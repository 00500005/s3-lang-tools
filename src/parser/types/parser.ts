import { cloneDeep } from "lodash";
import { StartIndex, EndIndex, Token, Checkpointable, Position } from "./common";
import { Err } from "./errors";
import * as Rules from "./rules";
import { StatementToken } from "./AST";

export namespace Parser {
  export interface TokenBuilderResult<T extends Token> {
    result : T | Err.ParserError | undefined,
    errors ?: Err.TokenError[]
  }
  export type GenericTokenBuilderResult = TokenBuilderResult<Token>;
  export type GenericDefinition = Definition<Rules.GenericState, Token>;
  export type GenericTokenBuilder = TokenBuilder<Rules.GenericState, Token>;
  export type RuleType = Rules.Type;
  export const RuleType = Rules.Type;
  export interface Definition<
    STATE extends Rules.State<STATE>, 
    T extends Token
  > {
    type : Rules.Type,
    runner : Runner<STATE>,
    tokenBuilder : TokenBuilder<STATE, T>,
  }
  export type StateConstructor<STATE extends Rules.State<STATE>> = () => STATE;
  export type TokenBuilder<STATE extends Rules.State<STATE>, T extends Token> = (
    source : Source,
    state : STATE, 
    tokens : Token[],
    startIndex : StartIndex,
    endIndex : EndIndex,
  ) => TokenBuilderResult<T>;
  export type Runner<STATE extends Rules.State<STATE>> = (
    source : Source, 
    ruleState : STATE,
    lastYield : Rules.YieldInstance,
  ) => Rules.YieldInstance
  export type GenericRunner = Runner<Rules.GenericState>;
  export interface Completion extends Rules.YieldPop {
    token: Token
  }
  export type Source = string;
  export type Engine = (input : EngineInput) => EngineOutput;
  export class Frame {
    constructor(state : Rules.GenericState, startIndex : number, tokenBuffer ?: Token[]) {
      this.state = state;
      this.startIndex = startIndex;
      this.tokenBuffer = tokenBuffer ? tokenBuffer : [];
    }
    state : Rules.GenericState;
    startIndex : number;
    tokenBuffer : Token[];
    snapshot() : Frame {
      return new Frame(this.state.clone(), this.startIndex, cloneDeep(this.tokenBuffer));
    }
  }
  export interface EngineInput {
    source: Source,
    stack: Frame[],
    lastYield: Rules.YieldInstance,
  }
  export interface EngineOutput {
    stack: Frame[],
    nextYield: Rules.YieldInstance,
  }
  export interface SourceIndex {
    getPositionFromOffset(offset: number) : Position;
    getOffsetFromPosition(position: Position) : number;
  }
  export interface CumulativeSourceIndex extends SourceIndex, Checkpointable<CumulativeSourceIndex> {
    currentMaxScan() : number;
    scanTo(offset: number) : void;
    finish() : SourceIndex;
    clone() : CumulativeSourceIndex;
  }
  export interface ParserState extends Checkpointable<ParserState> {
    ruleStack : Rules.GenericState[],
    sourceIndex : CumulativeSourceIndex,
  }
  export interface Parser {
    step(state: ParserState, outputBuffer : EngineOutput) : void;
    nextToken(state: ParserState, outputBuffer : EngineOutput) : void;
  }
  export interface Document {
    tokenAt(offset: number | Position) : Token;
    errorList() : Err.KnownError[];
  }
  export interface DocumentChange {
    startOffset : number,
    endOffset : number,
    modifiedText : string,
  }
  export interface ParserManager extends Parser {
    initialize(document : string) : StatementToken[];
    // will only emit tokens starting from the first resumed statement, until the final new token
    resume(change: DocumentChange) : StatementToken[];
    index() : SourceIndex;
  }
  export interface LivingDocument extends Document {
    initialize(document : string) : void;
    // will only emit tokens starting from the first resumed statement, until the final new token
    resume(change: DocumentChange) : void;
  }
}
