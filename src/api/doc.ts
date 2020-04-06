import { TextDocumentContentChangeEvent } from "vscode-languageserver-textdocument";

export class SugarcubeDoc {
  uri : string;
  version : number;
  content: string;
  constructor(uri : string, version : number, content : string) {
    this.uri = uri;
    this.version = version;
    this.content = content;
  }
  static create(uri: string, languageId: string, version: number, content: string): SugarcubeDoc {
    return new SugarcubeDoc(uri, version, content);
  }
  static update(document: SugarcubeDoc, changes: TextDocumentContentChangeEvent[], version: number): SugarcubeDoc {
    document.content = changes[0].text;
    return document;
  }
}
