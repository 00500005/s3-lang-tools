import { Yield, Err, AnyToken, Token, TokenType, StartIndex, EndIndex, Parser, Source, Content, Twinescript, Variable, GenericTokenChainBuilder } from "../types";


function sourceAndTokens(rawContentTokens: string[], rawTwinescriptToken ?: string) : [Source, Token[]] {
  const source = rawContentTokens.join('') + (rawTwinescriptToken || '');
  let runningIndex = 0;
  const contentTokens = rawContentTokens.map(s => {
    const token = Content.builder()
      .setStartIndex(runningIndex)
      .setEndIndex(runningIndex + Index.endOf(s))
      .build();
    runningIndex += Index.pastEndOf(s);
    return token;
  });
  if (rawTwinescriptToken) {
    const twinescriptToken = Twinescript.builder()
      // $a=0
      .setStartIndex(runningIndex)
      .setEndIndex(runningIndex + Index.endOf(rawTwinescriptToken))
      .addVariable(Variable.Type.GLOBAL)
        .setStartIndex(runningIndex + 1)
        .setEndIndex(runningIndex + 1)
        .getParent()
      .addContent()
        .setStartIndex(runningIndex + 2)
        .setEndIndex(runningIndex + 3)
        .getParent()
      .build();
    return [source, [
      ...contentTokens,
      twinescriptToken
    ]];
  }
  return [source, contentTokens];
}
export namespace Setup {
  export function createDefaultRunner<S extends Yield.RawState<S>>(runner : Parser.Runner<S>, defaultState : () => S) {
    return function run(source : string, startAt ?: StartIndex, state ?: S | null, customYield ?: Yield.Generic) {
      return runner(source, state ?? defaultState(), customYield ?? YieldInstance.fromIndex(startAt));
    };
  }
  export type TokenBuilderParameterSupplier = (...args : any[]) => [Source, Token[]]
  export function defaultTestTokenBuilderBuilder<S extends Yield.RawState<S>, T extends Token>(tokenBuilder : Parser.TokenBuilder<S, T>, defaultState : () => S, defaultStartIndex ?: StartIndex) {
    return (startIndex ?: StartIndex) => createTestTokenBuilderBuilder(tokenBuilder, defaultState, startIndex ?? defaultStartIndex);
  }
  export function createTestTokenBuilderBuilder<S extends Yield.RawState<S>, T extends Token>(tokenBuilder : Parser.TokenBuilder<S, T>, defaultState : () => S, startIndex ?: StartIndex) {
    const builder = SourceTokenChainBuilder.builder(
      function buildTestTargetToken(customState ?: S, frameStartIndex : number = 0, lastIndex ?: number) : Parser.TokenBuilderResult<T> {
        const source = builder.source
        const tokens = builder.tokens;
        return tokenBuilder(source, customState ?? defaultState(), tokens, frameStartIndex || 0, lastIndex ?? source.length - 1);
      }, startIndex
    );
    return builder;
  }
  export type TokenBuilderType = Twinescript.Builder.Generic | Content.Builder.Generic;
  export type TargetInvocation<S, T extends Token> = (customState ?: S, frameStartIndex ?: number, lastIndex ?: number) => Parser.TokenBuilderResult<T>
  export class SourceTokenChainBuilder<S, T extends Token> {
    static builder<S, T extends Token>(targetInvocation : TargetInvocation<S, T>, startIndex ?: StartIndex) : SourceTokenChainBuilder<S, T> {
      return new SourceTokenChainBuilder(targetInvocation, startIndex);
    }
    constructor(targetInvocation : TargetInvocation<S, T>, startIndex : StartIndex = 0) { 
      this.buildTestTargetToken = targetInvocation;
      this.startIndex = startIndex;
    }
    sourceLength: number = 0;
    startIndex: number;
    rawTokens: string[] = [];
    tokensMappedToRaw: (Token|null)[] = [];
    buildTestTargetToken : TargetInvocation<S, T>;
    get source() : string {
      return this.rawTokens.join('');
    }
    get tokens() : Token[] {
      return <Token[]>this.tokensMappedToRaw.filter(t => t !== null);
    }
    /**
     * NOTE: {@link SourceTokenChainBuilder.tokensMappedToRaw} is appended with nulls
     *  if it has fewer elements after inserting
     */
    addRawToken(rawToken : string) : SourceTokenChainBuilder<S,T> {
      this.rawTokens.push(rawToken);
      while (this.tokensMappedToRaw.length < this.rawTokens.length) {
        this.tokensMappedToRaw.push(null);
      }
      this.sourceLength += rawToken.length;
      return this;
    }
    addToken(rawToken : string, maybeBuilder : GenericTokenChainBuilder | Token, overrideProps : Partial<AnyToken> = {}) : SourceTokenChainBuilder<S,T> {
      let token : Token;
      if (!!(<GenericTokenChainBuilder>maybeBuilder)?.build) {
        const tokenBuilder = <GenericTokenChainBuilder>maybeBuilder;
        token = tokenBuilder
          .setStartIndex(this.startIndex + this.sourceLength)
          .setEndIndex(this.startIndex + this.sourceLength + Index.endOf(rawToken))
          .build();
      } else {
        token = <Token>maybeBuilder;
      }
      // NOTE: order is important
      this.tokensMappedToRaw.push(Object.assign(token, overrideProps));
      this.addRawToken(rawToken);
      return this;
    }
    addContent(rawToken : string, overrideProps : Partial<Content.Token>={}) : SourceTokenChainBuilder<S,T> {
      return this.addToken(rawToken, Content.builder(), overrideProps);
    }
    addTwinescript(rawToken : string, overrideProps : Partial<Twinescript.Token>={}) : SourceTokenChainBuilder<S,T> {
      return this.addToken(rawToken, Twinescript.builder(), overrideProps);
    }
  }
}
export namespace Index {
  export function endOf(token : String) : number {
    return token.length - 1;
  }
  export function pastEndOf(token : String) : number {
    return token.length;
  }
}
export namespace YieldInstance {
  export function fromIndex(startAt ?: StartIndex) : Yield.Generic {
    return {
      type: Yield.Type.START,
      lastIndex: (startAt ?? 0) - 1,
    }
  }
}
export namespace Expects {
  export function tokenResult<T extends Token>(actual : Parser.TokenBuilderResult<T>) : FluentTokenResultMatcher {
    return <any>new GeneralFluentTokenResultMatcher(actual);
  }
  export function anyYield(actual : Yield.Any) : FluentYieldMatcher {
    return <any>new GeneralFluentYieldMatcher(actual);
  }
  export function push(actual : Yield.Any) : FluentYieldMatcher {
    return <any>new GeneralFluentYieldMatcher(actual)
      .toYieldType(Yield.Push);
  }
  export function goto(actual : Yield.Any) : FluentYieldMatcher {
    return <any>new GeneralFluentYieldMatcher(actual)
      .toYieldType(Yield.Goto);
  }
  export function pop(actual : Yield.Any) : FluentYieldMatcher {
    return <any>new GeneralFluentYieldMatcher(actual)
      .toYieldType(Yield.Pop);
  }
  export function step(actual : Yield.Any) : FluentYieldMatcher {
    return <any>new GeneralFluentYieldMatcher(actual)
      .toYieldType(Yield.Step);
  }
  export function criticalError(actual : Yield.Any) : FluentYieldMatcher {
    return <any>new GeneralFluentYieldMatcher(actual)
      .toYieldType(Yield.Unrecoverable);
  }
  /**
   * @todo merge this and {@link FluentYieldMatcher} as they share much of the same code
   */
  export type FluentTokenResultMatcher = GeneralFluentTokenResultMatcher<FluentTokenResultMatcher>;
  export class GeneralFluentTokenResultMatcher<S extends GeneralFluentTokenResultMatcher<S>> {
    constructor(actual ?: Parser.GenericTokenBuilderResult) {
      expect(actual).not.toBeFalsy();
      if (actual?.result instanceof Err.ParserError) {
        this.criticalError = actual.result;
        this.token = null;
      } else {
        this.criticalError = null;
        this.token = <AnyToken>actual?.result;
      }
      this.errors = actual?.errors || [];
    }
    token : AnyToken | null;
    criticalError : Err.ParserError | null;
    errors : Err.TokenError[];
    checkedErrorCount : number = 0;
    expectedCriticalError : boolean = false;
    
    toHaveTokenContaining(tokenProps : Partial<AnyToken>) : S {
      expect(this.token).toEqual(expect.objectContaining(tokenProps))
      return <any>this;
    };
    toHaveTokenEqualTo(tokenProps : Partial<AnyToken>) : S {
      expect(this.token).toEqual(tokenProps);
      return <any>this;
    }
    toHaveCriticalError(errorType : Err.Type, criticalErrorProps ?: Partial<Err.ParserError>) : S {
      expect(this.criticalError?.errorType).toEqual(errorType);
      expect(this.criticalError?.recoverable).toEqual(false);
      if (criticalErrorProps) {
        expect(this.criticalError).toEqual(expect.objectContaining(criticalErrorProps))
      }
      this.expectedCriticalError = true;
      return <any>this;
    };
    toHaveNoOtherErrors() : S {
      if (!this.expectedCriticalError) {
        expect(this.criticalError).toBeNull();
      }
      expect(this.errors).toHaveLength(this.checkedErrorCount);
      return <any>this;
    };
    toHaveTokenError(type: Err.Type, tokenType: TokenType, additionalProps ?: Partial<Err.TokenError>) : S {
      const foundError = this.errors?.find((e) => e.errorType === type);
      expect(foundError).toBeTruthy();
      expect(foundError?.errorType).toBe(type);
      expect(foundError?.tokenType).toBe(tokenType);
      if (additionalProps) {
        expect(foundError).toEqual(expect.objectContaining(additionalProps));
      }
      this.checkedErrorCount++;
      return <any>this;
    };
  }
  export type FluentYieldMatcher = GeneralFluentYieldMatcher<FluentYieldMatcher>;
  export class GeneralFluentYieldMatcher<S extends GeneralFluentYieldMatcher<S>> {
    constructor(actual ?: Yield.Any) {
      expect(actual).not.toBeFalsy();
      this.actual = <Yield.Any>actual;
    }
    actual : Yield.Any;
    endAt ?: number;
    checkedErrorCount : number = 0;
    expectedCriticalError: boolean = false;
    toYieldType(type : Yield.Type) : S {
      expect(this.actual?.type).toBe(type);
      return <S><any>this;
    };
    toEndAt(endIndex : EndIndex) : S {
      expect(this.actual?.lastIndex).toBe(endIndex);
      this.endAt = endIndex;
      return <S><any>this;
    };
    toHaveNoToken() : S {
      expect(this.actual?.token).toBeUndefined();
      return <S><any>this;
    }
    toHaveMatchingToken(tokenType : TokenType, startIndex : number = 0, endIndex ?: number, additionalProps ?: Partial<AnyToken>) : S {
      expect(this.actual?.token?.tokenType).toBe(tokenType);
      expect(this.actual?.token?.startIndex).toBe(startIndex);
      if (endIndex === undefined && this.endAt !== undefined) {
        expect(this.actual?.lastIndex).toBe(this.endAt);
      }
      if(additionalProps) {
        expect(this.actual?.token).toEqual(expect.objectContaining(additionalProps));
      }
      return <S><any>this;
    }
    toHaveTokenContaining(tokenProps : Partial<Token>) : S {
      expect(this.actual?.token).toEqual(expect.objectContaining(tokenProps))
      return <S><any>this;
    };
    toHaveState(ruleType : Yield.StateType, stateProps ?: Yield.AllState) : S {
      expect(this.actual?.newState).not.toBeFalsy();
      expect(this.actual?.newState?.type).toBe(ruleType);
      if (stateProps) {
        expect(this.actual?.newState).toEqual(expect.objectContaining(stateProps))
      }
      return <S><any>this;
    }
    toHaveStateMatching(stateProps ?: Yield.AllState) : S {
      expect(this.actual?.newState).toEqual(expect.objectContaining(stateProps))
      return <S><any>this;
    }
    toHaveStateEqualTo(stateProps ?: Yield.AllState) : S {
      expect(this.actual?.newState).toEqual(stateProps);
      return <S><any>this;
    }
    toHaveCriticalErrorEqualTo(err : Err.ParserError) : S {
      expect(this.actual.criticalError).toEqual(err);
      this.expectedCriticalError = true;
      return <any>this;
    }
    toHaveCriticalError(errorType : Err.Type, criticalErrorProps ?: Partial<Err.ParserError>) : S {
      expect(this.actual?.criticalError?.errorType).toEqual(errorType);
      expect(this.actual?.criticalError?.recoverable).toEqual(false);
      if (criticalErrorProps) {
        expect(this.actual?.criticalError).toEqual(expect.objectContaining(criticalErrorProps))
      }
      this.expectedCriticalError = true;
      return <S><any>this;
    };
    toHaveNoOtherErrors() : S {
      expect(!!this.actual?.criticalError).toBe(this.expectedCriticalError);
      expect(this.actual?.errors || []).toHaveLength(this.checkedErrorCount);
      return <S><any>this;
    };
    toHaveTokenErrorEqualTo(err : Err.TokenError) : S {
      const foundError = this.actual?.errors?.find((e) => e.errorType === err.errorType);
      expect(foundError).toEqual(err);
      this.checkedErrorCount++;
      return <any>this;
    }
    toHaveTokenError(type: Err.Type, tokenType: TokenType, additionalProps ?: Partial<Err.TokenError>) : S {
      const foundError = this.actual?.errors?.find((e) => e.errorType === type);
      expect(foundError).toBeTruthy();
      expect(foundError?.errorType).toBe(type);
      expect(foundError?.tokenType).toBe(tokenType);
      if (additionalProps) {
        expect(foundError).toEqual(expect.objectContaining(additionalProps));
      }
      this.checkedErrorCount++;
      return <S><any>this;
    }
  }
}
