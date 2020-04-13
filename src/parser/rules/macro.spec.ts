import 'jest';
import { runner, State, EndMode, tokenBuilder } from './macro';
import { Yield, StartIndex, Parser, Token, EndIndex, Err, Content, String, Variable, Twinescript, Twinemarkup, Main, Macro, TokenType } from '../types';
import { Expects, Setup, Index } from './rule-test.util';

describe('macro', () => {
  describe('runner', () => {
    describe('script', () => {
      let state: State;
      const run = Setup.createDefaultRunner(runner, () => {
        return state = State.create(Yield.Macro.EndMode.MACROENTRY)
      });
      it.each([
        'script>>',
        '\t script \t>>'
      ])('should enter script and consume the token of: "%s"', (entryToken) => {
        Expects.goto(run(entryToken + ' ignored'))
          .toEndAt(Index.endOf(entryToken))
          .toHaveState(Yield.Javascript.Type)
          .toHaveNoOtherErrors();
      });
      it.each([
        [' scrip', 1],
        ['  script_', 2],
        ['scriptr', 0]
      ])('should enter user macro and consume 1 token of: "%s"', (testToken, startAt: StartIndex) => {
        Expects.step(run(testToken + ' ignored'))
          .toEndAt(Index.endOf(testToken))
          .toHaveMatchingToken(Content.TokenType, startAt)
          .toHaveNoOtherErrors();
        expect(state.macroType).toEqual(Yield.Macro.MacroType.USER);
        expect(state.macroName).toEqual(testToken.slice(startAt));
      });
    });
    describe('user macro arguments', () => {
      let state: State;
      const run = Setup.createDefaultRunner(runner, () => {
        state = State.create(Yield.Macro.EndMode.MACROENTRY)
        state.macroType = Yield.Macro.MacroType.USER;
        state.macroName = "test"
        return state;
      });
      /**
       * Note: post-processing takes care of more complex processing
       * The parser/lexer is only concerned with permissively parsing syntax
       */
      describe('string args', () => {
        it.each([
          ["''", 0],
          ["'foo'", 0],
          ["'foo\\''", 0],
          [" 'foo\\''", 1],
          ["  'foo\\''", 2],
          ["\t 'foo\\''", 2],
        ])('should emit a SINGLE string argument on: %s', (testToken, startAt) => {
          Expects.step(run(testToken + ' ignored'))
            .toEndAt(Index.endOf(testToken))
            .toHaveMatchingToken(String.TokenType, startAt, undefined, { stringType: String.Type.SINGLE })
            .toHaveNoOtherErrors();
        });
        it.each([
          ['""', 0],
          ['"foo"', 0],
          ['"foo\\""', 0],
          [' "foo\\""', 1],
          ['  "foo\\""', 2],
          ['\t "foo\\""', 2],
        ])('should emit a DOUBLE string argument on: %s', (testToken, startAt) => {
          Expects.step(run(testToken + ' ignored'))
            .toEndAt(Index.endOf(testToken))
            .toHaveMatchingToken(String.TokenType, startAt, undefined, { stringType: String.Type.DOUBLE })
            .toHaveNoOtherErrors();
        });
      });
      describe('variable args', () => {
        it.each([
          ['$a'],
          ['$B0_$'],
          ['  $z', 2],
        ])('should enter global variable on: "%s"', (testToken, startAt: number = 0) => {
          Expects.push(run(testToken + ' ignored'))
            .toEndAt(startAt + Index.endOf('$'))
            .toHaveState(Yield.Variable.Type, { variableType: Yield.Variable.VariableType.GLOBAL })
            .toHaveNoOtherErrors();
        });
        it.each([
          ['_a'],
          ['_B0_$'],
          ['  _z', 2],
        ])('should enter local variable on: "%s"', (testToken, startAt: number = 0) => {
          Expects.push(run(testToken + ' ignored'))
            .toEndAt(startAt + Index.endOf('_'))
            .toHaveState(Yield.Variable.Type, { variableType: Yield.Variable.VariableType.LOCAL })
            .toHaveNoOtherErrors();
        });
        it.each([
          '_',
          '$',
          '$.',
          '$<',
        ])('should emit a content token on: "%s"', (testToken) => {
          Expects.step(run(testToken + ' ignored'))
            .toEndAt(Index.endOf(testToken))
            .toHaveMatchingToken(Content.TokenType)
            .toHaveNoOtherErrors();
        });
        // TODO: emit warning on $$
      });
      describe('twinescript args', () => {
        it.each([
          ['`', Yield.Twinescript.EndMode.QUOTE],
          ['  `', Yield.Twinescript.EndMode.QUOTE],
          ['[', Yield.Twinescript.EndMode.ARRAY],
          ['  [', Yield.Twinescript.EndMode.ARRAY],
          ['{', Yield.Twinescript.EndMode.BRACE],
          ['  {', Yield.Twinescript.EndMode.BRACE],
        ])('should enter a twinescript expression on: "%s"', (testToken, endMode) => {
          Expects.push(run(testToken + ' ignored'))
            .toEndAt(Index.endOf(testToken))
            .toHaveState(Yield.Twinescript.Type, { endMode })
            .toHaveNoOtherErrors();
        });
      });
    });
    describe('end macro', () => {
      let state: State;
      const run = Setup.createDefaultRunner(runner, () => {
        return state = State.create(Yield.Macro.EndMode.MACROENTRY)
      });
      it.each([
        ['/foo>>', 'foo'],
        ['/widget>>', 'widget'],
        ['/  validName0_$  >>', 'validName0_$'],
      ])('should pop given valid end macro "<<%s"', (testToken, name) => {
        Expects.pop(run(testToken + ' ignored'))
          .toEndAt(Index.endOf(testToken))
          .toHaveTokenContaining({ tokenType: TokenType.Content })
          .toHaveNoOtherErrors();
        expect(state.macroName).toEqual(name)
        expect(state.macroType).toEqual(Macro.Type.END)
      });

    });
  });
  describe('tokenBuilder', () => {
    describe('user macro', () => {
      const macroName = 'myMacro';
      const buildContentTokenInvocation = Setup.defaultTestTokenBuilderBuilder(tokenBuilder, () => {
        const state = State.create(EndMode.MACROENTRY)
        state.macroType = Macro.Type.USER;
        state.macroName = macroName;
        return state;
      });
      it('should build a token with name, no args', () => {
        const name1 = Content.builder();
        // pretend that the rule has a much wider start and end
        // outside of the returned tokens
        const startIndex = 5;
        const endIndex = 500;

        const resultingToken = buildContentTokenInvocation(10)
          .addRawToken("<<")
          .addToken(macroName, <any>name1)
          .addRawToken(">>")
          .buildTestTargetToken(undefined, startIndex, endIndex);
        Expects.tokenResult(resultingToken)
          .toHaveTokenEqualTo(<Macro.Token>{
            tokenType: Macro.TokenType,
            macroType: Macro.Type.USER,
            startIndex, endIndex,
            name: macroName,
            content: [],
            args: [],
          })
          .toHaveNoOtherErrors()
      });
      it('should build a token with name, args', () => {
        const name1 = Content.builder();
        const var1 = Variable.builder(Variable.Type.GLOBAL);
        const var2 = Variable.builder(Variable.Type.LOCAL);
        const content1 = Content.builder();
        const content2 = Content.builder();
        const markup1 = Twinemarkup.builder(Twinemarkup.Type.LINK).setMarkupLink('foo');
        const string1 = String.builder(String.Type.DOUBLE);
        // pretend that the rule has a much wider start and end
        // outside of the returned tokens
        const startIndex = 5;
        const endIndex = 500;

        const resultingToken = buildContentTokenInvocation(10)
          .addRawToken("<<")
          .addToken(macroName, <any>name1)
          .addToken('$foo', <any>var1)
          .addRawToken(" ")
          .addToken('=', <any>content1)
          .addRawToken(" ")
          .addToken('[[foo]]', <any>markup1)
          .addRawToken(" ")
          .addToken(';', <any>content2)
          .addRawToken(" ")
          .addToken('$bar', <any>var2)
          .addRawToken(" ")
          .addToken('"foo"', <any>string1)
          .addRawToken(">>")
          .buildTestTargetToken(undefined, startIndex, endIndex);
        Expects.tokenResult(resultingToken)
          .toHaveTokenEqualTo(<Macro.Token>{
            tokenType: Macro.TokenType,
            macroType: Macro.Type.USER,
            startIndex, endIndex,
            name: macroName,
            content: [],
            args: [
              var1.build(),
              content1.build(),
              markup1.build(),
              content2.build(),
              var2.build(),
              string1.build()
            ]
          })
          .toHaveNoOtherErrors()
      });
      it('should return no token or error given script state', () => {
        const scriptState = State.create(EndMode.MACROENTRY);
        scriptState.macroType = Macro.Type.JAVASCRIPT;
        const result = Setup.createTestTokenBuilderBuilder(tokenBuilder, () => scriptState)
          .addRawToken('<<')
          .addToken('script', Content.builder())
          .addRawToken('>>')
          .buildTestTargetToken()
        expect(result.result).toBeUndefined();
        expect(result.errors || []).toHaveLength(0);
      });
    });
  });
});
