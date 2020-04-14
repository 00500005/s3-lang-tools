import 'jest';
import { Content, Token, Twinemarkup, Twinescript, Variable, Yield } from '../types';
import { Expects, Index, Setup } from './rule-test.util';
import { MarkupMode, MarkupType, runner, State } from './twinemarkup';

function asTokens(source: string, str?: string, startIndex: number = 0): Content.Token[] {
  str = str || source;
  return [Content.builder()
    .setStartIndex(startIndex)
    .setEndIndex(startIndex + Index.endOf(str))
    .build()]
}
describe('Twinemarkup', () => {
  describe('runner', () => {
    let state: State;
    function refreshState(markupType: MarkupType, props: Partial<State> = {}): void {
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
      [' asdf %@ ]  [', MarkupMode.IMG_START, 'asdf %@', MarkupMode.IMG_LINK_OR_END, Yield.Type.STEP, MarkupType.IMAGE],
      ['foo/bar.png]]', MarkupMode.IMG_START, 'foo/bar.png', MarkupMode.NO_MORE, Yield.Type.POP, MarkupType.IMAGE],
      [' asdf %@ ]  ]', MarkupMode.IMG_START, 'asdf %@', MarkupMode.NO_MORE, Yield.Type.POP, MarkupType.IMAGE],
    ])('should match path given "%s" in %s mode', (token, startMode, imgpath, endMode, yieldType, markupType) => {
      refreshState(markupType, { nextMode: startMode })
      const endOfImgPath = token.search(/]/) - 1;
      Expects.anyYield(run(token + ' ignored'))
        .toYieldType(yieldType)
        .toEndAt(Index.endOf(token))
        .toHaveNoToken()
        .toHaveNoOtherErrors();
      expect(state).toEqual(<State>{
        type: Yield.Twinemarkup.Type,
        markupType,
        nextMode: endMode,
        title: <Token[]>[],
        link: <Token[]>[],
        imgpath: [Content.builder().setStartIndex(0).setEndIndex(endOfImgPath).build()]
      })
    });
    it.each([
      ['foo/bar.png][', MarkupMode.IMG_LINK_OR_END, 'foo/bar.png', MarkupMode.SETTER_OR_END, Yield.Type.STEP, MarkupType.IMAGE],
      [' asdf %@ ]  [', MarkupMode.IMG_LINK_OR_END, 'asdf %@', MarkupMode.SETTER_OR_END, Yield.Type.STEP, MarkupType.IMAGE],
      ['foo/bar.png]]', MarkupMode.IMG_LINK_OR_END, 'foo/bar.png', MarkupMode.NO_MORE, Yield.Type.POP, MarkupType.IMAGE],
      [' asdf %@ ]  ]', MarkupMode.IMG_LINK_OR_END, 'asdf %@', MarkupMode.NO_MORE, Yield.Type.POP, MarkupType.IMAGE],

      ['name][', MarkupMode.LINK_START, 'name', MarkupMode.SETTER_OR_END, Yield.Type.STEP, MarkupType.LINK],
      [' asdf %@ ]  [', MarkupMode.LINK_START, 'asdf %@', MarkupMode.SETTER_OR_END, Yield.Type.STEP, MarkupType.LINK],
      ['name]]', MarkupMode.LINK_START, 'name', MarkupMode.NO_MORE, Yield.Type.POP, MarkupType.LINK],
      [' asdf %@ ]  ]', MarkupMode.LINK_START, 'asdf %@', MarkupMode.NO_MORE, Yield.Type.POP, MarkupType.LINK],
    ])('should match link given "%s" in %s mode', (token, startMode, link, endMode, yieldType, markupType) => {
      refreshState(markupType, { nextMode: startMode })
      const endOfLink = token.search(/]/) - 1;
      Expects.anyYield(run(token + ' ignored'))
        .toYieldType(yieldType)
        .toEndAt(Index.endOf(token))
        .toHaveNoToken()
        .toHaveNoOtherErrors();
      expect(state).toEqual(<State>{
        type: Yield.Twinemarkup.Type,
        markupType,
        nextMode: endMode,
        link: [Content.builder().setStartIndex(0).setEndIndex(endOfLink).build()],
        imgpath: <Token[]>[],
        title: <Token[]>[],
      })

    });
    it.each([
      ['foo|foo/bar.png][', MarkupMode.IMG_START, 'foo', 'foo/bar.png', MarkupMode.IMG_LINK_OR_END, Yield.Type.STEP, MarkupType.IMAGE],
      [' asdf %@  |  asdf %@ ]  [', MarkupMode.IMG_START, 'asdf %@', 'asdf %@', MarkupMode.IMG_LINK_OR_END, Yield.Type.STEP, MarkupType.IMAGE],
      ['foo|foo/bar.png]]', MarkupMode.IMG_START, 'foo', 'foo/bar.png', MarkupMode.NO_MORE, Yield.Type.POP, MarkupType.IMAGE],
      [' asdf %@  |  asdf %@ ]  ]', MarkupMode.IMG_START, 'asdf %@', 'asdf %@', MarkupMode.NO_MORE, Yield.Type.POP, MarkupType.IMAGE],
    ])('should match path and title given "%s" in %s mode', (content, startMode, title, imgpath, endMode, yieldType, markupType) => {
      refreshState(markupType, { nextMode: startMode })
      const linkAndDelimiter = content.search(/\|/);
      const contentUntilDelimiter = content.search(/\]/) - 1;
      Expects.anyYield(run(content + ' ignored'))
        .toYieldType(Yield.Type.STEP)
        .toEndAt(linkAndDelimiter)
        .toHaveNoToken()
        .toHaveNoOtherErrors();
      Expects.anyYield(run(content + ' ignored', linkAndDelimiter + 1))
        .toYieldType(yieldType)
        .toEndAt(Index.endOf(content))
        .toHaveNoToken()
        .toHaveNoOtherErrors();
      expect(state).toEqual(<State>{
        type: Yield.Twinemarkup.Type,
        markupType,
        nextMode: endMode,
        title: [Content.builder().setEndIndex(linkAndDelimiter - 1).setStartIndex(0).build()],
        imgpath: [Content.builder().setEndIndex(contentUntilDelimiter).setStartIndex(linkAndDelimiter + 1).build()],
        link: <Token[]>[],
      })
    });
    it.each([
      ['foo|foo/bar.png][', MarkupMode.LINK_START, 'foo', 'foo/bar.png', MarkupMode.SETTER_OR_END, Yield.Type.STEP, MarkupType.LINK],
      [' asdf %@  |  asdf %@ ]  [', MarkupMode.LINK_START, 'asdf %@', 'asdf %@', MarkupMode.SETTER_OR_END, Yield.Type.STEP, MarkupType.LINK],
      ['foo|foo/bar.png]]', MarkupMode.LINK_START, 'foo', 'foo/bar.png', MarkupMode.NO_MORE, Yield.Type.POP, MarkupType.LINK],
      [' asdf %@  |  asdf %@ ]  ]', MarkupMode.LINK_START, 'asdf %@', 'asdf %@', MarkupMode.NO_MORE, Yield.Type.POP, MarkupType.LINK],
    ])('should match link and title given "%s" in %s mode', (content, startMode, title, link, endMode, yieldType, markupType) => {
      refreshState(markupType, { nextMode: startMode })
      const linkAndDelimiter = content.search(/\|/);
      const contentUntilDelimiter = content.search(/\]/) - 1;
      Expects.anyYield(run(content + ' ignored'))
        .toYieldType(Yield.Type.STEP)
        .toEndAt(linkAndDelimiter)
        .toHaveNoToken()
        .toHaveNoOtherErrors();
      Expects.anyYield(run(content + ' ignored', linkAndDelimiter + 1))
        .toYieldType(yieldType)
        .toEndAt(Index.endOf(content))
        .toHaveNoToken()
        .toHaveNoOtherErrors();
      expect(state).toEqual(<State>{
        type: Yield.Twinemarkup.Type,
        markupType,
        nextMode: endMode,
        title: [Content.builder().setEndIndex(linkAndDelimiter - 1).setStartIndex(0).build()],
        link: [Content.builder().setEndIndex(contentUntilDelimiter).setStartIndex(linkAndDelimiter + 1).build()],
        imgpath: <Token[]>[],
      })
    });
    it.each([
      ['$foo=bar]]', MarkupMode.SETTER_OR_END, MarkupType.IMAGE, ExpectedIndex.IMMEDIATE, expectedTwinescriptState, MarkupMode.TWINESCRIPT_END, Yield.Type.PUSH],
      [' $foo[bar[0]] ]  ]', MarkupMode.SETTER_OR_END, MarkupType.IMAGE, ExpectedIndex.IMMEDIATE, expectedTwinescriptState, MarkupMode.TWINESCRIPT_END, Yield.Type.PUSH],
      [']]', MarkupMode.SETTER_OR_END, MarkupType.IMAGE, ExpectedIndex.TOKEN, null, MarkupMode.NO_MORE, Yield.Type.POP],
      [']  ]', MarkupMode.SETTER_OR_END, MarkupType.IMAGE, ExpectedIndex.TOKEN, null, MarkupMode.NO_MORE, Yield.Type.POP],

      ['$foo=bar]]', MarkupMode.SETTER_OR_END, MarkupType.LINK, ExpectedIndex.IMMEDIATE, expectedTwinescriptState, MarkupMode.TWINESCRIPT_END, Yield.Type.PUSH],
      [' $foo[bar[0]] ]  ]', MarkupMode.SETTER_OR_END, MarkupType.LINK, ExpectedIndex.IMMEDIATE, expectedTwinescriptState, MarkupMode.TWINESCRIPT_END, Yield.Type.PUSH],
      [']]', MarkupMode.SETTER_OR_END, MarkupType.LINK, ExpectedIndex.TOKEN, null, MarkupMode.NO_MORE, Yield.Type.POP],
      [']  ]', MarkupMode.SETTER_OR_END, MarkupType.LINK, ExpectedIndex.TOKEN, null, MarkupMode.NO_MORE, Yield.Type.POP],
    ])('should match setter given "%s" in %s mode for %s', (token, startMode, markupType, expectedEndIndex, newState, endMode, yieldType) => {
      refreshState(markupType, { nextMode: startMode })
      const result = run(token + ' ignored');
      Expects.anyYield(result)
        .toYieldType(yieldType)
        .toEndAt(expectedEndIndex === ExpectedIndex.TOKEN ? Index.endOf(token) : -1)
        .toHaveNoToken()
        .toHaveNoOtherErrors();
      if (newState) {
        expect((<Yield.Push>result).newState).toEqual(newState)
      }
      expect(state).toEqual(<State>{
        type: Yield.Twinemarkup.Type,
        markupType,
        nextMode: endMode,
        imgpath: <Token[]>[],
        link: <Token[]>[],
        title: <Token[]>[],
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
        imgpath: <Token[]>[],
        link: <Token[]>[],
        title: <Token[]>[],
      })
    });
  });
  describe('regressions', () => {
    it('should allow naked variables in fields', () => {
      const title = [
        'title-',
        '$foo[',
        '"bar"',
        ']'
      ]
      const link = [
        'link-',
        '$foo[',
        '"bar"',
        ']'
      ]
      const setter = '$foo["bar"]+=1'
      const source = `${title.join('')}|${link.join('')}][${setter}]] + ignored`
      const state = State.create(Twinemarkup.Type.LINK);
      const setterToken = Twinescript.builder()
        .setStartIndex(Index.pastEndOf(`${title.join('')}|${link.join('')}][`))
        .setEndIndex(Index.pastEndOf(`${title.join('')}|${link.join('')}][${setter}`))
        .build()
      const titleTokens = [
        Content.builder()
          .setStartIndex(0)
          .setEndIndex(Index.endOf(`${title[0]}`))
          .build(),
        Variable.builder(Variable.Type.GLOBAL)
          .setStartIndex(Index.pastEndOf(`${title[0]}`))
          .setEndIndex(Index.endOf(`${title.join('')}`))
          .build()
      ]
      const linkTokens = [
        Content.builder()
          .setStartIndex(Index.pastEndOf(`${title.join('')}|`))
          .setEndIndex(Index.endOf(`${title.join('')}|${link[0]}`))
          .build(),
        Variable.builder(Variable.Type.GLOBAL)
          .setStartIndex(Index.endOf(`${title.join('')}|${link[0]}$`))
          .setEndIndex(Index.endOf(`${title.join('')}|${link.join('')}`))
          .build()
      ]
      let lastYield: Yield.Generic;
      expect(state).toEqual({
        type: Twinemarkup.TokenType,
        markupType: MarkupType.LINK,
        nextMode: MarkupMode.LINK_START,
        title: [],
        link: [],
        imgpath: [],
      })
      Expects.anyYield(lastYield = runner(source, state, Yield.START))
        .toYieldType(Yield.Type.PUSH)
        .toEndAt(Index.endOf(`${title[0]}$`))
        .toHaveState(Yield.Variable.Type)
        .toHaveNoToken()
        .toHaveNoOtherErrors();
      // before we process the | token, we assume tokens apply to link
      expect(state).toEqual({
        type: Twinemarkup.TokenType,
        markupType: MarkupType.LINK,
        nextMode: MarkupMode.LINK_START,
        title: [],
        link: [titleTokens[0]],
        imgpath: [],
      })
      // from variable rule
      lastYield = {
        type: Yield.Type.POP,
        lastIndex: Index.endOf(`${title.join('')}`),
        token: titleTokens[1]
      }
      Expects.anyYield(lastYield = runner(source, state, lastYield))
        .toYieldType(Yield.Type.STEP)
        .toEndAt(Index.endOf(`${title.join('')}|`))
        .toHaveNoToken()
        .toHaveNoOtherErrors();
      expect(state).toEqual({
        type: Twinemarkup.TokenType,
        markupType: MarkupType.LINK,
        nextMode: MarkupMode.LINK_LINK,
        title: titleTokens,
        link: [],
        imgpath: [],
      })

      Expects.anyYield(lastYield = runner(source, state, lastYield))
        .toYieldType(Yield.Type.PUSH)
        .toEndAt(Index.endOf(`${title.join('')}|${link[0]}$`))
        .toHaveState(Yield.Variable.Type)
        .toHaveNoToken()
        .toHaveNoOtherErrors();
      expect(state).toEqual({
        type: Twinemarkup.TokenType,
        markupType: MarkupType.LINK,
        nextMode: MarkupMode.LINK_LINK,
        title: titleTokens,
        link: [linkTokens[0]],
        imgpath: [],
      })
      // from variable rule
      lastYield = {
        type: Yield.Type.POP,
        lastIndex: Index.endOf(`${title.join('')}|${link.join('')}`),
        token: linkTokens[1]
      }
      Expects.anyYield(lastYield = runner(source, state, lastYield))
        .toYieldType(Yield.Type.STEP)
        .toEndAt(Index.endOf(`${title.join('')}|${link.join('')}][`))
        .toHaveNoToken()
        .toHaveNoOtherErrors();
      expect(state).toEqual({
        type: Twinemarkup.TokenType,
        markupType: MarkupType.LINK,
        nextMode: MarkupMode.SETTER_OR_END,
        title: titleTokens,
        link: linkTokens,
        imgpath: [],
      })

      Expects.anyYield(lastYield = runner(source, state, lastYield))
        .toYieldType(Yield.Type.PUSH)
        .toEndAt(Index.endOf(`${title.join('')}|${link.join('')}][`))
        .toHaveState(Yield.Twinescript.Type)
        .toHaveNoToken()
        .toHaveNoOtherErrors();
      expect(state).toEqual({
        type: Twinemarkup.TokenType,
        markupType: MarkupType.LINK,
        nextMode: MarkupMode.TWINESCRIPT_END,
        title: titleTokens,
        link: linkTokens,
        imgpath: [],
      })
      lastYield = {
        type: Yield.Type.POP,
        lastIndex: Index.endOf(`${title.join('')}${link.join('')}][${setter}]]`),
        token: setterToken
      }
      Expects.anyYield(lastYield = runner(source, state, lastYield))
        .toYieldType(Yield.Type.POP)
        .toEndAt(Index.endOf(`${title.join('')}${link.join('')}][${setter}]]`))
        .toHaveNoToken()
        .toHaveNoOtherErrors();
      expect(state).toEqual({
        type: Twinemarkup.TokenType,
        markupType: MarkupType.LINK,
        nextMode: MarkupMode.NO_MORE,
        title: titleTokens,
        link: linkTokens,
        imgpath: [],
        setter: setterToken
      })
    });
  });
});
