import { Parser, Position, Source } from './types';

export class CumulativeSourceIndex implements Parser.CumulativeSourceIndex {
  constructor(source : Source) {
    this.source = source;
  }
  source : Source;
  offsetByLineNumber : number[] = [0];
  lineCount : number = 1;
  newLine : RegExp = /[^\n]*\n/y;
  maxScan : number = -1;
  currentMaxScan(): number {
    return this.maxScan;
  }
  scanTo(offset: number): void {
    const source = this.source;
    let maybeMatch = true;
    while(this.newLine.lastIndex < offset && maybeMatch) {
      maybeMatch = !!this.newLine.exec(source);
      if (maybeMatch) {
        this.offsetByLineNumber[this.lineCount++] = this.newLine.lastIndex;
      }
    }
    this.maxScan = maybeMatch ? this.newLine.lastIndex : source.length;
  }
  finish(): Parser.SourceIndex {
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
    return copy;
  }
  getPositionFromOffset(offset: number): Position {
    const lineAt = binarySearchFloorIndex(this.offsetByLineNumber, offset)
    const charAt = offset - this.offsetByLineNumber[lineAt];
    return {
      line: lineAt,
      character : charAt,
    }
  }
  getOffsetFromPosition(position: Position): number {
    return this.offsetByLineNumber[position.line - 1] + position.character - 1;
  }
}

function binarySearchFloorIndex(sortedNumbers : number[], target : number) : number {
  let startInc = 0;
  let endExc = sortedNumbers.length;

  while(endExc - startInc > 1) {
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
