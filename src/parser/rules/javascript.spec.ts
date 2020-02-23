import "jest";
import { runner, tokenBuilder, State } from './javascript';
import { Expects, Setup, Index } from './rule-test.util'
import { String, Content, Macro } from '../types';

describe('javascript', () => {
  describe('runner', () => {
    const run = Setup.createDefaultRunner(runner, () => State.create());
    it.each(['<</script>>', '<</ script >>'])('should pop given %s', (endToken) => {
      const source = endToken + ' ignored '
      Expects.pop(run(source))
        .toEndAt(Index.endOf(endToken))
        .toHaveNoToken()
        .toHaveNoOtherErrors()
    });
    it.each([
      ['"<</script>>"', String.TokenType],
      ["'<</script>>'", String.TokenType],
      ["script", Content.TokenType],
      ["var", Content.TokenType],
      ["/", Content.TokenType],
      ["<", Content.TokenType],
      [">>", Content.TokenType],
    ])('should step with token given %s', (token, tokenType) => {
      const source = token + '" ignored"';
      Expects.step(run(source))
        .toEndAt(Index.endOf(token))
        .toHaveMatchingToken(tokenType)
        .toHaveNoOtherErrors()
    });
    
  });
  describe('tokenBuilder', () => {
    const getTokenBuilder = Setup.defaultTestTokenBuilderBuilder(tokenBuilder, () => State.create());
    it('should create a macro token with content', () => {
      const startIndex = 5;
      const endIndex = 100;
      const tokens = [
        Content.builder(),
        Content.builder(),
      ]
      const endToken = getTokenBuilder(10)
        .addToken('foo', <any>tokens[0])
        .addRawToken(' ')
        .addToken('foobar', <any>tokens[1])
      .buildTestTargetToken(undefined, startIndex, endIndex)
      Expects.tokenResult(endToken)
        .toHaveTokenEqualTo(<Macro.Token>{
          macroType: Macro.Type.JAVASCRIPT,
          name: 'script',
          endIndex,
          startIndex,
          tokenType: Macro.TokenType,
          args: [],
          content: tokens.map(t => t.build())
        })
        .toHaveNoOtherErrors()
    });
  });
});
