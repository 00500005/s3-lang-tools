/**
 * Note, external users should prefer the facade in ./AST-builders
 */
import { Token } from "./common";

export { Token };
export enum TwinemarkupType {
  IMAGE="IMAGE",
  LINK="LINK"
}
export enum StringType {
  DOUBLE = '"',
  SINGLE = "'",
}
export enum MacroType {
  JAVASCRIPT = 'JAVASCRIPT',
  USER = 'USER',
  INVALID = "INVALID",
  END = "END"
}
export interface MainToken extends Token {
  chunks: StatementToken[]
}
export type StatementToken = ContentToken | PassageDefinitionToken | MacroToken | TwinemarkupToken | VariableToken | TwinescriptToken;
export interface ContentToken extends Token { }
export interface StringToken extends Token { 
  stringType: StringType,
}
export interface PassageDefinitionToken extends Token {
  name: string
}
export type MacroArgToken = TwinescriptToken | TwinemarkupToken | VariableToken | StringToken | ContentToken;
export interface MacroToken extends Token { 
  macroType: MacroType,
  name: string,
  args: MacroArgToken[],
  content: StatementToken[],
}
export interface TwinemarkupToken extends Token { 
  markupType: TwinemarkupType,
  link?: string,
  title?: string,
  setter?: TwinescriptToken,
  imagePath?: string,
}
export enum VariableType {
  LOCAL = "_",
  GLOBAL = "$",
}
export type VariableNamePartToken = TwinescriptToken | ContentToken;
export interface VariableToken extends Token { 
  variableType: VariableType,
  variablePath: VariableNamePartToken[],
}
export type TwinescriptContentToken = VariableToken | TwinemarkupToken | TwinescriptToken | StringToken | ContentToken;
export interface TwinescriptToken extends Token { 
  content: TwinescriptContentToken[]
}
