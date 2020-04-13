import { WorkDoneProgressReport, Connection, VersionedTextDocumentIdentifier, TextDocumentItem, Diagnostic, WorkDoneProgressEnd, WorkDoneProgress, WorkDoneProgressBegin, TextDocumentContentChangeEvent, Range, TextDocumentIdentifier } from "vscode-languageserver";
import { VsSugarcubeParser } from "./parse";
import { TaskQueue, CallbackResult, ProgressOptions } from "../manager";
import { ManagedSugarcubeDocData, TextDocumentGroupUpdate, ParseTaskState, ParseTaskQueued, ParseTaskComplete, ParseTaskRunning, TaskState, ParseTaskNew } from "./doc-types";
import { fileURLToPath } from "url";
import { basename } from "path";
import { nanoid } from "nanoid/non-secure";
import { DebugConsole } from "../config/log";
import { Main, SourceIndex } from "../parser";
import { CumulativeSourceIndex } from "../parser/source-index";

export interface DocumentChange {
  /**
   * The range of the document that changed.
   */
  range: Range;
  /**
   * The new text for the provided range.
   */
  text: string;
}

export class ManagedSugarcubeDoc {
  connection: Connection;
  debugConsole: DebugConsole;
  parser: VsSugarcubeParser;
  taskQueue: TaskQueue;
  data: Record<string, ManagedSugarcubeDocData> = {};
  constructor(
    connection: Connection,
    debugConsole: DebugConsole,
    parser: VsSugarcubeParser,
    taskQueue: TaskQueue,
  ) {
    this.connection = connection;
    this.debugConsole = debugConsole;
    this.parser = parser;
    this.taskQueue = taskQueue;
  }
  raw(uri: string, text: string, groupInitializer?: TextDocumentGroupUpdate): ManagedSugarcubeDocData {
    this.queueVersion(uri, null, text, groupInitializer)
    return this.data[uri];
  }
  open(doc: TextDocumentItem, groupInitializer?: TextDocumentGroupUpdate): ManagedSugarcubeDocData {
    this.queueVersion(doc.uri, doc.version, doc.text, groupInitializer)
    return this.data[doc.uri];
  }
  isOpen(uri: string): boolean {
    return !!this.data[uri]
  }
  close(uri: string) {
    this.debugConsole.trace(`Closing ${uri}`);
    delete this.data[uri];
  }
  change(
    docId: VersionedTextDocumentIdentifier,
    changes: TextDocumentContentChangeEvent[]
  ): ParseTaskState | null {
    /** @todo */
    if (!docId.uri) {
      this.debugConsole.error(`Missing version number for ${JSON.stringify(docId)}.`
        + `\nAttempting to recover with invalid version number, but may lead to prograted errors`)
    }
    const useVersion = docId.version || 0;
    if (!(<DocumentChange>changes[0]).range) {
      if (changes.length > 1) {
        this.debugConsole.error(`Invalid change request. Got ${changes.length} that were not all patches`)
      }
      return this.queueVersion(docId.uri, useVersion, changes[0].text)
    } else {
      return this.queueUpdate(docId.uri, useVersion, <DocumentChange[]>changes);
    }
  }
  cancelAll(uri: string) {
    const data = this.data[uri];
    Object.keys(data.versions).forEach((version: any) => {
      const parseTask = <ParseTaskRunning | ParseTaskQueued>data.versions[version];
      const taskId = parseTask.taskId
      if (taskId) {
        this.taskQueue.cancel(taskId);
        parseTask.cancelled = true;
      }
    });
  }
  inventVersion(uri: string): number {
    const doc = this.data[uri];
    if (doc) {
      return -(doc.latestVersion + 1);
    } else {
      return -1;
    }
  }
  queueVersion(uri: string, rawVersion: number | null, text: string, groupInitializer?: TextDocumentGroupUpdate): ParseTaskState {
    const version: number = rawVersion === null ? this.inventVersion(uri) : rawVersion;
    const data = this.initializeIfMissing({ uri, version });
    this.debugConsole.throttledTrace(`manager.queue:${data.name}`)(`creating parse task (${text.length})`);
    // this.debugConsole.log(`${data.name}:${version}:\n"""${text}"""`);
    const parseTaskState: ParseTaskState = data.versions[version]
      || <ParseTaskNew>{
        type: TaskState.NEW,
        version, text
      };
    if (parseTaskState.type !== TaskState.NEW) {
      this.debugConsole.warn(`Ignoring queue request;`
        + ` Found existing state for ${data.name}@${version} =`
        + JSON.stringify(parseTaskState))
      return parseTaskState;
    } else {
      this.cancelAllButLatest(uri);
    }
    const progressToken = groupInitializer
      ? groupInitializer.progressToken
      : sendProgress(this.connection, progressBegin(`Parsing ${data.name}`, `Parse`));
    data.versions[version] = parseTaskState;
    this.manageLatestVersion(data, version);
    (<ParseTaskQueued>parseTaskState).taskId = this.taskQueue.queueTask({
      progressToken, callback: this.createParseProgressCallback(
        data,
        version,
        text,
        parseTaskState,
        groupInitializer
      )
    })
    return parseTaskState;
  }
  queueUpdate(
    uri: string,
    version: number,
    changes: DocumentChange[]
  ): ParseTaskState | null {
    const data = this.data[uri];
    if (!data) {
      this.debugConsole.error(`Aborting change application.`
        + ` Attempting to apply changes to file that isn't open: ${uri}`)
      return null;
    }
    const latestVersion = data.versions[data.latestVersion];
    if (!latestVersion) {
      this.debugConsole.error(
        `Invalid configuration, missing latest version ${data.latestVersion} for ${data.uri}`
        + `\navailable versions: ${JSON.stringify(Object.keys(data.versions))}`
      )
    }
    if (!latestVersion.sourceIndex) {
      latestVersion.sourceIndex = new CumulativeSourceIndex(latestVersion.text).finish()
    }
    const text = applyChangesToText(this.debugConsole, latestVersion.text, latestVersion.sourceIndex, changes);
    return this.queueVersion(uri, version, text)
  }

  private cancelAllButLatest(uri: string) {
    const data = this.data[uri];
    const allVersions = Object.keys(data.versions).filter(v => v !== data.latestVersion.toString());
    this.cancelVersions(uri, allVersions)
  }
  private cancelVersions(uri: string, versions: any[]) {
    const data = this.data[uri];
    this.debugConsole.throttledTrace(`manager.cancel:${data.name}`)(`cancelling versions: ${JSON.stringify(versions)}`);
    versions.forEach((version: any) => {
      const parseTask = <ParseTaskRunning | ParseTaskQueued>data.versions[version];
      const taskId = parseTask.taskId
      if (taskId) {
        this.taskQueue.cancel(taskId);
        parseTask.cancelled = true;
      }
    });
  }
  private initializeIfMissing(docId: { uri: string, version: number }) {
    const data = this.data[docId.uri];
    if (!this.data[docId.uri]) {
      const filename = fileURLToPath(docId.uri);
      return this.data[docId.uri] = {
        uri: docId.uri,
        name: basename(filename),
        filename,
        latestVersion: docId.version,
        versions: {}
      }
    } else {
      return data;
    }
  }
  private manageLatestSuccess(data: ManagedSugarcubeDocData, version: number, ast: Main.Token | null) {
    if (ast) {
      if (data.lastSuccessVersion) {
        this.debugConsole.trace(`cleaning up version ${data.lastSuccessVersion}`)
        delete data.versions[data.lastSuccessVersion]
      }
      data.lastSuccessVersion = version
      this.debugConsole.trace(`latest successful version is now ${data.lastSuccessVersion}`)
    }
  }
  private manageLatestVersion(data: ManagedSugarcubeDocData, version: number) {
    if (data.latestVersion !== data.lastSuccessVersion && data.latestVersion !== version) {
      this.debugConsole.trace(`cleaning up version ${data.latestVersion}`)
      delete data.versions[data.latestVersion]
    }
    if (data.latestVersion > version) {
      this.debugConsole.error(
        `Unexpected document version ${version}.`
        + ` Latest was ${data.latestVersion} and still had versions ${Object.keys(data.versions)} cached.`
        + ` Expected a larger version number than ${data.latestVersion}`
      )
    }
    data.latestVersion = version
    this.debugConsole.trace(`latest version is now ${data.latestVersion}`)
  }
  private createParseProgressCallback(
    data: ManagedSugarcubeDocData,
    version: number,
    text: string,
    parseTaskState: ParseTaskState,
    groupInitializer?: TextDocumentGroupUpdate
  ): (options: ProgressOptions) => CallbackResult {
    const docName = groupInitializer
      ? `${data.name} (${groupInitializer.id}/${groupInitializer.count})`
      : data.name;
    const parseIterator = this.parser.parse(data.uri, text)

    return (options: ProgressOptions) => {
      parseTaskState.type = TaskState.RUNNING
      const parseResult = parseIterator.next(options);
      if (parseResult.done) {
        if (!parseResult.value[1]) {
          this.debugConsole.error(
            `Invalid parsing result ${JSON.stringify(parseResult.value[1])}.`
            + ` Expected an AST and list of diagnostics`)
        } else {
          parseTaskState.type = TaskState.COMPLETE;
          (<ParseTaskComplete>parseTaskState).ast = parseResult.value[1].root;
          delete (<ParseTaskRunning>parseTaskState).taskId;
          sendDiagnostics(this.connection, data.uri, parseResult.value[1].diagnostics)
          this.manageLatestSuccess(data, version, parseResult.value[1].root);
        }
      }
      return <IteratorResult<
        () => WorkDoneProgressReport,
        () => WorkDoneProgressReport | WorkDoneProgressEnd
      >>{
          done: parseResult.done,
          value: () => (
            !groupInitializer
            || groupInitializer.count !== groupInitializer.id
          ) ? progressReport(
            text.length, parseResult.value[0].lastYield.lastIndex, `Parsing ${docName}`
          ) : progressEnd(`Parsing complete ${docName}`)
        }
    }
  }
}
// utils
export function applyChangesToText(debugLog: DebugConsole, text: string, sourceIndex: SourceIndex, changes: DocumentChange[]) {
  const orderedChanges = changes.map(change => ({
    text: change.text,
    start: sourceIndex.getOffsetFromPosition(change.range.start),
    end: sourceIndex.getOffsetFromPosition(change.range.end)
  })).sort((a, b) => {
    return a.start - b.start
  });
  const updatedText = orderedChanges.reduce((acc: [string[], number], change) => {
    const [tokens, startIndex] = acc;
    const text = tokens.pop()!;
    const before = text.slice(0, change.start - startIndex);
    const after = text.slice(change.end - startIndex);
    tokens.push(before)
    tokens.push(change.text)
    tokens.push(after)
    return <[string[], number]>[tokens, change.end];
  }, [[text], 0])[0].join('');
  return updatedText;
}
function sendDiagnostics(connection: Connection, uri: string, diagnostics: Diagnostic[]) {
  connection.sendDiagnostics({
    uri,
    diagnostics
  });
}
function sendProgress(
  connection: Connection,
  progress: WorkDoneProgressBegin | WorkDoneProgressReport | WorkDoneProgressEnd
): string {
  const progressToken = nanoid()
  connection.sendProgress(WorkDoneProgress.type, progressToken, progress)
  return progressToken
}
function progressBegin(
  message: string,
  title: string,
  cancellable?: boolean,
): WorkDoneProgressBegin {
  return <WorkDoneProgressBegin>{
    title,
    message,
    cancellable: cancellable === undefined ? true : cancellable,
  }
}
function progressReport(length: number, currentOffset: number, message?: string): WorkDoneProgressReport {
  const percentage = currentOffset / length * 100;
  return <WorkDoneProgressReport>{
    message,
    percentage
  };
}
function progressEnd(message: string): WorkDoneProgressEnd {
  return <WorkDoneProgressEnd>{ message }
}
