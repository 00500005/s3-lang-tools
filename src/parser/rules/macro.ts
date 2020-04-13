
import { Parser, Source, Token, EndIndex, StartIndex, Yield, Macro, Variable, Err } from '../types';
import { scanners, handleDoubleQuote, handleSingleQuote, whitespace, maybeTwinemarkup } from './scanners.util';
import { StickyRegex } from './util';

export type State = Yield.Macro.State;
export const State = Yield.Macro.State;
export type EndMode = Yield.Macro.EndMode;
export const EndMode = Yield.Macro.EndMode;
export function tokenBuilder(
  source: Source,
  state: Yield.Macro.State,
  tokens: Token[],
  startIndex: StartIndex,
  endIndex: EndIndex,
): Parser.TokenBuilderResult<Macro.Token> {
  const builder = Macro.builder()
    .setStartIndex(startIndex)
    .setEndIndex(endIndex)
    .setMacroType(state.macroType || Macro.Type.INVALID)
    .setArgs(tokens.slice(1));
  if (state.macroType === undefined || tokens.length === 0) {
    const token = builder
      .setMacroType(Macro.Type.INVALID)
      .setMacroName(Macro.Type.INVALID)
      .build()
    return {
      result: token,
      errors: [Err.tokenError(Err.Type.MissingMacroName, token)]
    }
  }
  switch (state.macroType) {
    case Macro.Type.INVALID:
      return {
        result: builder.setMacroName(state.macroName || Macro.Type.INVALID).build(),
        errors: [Err.tokenError(Err.Type.InvalidName, tokens[0])]
      }
    case Macro.Type.END:
    case Macro.Type.USER:
      if (!state.macroName) {
        throw Err.unexpected({ source, state, startIndex, endIndex, tokens })
      }
      builder.setMacroName(state.macroName);
      break;
    case Macro.Type.JAVASCRIPT:
      // we switch to javascript mode instead, don't emit a token
      return { result: undefined };
    default:
      throw Err.unexpected({ source, state, startIndex, endIndex, tokens })
  }
  return {
    result: builder.build()
  }
}
const {
  variableOrContent,
  twinemarkupOrTwinescript,
  content
  // Note: whitespace is *not* considered content inside of macros
  // arg tokens will be whitespace delimited
} = scanners(new StickyRegex(/[^\[$_'"`>\s]*/y));
const validMacroNameMatcher = new StickyRegex(/[A-Za-z][A-Za-z0-9$_]*/y);
const macroEndMatcher = new StickyRegex(/\s*([A-Za-z0-9$_]*)\s*>>/y);
const macroInvocationEndMatcher = new StickyRegex(/\s*>>/y);
export function runner(
  source: Source,
  state: Yield.Macro.State,
  lastRule: Yield.Generic,
): Yield.Generic {
  // throw Err.unexpected({ source, state, lastRule })
  if (state.endMode !== Yield.Macro.EndMode.MACROENTRY) {
    throw Err.unexpected({ source, state, lastRule })
  }
  // For the purposes of content in a macro, we ignore all whitespace
  const rawFirstIndex = lastRule.lastIndex + 1;
  const currentIndex = whitespace.getNextStart(source, rawFirstIndex) || rawFirstIndex;
  const nextIndex = currentIndex + 1;
  switch (source[currentIndex]) {
    case '[':
      // indexing should only be allowed as part of a variable
      const maybeMarkup = maybeTwinemarkup(source, nextIndex);
      if (maybeMarkup) {
        return maybeMarkup;
      } else {
        return Yield.push()
          .setLastIndex(currentIndex)
          .setNewState(Yield.Twinescript.State.create(Yield.Twinescript.EndMode.ARRAY))
          .build();
      }
    case '{':
      return Yield.push()
        .setLastIndex(currentIndex)
        .setNewState(Yield.Twinescript.State.create(Yield.Twinescript.EndMode.BRACE))
        .build();
    case '$':
      return variableOrContent(Variable.Type.GLOBAL, source, currentIndex, nextIndex);
    case '_':
      return variableOrContent(Variable.Type.LOCAL, source, currentIndex, nextIndex);
    case "'":
      return handleSingleQuote(source, nextIndex);
    case '"':
      return handleDoubleQuote(source, nextIndex);
    case '`':
      return Yield.push()
        .setLastIndex(currentIndex)
        .setNewState(Yield.Twinescript.State.create(Yield.Twinescript.EndMode.QUOTE))
        .build();
    case '>':
      if (source[nextIndex] === '>') {
        return Yield.pop()
          .setLastIndex(nextIndex)
          .build();
      } else {
        return content(source, currentIndex, nextIndex);
      }
    case '/':
      if (state.macroType === undefined) {
        const endMacroMatch = macroEndMatcher.execAt(source, nextIndex);
        if (endMacroMatch !== null) {
          state.macroType = Macro.Type.END
          state.macroName = endMacroMatch[1];
          const endIndex = macroEndMatcher.regex.lastIndex - 1;
          return Yield.pop()
            .setLastIndex(endIndex)
            .buildContentToken()
            .setStartIndex(nextIndex)
            .setEndIndex(endIndex)
            .getParent()
            .build()
        }
      }
    // maybe endwidget invocation
    default:
      if (state.macroType === undefined) {
        const [endIndex, match] = validMacroNameMatcher.getMatchAndEndIndex(source, currentIndex);
        if (match && endIndex) {
          const macroType = Macro.keyword(match);
          switch (macroType) {
            case Macro.Type.JAVASCRIPT:
              state.macroType = macroType;
              state.macroName = 'script';
              const endOfInvocation = macroInvocationEndMatcher.getEndIndex(source, endIndex + 1);
              if (!endOfInvocation) {
                return Yield.unrecoverable()
                  .setCriticalError(
                    Err.unrecoverable(Err.Type.UnclosedMacroInvocation, rawFirstIndex)
                  )
                  .build();
              } else {
                return Yield.goto()
                  .setLastIndex(endOfInvocation)
                  .buildContentToken()
                  .setStartIndex(currentIndex)
                  .setEndIndex(endIndex)
                  .getParent()
                  .setNewState(Yield.Javascript.State.create())
                  .build()
              }
            case Macro.Type.USER:
              state.macroType = macroType;
              state.macroName = match;
              return Yield.step()
                .setLastIndex(endIndex)
                .buildContentToken()
                .setStartIndex(currentIndex)
                .setEndIndex(endIndex)
                .getParent()
                .build()
            default:
              throw Err.unexpected({ source, state, lastRule, atIndex: currentIndex })
          }
        } else {
          state.macroType = Macro.Type.INVALID;
        }
      }
      // TODO: handle keywords or naked javascript name
      return content(source, currentIndex, nextIndex);
  }
}

export function unexpectedEnd(startIndex: StartIndex, state: Partial<Yield.AnyState>) {
  return Err.unrecoverable(Err.Type.UnclosedMacroInvocation, startIndex);
}

export const Definition: Parser.Definition<Yield.Macro.State, Macro.Token> = {
  type: Yield.Macro.Type,
  runner,
  tokenBuilder,
}
