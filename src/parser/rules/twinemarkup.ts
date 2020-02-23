import { Parser, Source, Token, EndIndex, StartIndex, Yield, Macro, Variable, Err, Twinemarkup, Content, Twinescript } from '../types';
import { scanners, handleDoubleQuote, handleSingleQuote, whitespace, maybeTwinemarkup, handleQuoteScanResult } from './scanners.util';
import { StickyRegex } from './util';
import { setPriority } from 'os';

export type State = Yield.Twinemarkup.State;
export const State = Yield.Twinemarkup.State;
export type TokenType = Twinemarkup.Token;
export const TokenType = Twinemarkup.TokenType;
export type MarkupType = Yield.Twinemarkup.MarkupType;
export const MarkupType = Yield.Twinemarkup.MarkupType;
export type MarkupMode = Yield.Twinemarkup.MarkupMode;
export const MarkupMode = Yield.Twinemarkup.MarkupMode;

export function tokenBuilder(
  source : Source,
  state : State,
  tokens : Token[],
  startIndex : StartIndex,
  endIndex : EndIndex,
) : Parser.TokenBuilderResult<TokenType> { 
  const tokenBuilder = Twinemarkup.builder(state.markupType)
    .setImagePath(state.imgpath)
    .setMarkupLink(state.link)
    .setMarkupTitle(state.title)
    .setStartIndex(startIndex)
    .setEndIndex(endIndex)
  if (state.nextMode !== MarkupMode.NO_MORE) {
    const result = Err.unrecoverable(Err.Type.UnexpectedInvocation, startIndex) ;
    return { result };
  }

  const errors = []
  if (tokens[0]) {
    if (tokens[0].tokenType === Twinescript.TokenType) {
      tokenBuilder.setMarkupSetter(<Twinescript.Token>tokens[0])
    } else {
      errors.push(Err.tokenError(Err.Type.UnexpectedToken, tokens[0]))
    } 
    if (tokens.length > 1) {
      errors.push(Err.tokenError(Err.Type.UnexpectedToken, tokens[1]))
    }
  }
  return {
    result: tokenBuilder.build(),
    errors
  }
}

const hasImmediateEnd = new StickyRegex(/\s*\]\s*\]/y);

const contentMatcher = new StickyRegex(/[^\]]*/y)
const hasNewModeAfterContentMatcher = new StickyRegex(/\s*\[/y);
const hasFullEndAfterContentMatcher = new StickyRegex(/\s*\]/y);
const hasTitlePipeMatcher = new StickyRegex(/([^\|\]]*)\|([^\]]*)/y);
enum MarkupModeEndType {
  NewMode = "NewMode",
  FullEnd = "FullEnd",
  Unclosed = "Unclosed"
}
export function runner(
  source : Source, 
  state : State,
  lastRule : Yield.Generic,
) : Yield.Generic {
  const startIndex = lastRule.lastIndex + 1;
  if (state.nextMode === MarkupMode.SETTER_OR_END) {
    const endIndex = hasImmediateEnd.getEndIndex(source, startIndex);
    if (endIndex) {
      return pop(endIndex)
    }
    state.nextMode = MarkupMode.TWINESCRIPT_END;
    return Yield.push()
      .setLastIndex(startIndex)
      .setNewState(Yield.Twinescript.State.create(Yield.Twinescript.EndMode.TWINEMARKUP))
      .setNewStateStartIndex(startIndex)
      .build()
  }
  const [contentMatchEndIndex, content] : [EndIndex, string] = 
    <[EndIndex, string]>contentMatcher.getMatchAndEndIndex(source, startIndex);
  if (contentMatchEndIndex === null) { return unclosed(startIndex) }
  switch(state.nextMode) {
    case MarkupMode.LINK_START:
      return handleStart(MarkupMode.SETTER_OR_END, "link");
    case MarkupMode.IMG_START:
      return handleStart(MarkupMode.IMG_LINK_OR_END, "imgpath");
    case MarkupMode.TWINESCRIPT_END:
      return pop(lastRule.lastIndex);
    case MarkupMode.IMG_LINK_OR_END: {
      const [ endType, endIndex ] = whichEndType()
      state.link = content.trim();
      switch(endType) {
        case MarkupModeEndType.FullEnd:
          return pop(endIndex!);
        case MarkupModeEndType.NewMode:
          return step(MarkupMode.SETTER_OR_END, endIndex!)
        case MarkupModeEndType.Unclosed:
          return unclosed(startIndex);
      }
    } break;
  }
  throw Err.unexpected({ source, lastRule, state });

  function handleStart(nextMode : MarkupMode, linkOrPath : string) : Yield.Generic {
    const titlePipeMatch = hasTitlePipeMatcher.execAt(source, startIndex);
    if (titlePipeMatch === null) {
      (<any>state)[linkOrPath] = content.trim();
    } else {
      state.title = titlePipeMatch[1].trim();
      (<any>state)[linkOrPath] = titlePipeMatch[2].trim();
    }
    const [endType, endIndex] = whichEndType();
    switch(endType) {
      case MarkupModeEndType.NewMode:
        return step(nextMode, endIndex!)
      case MarkupModeEndType.FullEnd:
        return pop(endIndex!)
      case MarkupModeEndType.Unclosed:
        return unclosed(startIndex)
    }
  }
  function whichEndType() : [MarkupModeEndType, EndIndex | null] {
    const hasNewModeIndex = hasNewModeAfterContentMatcher.getEndIndex(source, contentMatchEndIndex + 2);
    if (hasNewModeIndex !== null) {
      return [MarkupModeEndType.NewMode, hasNewModeIndex];
    }
    const hasFullEndIndex = hasFullEndAfterContentMatcher.getEndIndex(source, contentMatchEndIndex + 2);
    if (hasFullEndIndex !== null) {
      return [MarkupModeEndType.FullEnd, hasFullEndIndex];
    }
    return [MarkupModeEndType.Unclosed, null];
  }
  function step(nextMode : MarkupMode, endIndex : EndIndex) : Yield.Step {
    state.nextMode = nextMode;
    return Yield.step()
      .setLastIndex(endIndex)
      .build();
  }
  function pop(endIndex : EndIndex) : Yield.Pop {
    state.nextMode = MarkupMode.NO_MORE;
    return Yield.pop()
      .setLastIndex(endIndex)
      .build()
  }
  function unclosed(startIndex : StartIndex) : Yield.Unrecoverable {
    return Yield.unrecoverable()
      .setCriticalError(Err.unrecoverable(Err.Type.UnclosedTwinemarkup, startIndex))
      .build();
  }
}

export function unexpectedEnd(startIndex : StartIndex, state : Partial<Yield.AnyState>) {
  return Err.unrecoverable(Err.Type.UnclosedTwinemarkup, startIndex);
}

export const Definition : Parser.Definition<State, TokenType> = {
    type : Yield.Macro.Type,
    runner,
    tokenBuilder,
}
