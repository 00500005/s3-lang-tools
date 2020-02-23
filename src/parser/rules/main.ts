
import { Parser, Source, Token, Main, Yield, Variable, Err, Content } from '../types';
import { scanners } from './scanners.util';
import { StickyRegex } from './util';

export type State = Yield.Main.State;
export const State = Yield.Main.State;
export function tokenBuilder(
  source : Source,
  _ : Yield.Main.State, 
  tokens : Token[],
  startIndex : number,
  endIndex : number,
) : Parser.TokenBuilderResult<Main.Token> { 
  return {
    result: Main.builder()
      .setStartIndex(startIndex)
      .setEndIndex(endIndex)
      .setChunks(reduceContentTokens(tokens))
      .build()
  }
}
const {
    variableOrContent,
    twinemarkupOrContent,
    macroOrTwinescriptOrContent,
    content
} = scanners(new StickyRegex(/[^\[$_<]*/y));
export function runner(
  source : Source, 
  _ : Yield.Main.State,
  lastRule : Yield.Generic,
) : Yield.Generic {
  const { lastIndex: lastConsumedOffset } = lastRule;

  const firstIndex = lastConsumedOffset + 1;
  let nextIndex = lastConsumedOffset + 2;
  switch(source[firstIndex]) {
    case '[':
      return twinemarkupOrContent(source, firstIndex, nextIndex);
    case '$':
      if (source[nextIndex] === '$') {
        // escaped '$' value, this is not a variable
        // AFAIK This type of escape is only allowed in main content
        return content(source, firstIndex, nextIndex + 1);
      } else {
        return variableOrContent(Variable.Type.GLOBAL, source, firstIndex, nextIndex);
      }
    case '_':
      return variableOrContent(Variable.Type.LOCAL, source, firstIndex, nextIndex);
    case '<':
      return macroOrTwinescriptOrContent(source, firstIndex, nextIndex);
    default:
      return content(source, firstIndex, nextIndex);
  }
}

export const Definition : Parser.Definition<Yield.Main.State, Main.Token> = {
    type : Yield.Main.Type,
    runner,
    tokenBuilder,
}

// utilities
type ContentFlattener = [ Token[], Token[] ];
function reduceContentTokens(tokens : Token[]) : Token[] {
  const [ mergedTokens, contentBuffer ] = tokens.reduce(contentTokensReducer, [[], []])
  flushAndAppendContent(mergedTokens, contentBuffer);
  return mergedTokens;

  function contentTokensReducer(args : ContentFlattener, nextToken : Token, ..._: any[]) : ContentFlattener {
    const [ mergedTokens, contentBuffer ] = args;
    if (nextToken.tokenType === Content.TokenType) {
      contentBuffer.push(nextToken)
    } else {
      flushAndAppendContent(mergedTokens, contentBuffer);
      mergedTokens.push(nextToken);
    }
    return args;
  }
  function flushAndAppendContent(mergedTokens : Token[], contentBuffer : Token[]) {
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
