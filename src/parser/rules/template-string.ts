import { Content, Err, Parser, Source, Token, Twinescript, Yield } from '../types';
import { TwinescriptEndMode } from '../types/rule-states';
import { StickyRegex } from './util';

export type State = Yield.TemplateString.State;
export const State = Yield.TemplateString.State;
export function tokenBuilder(
  source: Source,
  _: Yield.Main.State,
  tokens: Token[],
  startIndex: number,
  endIndex: number,
): Parser.TokenBuilderResult<Twinescript.Token> {
  return {
    result: Twinescript.builder()
      .setStartIndex(startIndex)
      .setEndIndex(endIndex)
      .addTwinescriptContent(...reduceContentTokens(tokens))
      .build()
  }
}
const contentMatcher = new StickyRegex(/(?:[^`$]|(?:\\.))*/y);
export function runner(
  source: Source,
  _: Yield.TemplateString.State,
  lastRule: Yield.Generic,
): Yield.Generic {
  const { lastIndex } = lastRule;
  const firstIndex = lastIndex + 1;
  const endOfContentIndex = contentMatcher.getEndIndex(source, firstIndex)
  const currentIndex = endOfContentIndex === null ? firstIndex : endOfContentIndex + 1
  switch (source[currentIndex]) {
    case '`':
      return Yield.pop()
        .setLastIndex(currentIndex)
        .build()
    case '$':
      if (source[currentIndex + 1] === '{') {
        return Yield.push()
          .setLastIndex(currentIndex + 1)
          .setNewState(Yield.Twinescript.State.create(TwinescriptEndMode.BRACE))
          .build()
      } else {
        return Yield.step()
          .setLastIndex(currentIndex)
          .buildContentToken()
          .setStartIndex(firstIndex)
          .setEndIndex(currentIndex)
          .getParent()
          .build()
      }
    default:
      return Yield.unrecoverable()
        .setCriticalError(Err.unrecoverable(Err.Type.UnclosedTemplateString, firstIndex))
        .build()
  }
}

export const Definition: Parser.Definition<Yield.TemplateString.State, Twinescript.Token> = {
  type: Yield.Main.Type,
  runner,
  tokenBuilder,
}

// utilities
type ContentFlattener = [Token[], Token[]];
function reduceContentTokens(tokens: Token[]): Token[] {
  const [mergedTokens, contentBuffer] = tokens.reduce(contentTokensReducer, [[], []])
  flushAndAppendContent(mergedTokens, contentBuffer);
  return mergedTokens;

  function contentTokensReducer(args: ContentFlattener, nextToken: Token, ..._: any[]): ContentFlattener {
    const [mergedTokens, contentBuffer] = args;
    if (nextToken.tokenType === Content.TokenType) {
      contentBuffer.push(nextToken)
    } else {
      flushAndAppendContent(mergedTokens, contentBuffer);
      mergedTokens.push(nextToken);
    }
    return args;
  }
  function flushAndAppendContent(mergedTokens: Token[], contentBuffer: Token[]) {
    if (contentBuffer.length > 0) {
      const tokensToAdd = contentBuffer.splice(0, contentBuffer.length);
      const firstToken = tokensToAdd[0];
      const lastToken = tokensToAdd[tokensToAdd.length - 1];
      mergedTokens.push(Content.builder()
        .setStartIndex(firstToken.startIndex)
        .setEndIndex(lastToken.endIndex)
        .build())
    }
  }
}
