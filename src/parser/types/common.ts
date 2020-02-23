/* High level definition of various types to be used throughout types */

/* 
  From vscode-language-server, but copied to be independent 
  line and character are indexed starting at 1

  Internally offset should be preferred
*/
export interface Position { line: number, character: number }

export interface Checkpointable<T> { clone() : T; }
export interface RangeLike {
  start: Position,
  end: Position
}
// semantic types to help clarify what type of index or numeric value should be passed
export type RawLength = number;
export type StartIndex = number;
export type EndIndex = number;

/**
 * We use the term index throughout to emphasize that all numeric
 * offsets are inclusive indicies.
 * 
 * For example, to slice (which has an exclusive end), you'd need to call
 * source.slice(startIndex, endIndex + 1)
 */
export interface RawRangeLike {
  startIndex: StartIndex,
  endIndex: EndIndex,
}

export enum TokenType {
  RawJavascript = "Script",
  Macro = "Macro",
  Twinescript = "Twinescript",
  Twinemarkup = "Twinemarkup",
  Variable = "Variable",
  PassageDefinition = "PassageDefinition",
  Content = "Content",
  Main = "Main",
  String = "String"
}

export interface Token extends RawRangeLike {
  // as child tokens are created first, parent must be assignable later
  tokenType: TokenType,
  parent?: Token,
}

export type Source = string;
