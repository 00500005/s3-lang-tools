import { Source, StartIndex, EndIndex, Err, Yield, String, Variable, Twinescript } from "../types";
import { Maybe, StickyRegex } from './util'

export function maybeMacroOrTwinescript(
  source : Source, 
  startIndex : StartIndex, 
) : Yield.Push | undefined {
  switch(source[startIndex]) {
    case '<':
      switch(source[startIndex + 1]) {
        case '-':
        case '=':
          return Yield.push()
            .setLastIndex(startIndex + 1)
            .setNewState(Yield.Twinescript.State.create(Yield.Twinescript.EndMode.MACROLIKE))
            .setNewStateStartIndex(startIndex - 1)
            .build();
        default:
          return Yield.push()
            .setLastIndex(startIndex)
            .setNewState(Yield.Macro.State.create(Yield.Macro.EndMode.MACROENTRY))
            .setNewStateStartIndex(startIndex - 1)
            .build();
      }
    default:
      return undefined;
  }
}
const script = "script";
const SCRIPT = "SCRIPT";
/** @deprecated */
export function maybeScript(
  source : Source, 
  startIndex : StartIndex, 
) : Yield.Goto | undefined {
  /** @todo replace with regex as lookahead support is no longer needed */
  let nextIndex = startIndex;
  let scriptNameIndex = 0;
  while(nextIndex < source.length) {
    switch(source[nextIndex++]) {
      case ' ':
      case '\t':
      case '\n':
      case '\r':
        continue;
      case '>':
        if (source[nextIndex + 1] === '>' && scriptNameIndex === script.length) {
          return Yield.goto()
            .setLastIndex(nextIndex + 1)
            .setNewState(Yield.Javascript.State.create())
            .setNewStateStartIndex(startIndex - 1)
            .build();
        } else {
          return undefined;
        }
      case script[scriptNameIndex]:
      case SCRIPT[scriptNameIndex]:
        scriptNameIndex++;
        if (scriptNameIndex > script.length) {
          return undefined;
        } else {
          continue;
        }
    }
  }
  return undefined;
}
export const whitespace = new StickyRegex(/\s*/y);
const IMG = 'IMG';
const img = 'img';
export function maybeTwinemarkup(
  source : Source, 
  startIndex : StartIndex
) : Yield.Push | undefined {
  /** @todo replace with regex */
  let currentIndex = startIndex;
  let tryEnterImage = false;
  let nextExpectedImageChar = 0;
MainLoop:
  while(currentIndex < source.length) {
    switch(source[currentIndex]) {
      case ' ':
      case '\t':
      case '\n':
      case '\r':
        currentIndex++; continue;
      case '[':
        if (tryEnterImage) {
          return Yield.push()
            .setLastIndex(currentIndex)
            .setNewState(Yield.Twinemarkup.State.create(Yield.Twinemarkup.MarkupType.IMAGE))
            .setNewStateStartIndex(startIndex - 1)
            .build();
        } else {
          return Yield.push()
            .setLastIndex(currentIndex)
            .setNewState(Yield.Twinemarkup.State.create(Yield.Twinemarkup.MarkupType.LINK))
            .setNewStateStartIndex(startIndex - 1)
            .build();
        }
      // TODO: manually unroll this
      case img[nextExpectedImageChar]:
      case IMG[nextExpectedImageChar]:
        nextExpectedImageChar++;
        if (nextExpectedImageChar === img.length) {
          tryEnterImage = true;
        }
        currentIndex++; continue;
      default:
        break MainLoop;
    }
  }
  return undefined;
}

const DOUBLE_QUOTE_MATCHER =           /(?:(?:[^"\\]|\\["bfnrt\/\\\n]|\\u[a-fA-F0-9]{4})*")/y;
const DOUBLE_QUOTE_LIBERAL_MATCHER =   /(?:(?:[^"\\]|\\.)*")/y;
const SINGLE_QUOTE_MATCHER =           /(?:(?:[^'\\]|\\['bfnrt\/\\\n]|\\u[a-fA-F0-9]{4})*')/y;
const SINGLE_QUOTE_LIBERAL_MATCHER =   /(?:(?:[^'\\]|\\.)*')/y;

export function scanDoubleQuote(
  source : Source, 
  afterQuoteStart : StartIndex, 
) : EndIndex | Err.ParserError {
  DOUBLE_QUOTE_MATCHER.lastIndex = afterQuoteStart;
  const result = DOUBLE_QUOTE_MATCHER.exec(source);
  if (result) {
    return afterQuoteStart + result[0].length - 1;
  } else {
    DOUBLE_QUOTE_LIBERAL_MATCHER.lastIndex = afterQuoteStart;
    const recoveryResult = DOUBLE_QUOTE_LIBERAL_MATCHER.exec(source);
    if (recoveryResult) {
      return Err.tokenError(Err.Type.InvalidString, 
        String.builder(String.Type.DOUBLE)
          .setStartIndex(afterQuoteStart - 1)
          .setEndIndex(DOUBLE_QUOTE_LIBERAL_MATCHER.lastIndex - 1)
          .build()
      );
    }
    return Err.unrecoverable(Err.Type.UnclosedString, afterQuoteStart);
  }
}

export function scanSingleQuote(
  source : Source, 
  afterQuoteStart : StartIndex, 
) : EndIndex | Err.ParserError {
  SINGLE_QUOTE_MATCHER.lastIndex = afterQuoteStart;
  const result = SINGLE_QUOTE_MATCHER.exec(source);
  if (result) {
    return afterQuoteStart + result[0].length - 1;
  } else {
    SINGLE_QUOTE_LIBERAL_MATCHER.lastIndex = afterQuoteStart;
    const recoveryResult = SINGLE_QUOTE_LIBERAL_MATCHER.exec(source);
    if (recoveryResult) {
      return Err.tokenError(Err.Type.InvalidString, 
        String.builder(String.Type.SINGLE)
          .setStartIndex(afterQuoteStart - 1)
          .setEndIndex(DOUBLE_QUOTE_LIBERAL_MATCHER.lastIndex - 1)
          .build()
      );
    }
    return Err.unrecoverable(Err.Type.UnclosedString, afterQuoteStart);
  }
}

export function handleQuoteScanResult(
  stringType : String.Type, 
  source : Source, 
  afterQuoteStart : StartIndex, 
  quoteScanResult : EndIndex | Err.ParserError
) : Yield.Step | Yield.Unrecoverable {
  if (typeof quoteScanResult === 'number') {
    return Yield.step()
      .buildStringToken(stringType)
        .setStartIndex(afterQuoteStart - 1)
        .setEndIndex(quoteScanResult)
      .getParent()
      .build();
  } else if(quoteScanResult.recoverable) {
    const error = (<Err.TokenError>quoteScanResult);
    return Yield.step()
      .addErrors(error)
      .buildStringToken(stringType)
        .setStartIndex(afterQuoteStart - 1)
        .setEndIndex(error.endIndex)
      .getParent()
      .build();
  } else {
    const error = (<Err.ParserError>quoteScanResult);
    return Yield.unrecoverable()
      .setCriticalError(error)
      .build();
  }
}

export function handleSingleQuote(source : Source, startIndex : StartIndex) : Yield.Step | Yield.Unrecoverable {
  return handleQuoteScanResult(String.Type.SINGLE, source, startIndex, scanSingleQuote(source, startIndex));
}

export function handleDoubleQuote(source : Source, startIndex : StartIndex) : Yield.Step | Yield.Unrecoverable {
  return handleQuoteScanResult(String.Type.DOUBLE, source, startIndex, scanDoubleQuote(source, startIndex));
}

const ALLOWED_VARIABLE_NAME_STARTS = {
  GLOBAL: new StickyRegex(/[A-Za-z_]/yi),
  LOCAL: new StickyRegex(/[A-Za-z$]/yi),
}
export function maybeVariable(source : Source, nextIndex : StartIndex, varType: Variable.Type) : Yield.Push | undefined {
  let isVariable : boolean;
  switch(varType) {
    case Variable.Type.GLOBAL:
      isVariable = ALLOWED_VARIABLE_NAME_STARTS.GLOBAL.matchExists(source, nextIndex)
      break;
    case Variable.Type.LOCAL:
      isVariable = ALLOWED_VARIABLE_NAME_STARTS.LOCAL.matchExists(source, nextIndex)
      break;
  }
  if (isVariable) {
    return Yield.push()
      // don't consume the character we checked
      .setLastIndex(nextIndex - 1)
      // we only check the first character after a possible variable prefix
      .setNewState(Yield.Variable.State.create(varType))
      .build()
  } else {
    return undefined;
  }
}

export function scanners(contentMatcher: StickyRegex) {
  return {
    variableOrContent,
    twinemarkupOrContent,
    twinemarkupOrTwinescript,
    macroOrTwinescriptOrContent,
    content
  }
  function macroOrTwinescriptOrContent(
    source : Source, 
    firstIndex : StartIndex, 
    nextIndex : StartIndex
  ) : Yield.Step | Yield.Push {
    return maybeMacroOrTwinescript(source, nextIndex) || content(source, firstIndex, nextIndex);
  }
  function twinemarkupOrTwinescript(
    source : Source, 
    firstIndex : StartIndex, 
    nextIndex : StartIndex
  ) : Yield.Step | Yield.Push {
    return maybeTwinemarkup(source, nextIndex) || pushTwinescript();
    function pushTwinescript() : Yield.Push {
      return Yield.push()
        .setLastIndex(nextIndex)
        .setNewState(Yield.Twinescript.State.create(Twinescript.EndMode.INDEX))
        .build()
    }
  }
  function twinemarkupOrContent(
    source : Source, 
    firstIndex : StartIndex, 
    nextIndex : StartIndex
  ) : Yield.Step | Yield.Push {
    return maybeTwinemarkup(source, nextIndex) || content(source, firstIndex, nextIndex);
  }
  function variableOrContent(
    variableType : Variable.Type, 
    source : Source, 
    firstIndex : StartIndex, 
    nextIndex : StartIndex
  ) : Yield.Step | Yield.Push {
    return maybeVariable(source, nextIndex, variableType) || content(source, firstIndex, nextIndex);
  }
  function content(
    source : Source, 
    firstIndex : StartIndex, 
    nextIndex : StartIndex, 
    lastScannedIndex ?: EndIndex
  ) : Yield.Step {
    const endIndex = contentMatcher.getEndIndex(source, nextIndex) || (Math.min(nextIndex, source.length) - 1);
    return Yield.step()
      .buildContentToken()
        .setStartIndex(firstIndex)
        .setEndIndex(endIndex)
      .getParent()
      .build()
  }
}
