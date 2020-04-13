import 'jest'
import { CumulativeSourceIndex } from './source-index'

describe('Source index scanner', () => {
  const lines = [
    // Keep these lines the same length for easy calculation
    // of offsets
    ' \tline 1',
    ' \tline 2',
    ' \tline 3',
  ]
  const LINE_LENGTH = lines[0].length
  describe('crlf', () => {
    const LINE_LENGTH_CRLF = LINE_LENGTH + 2;
    const source = lines.join('\r\n');
    const index = new CumulativeSourceIndex(source).finish()
    it('should getOffset', () => {
      expect(index.getOffsetFromPosition({ line: 0, character: 0 })).toEqual(0)
      expect(index.getOffsetFromPosition({ line: 0, character: 1 })).toEqual(1)
      expect(index.getOffsetFromPosition({ line: 1, character: 0 })).toEqual(LINE_LENGTH_CRLF)
      expect(index.getOffsetFromPosition({ line: 1, character: 1 })).toEqual(LINE_LENGTH_CRLF + 1)
      expect(index.getOffsetFromPosition({ line: 2, character: 0 })).toEqual(LINE_LENGTH_CRLF + LINE_LENGTH_CRLF)
      expect(index.getOffsetFromPosition({ line: 2, character: 1 })).toEqual(LINE_LENGTH_CRLF + LINE_LENGTH_CRLF + 1)
    });
    it('should treat crlf as same character on getOffset', () => {
      expect(index.getOffsetFromPosition({ line: 0, character: LINE_LENGTH })).toEqual(LINE_LENGTH)
      expect(index.getOffsetFromPosition({ line: 1, character: LINE_LENGTH })).toEqual(LINE_LENGTH_CRLF + LINE_LENGTH)
      // Currently, we don't transform CRLF, instead we rely on the client to infer the selection of a character
      // past the end of a line as going to the end of the line
      // expect(index.getOffsetFromPosition({ line: 0, character: LINE_LENGTH + 1})).toEqual(LINE_LENGTH)
      // expect(index.getOffsetFromPosition({ line: 1, character: LINE_LENGTH + 1})).toEqual(LINE_WITH_CRLF_LENGTH + LINE_LENGTH)
    });
    it('should getPosition', () => {
      expect(index.getPositionFromOffset(0)).toEqual({ line: 0, character: 0 })
      expect(index.getPositionFromOffset(1)).toEqual({ line: 0, character: 1 })
      expect(index.getPositionFromOffset(LINE_LENGTH_CRLF + 1)).toEqual({ line: 1, character: 1 })
      expect(index.getPositionFromOffset(LINE_LENGTH_CRLF + LINE_LENGTH_CRLF + 1)).toEqual({ line: 2, character: 1 })
    });
    it('should treat crlf as same character on getPosition', () => {
      expect(index.getPositionFromOffset(LINE_LENGTH_CRLF)).toEqual({ line: 1, character: 0 })
      expect(index.getPositionFromOffset(LINE_LENGTH_CRLF + LINE_LENGTH_CRLF)).toEqual({ line: 2, character: 0 })
      // Currently, we don't transform CRLF, instead we rely on the client to infer the selection of a character
      // past the end of a line as going to the end of the line
      // expect(index.getPositionFromOffset(LINE_WITH_CRLF_LENGTH - 1)).toEqual({ line: 0, character: LINE_LENGTH })
      // expect(index.getPositionFromOffset(LINE_WITH_CRLF_LENGTH * 2 - 1)).toEqual({ line: 1, character: LINE_LENGTH })
    });
  });
  describe('lf', () => {
    const source = lines.join('\n');
    const LINE_LENGTH_LF = LINE_LENGTH + 1;
    const index = new CumulativeSourceIndex(source).finish()
    it('should getOffset', () => {
      expect(index.getOffsetFromPosition({ line: 0, character: 0 })).toEqual(0)
      expect(index.getOffsetFromPosition({ line: 0, character: 1 })).toEqual(1)
      expect(index.getOffsetFromPosition({ line: 0, character: LINE_LENGTH })).toEqual(LINE_LENGTH_LF - 1)
      expect(index.getOffsetFromPosition({ line: 1, character: 0 })).toEqual(LINE_LENGTH_LF)
      expect(index.getOffsetFromPosition({ line: 1, character: 1 })).toEqual(LINE_LENGTH_LF + 1)
      expect(index.getOffsetFromPosition({ line: 1, character: LINE_LENGTH })).toEqual(LINE_LENGTH_LF + LINE_LENGTH_LF - 1)
      expect(index.getOffsetFromPosition({ line: 2, character: 0 })).toEqual(LINE_LENGTH_LF + LINE_LENGTH_LF)
      expect(index.getOffsetFromPosition({ line: 2, character: 1 })).toEqual(LINE_LENGTH_LF + LINE_LENGTH_LF + 1)
    });
    it('should getPosition', () => {
      expect(index.getPositionFromOffset(0)).toEqual({ line: 0, character: 0 })
      expect(index.getPositionFromOffset(1)).toEqual({ line: 0, character: 1 })
      expect(index.getPositionFromOffset(LINE_LENGTH)).toEqual({ line: 0, character: LINE_LENGTH })
      expect(index.getPositionFromOffset(LINE_LENGTH_LF)).toEqual({ line: 1, character: 0 })
      expect(index.getPositionFromOffset(LINE_LENGTH_LF + 1)).toEqual({ line: 1, character: 1 })
      expect(index.getPositionFromOffset(LINE_LENGTH_LF + LINE_LENGTH)).toEqual({ line: 1, character: LINE_LENGTH })
      expect(index.getPositionFromOffset(LINE_LENGTH_LF + LINE_LENGTH_LF)).toEqual({ line: 2, character: 0 })
      expect(index.getPositionFromOffset(LINE_LENGTH_LF + LINE_LENGTH_LF + 1)).toEqual({ line: 2, character: 1 })
    });
  });
});
