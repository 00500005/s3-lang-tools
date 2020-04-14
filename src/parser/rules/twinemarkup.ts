import { Content, EndIndex, Err, Parser, Source, StartIndex, Token, Twinemarkup, Twinescript, Variable, Yield } from '../types';
import { TwinemarkupMode } from '../types/rule-states';
import { StickyRegex } from './util';

export type State = Yield.Twinemarkup.State;
export const State = Yield.Twinemarkup.State;
export type TokenType = Twinemarkup.Token;
export const TokenType = Twinemarkup.TokenType;
export type MarkupType = Yield.Twinemarkup.MarkupType;
export const MarkupType = Yield.Twinemarkup.MarkupType;
export type MarkupMode = Yield.Twinemarkup.MarkupMode;
export const MarkupMode = Yield.Twinemarkup.MarkupMode;

export function tokenBuilder(
  source: Source,
  state: State,
  tokens: Token[],
  startIndex: StartIndex,
  endIndex: EndIndex,
): Parser.TokenBuilderResult<TokenType> {
  const result = Twinemarkup.builder(state.markupType)
    .setImagePath(state.imgpath)
    .setMarkupLink(state.link)
    .setMarkupTitle(state.title)
    .setStartIndex(startIndex)
    .setEndIndex(endIndex)
    .setMarkupSetter(state.setter)
    .build()
  return {
    result,
  }
}

const contentMatcher = new StickyRegex(/[^\]$_]+/y);
const maybeTitleContentMatcher = new StickyRegex(/[^\]$_|]+/y);

const immediateEndMatcher = new StickyRegex(/\s*\]\s*\]/y);
const narkedVarAfterContentMatcher = new StickyRegex(/[$_]/y);
const titleAfterContentMatcher = new StickyRegex(/\|/y);
const newModeAfterContentMatcher = new StickyRegex(/\]\s*\[/y);
const fullEndAfterContentMatcher = new StickyRegex(/\]\s*\]/y);

export function runner(
  source: Source,
  state: State,
  lastRule: Yield.Generic,
): Yield.Generic {
  const startIndex = lastRule.lastIndex + 1;
  switch (state.nextMode) {
    case MarkupMode.NO_MORE:
      throw Err.unexpected({ state, lastRule, source })
    case MarkupMode.TWINESCRIPT_END: {
      appendTwinescriptFromLast(lastRule, state)
      state.nextMode = MarkupMode.NO_MORE;
      return Yield.pop().setLastIndex(lastRule.lastIndex).build()
    }
    case MarkupMode.SETTER_OR_END: {
      return immediateEnd(state, source, startIndex) || pushTwinescript(state, lastRule.lastIndex)
    }
    case MarkupMode.IMG_LINK_OR_END: {
      appendVarFromLast(lastRule, state.link)
      const contentEnd = contentMatcher.getEndIndex(source, startIndex)
      return nextMode(state, source, startIndex, contentEnd, state.link, MarkupMode.SETTER_OR_END)
        || end(state, source, startIndex, contentEnd, state.link, false)
        || variable(source, startIndex, contentEnd, state.link)
        || unclosed(state, startIndex)
    }
    case MarkupMode.IMG_IMG: {
      appendVarFromLast(lastRule, state.imgpath)
      const contentEnd = contentMatcher.getEndIndex(source, startIndex)
      return nextMode(state, source, startIndex, contentEnd, state.imgpath, MarkupMode.IMG_LINK_OR_END)
        || end(state, source, startIndex, contentEnd, state.imgpath)
        || variable(source, startIndex, contentEnd, state.imgpath)
        || unclosed(state, startIndex)
    }
    case MarkupMode.LINK_LINK: {
      appendVarFromLast(lastRule, state.link)
      const contentEnd = contentMatcher.getEndIndex(source, startIndex)
      return nextMode(state, source, startIndex, contentEnd, state.link, MarkupMode.SETTER_OR_END)
        || end(state, source, startIndex, contentEnd, state.link)
        || variable(source, startIndex, contentEnd, state.link)
        || unclosed(state, startIndex)
    }
    case MarkupMode.IMG_START: {
      appendVarFromLast(lastRule, state.imgpath)
      const contentEnd = maybeTitleContentMatcher.getEndIndex(source, startIndex)
      return title(state, source, startIndex, contentEnd, state.imgpath, MarkupMode.IMG_IMG)
        || nextMode(state, source, startIndex, contentEnd, state.imgpath, MarkupMode.IMG_LINK_OR_END)
        || end(state, source, startIndex, contentEnd, state.imgpath)
        || variable(source, startIndex, contentEnd, state.imgpath)
        || unclosed(state, startIndex)
    }
    case MarkupMode.LINK_START: {
      appendVarFromLast(lastRule, state.link)
      const contentEnd = maybeTitleContentMatcher.getEndIndex(source, startIndex)
      return title(state, source, startIndex, contentEnd, state.link, MarkupMode.LINK_LINK)
        || nextMode(state, source, startIndex, contentEnd, state.link, MarkupMode.SETTER_OR_END)
        || end(state, source, startIndex, contentEnd, state.link)
        || variable(source, startIndex, contentEnd, state.link)
        || unclosed(state, startIndex)
    }
    default:
      throw Err.unexpected({ state, lastRule, source })
  }
}

export function unexpectedEnd(startIndex: StartIndex, state: Partial<Yield.AnyState>) {
  return Err.unrecoverable(Err.Type.UnclosedTwinemarkup, startIndex);
}

export const Definition: Parser.Definition<State, TokenType> = {
  type: Yield.Macro.Type,
  runner,
  tokenBuilder,
}

function title(
  state: State,
  source: Source,
  startIndex: StartIndex,
  contentEnd: EndIndex | null,
  fromTokens: Token[],
  toMode: MarkupMode
): null | Yield.Step {
  const scanFrom = contentEnd === null ? startIndex : contentEnd + 1;
  const hasTitleIndex = titleAfterContentMatcher.getEndIndex(source, scanFrom);
  if (hasTitleIndex !== null) {
    state.nextMode = toMode;
    const errors: Err.TokenError[] = []
    state.title.splice(0, 0, ...fromTokens.splice(0, fromTokens.length))
    if (contentEnd !== null) {
      const token = Content.builder()
        .setStartIndex(startIndex)
        .setEndIndex(contentEnd)
        .build()
      state.title.push(token)
    }
    if (state.title.length === 0) {
      const token = Content.builder()
        .setStartIndex(startIndex)
        .setEndIndex(hasTitleIndex)
        .build()
      errors.push(Err.tokenError(Err.Type.MissingArgument, token))
    }
    return Yield.step()
      .setLastIndex(hasTitleIndex)
      .addErrors(...errors)
      .build()
  } else {
    return null;
  }
}
function variable(
  source: Source,
  startIndex: StartIndex,
  contentEnd: EndIndex | null,
  toTokens: Token[],
): null | Yield.Push {
  const scanFrom = contentEnd === null ? startIndex : contentEnd + 1;
  const variableEndIndex = narkedVarAfterContentMatcher.getEndIndex(source, scanFrom);
  if (variableEndIndex !== null) {
    if (contentEnd !== null) {
      const token = Content.builder()
        .setStartIndex(startIndex)
        .setEndIndex(contentEnd)
        .build()
      toTokens.push(token)
    }
    return Yield.push()
      .setLastIndex(variableEndIndex)
      .setNewState(Yield.Variable.State.create(<Variable.Type>source[variableEndIndex]))
      .setNewStateStartIndex(variableEndIndex)
      .build()
  } else {
    return null;
  }
}
function nextMode(
  state: State,
  source: string,
  startIndex: StartIndex,
  contentEnd: EndIndex | null,
  toUpdate: Token[],
  mode: MarkupMode
): null | Yield.Step {
  const scanFrom = contentEnd === null ? startIndex : contentEnd + 1;
  const newModeEndIndex = newModeAfterContentMatcher.getEndIndex(source, scanFrom);
  if (newModeEndIndex !== null) {
    const errors: Err.TokenError[] = [];
    state.nextMode = mode;
    if (contentEnd !== null) {
      const token = Content.builder()
        .setEndIndex(contentEnd)
        .setStartIndex(startIndex)
        .build();
      toUpdate.push(token);
    } else if (toUpdate.length === 0) {
      const token = Content.builder()
        .setEndIndex(newModeEndIndex)
        .setStartIndex(startIndex)
        .build();
      errors.push(Err.tokenError(Err.Type.MissingArgument, token))
    }
    return Yield.step()
      .setLastIndex(newModeEndIndex)
      .addErrors(...errors)
      .build();
  } else {
    return null;
  }
}
function end(
  state: State,
  source: Source,
  startIndex: StartIndex,
  contentEnd: EndIndex | null,
  toTokens: Token[] | null,
  requiresContent: boolean = true
): null | Yield.Pop {
  const scanFrom = contentEnd === null ? startIndex : contentEnd + 1;
  const endIndex = fullEndAfterContentMatcher.getEndIndex(source, scanFrom)
  if (endIndex !== null) {
    state.nextMode = MarkupMode.NO_MORE;
    const errors: Err.TokenError[] = [];
    if (contentEnd !== null) {
      const token = Content.builder()
        .setStartIndex(startIndex)
        .setEndIndex(contentEnd)
        .build()
      if (toTokens === null) {
        errors.push(Err.tokenError(Err.Type.UnexpectedToken, token))
      } else {
        toTokens.push(token)
      }
    } else if (requiresContent && toTokens && toTokens.length === 0) {
      const errToken = Content.builder()
        .setStartIndex(startIndex)
        .setEndIndex(startIndex)
        .build()
      errors.push(Err.tokenError(Err.Type.MissingArgument, errToken))
    }
    return Yield.pop()
      .setLastIndex(endIndex)
      .addErrors(...errors)
      .build()
  } else {
    return null;
  }
}
function immediateEnd(
  state: State,
  source: Source,
  startIndex: StartIndex
): null | Yield.Pop {
  const endIndex = immediateEndMatcher.getEndIndex(source, startIndex);
  if (endIndex) {
    state.nextMode = TwinemarkupMode.NO_MORE;
    return Yield.pop()
      .setLastIndex(endIndex)
      .build();
  } else {
    return null;
  }
}
function unexpectedMode(
  state: State,
  source: Source,
  startIndex: StartIndex,
  contentEnd: null | EndIndex
): null | Yield.Pop {
  const scanFrom = contentEnd === null ? startIndex : contentEnd + 1;
  const endIndex = newModeAfterContentMatcher.getEndIndex(source, scanFrom)
  if (endIndex !== null) {
    state.nextMode = TwinemarkupMode.NO_MORE;
    const errors = [];
    if (contentEnd !== null) {
      const errToken = Content.builder()
        .setStartIndex(startIndex)
        .setEndIndex(contentEnd)
        .build()
      errors.push(Err.tokenError(Err.Type.UnexpectedToken, errToken))
    }
    return Yield.pop()
      .setLastIndex(endIndex)
      .addErrors(...errors)
      .build()
  } else {
    return null;
  }
}
function unclosed(
  state: State,
  startIndex: StartIndex
): Yield.Unrecoverable {
  state.nextMode = TwinemarkupMode.NO_MORE;
  return Yield.unrecoverable()
    .setCriticalError(Err.unrecoverable(Err.Type.UnclosedTwinemarkup, startIndex))
    .build();
}
function pushTwinescript(
  state: State,
  lastYieldStart: StartIndex
): Yield.Push {
  state.nextMode = MarkupMode.TWINESCRIPT_END;
  return Yield.push()
    .setLastIndex(lastYieldStart)
    .setNewState(Yield.Twinescript.State.create(Yield.Twinescript.EndMode.TWINEMARKUP))
    .setNewStateStartIndex(lastYieldStart)
    .build()
}
function appendTwinescriptFromLast(lastRule: Yield.Generic, state: State): boolean {
  if (lastRule.type === Yield.Type.POP) {
    const token = lastRule.token;
    if (!token) {
      /** @todo: add error, should have had token */
      throw Err.unexpected({ lastRule })
    } else if (token.tokenType === Twinescript.TokenType) {
      state.setter = <Twinescript.Token>token;
    } else {
      /** @todo: add error, only allow variable tokens */
      throw Err.unexpected({ lastRule })
    }
    return true;
  }
  return false;
}
function appendVarFromLast(lastRule: Yield.Generic, toTokens: Token[]): boolean {
  if (lastRule.type === Yield.Type.POP) {
    const token = lastRule.token;
    if (!token) {
      /** @todo: add error, should have had token */
      throw Err.unexpected({ lastRule })
    } else if (token.tokenType === Variable.TokenType) {
      toTokens.push(token)
    } else {
      /** @todo: add error, only allow variable tokens */
      throw Err.unexpected({ lastRule })
    }
    return true;
  }
  return false;
}
