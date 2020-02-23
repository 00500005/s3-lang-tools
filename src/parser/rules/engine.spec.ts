import "jest";
import { parse, DefinitionTable } from './engine';
import { Parser, Err, TokenType, Yield, AnyToken, StartIndex, Token, Content, EndIndex, Macro, Source } from "../types";
import { Expects } from "./rule-test.util";
import { YieldType, GenericState } from "../types/rules";
import { cloneDeep, noop } from "lodash";
import { MacroType } from "../types/AST";


describe('engine', () => {
  beforeEach(() => {
    // rules must be explicitly declared
    ruleDef(Parser.RuleType.Main, null, null);
    ruleDef(Parser.RuleType.Macro, null, null);
    ruleDef(Parser.RuleType.Variable, null, null);
    ruleDef(Parser.RuleType.Twinemarkup, null, null);
    ruleDef(Parser.RuleType.Twinescript, null, null);
    ruleDef(Parser.RuleType.Javascript, null, null);
  });
  describe('running each rule', () => {
    it.each(Object.values(Parser.RuleType))('should execute the "%s" runner but not tokenBuilder on step', (rule : Parser.RuleType) => {
      let didCallRunner = false;
      let didCallTokenBuilder = false;
      ruleDef(rule, 
        fakeRule(() => didCallRunner = true, fakeStep), 
        fakeTokenBuilder(() => didCallTokenBuilder = true));
      parseWith([fakeFrame({ state: fakeState(rule) })])();
      expect(didCallRunner).toBe(true);
      expect(didCallTokenBuilder).toBe(false);
    });
    it.each(Object.values(Parser.RuleType))('should execute the "%s" runner but not tokenBuilder on push', (rule : Parser.RuleType) => {
      let didCallRunner = false;
      let didCallTokenBuilder = false;
      ruleDef(rule, 
        fakeRule(() => didCallRunner = true, () => fakePush({ newState: fakeState(Parser.RuleType.Macro)})), 
        fakeTokenBuilder(() => didCallTokenBuilder = true));
      parseWith([fakeFrame({ state: fakeState(rule) })])();
      expect(didCallRunner).toBe(true);
      expect(didCallTokenBuilder).toBe(false);
    });
    it.each(Object.values(Parser.RuleType))('should execute the "%s" runner but not tokenBuilder on criticalError', (rule : Parser.RuleType) => {
      let didCallRunner = false;
      let didCallTokenBuilder = false;
      ruleDef(rule, 
        fakeRule(() => didCallRunner = true, () => fakeUnrecoverable({ criticalError: Err.unrecoverable(Err.Type.InvalidArgument, 0) })), 
        fakeTokenBuilder(() => didCallTokenBuilder = true));
      parseWith([fakeFrame({ state: fakeState(rule) })])();
      expect(didCallRunner).toBe(true);
      expect(didCallTokenBuilder).toBe(false);
    });
    it.each(Object.values(Parser.RuleType))('should execute the "%s" runner and tokenBuilder on pop', (rule : Parser.RuleType) => {
      let didCallRunner = false;
      let didCallTokenBuilder = false;
      ruleDef(rule, 
        fakeRule(() => didCallRunner = true, fakePop), 
        fakeTokenBuilder(() => didCallTokenBuilder = true));
      parseWith([fakeFrame({ state: fakeState(rule) })])();
      expect(didCallRunner).toBe(true);
      expect(didCallTokenBuilder).toBe(true);
    });
    it.each(Object.values(Parser.RuleType))('should execute the "%s" runner and tokenBuilder on goto', (rule : Parser.RuleType) => {
      let didCallRunner = false;
      let didCallTokenBuilder = false;
      ruleDef(rule, 
        fakeRule(() => didCallRunner = true, () => fakeGoto({ newState: fakeState(Parser.RuleType.Macro)})), 
        fakeTokenBuilder(() => didCallTokenBuilder = true));
      parseWith([fakeFrame({ state: fakeState(rule) })])();
      expect(didCallRunner).toBe(true);
      expect(didCallTokenBuilder).toBe(true);
    });
  });
  describe('stack manipulation', () => {
    it('should remove from stack on pop', () => {
      ruleDef(Parser.RuleType.Main, 
        fakeRule(noop, () => fakePop()), 
        fakeTokenBuilder());
      const expectedFrame = fakeFrame({ startIndex: 10 });
      const frameToBePopped = fakeFrame({ startIndex: 20 });
      Expects.engineOutput(parseWith([expectedFrame, frameToBePopped])())
        .toHaveFrameEqualTo(expectedFrame)
        .toHaveAdditionalStackLength(1);
    });
    it('should add to stack on push', () => {
      const expectedStartIndex = 10;
      const expectedState = fakeState(Parser.RuleType.Macro);
      const priorFrame = fakeFrame({ state: fakeState(Parser.RuleType.Variable), startIndex: 20 });
      ruleDef(Parser.RuleType.Variable, 
        fakeRule(noop, () => fakePush({ newState: expectedState, endOfYield: expectedStartIndex - 1 })), 
        fakeTokenBuilder());
      Expects.engineOutput(parseWith([priorFrame])())
        .toHaveFrameMatching()
          .toHaveStartingIndex(expectedStartIndex)
          .toHaveStateEqualTo(expectedState)
          .toHaveNoOtherTokens()
        .toHaveParentAlsoMatching()
        .toHaveAdditionalStackLength(2);
    });
    it('should replace on stack on goto', () => {
      const expectedStartIndex = 10;
      const expectedState = fakeState(Parser.RuleType.Macro);
      const priorFrame = fakeFrame({ state: fakeState(Parser.RuleType.Variable), startIndex: expectedStartIndex });
      ruleDef(Parser.RuleType.Variable, 
        fakeRule(noop, () => fakeGoto({ newState: expectedState, endOfYield: 20 })), 
        fakeTokenBuilder());
      Expects.engineOutput(parseWith([priorFrame])())
        .toHaveFrameMatching()
          .toHaveStartingIndex(expectedStartIndex)
          .toHaveStateEqualTo(expectedState)
          .toHaveNoOtherTokens()
        .toHaveParentAlsoMatching()
        .toHaveAdditionalStackLength(1);
    });
  });
  describe('token buffer manipulation', () => {
    describe('on step', () => {
      it('should add the yielded token to the current frame', () => {
        const token1 = fakeToken({ startIndex: 0, endIndex: 9});
        const token2 = fakeToken({ startIndex: 10, endIndex: 19});
        const yieldedToken = fakeToken({ startIndex: 20, endIndex: 29});
        const existingTokens = [ token1, token2 ];
        const existingState = fakeState(Yield.StateType.Twinemarkup);
        const frameWithExistingTokens = fakeFrame({ tokens: [...existingTokens], state: existingState })

        ruleDef(existingState.type,
          fakeRule(noop, () => fakeStep({ token: yieldedToken })), 
          null,
        );
        const result = parseWith([frameWithExistingTokens])()
        Expects.engineOutput(result)
          .toHaveAdditionalStackLength(1)
          .toHaveFrameMatching(1)
            .toHaveNextTokensInOrder(...existingTokens)
            .toHaveNextToken(yieldedToken)
            .toHaveNoOtherTokens()
      });
    });
    describe('on pop', () => {
      it('should invoke the token builder with the current stack and a yielded token', () => {
        const token1 = fakeToken({ startIndex: 0, endIndex: 9});
        const token2 = fakeToken({ startIndex: 10, endIndex: 19});
        const yieldedToken = fakeToken({ startIndex: 20, endIndex: 29});
        const existingTokens = [ token1, token2 ];
        const existingState = fakeState(Yield.StateType.Macro);
        const frameWithExistingTokens = fakeFrame({ tokens: [...existingTokens], state: existingState })

        let invokedWithTokens = null;
        ruleDef(existingState.type,
          fakeRule(noop, () => fakePop({ token: yieldedToken })), 
          fakeTokenBuilder((
            source : Source,
            state : GenericState, 
            tokens : Token[],
            startIndex : StartIndex,
            endIndex : EndIndex,
          ) => {
            invokedWithTokens = tokens;
          }, () => fakeTokenBuilderResult(undefined))
        );
        const result = parseWith([frameWithExistingTokens])()
        expect(invokedWithTokens).not.toBeNull();
        invokedWithTokens = <Token[]><any>invokedWithTokens;
        expect(invokedWithTokens[0]).toEqual(token1);
        expect(invokedWithTokens[1]).toEqual(token2);
        expect(invokedWithTokens[2]).toEqual(yieldedToken);
      });
      it('should invoke the token builder with just the current stack if no yielded token', () => {
        const token1 = fakeToken({ startIndex: 0, endIndex: 9});
        const token2 = fakeToken({ startIndex: 10, endIndex: 19});
        const existingState = fakeState(Yield.StateType.Twinemarkup);
        const existingTokens = [ token1, token2 ];
        const currentFrame = fakeFrame({ tokens: [...existingTokens], state: existingState })

        let invokedWithTokens = null;
        ruleDef(currentFrame.state.type,
          fakeRule(noop, () => fakePop({ useToken: false })), 
          fakeTokenBuilder((
            source : Source,
            state : GenericState, 
            tokens : Token[],
            startIndex : StartIndex,
            endIndex : EndIndex,
          ) => {
            invokedWithTokens = tokens;
          })
        );
        const result = parseWith([currentFrame])()
        expect(invokedWithTokens).not.toBeNull();
        invokedWithTokens = <Token[]><any>invokedWithTokens;
        expect(invokedWithTokens[0]).toEqual(token1);
        expect(invokedWithTokens[1]).toEqual(token2);
        expect(invokedWithTokens).toHaveLength(2);
      });
      it('should add the created token to the previous frame', () => {
        const token1 = fakeToken({ startIndex: 0, endIndex: 9});
        const token2 = fakeToken({ startIndex: 10, endIndex: 19});
        const existingState = fakeState(Yield.StateType.Twinemarkup);
        const existingTokens = [ token1, token2 ];
        const currentFrame = fakeFrame({ tokens: [...existingTokens], state: existingState })

        const expectedToken : Token = { tokenType: Macro.TokenType, startIndex: 0, endIndex: 10 };
        ruleDef(currentFrame.state.type,
          fakeRule(noop, () => fakePop({ useToken: false })), 
          fakeTokenBuilder(noop, () => fakeTokenBuilderResult(expectedToken))
        );
        const result = parseWith([currentFrame])()
        Expects.engineOutput(result)
          .toHaveAdditionalStackLength(0)
          .toHaveFrameMatching(0)
            .toHaveNextToken(expectedToken)
            .toHaveNoOtherTokens()
      });
      it('should add not add an empty token', () => {
        const token1 = fakeToken({ startIndex: 0, endIndex: 9});
        const token2 = fakeToken({ startIndex: 10, endIndex: 19});
        const existingState = fakeState(Yield.StateType.Twinemarkup);
        const existingTokens = [ token1, token2 ];
        const currentFrame = fakeFrame({ tokens: [...existingTokens], state: existingState })

        ruleDef(currentFrame.state.type, 
          fakeRule(noop, () => fakePop({ useToken: false })), 
          fakeTokenBuilder(noop, () => fakeTokenBuilderResult(undefined))
        );
        const result = parseWith([currentFrame])()
        Expects.engineOutput(result)
          .toHaveAdditionalStackLength(0)
          .toHaveFrameMatching(0)
            .toHaveNoOtherTokens()
      });
    });
    describe('on goto', () => {
      it('should invoke the token builder with the current stack and a yielded token', () => {
        const token1 = fakeToken({ startIndex: 0, endIndex: 9});
        const token2 = fakeToken({ startIndex: 10, endIndex: 19});
        const yieldedToken = fakeToken({ startIndex: 20, endIndex: 29});
        const existingTokens = [ token1, token2 ];
        const existingState = fakeState(Yield.StateType.Twinescript)
        const currentFrame = fakeFrame({ tokens: [...existingTokens], state: existingState })
        const expectedState = fakeState(Yield.StateType.Macro);

        let invokedWithTokens = null;
        ruleDef(currentFrame.state.type,
          fakeRule(noop, () => fakeGoto({ token: yieldedToken, newState: expectedState })), 
          fakeTokenBuilder((
            source : Source,
            state : GenericState, 
            tokens : Token[],
            startIndex : StartIndex,
            endIndex : EndIndex,
          ) => {
            invokedWithTokens = tokens;
          }, () => fakeTokenBuilderResult(undefined))
        );
        parseWith([currentFrame])()
        expect(invokedWithTokens).not.toBeNull();
        invokedWithTokens = <Token[]><any>invokedWithTokens;
        expect(invokedWithTokens[0]).toEqual(token1);
        expect(invokedWithTokens[1]).toEqual(token2);
        expect(invokedWithTokens[2]).toEqual(yieldedToken);
      });
      it('should invoke the token builder with just the current stack if no yielded token', () => {
        const token1 = fakeToken({ startIndex: 0, endIndex: 9});
        const token2 = fakeToken({ startIndex: 10, endIndex: 19});
        const existingTokens = [ token1, token2 ];
        const existingState = fakeState(Yield.StateType.Twinescript)
        const currentFrame = fakeFrame({ tokens: [...existingTokens], state: existingState })
        const expectedState = fakeState(Yield.StateType.Macro);

        let invokedWithTokens = null;
        ruleDef(currentFrame.state.type,
          fakeRule(noop, () => fakeGoto({ useToken: false, newState: expectedState })), 
          fakeTokenBuilder((
            source : Source,
            state : GenericState, 
            tokens : Token[],
            startIndex : StartIndex,
            endIndex : EndIndex,
          ) => {
            invokedWithTokens = tokens;
          }, () => fakeTokenBuilderResult(undefined))
        );
        parseWith([currentFrame])()
        expect(invokedWithTokens).not.toBeNull();
        invokedWithTokens = <Token[]><any>invokedWithTokens;
        expect(invokedWithTokens[0]).toEqual(token1);
        expect(invokedWithTokens[1]).toEqual(token2);
      });
      it('should add the created token to the previous frame', () => {
        const token1 = fakeToken({ startIndex: 0, endIndex: 9});
        const token2 = fakeToken({ startIndex: 10, endIndex: 19});
        const existingTokens = [ token1, token2 ];
        const existingState = fakeState(Yield.StateType.Twinemarkup);
        const currentFrame = fakeFrame({ tokens: [...existingTokens], state: existingState })
        const expectedToken = fakeToken({ startIndex: 20, endIndex: 29 });
        const expectedState = fakeState(Yield.StateType.Macro);
        ruleDef(currentFrame.state.type, 
          fakeRule(noop, () => fakeGoto({ useToken: false, newState: expectedState })), 
          fakeTokenBuilder(noop, () => fakeTokenBuilderResult(expectedToken))
        );
        Expects.engineOutput(parseWith([currentFrame])())
          .toHaveAdditionalStackLength(1)
          .toHaveFrameMatching(1)
            .toHaveStateEqualTo(expectedState)
            .toHaveNoOtherTokens()
            .toHaveParentAlsoMatching()
          .toHaveFrameMatching(0)
            .toHaveNextToken(expectedToken)
            .toHaveNoOtherTokens()
      });
      it('should add not add an empty token', () => {
        const token1 = fakeToken({ startIndex: 0, endIndex: 9});
        const token2 = fakeToken({ startIndex: 10, endIndex: 19});
        const existingTokens = [ token1, token2 ];
        const existingState = fakeState(Yield.StateType.Twinemarkup);
        const currentFrame = fakeFrame({ tokens: [...existingTokens], state: existingState })
        const expectedState = fakeState(Yield.StateType.Macro);
        ruleDef(currentFrame.state.type,
          fakeRule(noop, () => fakeGoto({ useToken: false, newState: expectedState })), 
          fakeTokenBuilder(noop, () => fakeTokenBuilderResult(undefined))
        );
        Expects.engineOutput(parseWith([currentFrame])())
          .toHaveAdditionalStackLength(1)
          .toHaveFrameMatching(1)
            .toHaveStateEqualTo(expectedState)
            .toHaveNoOtherTokens()
            .toHaveParentAlsoMatching()
          .toHaveFrameMatching(0)
            .toHaveNoOtherTokens()
      });
    });
    describe('on push', () => {
      it('should add a yielded token to the current (not next) frame', () => {
        const token1 = fakeToken({ startIndex: 0, endIndex: 9});
        const token2 = fakeToken({ startIndex: 10, endIndex: 19});
        const expectedToken = fakeToken({ startIndex: 20, endIndex: 29 });
        const existingTokens = [ token1, token2 ];
        const existingState = fakeState(Yield.StateType.Twinemarkup);
        const currentFrame = fakeFrame({ tokens: [...existingTokens], state: existingState })
        const expectedState = fakeState(Yield.StateType.Macro);

        ruleDef(currentFrame.state.type,
          fakeRule(noop, () => fakePush({ token: expectedToken, newState: expectedState })), 
          null
        );
        Expects.engineOutput(parseWith([currentFrame])())
          .toHaveAdditionalStackLength(2)
          .toHaveFrameMatching(2)
            .toHaveStateEqualTo(expectedState)
            .toHaveNoOtherTokens()
            .toHaveParentAlsoMatching()
          .toHaveFrameMatching(1)
            .toHaveStateEqualTo(existingState)
            .toHaveNextTokensInOrder(...existingTokens)
            .toHaveNextToken(expectedToken)
            .toHaveNoOtherTokens()
            .toHaveParentAlsoMatching()
          .toHaveFrameMatching(0)
            .toHaveNoOtherTokens()
      });
      it('should not add an empty token', () => {
        const token1 = fakeToken({ startIndex: 0, endIndex: 9});
        const token2 = fakeToken({ startIndex: 10, endIndex: 19});
        const existingTokens = [ token1, token2 ];
        const existingState = fakeState(Yield.StateType.Twinemarkup);
        const currentFrame = fakeFrame({ tokens: [...existingTokens], state: existingState })
        const expectedState = fakeState(Yield.StateType.Macro);

        ruleDef(currentFrame.state.type,
          fakeRule(noop, () => fakePush({ useToken: false, newState: expectedState })), 
          fakeTokenBuilder(noop, () => fakeTokenBuilderResult(undefined))
        );
        Expects.engineOutput(parseWith([currentFrame])())
          .toHaveAdditionalStackLength(2)
          .toHaveFrameMatching(2)
            .toHaveStateEqualTo(expectedState)
            .toHaveNoOtherTokens()
            .toHaveParentAlsoMatching()
          .toHaveFrameMatching(1)
            .toHaveStateEqualTo(existingState)
            .toHaveNextTokensInOrder(...existingTokens)
            .toHaveNoOtherTokens()
            .toHaveParentAlsoMatching()
          .toHaveFrameMatching(0)
            .toHaveNoOtherTokens()
      });
    });
    describe('on error', () => {
      it('should not add a yielded token or invoke the token builder', () => {
        const token1 = fakeToken({ startIndex: 0, endIndex: 9});
        const token2 = fakeToken({ startIndex: 10, endIndex: 19});
        const yieldedToken = fakeToken({ startIndex: 20, endIndex: 29 });
        const existingState = fakeState(Yield.StateType.Twinemarkup);
        const existingTokens = [ token1, token2 ];
        const currentFrame = fakeFrame({ tokens: [...existingTokens], state: existingState })
        ruleDef(currentFrame.state.type, 
          fakeRule(noop, () => fakeUnrecoverable({ token: yieldedToken, criticalError: Err.unrecoverable(Err.Type.InvalidArgument, 0) })), 
          // token builder should not be invoked
          null
        );
        Expects.engineOutput(parseWith([currentFrame])())
          .toHaveAdditionalStackLength(1)
          .toHaveFrameMatching(1)
            .toHaveStateEqualTo(existingState)
            .toHaveNextTokensInOrder(...existingTokens)
            .toHaveNoOtherTokens()
            .toHaveParentAlsoMatching()
          .toHaveFrameMatching(0)
            .toHaveNoOtherTokens()
      });
      it('should not add an empty token', () => {
        const token1 = fakeToken({ startIndex: 0, endIndex: 9});
        const token2 = fakeToken({ startIndex: 10, endIndex: 19});
        const existingState = fakeState(Yield.StateType.Twinemarkup);
        const existingTokens = [ token1, token2 ];
        const currentFrame = fakeFrame({ tokens: [...existingTokens], state: existingState })
        ruleDef(currentFrame.state.type, 
          fakeRule(noop, () => fakeUnrecoverable({ useToken: false, criticalError: Err.unrecoverable(Err.Type.InvalidArgument, 0) })), 
          // token builder should not be invoked
          null
        );
        Expects.engineOutput(parseWith([currentFrame])())
          .toHaveAdditionalStackLength(1)
          .toHaveFrameMatching(1)
            .toHaveStateEqualTo(existingState)
            .toHaveNextTokensInOrder(...existingTokens)
            .toHaveNoOtherTokens()
            .toHaveParentAlsoMatching()
          .toHaveFrameMatching(0)
            .toHaveNoOtherTokens()
      });
    });
  });
  describe('error handling', () => {
    it('should propogate error tokens from yield', () => {
      const expectedError : Err.TokenError = Err.tokenError(Err.Type.InvalidArgument, fakeToken());
      ruleDef(Parser.RuleType.Main, 
        fakeRule(noop, () => fakeStep({ errors: [expectedError] })), 
        fakeTokenBuilder());
      Expects.engineOutput(parseWith()())
        .toHaveYieldMatching()
          .toHaveTokenErrorEqualTo(expectedError)
          .toHaveNoOtherErrors();
    });
    it('should propogate error tokens from token build', () => {
      const expectedError : Err.TokenError = Err.tokenError(Err.Type.InvalidArgument, fakeToken());
      ruleDef(Parser.RuleType.Main, 
        fakeRule(noop, fakePop), 
        fakeTokenBuilder(noop, () => fakeTokenBuilderResult(undefined, [expectedError])));
      Expects.engineOutput(parseWith()())
        .toHaveYieldMatching()
          .toHaveTokenErrorEqualTo(expectedError)
          .toHaveNoOtherErrors();
    });
    it('should propogate critical error from yield', () => {
      const criticalError : Err.ParserError = Err.unrecoverable(Err.Type.InvalidArgument, 0);
      ruleDef(Parser.RuleType.Main, 
        fakeRule(noop, () => fakeUnrecoverable({ criticalError })), 
        fakeTokenBuilder());
      Expects.engineOutput(parseWith()())
        .toHaveYieldMatching()
          .toYieldType(YieldType.UNRECOVERABLE)
          .toHaveCriticalErrorEqualTo(criticalError)
          .toHaveNoOtherErrors();
    });
    it('should propogate critical error from token build', () => {
      const expectedError : Err.ParserError = Err.unrecoverable(Err.Type.InvalidArgument, 0);
      ruleDef(Parser.RuleType.Main, 
        fakeRule(noop, fakePop), 
        fakeTokenBuilder(noop, () => fakeTokenBuilderResult(expectedError)));
      Expects.engineOutput(parseWith()())
        .toHaveYieldMatching()
          .toYieldType(YieldType.UNRECOVERABLE)
          .toHaveCriticalErrorEqualTo(expectedError)
          .toHaveNoOtherErrors();
    });
  });
});

function ruleDef(type : Parser.RuleType, runner : Parser.GenericRunner | null, builder : Parser.GenericTokenBuilder | null) : Parser.GenericDefinition {
  const def : Parser.GenericDefinition = { type: type, runner: <any>runner, tokenBuilder: <any>builder };
  DefinitionTable[type] = def;
  return def;
}
type FakeTokenArgs = Partial<{type : TokenType, length : number, startIndex : StartIndex } & Partial<AnyToken>>
function fakeToken({ type, length, startIndex, ...additionalArgs }: FakeTokenArgs = {}) : Token {
  const baseToken : Token =  {
    startIndex: startIndex || 0,
    endIndex: (startIndex || 0) + (length || 1) - 1,
    tokenType: (type || TokenType.Content),
  };
  return <Token>{
    ...baseToken,
    ...additionalArgs
  }
}
type YieldArgs = {
  errors : Err.TokenError[],
  criticalError : Err.ParserError,
  newState : Yield.GenericState,
  endOfYield : EndIndex,
  useToken : boolean,
  token : Token,
};
function withYieldArgs<T extends Yield.Generic>(builder : Yield.Builder<T>, args : Partial<FakeTokenArgs & YieldArgs> = {}) : Yield.Builder<T> {
  const token = args.token || fakeToken(args);
  const lastIndex = args.endOfYield || (args.useToken ? token.endIndex : args.endIndex) || 1;
  if (args.errors) {
    builder.addErrors(...args.errors);
  }
  if (args.newState) {
    builder.setNewState(args.newState);
  }
  if (args.useToken || args.token) {
    builder.setToken(token);
  }
  if (args.criticalError) {
    builder.setCriticalError(args.criticalError);
  }
  builder.setLastIndex(lastIndex);
  return builder;
}
function fakeStep(args ?: Partial<FakeTokenArgs & YieldArgs>) : Yield.Step {
  return withYieldArgs(Yield.step(), { useToken: true, ...args }).build();
}
function fakePop(args ?: Partial<FakeTokenArgs & YieldArgs>) : Yield.Pop {
  return withYieldArgs(Yield.pop(), args).build();
}
function fakeGoto(args ?: Partial<FakeTokenArgs & YieldArgs>) : Yield.Goto {
  if (!args?.newState) {throw Err.unexpected(); }
  return withYieldArgs(Yield.goto(), args).build();
}
function fakePush(args ?: Partial<FakeTokenArgs & YieldArgs>) : Yield.Push {
  if (!args?.newState) {throw Err.unexpected(); }
  return withYieldArgs(Yield.push(), args).build();
}
function fakeUnrecoverable(args ?: Partial<FakeTokenArgs & YieldArgs>) : Yield.Unrecoverable {
  if (!args?.criticalError) {throw Err.unexpected(); }
  return withYieldArgs(Yield.unrecoverable(), args).build();
}
function fakeTokenBuilderResult(tokenOrCritError ?: FakeTokenArgs | Err.ParserError | undefined, errors ?: Err.TokenError[]) : Parser.GenericTokenBuilderResult {
  const result : Parser.GenericTokenBuilderResult = {
    result: tokenOrCritError instanceof Err.ParserError 
      ? tokenOrCritError 
      : (tokenOrCritError !== undefined ? fakeToken(tokenOrCritError) : undefined)
  }
  if (errors && errors.length > 0) {
    result.errors = errors;
  }
  return result;
}
type SideEffect = (...args : any[]) => void;
type Returns<T> = (...args : any[]) => T;
function fakeRule(sideEffect : SideEffect = noop, returnFn : Returns<Yield.Generic> = () => fakeStep()) : Parser.GenericRunner {
  return (...args : any[]) => {
    sideEffect(...args);
    return returnFn(...args);
  }
}
function fakeTokenBuilder(sideEffect : SideEffect = noop, returnFn : Returns<Parser.GenericTokenBuilderResult> = () => fakeTokenBuilderResult()) : Parser.GenericTokenBuilder {
  return (...args : any[]) => {
    sideEffect(...args);
    return returnFn(...args);
  }
}
const FIRST_YIELD : Yield.Generic = {
  type: YieldType.START,
  lastIndex: -1,
}
function fakeFrame({ tokens, state, startIndex }: {tokens ?: Token[], state ?: Yield.GenericState, startIndex ?: StartIndex }={}) : Parser.Frame {
  const frame : Parser.Frame = {
    state: state || Yield.Main.State.create(),
    startIndex: startIndex || 0,
    tokenBuffer: tokens || [],
    snapshot: () => cloneDeep(frame),
  }
  return frame;
}
function fakeState(type : Parser.RuleType) : GenericState {
  const fake = {
    type,
    equals: (other : any) => other.type === type,
    clone: () => fake
  }
  return fake;
}
function firstFrame() : Parser.Frame {
  const thisFrame = {
    state: Yield.Main.State.create(),
    startIndex: 0,
    tokenBuffer: [],
    snapshot: () => cloneDeep(thisFrame),
  }
  return thisFrame;
}
function parseWith(additionalStack : Parser.Frame[] = [], lastYield : Yield.Generic = FIRST_YIELD, defaultSource : string = '') : (source ?: string) => Parser.EngineOutput {
  return (source : string = defaultSource) => {
    const stack = [firstFrame()];
    additionalStack.forEach(f => stack.push(f));
    return parse({source, stack, lastYield});
  }
}
type FluentParserFrameMatcher = GeneralFluentParserFrameMatcher<FluentParserFrameMatcher>;
declare module "./rule-test.util" {
  class Expects {
    static engineOutput(output : Parser.EngineOutput) : FluentParserYieldMatcher
    static frame(frame : Parser.Frame) : FluentParserFrameMatcher
  }
}
Expects.engineOutput = function engineOutput(output : Parser.EngineOutput) : FluentParserYieldMatcher {
  return new FluentParserYieldMatcher(output);
}
Expects.frame = function frame(frame : Parser.Frame) : FluentParserFrameMatcher {
  return new GeneralFluentParserFrameMatcher(frame);
}

type WithParent<T, P> = T & { toHaveParentAlsoMatching: () => P }
type FluentYieldMatcherWithParent = WithParent<Expects.GeneralFluentYieldMatcher<FluentYieldMatcherWithParent>, FluentParserYieldMatcher>
type FluentParserFrameMatcherWithParent = WithParent<GeneralFluentParserFrameMatcher<FluentParserFrameMatcherWithParent>, FluentParserYieldMatcher>
class FluentParserYieldMatcher {
  constructor(actual : Parser.EngineOutput) {
    this.actual = actual;
  }
  actual : Parser.EngineOutput;
  toHaveAdditionalStackLength(length : number) : FluentParserYieldMatcher {
    expect(this.actual.stack).toHaveLength(length + 1);
    return this;
  }
  toHaveYieldMatching() : FluentYieldMatcherWithParent {
    const matcher = Expects.anyYield(this.actual.nextYield);
    Object.assign(matcher, { toHaveParentAlsoMatching: () => this  });
    return <FluentYieldMatcherWithParent>matcher;
  }
  toHaveFrameEqualTo(frame : Parser.Frame, index ?: number) : FluentParserYieldMatcher {
    expect(this.actual.stack[index ?? this.actual.stack.length - 1]).toEqual(frame);
    return this;
  }
  toHaveFrameMatching(index ?: number) : FluentParserFrameMatcherWithParent {
    const matcher = new GeneralFluentParserFrameMatcher(this.actual.stack[index ?? this.actual.stack.length - 1]);
    Object.assign(matcher, { toHaveParentAlsoMatching: () => this  });
    return <FluentParserFrameMatcherWithParent>matcher;
  }
}
class GeneralFluentParserFrameMatcher<S extends GeneralFluentParserFrameMatcher<S>> {
  constructor(actual : Parser.Frame) {
    this.actual = actual;
  }
  actual : Parser.Frame;
  examinedTokens : number = 0;
  toHaveStartingIndex(startIndex : number) : S {
    expect(this.actual.startIndex).toBe(startIndex);
    return <any>this;
  }
  toHaveState(type : Yield.StateType, otherProps ?: Partial<Yield.AnyState>) : S {
    expect(this.actual.state.type).toBe(type)
    if (otherProps) {
      expect(this.actual.state).toEqual(otherProps)
    }
    return <any>this;
  }
  toHaveStateEqualTo(state : Yield.GenericState) : S {
    expect(this.actual.state).toEqual(state);
    return <any>this;
  }
  toHaveNextToken(tokenMatcher : Partial<AnyToken>) : S {
    expect(this.actual.tokenBuffer[this.examinedTokens++]).toEqual(expect.objectContaining(tokenMatcher));
    return <any>this;
  }
  toHaveNextTokensInOrder(...tokenMatchers : Partial<AnyToken>[]) : S {
    const tokensToExamine = this.actual.tokenBuffer.slice(this.examinedTokens, tokenMatchers.length);
    expect(tokensToExamine).toEqual(tokenMatchers.map(m => expect.objectContaining(m)));
    this.examinedTokens += tokenMatchers.length;
    return <any>this;
  }
  toHaveNoOtherTokens() : S {
    expect(this.actual.tokenBuffer).toHaveLength(this.examinedTokens);
    return <any>this;
  }
}
