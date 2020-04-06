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
export type ParseYield = [SourceIndex, Err.TokenError[]];
export type ParseReturn = [SourceIndex, Main.Token | Err.ParserError];
export class Parser {
  constructor() {
    this.stack = [new T.Frame(Yield.Main.State.create(), 0, [])];
    this.lastYield = Yield.START;
  }
  stack : T.Frame[]
  lastYield : Yield.Generic;
  sourceIndex ?: T.CumulativeSourceIndex;
  *parseIter(source : string) : Generator<
    ParseYield,
    ParseReturn,
    void
  > {
    this.sourceIndex = new CumulativeSourceIndex(source);
    let nextResult : T.EngineOutput = { stack: this.stack, nextYield: this.lastYield };
    do {
      nextResult = statelessParse({ source, stack: nextResult.stack, lastYield: nextResult.nextYield })
      this.sourceIndex.scanTo(nextResult.nextYield.lastIndex);
      if (nextResult.nextYield.errors && nextResult.nextYield.errors.length) {
        yield [this.sourceIndex, nextResult.nextYield.errors]
      }
      // for introspection
      this.lastYield = nextResult.nextYield;
      this.stack = nextResult.stack;
    }
    while (
      nextResult.nextYield.lastIndex < source.length - 1
      && nextResult.nextYield.type !== Yield.Unrecoverable
    )
    if (!nextResult || !nextResult.nextYield || !nextResult.stack || nextResult.stack.length <= 0) {
      throw Err.unexpected({ source })
    }
    if (nextResult.nextYield.type === Yield.Unrecoverable) {
      return <ParseReturn>[
        this.sourceIndex.finish(),
        (<Yield.Unrecoverable>nextResult.nextYield).criticalError
      ];
    }
    if (nextResult.stack.length > 1) {
      const currentFrame = nextResult.stack[nextResult.stack.length - 1];
      const stateBasedEnd = unexpectedEnds[currentFrame.state.type];
      let err;
      if (stateBasedEnd) {
        err = stateBasedEnd(currentFrame.startIndex, <any>currentFrame.state || {})
      } else {
        err = Err.unrecoverable(Err.Type.UnrecoverableParserError, currentFrame.startIndex, {
          message: `Invalid ending mode stack. frame dump:\n${JSON.stringify(nextResult.stack.slice(1).reverse(), undefined, '  ')}`
        });
      }
      return <ParseReturn>[
        this.sourceIndex.finish(),
        err
      ];
    }
    return <ParseReturn>[
      this.sourceIndex.finish(),
      mainTokenBuilder(
        source
        , nextResult.stack[0].state
        , nextResult.stack[0].tokenBuffer
        , 0
        , nextResult.nextYield.lastIndex
      )!.result
    ]
  }
}
export type SourceIndex = T.SourceIndex;
