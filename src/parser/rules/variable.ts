
import { Content, EndIndex, Err, Parser, Source, StartIndex, Token, Twinescript, Variable, Yield } from '../types';
import { scanners, whitespace } from './scanners.util';
import { StickyRegex } from './util';

export type State = Yield.Variable.State;
export const State = Yield.Variable.State;
export type TokenType = Variable.Token;
export const TokenType = Variable.TokenType;
export type VariableType = Yield.Variable.VariableType;
export const VariableType = Yield.Variable.VariableType;

export function tokenBuilder(
  source: Source,
  state: State,
  tokens: Token[],
  startIndex: StartIndex,
  endIndex: EndIndex,
): Parser.TokenBuilderResult<TokenType> {
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
const allowedAfterDot = new StickyRegex(/[A-Za-z$_]/y);
const {
  content
  // Note: whitespace is *not* considered content inside of variables
  // arg tokens will be whitespace delimited
} = scanners(variableNameMatcher);
export function runner(
  source: Source,
  state: State,
  lastRule: Yield.Generic,
): Yield.Generic {
  /**
   * NOTE: as this is a raw variable that may be in mixed content,
   * whitespace is not allowed between tokens
   */
  const firstIndex = lastRule.lastIndex + 1;
  let endOfNameIndex = variableNameMatcher.getEndIndex(source, firstIndex);
  if (endOfNameIndex) {
    state.dot = false;
    const afterName = whitespace.getNextStart(source, endOfNameIndex + 1) || endOfNameIndex + 1;
    switch (source[afterName]) {
      case '[':
        return Yield.push()
          .setNewState(Yield.Twinescript.State.create(Yield.Twinescript.EndMode.INDEX))
          .setLastIndex(afterName)
          .buildContentToken()
          .setEndIndex(endOfNameIndex)
          .setStartIndex(firstIndex)
          .getParent()
          .build();
      case '.':
        const hasNextMatch = allowedAfterDot.matchExists(source, afterName + 1);
        if (hasNextMatch) {
          state.dot = true;
          return Yield.step()
            .setLastIndex(afterName)
            .buildContentToken()
            .setEndIndex(endOfNameIndex)
            .setStartIndex(firstIndex)
            .getParent()
            .build()
        }
      // else fall through
      default:
        return Yield.pop()
          .setLastIndex(afterName - 1)
          .buildContentToken()
          .setEndIndex(endOfNameIndex)
          .setStartIndex(firstIndex)
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
      .setLastIndex(firstIndex - 1)
      .build();
  } else if (lastRule.token?.tokenType === Twinescript.TokenType) {
    if (source[firstIndex] === '.') {
      state.dot = true;
      return Yield.step().setLastIndex(firstIndex).build();
    }
    return Yield.pop().setLastIndex(firstIndex - 1).build();
  } else {
    // invalid entrance into the variable rule
    throw Err.unexpected({ state, lastRule, source });
  }
}

export const Definition: Parser.Definition<State, TokenType> = {
  type: Yield.Macro.Type,
  runner,
  tokenBuilder,
}
