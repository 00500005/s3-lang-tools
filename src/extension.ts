import * as path from 'path';
import { workspace, ExtensionContext, Uri } from 'vscode';

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient';

// Node: most of this code taken directly from vscode-extension-samples/lsp-sample

let client: LanguageClient;

export function activate(context: ExtensionContext) {
  // Create the language client and start the client.
  client = new LanguageClient(
    'sugarcube2_lang_server',
    'sugarcube2 language server',
    serverOptions(context),
    clientOptions()
  );

  // Start the client. This will also launch the server
  client.start();
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}

function serverOptions(context: ExtensionContext) : ServerOptions {
  // The server is implemented in node
  let module = context.asAbsolutePath(
    path.join('dist', 'server.js')
  );
  // The debug options for the server
  // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
  let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };
  let defaultArgs = ['--enable-source-maps']

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  let serverOptions: ServerOptions = {
    run: { module, transport: TransportKind.ipc, args: defaultArgs,  },
    debug: {
      module,
      transport: TransportKind.ipc,
      args: defaultArgs,
      options: debugOptions
    }
  };
  return serverOptions;
}

function clientOptions() : LanguageClientOptions {
  // Options to control the language client
  let clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'sugarcube2', pattern: '*.{tw,twee}' }],
    synchronize: {
      // Notify the server about file changes to '.clientrc files contained in the workspace
      fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
    },
  };
  return clientOptions;
}
