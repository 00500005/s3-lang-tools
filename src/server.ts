import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  TextDocumentSyncKind,
  TextDocumentsConfiguration,
  NotificationType,
  DidChangeTextDocumentNotification,
  DidOpenTextDocumentNotification,
  DidCloseTextDocumentNotification,
  DidSaveTextDocumentNotification,
  DidChangeWatchedFilesNotification,
  DidChangeWorkspaceFoldersNotification,
  TextDocumentChangeRegistrationOptions,
  TextDocumentRegistrationOptions,
  DidChangeWatchedFilesRegistrationOptions,
  FileSystemWatcher
} from 'vscode-languageserver';
import { VsSugarcubeParser, SugarcubeDoc } from './api';
import { TaskQueue } from './manager';

let connection = createConnection(ProposedFeatures.all);
let taskQueue : TaskQueue, parser : VsSugarcubeParser;

let documents: TextDocuments<SugarcubeDoc> = new TextDocuments(SugarcubeDoc);

function refreshGlobals() {
  /** @todo provide options */
  taskQueue = new TaskQueue(connection)
  parser = new VsSugarcubeParser(connection, taskQueue);
}
connection.onInitialize((params: InitializeParams) => {
  /** @note consider moving to initialized */
  refreshGlobals()
  return {
    capabilities: {
      textDocumentSync: {
        openClose: true,
        save: { includeText: true },
        change: TextDocumentSyncKind.Full,
      }
    }
  };
});
connection.onInitialized(() => {
  const documentSelector = [{
    language: "sugarcube2",
  }]
  /**
   * Some notes
   * documents provides a middleware, so when it is provided we do *not* get the DidOpenTextDocumentNotification
   * Instead, we will get documents.DidOpen
   *
   * However, for some reason, documents does not correctly register itself and requires some notification registration
   * It's still unclear if there is diminished functionality by only registering a subset of notifications
   */
  documents.listen(connection);
  connection.client.register(DidOpenTextDocumentNotification.type, <TextDocumentRegistrationOptions>{ documentSelector })
  connection.client.register(DidChangeTextDocumentNotification.type, <TextDocumentChangeRegistrationOptions>{
    syncKind: TextDocumentSyncKind.Full,
    documentSelector
  });
  // connection.client.register(DidCloseTextDocumentNotification.type, <TextDocumentRegistrationOptions>{ documentSelector })
  // connection.client.register(DidSaveTextDocumentNotification.type, <TextDocumentRegistrationOptions>{ documentSelector })
  // connection.client.register(DidChangeWorkspaceFoldersNotification.type)

  // const watchers = [
  // 	<FileSystemWatcher>{ globPattern: "**/*.{tw,twee}" }
  // ]
  // connection.client.register(DidChangeWatchedFilesNotification.type, <DidChangeWatchedFilesRegistrationOptions>{ watchers })
})

documents.onDidOpen((params) => {
  parser.queueTask(params.document)
});
documents.onDidChangeContent((params) => {
  parser.queueTask(params.document)
});

connection.listen();
