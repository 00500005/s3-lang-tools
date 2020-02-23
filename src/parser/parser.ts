import { parse as statelessParse } from './rules'
import { Parser as T, Yield, Token, Main, Err, Content, Position, StartIndex } from './types'
import { tokenBuilder as mainTokenBuilder} from './rules/main';
import { CumulativeSourceIndex } from './source-index';
import { unexpectedEnd as javascriptUnexpectedEnd } from './rules/javascript';
import { unexpectedEnd as twinescriptUnexpectedEnd } from './rules/twinescript';
import { unexpectedEnd as macroUnexpectedEnd } from './rules/macro';
import { unexpectedEnd as twinemarkupUnexpectedEnd } from './rules/twinemarkup';

export type UnexpectedEndConstructor = (startIndex : StartIndex, state : Partial<Yield.AnyState>) => Err.ParserError;
export const unexpectedEnds : Partial<Record<Yield.StateType, UnexpectedEndConstructor>> = {
  [Yield.Javascript.Type]: javascriptUnexpectedEnd,
  [Yield.Twinescript.Type]: twinescriptUnexpectedEnd,
  [Yield.Twinemarkup.Type]: twinemarkupUnexpectedEnd,
  [Yield.Macro.Type]: macroUnexpectedEnd,
}
export type ParseResult = Main.Token | Err.ParserError | undefined;
export class Parser {
  constructor() {
    this.stack = [new T.Frame(Yield.Main.State.create(), 0, [])];
    this.lastYield = Yield.START;
  }
  stack : T.Frame[]
  lastYield : Yield.Generic;
  sourceIndex ?: T.CumulativeSourceIndex;
  *parseIter(source : string) : Generator<Err.TokenError[], Main.Token | Err.ParserError | undefined, void> {
    this.sourceIndex = new CumulativeSourceIndex(source);
    if (!source) { 
      // nothing to do, but we allow attempting to parse empty files
      return Main.builder().setStartIndex(0).setEndIndex(0).build();
    }
    let nextResult = statelessParse({ source, stack: this.stack, lastYield: this.lastYield })
    while (nextResult.nextYield.lastIndex < source.length - 1 && nextResult.nextYield.type !== Yield.Unrecoverable) {
      if (nextResult.nextYield.errors && nextResult.nextYield.errors.length) { yield nextResult.nextYield.errors }
      nextResult = statelessParse({ source, stack: nextResult.stack, lastYield: nextResult.nextYield })
      this.sourceIndex.scanTo(nextResult.nextYield.lastIndex);
      // for introspection
      this.lastYield = nextResult.nextYield;
      this.stack = nextResult.stack;
    }
    if (!nextResult || !nextResult.nextYield || !nextResult.stack || nextResult.stack.length <= 0) {
      throw Err.unexpected({ source })
    }
    if (nextResult.nextYield.type === Yield.Unrecoverable) {
      return (<Yield.Unrecoverable>nextResult.nextYield).criticalError;
    }
    if (nextResult.stack.length > 1) {
      const currentFrame = nextResult.stack[nextResult.stack.length - 1];
      if (unexpectedEnds[currentFrame.state.type]) {
        return unexpectedEnds[currentFrame.state.type]!(currentFrame.startIndex, <any>currentFrame.state || {})
      }
      return Err.unrecoverable(Err.Type.UnrecoverableParserError, currentFrame.startIndex, {
        message: `Invalid ending mode stack. frame dump:\n${JSON.stringify(nextResult.stack.slice(1).reverse(), undefined, '  ')}`
      });
    }
    return mainTokenBuilder(source, nextResult.stack[0].state, nextResult.stack[0].tokenBuffer, 0, nextResult.nextYield.lastIndex)?.result;
  }
  parse(source : string) : [Err.TokenError[], T.SourceIndex, ParseResult] {
    let errors : Err.TokenError[] = [];
    const iter = this.parseIter(source);
    let r : IteratorResult<Err.TokenError[], ParseResult>;
    while(!(r = iter.next()).done) {
      errors = [...errors, ...(<Err.TokenError[]>r.value)];
    }
    return [errors, this!.sourceIndex!.finish(), <ParseResult>r.value]
  }
}
export type SourceIndex = T.SourceIndex;
