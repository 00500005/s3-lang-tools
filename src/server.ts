import {
  createConnection,
  ProposedFeatures,
  InitializeParams,
  TextDocumentSyncKind,
  DidChangeTextDocumentNotification,
  DidOpenTextDocumentNotification,
  DidCloseTextDocumentNotification,
} from 'vscode-languageserver';
import { VsSugarcubeParser, ManagedSugarcubeDoc } from './api';
import { TaskQueue } from './manager';
import { DebugConsole } from './config/log';

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

connection.onInitialize((params: InitializeParams) => {
  return {
    capabilities: {
      textDocumentSync: {
        openClose: true,
        change: TextDocumentSyncKind.Incremental,
      }
    }
  };
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
})

connection.onDidOpenTextDocument(async params => {
  const doc = docs.open(params.textDocument);
  debugConsole.trace(`Opening ${doc.name}`)
});
connection.onDidChangeTextDocument(async params => {
  docs.change(params.textDocument, params.contentChanges);
});
connection.onDidCloseTextDocument(async params => {
  docs.close(params.textDocument)
});


connection.listen();
