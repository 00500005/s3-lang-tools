import { Parser, Position, Source } from './types';

export class CumulativeSourceIndex implements Parser.CumulativeSourceIndex {
  constructor(source: Source) {
    this.source = source;
  }
  source: Source;
  offsetByLineNumber: number[] = [0];
  finished: boolean = false;
  lineCount: number = 1;
  newLine: RegExp = /[^\n\r]*(?:(?:\r?\n))/y;
  maxScan: number = -1;
  currentMaxScan(): number {
    return this.maxScan;
  }
  scanTo(offset: number): void {
    const source = this.source;
    let maybeMatch = true;
    this.newLine.lastIndex = Math.max(this.newLine.lastIndex, this.maxScan);
    while (this.newLine.lastIndex < offset && maybeMatch) {
      maybeMatch = !!this.newLine.exec(source);
      if (maybeMatch) {
        this.offsetByLineNumber[this.lineCount++] = this.newLine.lastIndex;
      }
    }
    this.maxScan = maybeMatch ? this.newLine.lastIndex : source.length;
  }
  finish(): Parser.SourceIndex {
    if (this.finished) {
      throw new Error(`Calling finish on already finished cumulative source index`);
    }
    this.finished = true;
    if (this.currentMaxScan() < this.source.length) {
      this.scanTo(this.source.length);
    }
    const copy = this.clone();
    return {
      getOffsetFromPosition: copy.getOffsetFromPosition.bind(copy),
      getPositionFromOffset: copy.getPositionFromOffset.bind(copy),
    }
  }
  clone(): Parser.CumulativeSourceIndex {
    const copy = new CumulativeSourceIndex(this.source);
    copy.offsetByLineNumber = [...this.offsetByLineNumber]
    copy.maxScan = this.maxScan;
    copy.lineCount = this.lineCount;
    copy.newLine.lastIndex = this.newLine.lastIndex;
    copy.finished = this.finished;
    return copy;
  }
  getPositionFromOffset(offset: number): Position {
    const lineAt = binarySearchFloorIndex(this.offsetByLineNumber, offset)
    const charAt = offset - this.offsetByLineNumber[lineAt];
    return {
      line: lineAt,
      character: charAt,
    }
  }
  /** NOTE: may return up to source.length index (which is out-of-bounds) */
  getOffsetFromPosition(position: Position): number {
    const lineOffset = this.offsetByLineNumber[position.line];
    return lineOffset !== undefined
      ? Math.min(lineOffset + position.character, this.source.length)
      : this.source.length;
  }
}

function binarySearchFloorIndex(sortedNumbers: number[], target: number): number {
  let startInc = 0;
  let endExc = sortedNumbers.length;

  while (endExc - startInc > 1) {
    const mid = Math.floor((endExc + startInc) / 2);
    if (sortedNumbers[mid] < target) {
      startInc = mid;
    } else if (sortedNumbers[mid] > target) {
      endExc = mid;
    } else {
      return mid;
    }
  }
  // we want the floor index, so the inclusive index
  // is always the correct one
  return startInc;
}
