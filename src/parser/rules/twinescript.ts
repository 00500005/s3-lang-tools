
import { Parser, Source, Token, EndIndex, StartIndex, Yield, Macro, Variable, Err, Twinemarkup, Content, Twinescript } from '../types';
import { scanners, handleDoubleQuote, handleSingleQuote, whitespace, maybeTwinemarkup, maybeVariable } from './scanners.util';
import { StickyRegex } from './util';

export type State = Yield.Twinescript.State;
export const State = Yield.Twinescript.State;
export type TokenType = Twinescript.Token;
export const TokenType = Twinescript.TokenType;
export type EndMode = Yield.Twinescript.EndMode;
export const EndMode = Yield.Twinescript.EndMode;

export function tokenBuilder(
  source: Source,
  state: State,
  tokens: Token[],
  startIndex: StartIndex,
  endIndex: EndIndex,
): Parser.TokenBuilderResult<TokenType> {
  const token = Twinescript.builder()
    .setStartIndex(startIndex)
    .setEndIndex(endIndex)
    .addTwinescriptContent(...tokens)
    .build();
  /** @todo emit error if empty content */
  return {
    result: token
  }
}

const keywords: string[] = [
  '=',
  '\\+=',
  '-=',
  '\\*=',
  '/=',
  '%=',
  '\\*\\*=',
  '&=',
  '\\^=',
  '\\|=',
  '==',
  '!=',
  '===',
  '!==',
  '>',
  '>=',
  '<',
  '<=',
  '\\+',
  '-',
  '\\*',
  '/',
  '%',
  '\\+\\+',
  '--',
  '\\*\\*',
  '&',
  '\\|',
  '\\^',
  '~',
  '&&',
  '\\|\\|',
  '!',
  '\\?',
  '\\:',
  ',',
  ';',
  'var',
  'let',
  'const',
  'typeof',
  'instanceof',
  'in',
  'null',
  'undefined',
  'function',
  '=>',
  'void',
  'new',
  'class',
  '\\.\\.\\.',
  '\\.',
  'delete',
  'to',
  'eq',
  'gt',
  'gte',
  'lt',
  'lte',
].sort((a, b) => b.length - a.length);
const match = {
  javascriptId: new StickyRegex(/(?:[A-Za-z][A-Za-z0-9_$]*)/y),
  keyword: new StickyRegex(new RegExp([...keywords.map(s => `(?:${s})`)].join('|'), 'y')),
  unknownToken: new StickyRegex(/[^\s\]'"`]*/y),
  arrayEnd: new StickyRegex(/\]/y),
  objectEnd: new StickyRegex(/}/y),
  macroEnd: new StickyRegex(/>>/y),
  parenEnd: new StickyRegex(/\)/y),
  quoteEnd: new StickyRegex(/`/y),
  twinemarkupEnd: new StickyRegex(/]\s*]/y),
  number: new StickyRegex(/[0-9]+(?:.[0-9]+)?/y),
}

export function runner(
  source: Source,
  state: State,
  lastRule: Yield.Generic,
): Yield.Generic {
  const firstNonwhitespaceIndex = whitespace.getNextStart(source, lastRule.lastIndex + 1) || lastRule.lastIndex + 1;
  const endMatchIndex = getEndMatchIndex();
  if (endMatchIndex !== null) {
    return Yield.pop().setLastIndex(endMatchIndex).build();
  }
  let keywordIndex, javascriptIdentifierIndex;
  if ((keywordIndex = match.keyword.getEndIndex(source, firstNonwhitespaceIndex)) !== null) {
    return Yield.step()
      .setLastIndex(keywordIndex)
      .buildContentToken()
      .setStartIndex(firstNonwhitespaceIndex)
      .setEndIndex(keywordIndex)
      .getParent()
      .build()
  } else if (javascriptIdentifierIndex = match.javascriptId.getEndIndex(source, firstNonwhitespaceIndex)) {
    return Yield.step()
      .setLastIndex(javascriptIdentifierIndex)
      .buildContentToken()
      .setStartIndex(firstNonwhitespaceIndex)
      .setEndIndex(javascriptIdentifierIndex)
      .getParent()
      .build()
  } else {
    switch (source[firstNonwhitespaceIndex]) {
      case '[':
        const enterTwinemarkup = maybeTwinemarkup(source, firstNonwhitespaceIndex + 1);
        return enterTwinemarkup || reenterTwinescript(EndMode.ARRAY);
      case '(':
        return reenterTwinescript(EndMode.PAREN);
      case '{':
        return reenterTwinescript(EndMode.BRACE);
      case '"':
        return handleDoubleQuote(source, firstNonwhitespaceIndex + 1);
      case "'":
        return handleSingleQuote(source, firstNonwhitespaceIndex + 1);
      case '$':
        return variableOrContentChar(source, firstNonwhitespaceIndex + 1, Variable.Type.GLOBAL);
      case '_':
        return variableOrContentChar(source, firstNonwhitespaceIndex + 1, Variable.Type.LOCAL);
      default:
        let numberEndIndex, jsIdEndIndex;
        if (numberEndIndex = match.number.getEndIndex(source, firstNonwhitespaceIndex)) {
          return content(numberEndIndex)
        } else if (jsIdEndIndex = match.javascriptId.getEndIndex(source, firstNonwhitespaceIndex)) {
          return content(jsIdEndIndex)
        }
        return unexpectedToken(source, firstNonwhitespaceIndex);
    }
  }
  function content(endIndex: number): Yield.Step {
    const token = Content.builder()
      .setStartIndex(firstNonwhitespaceIndex)
      .setEndIndex(endIndex)
      .build();
    return Yield.step()
      .setLastIndex(firstNonwhitespaceIndex)
      .setToken(token)
      .build()
  }
  function variableOrContentChar(source: Source, firstNonwhitespaceIndex: EndIndex, variableType: Variable.Type): Yield.Generic {
    const yieldVar = maybeVariable(source, firstNonwhitespaceIndex, variableType);
    if (yieldVar) {
      return yieldVar;
    } else {
      return content(firstNonwhitespaceIndex);
    }
  }
  function unexpectedToken(source: Source, firstNonwhitespaceIndex: EndIndex): Yield.Step {
    const endOfUnknownTokenIndex = match.unknownToken.getEndIndex(source, firstNonwhitespaceIndex) || firstNonwhitespaceIndex;
    const token = Content.builder()
      .setStartIndex(firstNonwhitespaceIndex)
      .setEndIndex(endOfUnknownTokenIndex)
      .build()
    return Yield.step()
      .setLastIndex(endOfUnknownTokenIndex)
      .setToken(token)
      .addErrors(Err.tokenError(Err.Type.UnexpectedToken, token))
      .build()
  }
  function reenterTwinescript(endMode: EndMode): Yield.Push {
    return Yield.push()
      .setLastIndex(firstNonwhitespaceIndex)
      .setNewState(State.create(endMode))
      .build();
  }

  function getEndMatchIndex(): EndIndex | null {
    switch (state.endMode) {
      case EndMode.ARRAY:
      case EndMode.INDEX:
        return match.arrayEnd.getEndIndex(source, firstNonwhitespaceIndex);
      case EndMode.BRACE:
        return match.objectEnd.getEndIndex(source, firstNonwhitespaceIndex);
      case EndMode.MACROLIKE:
        return match.macroEnd.getEndIndex(source, firstNonwhitespaceIndex);
      case EndMode.PAREN:
        return match.parenEnd.getEndIndex(source, firstNonwhitespaceIndex);
      case EndMode.QUOTE:
        return match.quoteEnd.getEndIndex(source, firstNonwhitespaceIndex);
      case EndMode.TWINEMARKUP:
        return match.twinemarkupEnd.getEndIndex(source, firstNonwhitespaceIndex);
      default:
        throw Err.unexpected({ source, lastRule, state });
    }
  }
}

export function unexpectedEnd(startIndex: StartIndex, state: Partial<Yield.AnyState>) {
  return Err.unrecoverable(Err.Type.UnclosedTwinescript, startIndex, {
    message: `expected ${state.endMode} token`
  });
}

export const Definition: Parser.Definition<State, TokenType> = {
  type: Yield.Macro.Type,
  runner,
  tokenBuilder,
}
