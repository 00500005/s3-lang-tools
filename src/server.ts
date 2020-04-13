import {
  createConnection,
  ProposedFeatures,
  InitializeParams,
  TextDocumentSyncKind,
  DidChangeTextDocumentNotification,
  DidOpenTextDocumentNotification,
  DidCloseTextDocumentNotification,
  InitializeResult,
  DidChangeWatchedFilesNotification,
  WorkDoneProgressBegin,
  WorkDoneProgress,
  FileChangeType,
} from 'vscode-languageserver';
import { VsSugarcubeParser, ManagedSugarcubeDoc } from './api';
import { TaskQueue } from './manager';
import { DebugConsole } from './config/log';
import { queueFiles, filesFromRoot, readFileAsync } from './manager/file-scanner';
import { nanoid } from 'nanoid/non-secure';

let connection = createConnection(ProposedFeatures.all);
const debugConsole = DebugConsole.extend(connection.console);
const taskQueue = new TaskQueue(connection, debugConsole);
const parser = new VsSugarcubeParser(connection, debugConsole, taskQueue)
const docs = new ManagedSugarcubeDoc(
  connection,
  debugConsole,
  parser,
  taskQueue
);

connection.onInitialize(async (params: InitializeParams): Promise<InitializeResult> => {
  const results: InitializeResult = {
    capabilities: {
      textDocumentSync: {
        openClose: true,
        change: TextDocumentSyncKind.Incremental,
      }
    }
  };
  if (params.rootPath) {
    const files = await filesFromRoot(params.rootPath);
    if (files.length) {
      const progressToken = nanoid();
      connection.sendProgress(WorkDoneProgress.type, progressToken, <WorkDoneProgressBegin>{
        title: 'Scanning workspace files'
      })
      await queueFiles(debugConsole, docs, progressToken, files)
      debugConsole.log(`Scanning ${files.length} files on load`)
    }
  }
  return results;
});
connection.onInitialized(() => {
  const documentSelector = [{
    language: "sugarcube2",
  }]
  connection.client.register(DidOpenTextDocumentNotification.type, {
    documentSelector
  });
  connection.client.register(DidChangeTextDocumentNotification.type, {
    syncKind: TextDocumentSyncKind.Incremental,
    documentSelector
  });
  connection.client.register(DidCloseTextDocumentNotification.type, {
    documentSelector
  });
  connection.client.register(DidChangeWatchedFilesNotification.type, {
    watchers: [{ globPattern: '**/*.{tw,twee}' }]
  });
});
connection.onDidChangeWatchedFiles(async params => {
  const deletedFiles = params.changes.filter(p => p.type === FileChangeType.Deleted).map(p => p.uri)
  const updatedFiles = params.changes
    .filter(p => !docs.isOpen(p.uri))
    .filter(p => p.type !== FileChangeType.Deleted)
    .map(p => p.uri)
  if (deletedFiles.length) {
    deletedFiles.forEach(uri => docs.close(uri))
  }
  if (updatedFiles.length) {
    const progressToken = nanoid();
    connection.sendProgress(WorkDoneProgress.type, progressToken, <WorkDoneProgressBegin>{
      title: 'Scanning workspace files'
    })
    await queueFiles(debugConsole, docs, progressToken, updatedFiles)
  }
  debugConsole.log(`Queued ${updatedFiles.length} file updates (for unopened files). Closed ${deletedFiles.length} files`)
});
connection.onDidOpenTextDocument(async params => {
  const doc = docs.open(params.textDocument);
  debugConsole.trace(`Opening ${doc.name}`)
});
connection.onDidChangeTextDocument(async params => {
  docs.change(params.textDocument, params.contentChanges);
});
connection.onDidCloseTextDocument(async params => {
  docs.close(params.textDocument.uri)
});


connection.listen();
