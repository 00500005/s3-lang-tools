/**
 * Note, external users should prefer the facade in ./rule-builders
 */
import { Checkpointable, Token, Source, StartIndex, EndIndex } from "./common";
import { Err } from "./errors";

/* 
  Parser rules should have minimal state. 
  The *only* state information it contains should modify *how* the
  parser rule is run
  If the parser rule has any other information, consider refactoring
  ParserRule in general to accomidate it

  ParserRuleState be minimal as it will be copied and compared extensively,
  being the primary building block of checkpointed information
*/
export interface State<SELF extends State<SELF>> extends Checkpointable<SELF> {
  type : Type,
  equals(other: any) : boolean;
  // subclasses should also provide instead of a constructor
  // create(...args) : SELF;
}
export type GenericState = State<GenericState>;
export enum YieldType {
  POP = "POP",
  PUSH = "PUSH",
  GOTO = "GOTO",
  STEP = "STEP",
  UNRECOVERABLE = "UNRECOVERABLE",
  START = "START"
}
export interface YieldInstance {
  type : YieldType,
  lastIndex : number,
  token ?: Token,
  // Nontoken errors should be considered unrecoverable
  // and should use YieldUnrecoverable instead
  errors ?: Err.TokenError[],
}
export interface YieldPush extends YieldInstance {
  newState: GenericState
  newStateStartIndex?: StartIndex,
}
export interface YieldGoto extends YieldInstance {
  newState: GenericState,
  newStateStartIndex?: StartIndex,
}
export interface YieldPop extends YieldInstance {
}
export interface YieldStep extends YieldInstance {
  // Requires a token
  token : Token,
}
export interface YieldUnrecoverable extends YieldInstance {
  criticalError: Err.ParserError
}
export enum Type {
  Main = "Main",
  Macro = "Macro",
  Javascript = "RawJavascript",
  Twinescript = "Twinescript",
  Twinemarkup = "Twinemarkup",
  Variable = "NakedVariable",
}
