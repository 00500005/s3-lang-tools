import "jest"
import { tokenBuilder, runner, EndMode, State } from './twinescript'
import { Content, Twinescript, Variable, TokenType, Yield, Parser } from "../types";
import { Setup, Expects, Index } from "./rule-test.util";

describe('twinescript', () => {
  describe('runner', () => {
    describe('end modes', () => {
      it.each([
        [']]', EndMode.TWINEMARKUP],
        ['  ]  ]', EndMode.TWINEMARKUP],
        ['`', EndMode.QUOTE],
        ['  `', EndMode.QUOTE],
        [']', EndMode.INDEX],
        ['  ]', EndMode.INDEX],
        ['>>', EndMode.MACROLIKE],
        ['  >>', EndMode.MACROLIKE],
      ])('should pop given %s and endmode %s', (endString, endMode) => {
        const run = Setup.createDefaultRunner(runner, () => State.create(endMode));
        Expects.pop(run(endString + ' ignored'))
          .toEndAt(Index.endOf(endString))
          .toHaveNoOtherErrors();
      });
    });
    describe('tokens', () => {
      const state: State = State.create(EndMode.MACROLIKE);
      const run = Setup.createDefaultRunner(runner, () => state);
      function fixto(count: number, params: any[][]): any[] {
        const filler: undefined[] = [];
        for (let i = 0; i < count; i++) { filler[i] = undefined; }
        const fixedParams = params.map(p => {
          return [...p, ...filler].slice(0, count);
        })
        return fixedParams;
      }
      it.each(fixto(5, [
        [null, '$foo.bar["baz"]', '$', Yield.Variable.State.create(Yield.Variable.VariableType.GLOBAL)],
        [null, '  $foo.bar["baz"]', '$', Yield.Variable.State.create(Yield.Variable.VariableType.GLOBAL)],
        [null, '_foo.bar["baz"]', '_', Yield.Variable.State.create(Yield.Variable.VariableType.LOCAL)],
        [null, '  _foo.bar["baz"]', '_', Yield.Variable.State.create(Yield.Variable.VariableType.LOCAL)],
        [null, '"foo\\">>"', '"foo\\">>"'],
        [null, '  "foo\\">>"', '"foo\\">>"'],
        [null, "'foo\\'>>'", "'foo\\'>>'"],
        [null, "  'foo\\'>>'", "'foo\\'>>'"],
        [null, '[[foo]]', '[[', Yield.Twinemarkup.State.create(Yield.Twinemarkup.MarkupType.LINK)],
        [null, '  [[foo]]', '[[', Yield.Twinemarkup.State.create(Yield.Twinemarkup.MarkupType.LINK)],
        [null, '[ [ foo]]', '[ [', Yield.Twinemarkup.State.create(Yield.Twinemarkup.MarkupType.LINK)],
        [null, '  [ [ foo]]', '[ [', Yield.Twinemarkup.State.create(Yield.Twinemarkup.MarkupType.LINK)],
        [null, '(1+2)', '(', Yield.Twinescript.State.create(Yield.Twinescript.EndMode.PAREN)],
        [null, '  (1+2)', '(', Yield.Twinescript.State.create(Yield.Twinescript.EndMode.PAREN)],
        [null, '{foo: 1}', '{', Yield.Twinescript.State.create(Yield.Twinescript.EndMode.BRACE)],
        [null, '  {foo: 1}', '{', Yield.Twinescript.State.create(Yield.Twinescript.EndMode.BRACE)],
        [null, '[1,2]', '[', Yield.Twinescript.State.create(Yield.Twinescript.EndMode.ARRAY)],
        [null, '  [1,2]', '[', Yield.Twinescript.State.create(Yield.Twinescript.EndMode.ARRAY)],
        [TokenType.Content, '='],
        [TokenType.Content, '+='],
        [TokenType.Content, '-='],
        [TokenType.Content, '*='],
        [TokenType.Content, '/='],
        [TokenType.Content, '%='],
        [TokenType.Content, '**='],
        // bitshifts are unsupported
        [TokenType.Content, '&='],
        [TokenType.Content, '^='],
        [TokenType.Content, '|='],
        [TokenType.Content, '=='],
        [TokenType.Content, '!='],
        [TokenType.Content, '==='],
        [TokenType.Content, '!=='],
        [TokenType.Content, '>'],
        [TokenType.Content, '>='],
        [TokenType.Content, '<'],
        [TokenType.Content, '<='],
        [TokenType.Content, '+'],
        [TokenType.Content, '-'],
        [TokenType.Content, '*'],
        [TokenType.Content, '/'],
        [TokenType.Content, '%'],
        [TokenType.Content, '++'],
        [TokenType.Content, '--'],
        [TokenType.Content, '**'],
        [TokenType.Content, '&'],
        [TokenType.Content, '|'],
        [TokenType.Content, '^'],
        [TokenType.Content, '~'],
        // bitshifts are unsupported
        [TokenType.Content, '&&'],
        [TokenType.Content, '||'],
        [TokenType.Content, '!'],
        [TokenType.Content, '?'],
        [TokenType.Content, ':'],
        [TokenType.Content, ','],
        [TokenType.Content, ';'],
        [TokenType.Content, 'var'],
        [TokenType.Content, 'let'],
        [TokenType.Content, 'const'],
        [TokenType.Content, 'typeof'],
        [TokenType.Content, 'instanceof'],
        [TokenType.Content, 'in'],
        [TokenType.Content, 'null'],
        [TokenType.Content, 'undefined'],
        [TokenType.Content, 'function'],
        [TokenType.Content, '=>'],
        [TokenType.Content, 'void'],
        [TokenType.Content, 'new'],
        [TokenType.Content, 'class'],
        [TokenType.Content, '...'],
        [TokenType.Content, 'delete'],

        [TokenType.Content, 'to'],
        [TokenType.Content, 'eq'],
        [TokenType.Content, 'gt'],
        [TokenType.Content, 'gte'],
        [TokenType.Content, 'lt'],
        [TokenType.Content, 'lte'],
      ]))('should recognize %s tokens given: "%s"', (tokenType: TokenType | null, source: string, expectedTokenMatch?: string, pushedState?: Yield.GenericState, yieldType?: Yield.Type) => {
        const startOfToken = source.length - source.trimLeft().length;
        const result = run(source);
        Expects.anyYield(result)
          .toYieldType(yieldType || (pushedState ? Yield.Push : Yield.Step))
          .toEndAt(Index.endOf(expectedTokenMatch || source) + startOfToken)
          .toHaveNoOtherErrors();
        if (pushedState) {
          Expects.anyYield(result)
            .toHaveStateEqualTo(pushedState)
        }
        if (tokenType) {
          Expects.anyYield(result)
            .toHaveMatchingToken(tokenType, startOfToken, Index.endOf(expectedTokenMatch || source))
        }
      });
    });
  });
  describe('tokenBuilder', () => {
    it('should build a twinescript token', () => {
      const startIndex = 5;
      const endIndex = 100;
      const tokens = [
        Variable.builder(Variable.Type.GLOBAL),
        Content.builder(),
        Twinescript.builder(),
        Content.builder(),
        Content.builder(),
      ]
      const targetToken = Setup.createTestTokenBuilderBuilder(tokenBuilder, () => State.create(EndMode.MACROLIKE), 6)
        .addToken('$foo', <any>tokens[0])
        .addRawToken(' ')
        .addToken('=', <any>tokens[1])
        .addRawToken(' ')
        .addToken('(1 + 3)', <any>tokens[2])
        .addRawToken(' ')
        .addToken('-', <any>tokens[3])
        .addRawToken(' ')
        .addToken('2', <any>tokens[4])
        .buildTestTargetToken(undefined, startIndex, endIndex);
      Expects.tokenResult(targetToken)
        .toHaveTokenEqualTo(<Twinescript.Token>{
          tokenType: Twinescript.TokenType,
          startIndex,
          endIndex,
          content: tokens.map(t => t.build())
        })
        .toHaveNoOtherErrors();
    });
  });
});
