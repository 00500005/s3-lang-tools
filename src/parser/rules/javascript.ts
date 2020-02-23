
import { Parser, Source, Token, EndIndex, StartIndex, Yield, Macro, Variable, Err, Twinemarkup, Content } from '../types';
import { scanners, handleDoubleQuote, handleSingleQuote, whitespace, maybeTwinemarkup } from './scanners.util';
import { StickyRegex } from './util';

export type State = Yield.Javascript.State;
export const State = Yield.Javascript.State;
export type TokenType = Macro.Token;
export const TokenType = Macro.TokenType;
export type Type = Macro.Type;
export const Type = Macro.Type;

export function tokenBuilder(
  source : Source,
  state : State,
  tokens : Token[],
  startIndex : StartIndex,
  endIndex : EndIndex,
) : Parser.TokenBuilderResult<TokenType> { 
  const token = Macro.builder()
    .setMacroType(Type.JAVASCRIPT)
    .setMacroName('script')
    .setStartIndex(startIndex)
    .setEndIndex(endIndex)
    .addContent(...tokens)
    .build()
  return {
    result: token
  }
}

const endToken = new StickyRegex(/<<\/\s*script\s*>>/y);
const contentMatcher = new StickyRegex(/[^"'<]+/y);
const { content } = scanners(contentMatcher);
export function runner(
  source : Source, 
  state : State,
  lastRule : Yield.Generic,
) : Yield.Generic {
  const currentIndex = lastRule.lastIndex + 1;
  switch(source[currentIndex]) {
    case '"':
      return handleDoubleQuote(source, currentIndex + 1)
    case "'":
      return handleSingleQuote(source, currentIndex + 1)
    case "<":
      const endTokenIndex = endToken.getEndIndex(source, currentIndex);
      if (endTokenIndex) {
        return Yield.pop()
          .setLastIndex(endTokenIndex)
          .build()
      }
      // else fall through to default
    default:
      return content(source, currentIndex, currentIndex + 1);
  }
  throw Err.unexpected({ source, lastRule, state });
}

export function unexpectedEnd(startIndex : StartIndex) {
  return Err.unrecoverable(Err.Type.UnclosedJavascript, startIndex);
}

export const Definition : Parser.Definition<State, TokenType> = {
    type : Yield.Macro.Type,
    runner,
    tokenBuilder,
}
