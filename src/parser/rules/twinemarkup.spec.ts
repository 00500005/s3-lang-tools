import 'jest';
import { runner, State, MarkupType, MarkupMode, tokenBuilder } from './twinemarkup';
import { Setup, Index, Expects } from './rule-test.util';
import { Content, Twinescript, Yield, Twinemarkup, Source, Token, Parser, GenericTokenChainBuilder } from '../types';


describe('Twinemarkup', () => {
  describe('runner', () => {
    let state : State;
    function refreshState(markupType : MarkupType, props: Partial<State> = {}) : void {
      state = Object.assign(State.create(markupType), props)
    }
    const run = Setup.createDefaultRunner(runner, () => state);
    const expectedTwinescriptState = Yield.Twinescript.State.create(Twinescript.EndMode.TWINEMARKUP);
    enum ExpectedIndex {
      IMMEDIATE,
      TOKEN
    }
    it.each([
      ['foo/bar.png][', MarkupMode.IMG_START, 'foo/bar.png', MarkupMode.IMG_LINK_OR_END, Yield.Type.STEP, MarkupType.IMAGE], 
      [' asdf $%@ ]  [', MarkupMode.IMG_START, 'asdf $%@', MarkupMode.IMG_LINK_OR_END, Yield.Type.STEP, MarkupType.IMAGE],
      ['foo/bar.png]]', MarkupMode.IMG_START, 'foo/bar.png', MarkupMode.NO_MORE, Yield.Type.POP, MarkupType.IMAGE], 
      [' asdf $%@ ]  ]', MarkupMode.IMG_START, 'asdf $%@', MarkupMode.NO_MORE, Yield.Type.POP, MarkupType.IMAGE],
    ])('should match path given "%s" in %s mode', (token, startMode, imgpath, endMode, yieldType, markupType) => {
      refreshState(markupType, { nextMode: startMode })
      Expects.anyYield(run(token + ' ignored'))
        .toYieldType(yieldType)
        .toEndAt(Index.endOf(token))
        .toHaveNoToken()
        .toHaveNoOtherErrors();
      expect(state).toEqual(<State>{
        type: Yield.Twinemarkup.Type,
        markupType,
        nextMode: endMode,
        imgpath,
      })
    });
    it.each([
      ['foo/bar.png][', MarkupMode.IMG_LINK_OR_END, 'foo/bar.png', MarkupMode.SETTER_OR_END, Yield.Type.STEP, MarkupType.IMAGE], 
      [' asdf $%@ ]  [', MarkupMode.IMG_LINK_OR_END, 'asdf $%@', MarkupMode.SETTER_OR_END, Yield.Type.STEP, MarkupType.IMAGE],
      ['foo/bar.png]]', MarkupMode.IMG_LINK_OR_END, 'foo/bar.png', MarkupMode.NO_MORE, Yield.Type.POP, MarkupType.IMAGE], 
      [' asdf $%@ ]  ]', MarkupMode.IMG_LINK_OR_END, 'asdf $%@', MarkupMode.NO_MORE, Yield.Type.POP, MarkupType.IMAGE],

      ['foo/bar.png][', MarkupMode.LINK_START, 'foo/bar.png', MarkupMode.SETTER_OR_END, Yield.Type.STEP, MarkupType.LINK], 
      [' asdf $%@ ]  [', MarkupMode.LINK_START, 'asdf $%@', MarkupMode.SETTER_OR_END, Yield.Type.STEP, MarkupType.LINK],
      ['foo/bar.png]]', MarkupMode.LINK_START, 'foo/bar.png', MarkupMode.NO_MORE, Yield.Type.POP, MarkupType.LINK], 
      [' asdf $%@ ]  ]', MarkupMode.LINK_START, 'asdf $%@', MarkupMode.NO_MORE, Yield.Type.POP, MarkupType.LINK],
    ])('should match link given "%s" in %s mode', (token, startMode, link, endMode, yieldType, markupType) => {
      refreshState(markupType, { nextMode: startMode })
      Expects.anyYield(run(token + ' ignored'))
        .toYieldType(yieldType)
        .toEndAt(Index.endOf(token))
        .toHaveNoToken()
        .toHaveNoOtherErrors();
      expect(state).toEqual(<State>{
        type: Yield.Twinemarkup.Type,
        markupType,
        nextMode: endMode,
        link,
      })
      
    });
    it.each([
      ['foo|foo/bar.png][', MarkupMode.IMG_START, 'foo', 'foo/bar.png', MarkupMode.IMG_LINK_OR_END, Yield.Type.STEP, MarkupType.IMAGE], 
      [' asdf $%@  |  asdf $%@ ]  [', MarkupMode.IMG_START, 'asdf $%@', 'asdf $%@', MarkupMode.IMG_LINK_OR_END, Yield.Type.STEP, MarkupType.IMAGE],
      ['foo|foo/bar.png]]', MarkupMode.IMG_START, 'foo', 'foo/bar.png', MarkupMode.NO_MORE, Yield.Type.POP, MarkupType.IMAGE], 
      [' asdf $%@  |  asdf $%@ ]  ]', MarkupMode.IMG_START, 'asdf $%@', 'asdf $%@', MarkupMode.NO_MORE, Yield.Type.POP, MarkupType.IMAGE],
    ])('should match path and title given "%s" in %s mode', (token, startMode, title, imgpath, endMode, yieldType, markupType) => {
      refreshState(markupType, { nextMode: startMode })
      Expects.anyYield(run(token + ' ignored'))
        .toYieldType(yieldType)
        .toEndAt(Index.endOf(token))
        .toHaveNoToken()
        .toHaveNoOtherErrors();
      expect(state).toEqual(<State>{
        type: Yield.Twinemarkup.Type,
        markupType,
        nextMode: endMode,
        title,
        imgpath
      })
    });
    it.each([
      ['foo|foo/bar.png][', MarkupMode.LINK_START, 'foo', 'foo/bar.png', MarkupMode.SETTER_OR_END, Yield.Type.STEP, MarkupType.LINK], 
      [' asdf $%@  |  asdf $%@ ]  [', MarkupMode.LINK_START, 'asdf $%@', 'asdf $%@', MarkupMode.SETTER_OR_END, Yield.Type.STEP, MarkupType.LINK],
      ['foo|foo/bar.png]]', MarkupMode.LINK_START, 'foo', 'foo/bar.png', MarkupMode.NO_MORE, Yield.Type.POP, MarkupType.LINK], 
      [' asdf $%@  |  asdf $%@ ]  ]', MarkupMode.LINK_START, 'asdf $%@', 'asdf $%@', MarkupMode.NO_MORE, Yield.Type.POP, MarkupType.LINK],
    ])('should match link and title given "%s" in %s mode', (token, startMode, title, link, endMode, yieldType, markupType) => {
      refreshState(markupType, { nextMode: startMode })
      Expects.anyYield(run(token + ' ignored'))
        .toYieldType(yieldType)
        .toEndAt(Index.endOf(token))
        .toHaveNoToken()
        .toHaveNoOtherErrors();
      expect(state).toEqual(<State>{
        type: Yield.Twinemarkup.Type,
        markupType,
        nextMode: endMode,
        title,
        link
      })
    });
    it.each([
      ['$foo=bar][', MarkupMode.SETTER_OR_END, MarkupType.IMAGE, ExpectedIndex.IMMEDIATE, expectedTwinescriptState, MarkupMode.TWINESCRIPT_END, Yield.Type.PUSH],
      [' $foo[bar[0]] ]  [', MarkupMode.SETTER_OR_END, MarkupType.IMAGE, ExpectedIndex.IMMEDIATE, expectedTwinescriptState, MarkupMode.TWINESCRIPT_END, Yield.Type.PUSH],
      [']]', MarkupMode.SETTER_OR_END, MarkupType.IMAGE, ExpectedIndex.TOKEN, null, MarkupMode.NO_MORE, Yield.Type.POP],
      [']  ]', MarkupMode.SETTER_OR_END, MarkupType.IMAGE, ExpectedIndex.TOKEN, null, MarkupMode.NO_MORE, Yield.Type.POP],

      ['$foo=bar][', MarkupMode.SETTER_OR_END, MarkupType.LINK, ExpectedIndex.IMMEDIATE, expectedTwinescriptState, MarkupMode.TWINESCRIPT_END, Yield.Type.PUSH],
      [' $foo[bar[0]] ]  [', MarkupMode.SETTER_OR_END, MarkupType.LINK, ExpectedIndex.IMMEDIATE, expectedTwinescriptState, MarkupMode.TWINESCRIPT_END, Yield.Type.PUSH],
      [']]', MarkupMode.SETTER_OR_END, MarkupType.LINK, ExpectedIndex.TOKEN, null, MarkupMode.NO_MORE, Yield.Type.POP],
      [']  ]', MarkupMode.SETTER_OR_END, MarkupType.LINK, ExpectedIndex.TOKEN, null, MarkupMode.NO_MORE, Yield.Type.POP],
    ])('should match setter given "%s" in %s mode for %s', (token, startMode, markupType, expectedEndIndex, newState, endMode, yieldType) => {
      refreshState(markupType, { nextMode: startMode })
      const result = run(token + ' ignored');
      Expects.anyYield(result)
        .toYieldType(yieldType)
        .toEndAt(expectedEndIndex === ExpectedIndex.TOKEN ? Index.endOf(token) : 0)
        .toHaveNoToken()
        .toHaveNoOtherErrors();
      if (newState) {
        expect((<Yield.Push>result).newState).toEqual(newState)
      }
      expect(state).toEqual(<State>{
        type: Yield.Twinemarkup.Type,
        markupType,
        nextMode: endMode,
      })
    });
    it.each([
      ['', MarkupMode.TWINESCRIPT_END, MarkupType.IMAGE, MarkupMode.NO_MORE, Yield.Type.POP],
      ['', MarkupMode.TWINESCRIPT_END, MarkupType.LINK, MarkupMode.NO_MORE, Yield.Type.POP],
    ])('should pop given "%s" in %s mode for %s', (token, startMode, markupType, endMode, yieldType) => {
      refreshState(markupType, { nextMode: startMode })
      Expects.anyYield(run(token + ' ignored'))
        .toYieldType(yieldType)
        .toEndAt(Index.endOf(token))
        .toHaveNoToken()
        .toHaveNoOtherErrors();
      expect(state).toEqual(<State>{
        type: Yield.Twinemarkup.Type,
        markupType,
        nextMode: endMode,
      })
    });
  });
  describe('tokenBuilder', () => {
    function tokenState(markupType : MarkupType, props: Partial<State> = {}) : State {
      return Object.assign(State.create(markupType), <Partial<State>>{ nextMode: MarkupMode.NO_MORE }, props)
    }
    function buildWith(state : State, tokens: Token[] = [])  {
      return tokenBuilder(
        '',
        state,
        tokens,
        0,
        1
      )
    }
    it('should create token with path', () => {
      const imgpath = 'foo';
      Expects.tokenResult(buildWith(tokenState(MarkupType.IMAGE, { imgpath })))
        .toHaveTokenContaining(<Twinemarkup.Token>{
          tokenType: Twinemarkup.TokenType,
          markupType: MarkupType.IMAGE,
          imagePath: imgpath,
        })
        .toHaveNoOtherErrors()
    });
    it.each([
      [MarkupType.IMAGE, { imgpath: 'foo' }], 
      [MarkupType.LINK, {}]
    ])('should create %s token with link', (markupType, additionalState) => {
      const link = 'foo';
      Expects.tokenResult(buildWith(tokenState(markupType, Object.assign({}, additionalState, { link }))))
        .toHaveTokenContaining(<Twinemarkup.Token>{
          tokenType: Twinemarkup.TokenType,
          markupType,
          link
        })
        .toHaveNoOtherErrors()
    });
    it.each([
      [MarkupType.IMAGE, { imgpath: 'foo' }], 
      [MarkupType.LINK, { link: 'foo' }]
    ])('should create %s token with setter', (markupType, additionalState) => {
      const twinescriptToken = Twinescript.builder().setStartIndex(0).setEndIndex(1).build();
      Expects.tokenResult(buildWith(
          tokenState(markupType, additionalState),
          [twinescriptToken]
        ))
        .toHaveTokenContaining(<Twinemarkup.Token>{
          tokenType: Twinemarkup.TokenType,
          markupType,
          setter: twinescriptToken
        })
        .toHaveNoOtherErrors()
    });
    it.each([
      [MarkupType.IMAGE, { imgpath: 'foo' }], 
      [MarkupType.LINK, { link: 'foo' }]
    ])('should create %s token with title', (markupType, additionalState) => {
      const title = 'foo';
      Expects.tokenResult(buildWith(tokenState(markupType, Object.assign({}, additionalState, { title }))))
        .toHaveTokenContaining(<Twinemarkup.Token>{
          tokenType: Twinemarkup.TokenType,
          markupType,
          title
        })
        .toHaveNoOtherErrors()
    });
  });
});
