
import 'jest';
import { runner, State, tokenBuilder } from './main';
import { Err, Yield, Twinemarkup, Variable, Content, Main, Twinescript } from '../types';
import { Expects, Setup, Index } from './rule-test.util';

describe('main', () => {
  describe('runner', () => {
    const run = Setup.createDefaultRunner(runner, State.create);
    describe('content', () => {
      it.each(['simple content', '$$'])('should emit a content token on: "%s"', (source) => {
        Expects.step(run(source))
          .toEndAt(Index.endOf(source))
          .toHaveMatchingToken(Content.TokenType)
          .toHaveNoOtherErrors()
      });
      it('should emit multiple content tokens', () => {
        const firstToken = '$$ '
        const secondToken = '$$ other content';
        const source = firstToken + secondToken;
        Expects.step(run(source))
          .toEndAt(Index.endOf(firstToken))
          .toHaveMatchingToken(Content.TokenType)
          .toHaveNoOtherErrors()
        Expects.step(run(source, Index.pastEndOf(firstToken)))
          .toEndAt(Index.endOf(source))
          .toHaveMatchingToken(Content.TokenType, Index.pastEndOf(firstToken))
          .toHaveNoOtherErrors()
      });
    });
    describe('macro entry', () => {
      it('should enter macro on: "<<"', () => {
        const firstToken = '<<'
        const source = firstToken + 'ignored';
        Expects.push(run(source))
          .toEndAt(Index.endOf(firstToken))
          // lookahead at least 1 to check if start of twinescript rule instead
          .toHaveState(Yield.Macro.Type, { endMode: Yield.Macro.EndMode.MACROENTRY })
          .toHaveNoOtherErrors();
      });
      it('should not enter macro on: "< <"', () => {
        const firstToken = '< '
        const secondToken = '< more content'
        const source = firstToken + secondToken;
        Expects.step(run(source))
          .toEndAt(Index.endOf(firstToken))
          .toHaveMatchingToken(Content.TokenType)
          .toHaveNoOtherErrors();
        Expects.step(run(source, Index.pastEndOf(firstToken)))
          .toEndAt(Index.endOf(source))
          .toHaveMatchingToken(Content.TokenType, Index.pastEndOf(firstToken))
          .toHaveNoOtherErrors();
      });
    });
    describe('twinescript entry', () => {
      it.each(['<<-', '<<='])('should enter twinescript on: "%s"', (testToken) => {
        Expects.push(run(testToken + 'ignored'))
          .toEndAt(Index.endOf(testToken))
          .toHaveState(Yield.Twinescript.Type, { endMode: Yield.Twinescript.EndMode.MACROLIKE })
          .toHaveNoOtherErrors();
      });
      it.each(['<< -', '<< ='])('should not enter twinescript on: "%s"', (testToken) => {
        Expects.push(run(testToken + 'ignored'))
          .toEndAt(Index.endOf('<<'))
          .toHaveState(Yield.Macro.Type, { endMode: Yield.Macro.EndMode.MACROENTRY })
          .toHaveNoOtherErrors();
      })
    });
    describe('twinemarkup entry', () => {
      describe('link', () => {
        it.each(['[[', '[ ['])('should enter twine link on: "%s"', (testToken) => {
          Expects.push(run(testToken + 'ignored'))
            .toEndAt(Index.endOf(testToken))
            .toHaveState(Yield.Twinemarkup.Type, { markupType: Yield.Twinemarkup.MarkupType.LINK })
            .toHaveNoOtherErrors();
        });
        it.each(['[', '[]', '[i', '[ im', '[ img '])('should emit content on: "%s"', (testToken) => {
          Expects.step(run(testToken))
            .toEndAt(Index.endOf(testToken))
            .toHaveMatchingToken(Content.TokenType)
            .toHaveNoOtherErrors()
        });
      });
      describe('image', () => {
        it.each(['[img[', '[ img ['])('should enter twine image on: "%s"', (testToken) => {
          Expects.push(run(testToken + 'ignored'))
            .toEndAt(Index.endOf(testToken))
            .toHaveState(Yield.Twinemarkup.Type, { markupType: Yield.Twinemarkup.MarkupType.IMAGE })
            .toHaveNoOtherErrors();
        });
      });
    });
    describe('variable entry', () => {
      it.each(['$a', '$_'])('should enter global variable mode on: "%s"', (testToken) => {
        Expects.push(run(testToken + 'ignored ignored'))
          .toEndAt(Index.endOf('$'))
          // Check if not actually a variable or escaped variable
          .toHaveState(Yield.Variable.Type, { variableType: Yield.Variable.VariableType.GLOBAL })
          .toHaveNoOtherErrors();
      });
      it.each(['_a', '_$'])('should enter local variable mode on: "%s"', (testToken) => {
        Expects.push(run(testToken + 'ignored ignored'))
          .toEndAt(Index.endOf('$'))
          // Check if not actually a variable or escaped variable
          .toHaveState(Yield.Variable.Type, { variableType: Yield.Variable.VariableType.LOCAL })
          .toHaveNoOtherErrors();
      });
      it.each(['$$', '$.', '_', '_ ', '_,'])('should emit content on: "%s"', (testToken) => {
        Expects.step(run(testToken))
          .toEndAt(Index.endOf(testToken))
          // Check if not actually a variable or escaped variable
          .toHaveMatchingToken(Content.TokenType)
          /** @todo test errors for unrecommended token values */
      });
    });
  });
  describe('tokenBuilder', () => {
    const buildContentTokenInvocation = Setup.defaultTestTokenBuilderBuilder(tokenBuilder, State.create);
    it('should add all allowed content as chunks', () => {
      const token1Builder = Variable.builder(Variable.Type.GLOBAL);
      const token2Builder = Twinescript.builder();
      const token3Builder = Twinemarkup.builder(Twinemarkup.Type.LINK).setMarkupLink('foo');
      const token4Builder = Content.builder();
      // pretend that the rule has a much wider start and end
      // outside of the returned tokens
      const startIndex = 5;
      const endIndex = 500;

      const resultingToken = buildContentTokenInvocation(10)
        .addToken('$foo', <any>token1Builder)
        .addToken('<<-$foo>>', <any>token2Builder)
        .addToken('[[foo]]', <any>token3Builder)
        .addToken('foo', <any>token4Builder)
        .buildTestTargetToken(undefined, startIndex, endIndex);
      Expects.tokenResult(resultingToken)
        .toHaveTokenEqualTo(<Main.Token>{ tokenType: Main.TokenType, chunks: [
          token1Builder.build(), 
          token2Builder.build(),
          token3Builder.build(), 
          token4Builder.build(),
        ], startIndex, endIndex })
        .toHaveNoOtherErrors()
    });
    it('should add consecutive content tokens as a single content block', () => {
      const content1Builder = Content.builder();
      const content2Builder = Content.builder();
      const content3Builder = Content.builder();
      // pretend that the rule has a much wider start and end
      // outside of the returned tokens
      const startIndex = 5;
      const endIndex = 500;

      const resultingToken = buildContentTokenInvocation(10)
        .addToken('foo', <any>content1Builder)
        .addToken(' bar ', <any>content2Builder)
        .addToken('   baz   ', <any>content3Builder)
        .buildTestTargetToken(undefined, startIndex, endIndex);
      Expects.tokenResult(resultingToken)
        .toHaveTokenEqualTo(<Main.Token>{ tokenType: Main.TokenType, chunks: [
          { tokenType: Content.TokenType, startIndex: content1Builder.build().startIndex, endIndex: content3Builder.build().endIndex }
        ], startIndex, endIndex })
        .toHaveNoOtherErrors()
      
    });
    it('should add non-consecutive content tokens as multiple content', () => {
      const content1Builder = Content.builder();
      const token2Builder = Variable.builder(Variable.Type.GLOBAL);
      const content3Builder = Content.builder();
      const token4Builder = Twinescript.builder();
      const content5Builder = Content.builder();
      const token6Builder = Twinemarkup.builder(Twinemarkup.Type.LINK).setMarkupLink('foo');
      // pretend that the rule has a much wider start and end
      // outside of the returned tokens
      const startIndex = 5;
      const endIndex = 500;

      const resultingToken = buildContentTokenInvocation(10)
        .addToken('foo', <any>content1Builder)
        .addToken('$foo', <any>token2Builder)
        .addToken(' bar ', <any>content3Builder)
        .addToken('<<-$foo>>', <any>token4Builder)
        .addToken('   baz   ', <any>content5Builder)
        .addToken('[[foo]]', <any>token6Builder)
        .buildTestTargetToken(undefined, startIndex, endIndex);
      Expects.tokenResult(resultingToken)
        .toHaveTokenEqualTo(<Main.Token>{ tokenType: Main.TokenType, chunks: [
          content1Builder.build(),
          token2Builder.build(),
          content3Builder.build(),
          token4Builder.build(),
          content5Builder.build(),
          token6Builder.build(),
        ], startIndex, endIndex })
        .toHaveNoOtherErrors()
      
    });
  });
});
