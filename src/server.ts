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
import { TextDocumentContentChangeEvent } from 'vscode-languageserver-textdocument';
import { VsSugarcubeParser } from './api';

console.log('attempting to start custom lang server')

let connection = createConnection(ProposedFeatures.all);

class SugarcubeDoc {
	uri : string;
	version : number;
	content: string;
	constructor(uri : string, version : number, content : string) {
		this.uri = uri;
		this.version = version;
		this.content = content;
	}
	static create(uri: string, languageId: string, version: number, content: string): SugarcubeDoc {
		console.log('getting create request', arguments);
		return new SugarcubeDoc(uri, version, content);
	}
	static update(document: SugarcubeDoc, changes: TextDocumentContentChangeEvent[], version: number): SugarcubeDoc {
		document.content = changes[0].text;
		return document;
	}
}

let documents: TextDocuments<SugarcubeDoc> = new TextDocuments(SugarcubeDoc);

let parser : VsSugarcubeParser;

connection.onInitialize((params: InitializeParams) => {
	console.log('initializing server')
	console.log(`initializing server: ${JSON.stringify(params)}`);
	parser = new VsSugarcubeParser();
	console.log('initialization continuing')
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
    language: "SugarCube 2",
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
	// const watchers = [
	// 	<FileSystemWatcher>{ globPattern: "**/*.{tw,twee}" }
	// ]
	connection.client.register(DidChangeTextDocumentNotification.type, <TextDocumentChangeRegistrationOptions>{ 
		syncKind: TextDocumentSyncKind.Full,
		documentSelector
	});
	// connection.client.register(DidCloseTextDocumentNotification.type, <TextDocumentRegistrationOptions>{ documentSelector })
	// connection.client.register(DidSaveTextDocumentNotification.type, <TextDocumentRegistrationOptions>{ documentSelector })
	// connection.client.register(DidChangeWatchedFilesNotification.type, <DidChangeWatchedFilesRegistrationOptions>{ watchers })
	// connection.client.register(DidChangeWorkspaceFoldersNotification.type)
	console.log('registered various notification types');
	console.log(`Found ${documents.all().length} initial documents`);
})
connection.onNotification(function() {
	console.log('got notification', ...arguments);
})
connection.onDidChangeWatchedFiles(function() {
	console.log('got change watched files', ...arguments);
})
connection.onDidChangeConfiguration(function() {
	console.log('got change config', ...arguments);
})
// documents
documents.onDidClose(function() {
	console.log('got document close', ...arguments);
});
documents.onDidSave(function() {
	console.log('got document save', ...arguments);
});
documents.onWillSave(function() {
	console.log('got document will save', ...arguments);
});
// documents.onDidOpen((params) => {
// 	console.log(`${params.document.uri} opened.`);
// 	console.log(`Currently have ${documents.all().length} documents`);
// })
// documents.onDidChangeContent((params) => {
// 	console.log(`${params.document.uri} opened.`);
// 	console.log(`Currently have ${documents.all().length} documents`);
// });


documents.onDidOpen((params) => {
	console.log(`${params.document.uri} opened.`);
	console.log(`Currently have ${documents.all().length} documents`);
	const diagnostics = parser.diagnostics(params.document.uri, params.document.content)
	console.log(`Got ${diagnostics.length} diagnostics`);
	console.log(diagnostics);
	connection.sendDiagnostics({
		uri: params.document.uri,
		diagnostics
	});
});
documents.onDidChangeContent((params) => {
	console.log(`${params.document.uri} changed`);
	console.log(`Currently have ${documents.all().length} documents`);
	const diagnostics = parser.diagnostics(params.document.uri, params.document.content)
	console.log(`Got ${diagnostics.length} diagnostics`);
	console.log(diagnostics);
	connection.sendDiagnostics({
		uri: params.document.uri,
		diagnostics
	});
});

connection.listen();
