import "jest";
import { runner, VariableType, State, tokenBuilder } from "./variable";
import { Expects, Setup, Index } from "./rule-test.util";
import { Yield, TokenType, Twinescript, Content, Variable } from "../types";
import { VariableState } from "../types/rule-states";

type S1 = [string]
type S2 = [string, string]
type S3 = [string, string, string]

describe('variable', () => {
  describe('runner', () => {
    let state : State | null;
    const run = Setup.createDefaultRunner(runner, () => <State>state);
    // for the test to set the state before use
    beforeEach(() => { state = null; });
    it.each(transformTestInput<S1>([
      ['foo'],
      ['bar0_$'],
    ]))('should emit pop given: "%s%s"', (varType : VariableType, name: string, [token1] : S1) => {
      state = State.create(varType);
      const [token1StartIndex, token1EndIndex] = trimmedTokenIndicies(token1);
      Expects.pop(run(token1 + '+ ignored'))
        .toEndAt(Index.endOf(token1))
        .toHaveMatchingToken(TokenType.Content, token1StartIndex, token1EndIndex)
        .toHaveNoOtherErrors()
    });

    it.each(transformTestInput<S2>([
      ['foo', 'bar'],
      ['bar0_$', 'ba$_'],
    ], template('$0.$1')))('should emit step,pop given: "%s%s"', (varType : VariableType, name: string, [token1, token2] : S2) => {
      state = State.create(varType);
      const source = token1 + '.' + token2 + '+ ignored';
      const [token1StartIndex, token1EndIndex] = trimmedTokenIndicies(token1);
      const [token2StartIndex, token2EndIndex] = trimmedTokenIndicies(token2, Index.pastEndOf(token1 + '.'));
      Expects.step(run(source))
        .toEndAt(Index.endOf(token1 + '.'))
        .toHaveMatchingToken(TokenType.Content, token1StartIndex, token1EndIndex)
        .toHaveNoOtherErrors()
      Expects.pop(run(source, token2StartIndex))
        .toEndAt(Index.endOf(token1 + '.' + token2))
        .toHaveMatchingToken(TokenType.Content, token2StartIndex, token2EndIndex)
        .toHaveNoOtherErrors()
    });

    it.each(transformTestInput<S2>([
      ['foo', '[bar]'],
      ['bar0_$', '[ba$_]'],
    ]))('should emit push,pop given: "%s%s"', (varType : VariableType, name : string, [token1, twinescriptToken] : S2) => {
      state = State.create(varType);
      const source = token1 + twinescriptToken + '+ ignored';
      const [token1StartIndex, token1EndIndex] = trimmedTokenIndicies(token1);
      const [twinescriptStartIndex, twinescriptEndIndex] = trimmedTokenIndicies(twinescriptToken, Index.pastEndOf(token1));
      Expects.push(run(source))
        .toEndAt(twinescriptStartIndex)
        .toHaveMatchingToken(TokenType.Content, token1StartIndex, token1EndIndex)
        .toHaveState(Yield.Twinescript.Type, { endMode: Yield.Twinescript.EndMode.INDEX })
        .toHaveNoOtherErrors()
      const returningFromTwinescript = Yield.pop()
        .setLastIndex(twinescriptEndIndex)
        .buildTwinescriptToken()
          .setStartIndex(Index.pastEndOf(token1))
          .setEndIndex(twinescriptEndIndex)
          .getParent()
        .build();
      Expects.pop(run(source, undefined, null, returningFromTwinescript))
        .toEndAt(Index.endOf(token1 + twinescriptToken))
        .toHaveNoToken()
        .toHaveNoOtherErrors()
    });

    it.each(transformTestInput<S3>([
      ['foo', '[bar]', 'baz'],
      ['bar0_$', '[ba$_]', 'ba$_'],
    ], template('$0$1.$2')))('should emit push,pop given: "%s%s"', (varType : VariableType, name : string, [token1, twinescriptToken, token2] : [string, string, string]) => {
      state = State.create(varType);
      const source = token1 + twinescriptToken + '.' + token2 + '+ ignored';
      const [token1StartIndex, token1EndIndex] = trimmedTokenIndicies(token1);
      const [twinescriptStartIndex, twinescriptEndIndex] = trimmedTokenIndicies(twinescriptToken, Index.pastEndOf(token1));
      const [token2StartIndex, token2EndIndex] = trimmedTokenIndicies(token2, Index.pastEndOf(token1 + twinescriptToken + '.'));
      Expects.push(run(source))
        // we consume the bracket
        .toEndAt(twinescriptStartIndex)
        .toHaveMatchingToken(TokenType.Content, token1StartIndex, token1EndIndex)
        .toHaveState(Yield.Twinescript.Type, { endMode: Yield.Twinescript.EndMode.INDEX })
        .toHaveNoOtherErrors()
      const returningFromTwinescript = Yield.pop()
        .setLastIndex(twinescriptEndIndex)
        .buildTwinescriptToken()
          .setStartIndex(Index.pastEndOf(token1))
          .setEndIndex(twinescriptEndIndex)
          .getParent()
        .build();
      Expects.step(run(source, undefined, null, returningFromTwinescript))
        .toEndAt(Index.endOf(token1 + twinescriptToken + '.'))
        .toHaveNoToken()
        .toHaveNoOtherErrors()
      Expects.pop(run(source, Index.pastEndOf(token1 + twinescriptToken + '.')))
        .toEndAt(Index.endOf(token1 + twinescriptToken + '.' + token2))
        .toHaveMatchingToken(TokenType.Content, token2StartIndex, token2EndIndex)
        .toHaveNoOtherErrors()
    });

    it.each([VariableType.GLOBAL, VariableType.LOCAL])('should pop at new name given: "%sfoo bar"', (varType : VariableType) => {
      state = State.create(varType);
      const token1 = "foo ";
      const source = token1 + "bar";
      const [token1StartIndex, token1EndIndex] = trimmedTokenIndicies(token1);
      Expects.pop(run(source))
        .toEndAt(Index.endOf(token1))
        .toHaveMatchingToken(TokenType.Content, token1StartIndex, token1EndIndex)
        .toHaveNoOtherErrors()
    });

    it.each([VariableType.GLOBAL, VariableType.LOCAL])('should allow trailing "." for %s variables', (varType) => {
      state = State.create(varType);
      const token = "foo.";
      Expects.pop(run(token))
        // don't consume the '.'
        .toEndAt(Index.endOf(token) - 1)
        .toHaveMatchingToken(TokenType.Content)
        .toHaveNoOtherErrors()
    });
  });
  describe('tokenBuilder', () => {
    it.each([VariableType.GLOBAL, VariableType.LOCAL])('should build token for %s variables', (variableType : VariableType) => {
      const startIndex = 5;
      const endIndex = 100;
      const tokens = [
        Content.builder(),
        Twinescript.builder(),
        Content.builder(),
      ]
      const targetToken = Setup.createTestTokenBuilderBuilder(tokenBuilder, () => VariableState.create(variableType), 6)
        .addToken('foo', <any>tokens[0])
        .addToken('[bar]', <any>tokens[1])
        .addRawToken('.')
        .addToken('baz', <any>tokens[2])
        .buildTestTargetToken(undefined, startIndex, endIndex);
      Expects.tokenResult(targetToken)
        .toHaveTokenEqualTo(<Variable.Token>{
          tokenType: Variable.TokenType,
          startIndex,
          endIndex,
          variableType,
          variablePath: tokens.map(t => t.build())
        })
        .toHaveNoOtherErrors();
    });
  });
});
function trimmedTokenIndicies(token : string, startIndex : number = 0) : [number, number] {
  const tokenStart = token.length - token.trimLeft().length + startIndex;
  const tokenEnd = token.trimRight().length + startIndex - 1;
  return [tokenStart, tokenEnd];
}

function joinArgs(args : any) : string {
  return args.join('')
}
function template(template : string) {
  // cheap replace
  return (args : any) => {
    let rstr = template;
    for (let i = 0; i < args.length; i++) {
      const t = `$${i}`;
      rstr = rstr.replace(t, args[i])
    }
    return rstr;
  }
}
function forGlobal<T>(n : T, nameFn : (args: T) => string) : [VariableType, string, T] {
  return [VariableType.GLOBAL, nameFn(n), n];
}
function forLocal<T>(n : T, nameFn : (args: T) => string) : [VariableType, string, T] {
  return [VariableType.LOCAL, nameFn(n), n];
}
function transformTestInput<T>(names : T[], nameFn : (args : T) => string = joinArgs) : [VariableType, string, T][] {
  return [...names.map(n => forGlobal(n, nameFn)), ...names.map(n => forLocal(n, nameFn))];
}
