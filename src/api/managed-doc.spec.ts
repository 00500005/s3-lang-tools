import 'jest'
import { DebugConsole } from '../config/log'
import { applyChangesToText, DocumentChange } from './managed-doc'
import { CumulativeSourceIndex } from '../parser/source-index'
const dConsole = DebugConsole.extend(console)
function applyChanges(text: string, changes: DocumentChange[]): string {
  return applyChangesToText(dConsole, text, new CumulativeSourceIndex(text).finish(), changes);
}
describe('Applying text changes', () => {
  describe.each([['LF', '\n'], ['CRLF', '\r\n']])('a single change with %s endings', (name, lineEnd) => {
    const simpleCorpus = [
      'A123456789',
      'B123456789',
      'C123456789',
    ]
    const LINE_LENGTH = simpleCorpus[0].length;
    const source = simpleCorpus.join(lineEnd);
    it('should correctly merge document begin append', () => {
      const newText = applyChanges(source, [{
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 0 },
        }, text: 'Foo\n'
      }])
      expect(newText).toEqual('Foo\n' + source);
    });
    it('should correctly merge document begin remove', () => {
      const newText = applyChanges(source, [{
        range: {
          start: { line: 0, character: 0 },
          end: { line: 1, character: 0 },
        }, text: ''
      }])
      expect(newText).toEqual(simpleCorpus.slice(1).join(lineEnd));
    });
    it('should correctly merge document begin modify', () => {
      const newText = applyChanges(source, [{
        range: {
          start: { line: 0, character: 0 },
          end: { line: 1, character: 0 },
        }, text: 'Foo\n'
      }])
      expect(newText).toEqual('Foo\n' + simpleCorpus.slice(1).join(lineEnd));
    });
    it('should correctly merge line end insert', () => {
      const edit = 'Foo\n'
      const newText = applyChanges(source, [{
        range: {
          start: { line: 1, character: LINE_LENGTH },
          end: { line: 1, character: LINE_LENGTH },
        }, text: edit
      }])
      expect(newText).toEqual(simpleCorpus[0] + lineEnd + simpleCorpus[1] + edit + lineEnd + simpleCorpus[2]);
    });
    it('should correctly merge line begin append', () => {
      const edit = 'Foo\n'
      const newText = applyChanges(source, [{
        range: {
          start: { line: 1, character: 0 },
          end: { line: 1, character: 0 },
        }, text: edit
      }])
      expect(newText).toEqual(simpleCorpus[0] + lineEnd + edit + simpleCorpus[1] + lineEnd + simpleCorpus[2]);
    });
    it('should correctly merge document end insert', () => {
      const edit = 'Foo\n'
      const newText = applyChanges(source, [{
        range: {
          start: { line: 2, character: LINE_LENGTH + 1 },
          end: { line: 2, character: LINE_LENGTH + 1 },
        }, text: edit
      }])
      expect(newText).toEqual(simpleCorpus[0] + lineEnd + simpleCorpus[1] + lineEnd + simpleCorpus[2] + edit);
    });
  });
  describe('a compound change', () => {
    const simpleCorpus = [
      'A123456789',
      'B123456789',
      'C123456789',
    ]
    const LINE_LENGTH = simpleCorpus[0].length;
    const source = simpleCorpus.join('\n');
    it('should allow misordered,nonsequential changes', () => {
      const newText = applyChanges(source, [{
        range: {
          start: { line: 0, character: LINE_LENGTH },
          end: { line: 0, character: LINE_LENGTH },
        },
        text: '!'
      }, {
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 0 },
        },
        text: 'Foo\n'
      }, {
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 1 },
        },
        text: ''
      }]);
      expect(newText).toEqual('Foo\n123456789!\n' + simpleCorpus[1] + '\n' + simpleCorpus[2])
    });
  });
});
