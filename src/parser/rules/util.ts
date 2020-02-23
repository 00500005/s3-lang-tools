import { StartIndex, Source, EndIndex } from "../types";

function hasResult(result : RegExpExecArray | null) : boolean {
  return result !== null && result[0].length > 0;
}
export class StickyRegex {
  constructor(regex : RegExp) {
    this.regex = regex;
    this.exec = this.regex.exec
  }
  regex : RegExp;
  exec : (source : string) => RegExpExecArray | null;

  execAt(source : Source, startIndex : StartIndex) : RegExpExecArray | null {
    this.regex.lastIndex = startIndex
    return this.regex.exec(source);
  }
  execAndEndIndexAt(source : Source, startIndex : StartIndex) : [RegExpExecArray | null, EndIndex | null] {
    this.regex.lastIndex = startIndex
    const result = this.regex.exec(source);
    return [ result, hasResult(result) ? this.regex.lastIndex - 1 : null ]
  }
  matchExists(source : Source, startIndex : StartIndex) : boolean {
    this.regex.lastIndex = startIndex
    const result = this.regex.exec(source);
    return hasResult(result)
  }
  getMatch(source : Source, startIndex : StartIndex) : string | null {
    this.regex.lastIndex = startIndex
    const result = this.regex.exec(source);
    return hasResult(result) ? result![0] : null;
  }
  getEndIndex(source : Source, startIndex : StartIndex) : EndIndex | null {
    this.regex.lastIndex = startIndex
    const result = this.regex.exec(source);
    return hasResult(result) ? this.regex.lastIndex - 1 : null;
  }
  getNextStart(source : Source, startIndex : StartIndex) : StartIndex | null {
    this.regex.lastIndex = startIndex
    const result = this.regex.exec(source);
    return hasResult(result) ? this.regex.lastIndex : null;
  }
  getMatchAndEndIndex(source : Source, startIndex : StartIndex) : [EndIndex | null, string | null] {
    this.regex.lastIndex = startIndex
    const result = this.regex.exec(source);
    return [
      hasResult(result) ? this.regex.lastIndex - 1 : null, 
      hasResult(result) ? result![0] : null
    ];
  }
  getMatchAndNextStartIndex(source : Source, startIndex : StartIndex) : [StartIndex | null, string | null] {
    this.regex.lastIndex = startIndex
    const result = this.regex.exec(source);
    return [
      hasResult(result) ? this.regex.lastIndex : null, 
      hasResult(result) ? result![0] : null
    ];
  }
}

export namespace Maybe {
  export function orHandleEndIndex<A,B>(a : A | number, handleNoMatch : (endIndex: EndIndex) => B) : A | B {
    if (typeof a === 'number') {
      return handleNoMatch(a);
    } else {
      return a;
    }
  }
}
