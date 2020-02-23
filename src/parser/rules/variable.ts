
import { Parser, Source, Token, EndIndex, StartIndex, Yield, Macro, Variable, Err, Twinemarkup, Content, Twinescript } from '../types';
import { scanners, handleDoubleQuote, handleSingleQuote, whitespace, maybeTwinemarkup } from './scanners.util';
import { StickyRegex } from './util';

export type State = Yield.Variable.State;
export const State = Yield.Variable.State;
export type TokenType = Variable.Token;
export const TokenType = Variable.TokenType;
export type VariableType = Yield.Variable.VariableType;
export const VariableType = Yield.Variable.VariableType;

export function tokenBuilder(
  source : Source,
  state : State,
  tokens : Token[],
  startIndex : StartIndex,
  endIndex : EndIndex,
) : Parser.TokenBuilderResult<TokenType> { 
  return {
    result: Variable.builder(state.variableType)
      .setStartIndex(startIndex)
      .setEndIndex(endIndex)
      .addVariableNameParts(...tokens)
      .build()
  }
  return <Parser.TokenBuilderResult<TokenType>><any>null;
}
const variableNameMatcher = new StickyRegex(/[A-Za-z$_][A-Za-z0-9$_]*/y);
const {
    content
// Note: whitespace is *not* considered content inside of variables
// arg tokens will be whitespace delimited
} = scanners(variableNameMatcher);
export function runner(
  source : Source, 
  state : State,
  lastRule : Yield.Generic,
) : Yield.Generic {
  const rawFirstIndex = lastRule.lastIndex + 1;
  const firstNonwhitespaceIndex = whitespace.getNextStart(source, rawFirstIndex) || rawFirstIndex;
  let endOfNameIndex = variableNameMatcher.getEndIndex(source, firstNonwhitespaceIndex);
  if (endOfNameIndex) {
    state.dot = false;
    const afterNameAndWhitespace = whitespace.getNextStart(source, endOfNameIndex + 1) || endOfNameIndex + 1;
    switch(source[afterNameAndWhitespace]) {
      case '[':
        return Yield.push()
          .setNewState(Yield.Twinescript.State.create(Yield.Twinescript.EndMode.INDEX))
          .setLastIndex(afterNameAndWhitespace)
          .buildContentToken()
            .setEndIndex(endOfNameIndex)
            .setStartIndex(firstNonwhitespaceIndex)
            .getParent()
          .build();
      case '.':
        state.dot = true;
        return Yield.step()
          .setLastIndex(afterNameAndWhitespace)
          .buildContentToken()
            .setEndIndex(endOfNameIndex)
            .setStartIndex(firstNonwhitespaceIndex)
            .getParent()
          .build()
      default:
        return Yield.pop()
          .setLastIndex(afterNameAndWhitespace - 1)
          .buildContentToken()
            .setEndIndex(endOfNameIndex)
            .setStartIndex(firstNonwhitespaceIndex)
            .getParent()
          .build()
    }
  } else if (state.dot) {
    const errorToken = Content.builder()
      .setEndIndex(lastRule.lastIndex)
      .setStartIndex(lastRule.lastIndex)
      .build();
    return Yield.pop()
      .addErrors(Err.tokenError(Err.Type.InvalidOperation, errorToken))
      .setLastIndex(firstNonwhitespaceIndex - 1)
      .build();
  } else if (lastRule.token?.tokenType === Twinescript.TokenType) {
    if (source[firstNonwhitespaceIndex] === '.') {
      state.dot = true;
      return Yield.step().setLastIndex(firstNonwhitespaceIndex).build();
    }
    return Yield.pop().setLastIndex(firstNonwhitespaceIndex - 1).build();
  } else {
    // invalid entrance into the variable rule
    throw Err.unexpected({ state, lastRule, source });
  }
}

export const Definition : Parser.Definition<State, TokenType> = {
    type : Yield.Macro.Type,
    runner,
    tokenBuilder,
}
