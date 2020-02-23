/**
 * we test our assumptions about performance here 
 */
import "jest";
import "process";

function randomWordlike() {
  return Math.abs(Math.random()).toString(36).slice(2);
}
function *gobbledyGook(length : number) {
  const numberOfWords = Math.ceil(length / 10)
  for(let i=0; i<numberOfWords; i++) {
    yield randomWordlike()
  }
}
function timeit(todo : () => void) : number {
  // once to precache so ordering matters significantly less
  // todo();
  const start = process.hrtime();
  todo();
  // just the nanoseconds is fine
  return process.hrtime(start)[1];
}
describe('regex vs loop performance', () => {
  /**
   * it appears that non-greedy matcher is actually the most performant
   * with pure regex solutions being 20% faster than loop based ones
   */
  it.skip('should have significantly better regex than loop performance on dispatch matching', () => {
    let naiveRegexTimes = [];
    let greedyRegexTimes = [];
    let loopTimes = [];
    const numberOfTrials = 1200;
    const maxNumberOfSubTrials = 100;
    const minSubstrLength = 10000;
    const lengthOfTrailInput = 10000000;
    // warmup as regex may be lazyily compiled
    const testStr = Array.from(gobbledyGook(lengthOfTrailInput)).join(' ');
    const startPos = Math.floor(testStr.length * Math.random());
    timeit(testNaiveRegexDispatch(startPos, testStr));
    timeit(testGreedyRegexDispatch(startPos, testStr));
    timeit(testLoopDispatch(startPos, testStr));

    let c=0;
    for(let i=0; i<numberOfTrials; i++) {
      const testStr = Array.from(gobbledyGook(lengthOfTrailInput)).join(' ');
      let startPos = 0;
      for(let j=0; j<maxNumberOfSubTrials; j++) {
        c++;
        startPos += Math.floor((testStr.length - startPos) * Math.random() * .5);
        if (startPos > (testStr.length - minSubstrLength)) {
          break;
        }
        // as our trials are much shorter in nature, we're much more sensitive to caching
        // as such, we distribute the execution order to ensure as fair of trials as possible
        switch (c%6) {
          case 0:
            naiveRegexTimes.push(timeit(testNaiveRegexDispatch(startPos, testStr)))
            greedyRegexTimes.push(timeit(testGreedyRegexDispatch(startPos, testStr)))
            loopTimes.push(timeit(testLoopDispatch(startPos, testStr)))
            continue;
          case 1:
            naiveRegexTimes.push(timeit(testNaiveRegexDispatch(startPos, testStr)))
            loopTimes.push(timeit(testLoopDispatch(startPos, testStr)))
            greedyRegexTimes.push(timeit(testGreedyRegexDispatch(startPos, testStr)))
            continue;
          case 2:
            greedyRegexTimes.push(timeit(testGreedyRegexDispatch(startPos, testStr)))
            naiveRegexTimes.push(timeit(testNaiveRegexDispatch(startPos, testStr)))
            loopTimes.push(timeit(testLoopDispatch(startPos, testStr)))
            continue;
          case 3:
            loopTimes.push(timeit(testLoopDispatch(startPos, testStr)))
            naiveRegexTimes.push(timeit(testNaiveRegexDispatch(startPos, testStr)))
            greedyRegexTimes.push(timeit(testGreedyRegexDispatch(startPos, testStr)))
            continue;
          case 4:
            greedyRegexTimes.push(timeit(testGreedyRegexDispatch(startPos, testStr)))
            loopTimes.push(timeit(testLoopDispatch(startPos, testStr)))
            naiveRegexTimes.push(timeit(testNaiveRegexDispatch(startPos, testStr)))
            continue;
          case 5:
            loopTimes.push(timeit(testLoopDispatch(startPos, testStr)))
            greedyRegexTimes.push(timeit(testGreedyRegexDispatch(startPos, testStr)))
            naiveRegexTimes.push(timeit(testNaiveRegexDispatch(startPos, testStr)))
            continue;
        }
      }
    }
    console.log('actual number of trials', c);
    const greedyRegexAverage = greedyRegexTimes.reduce((sum, n) => sum + n, 0) / c;
    const naiveRegexAverage = naiveRegexTimes.reduce((sum, n) => sum + n, 0) / c;
    const loopTimeAverage = loopTimes.reduce((sum, n) => sum + n, 0) / c;
    console.log(`greedy avg(ns): ${greedyRegexAverage}`)
    console.log(`naive  avg(ns): ${naiveRegexAverage}`)
    console.log(`loop   avg(ns): ${loopTimeAverage}`)
    console.log(`${greedyRegexAverage} <? ${naiveRegexAverage / 1.2}`)
    console.log(`${greedyRegexAverage} <? ${loopTimeAverage / 1.2}`)
    expect(greedyRegexAverage).toBeLessThan(naiveRegexAverage / 1.2);
    expect(greedyRegexAverage).toBeLessThan(loopTimeAverage / 1.2);
    
  });
/**
 * curiously, loop performance degrades significantly when skipping tokens
 */
  it.skip('should have significantly better regex than loop performance on simple scan long string', () => {
    let regexTimes = [];
    let loopTimes = [];
    const numberOfTrials = 50;
    const lengthOfTrailInput = 1000000;
    for(let i=0; i<numberOfTrials; i++) {
      const testStr = Array.from(gobbledyGook(lengthOfTrailInput)).join(' ');
      regexTimes.push(timeit(testRegex(testStr)))
      loopTimes.push(timeit(testLoop(testStr)))
    }
    const regexTimeAverage = regexTimes.reduce((sum, n) => sum + n, 0) / numberOfTrials;
    const loopTimeAverage = loopTimes.reduce((sum, n) => sum + n, 0) / numberOfTrials;
    console.log(`regex avg(ms): ${regexTimeAverage}`)
    console.log(`loop  avg(ms): ${loopTimeAverage}`)
    console.log(`${regexTimeAverage} <? ${loopTimeAverage / 1.5}`)
    expect(regexTimeAverage).toBeLessThan(loopTimeAverage / 1.5);
  })
  const TestRegex = /[^<\[$_]+/y;
  function testRegex(input : string) : () => void {
    return () => {
      TestRegex.lastIndex = 0;
      const result = TestRegex.exec(input);
      if (!result) {
        throw new Error(`Invalid input`);
      }
    }
  }
  function testLoop(input : string) : () => void {
    return () => {
      let offset = 0;
      while(offset < input.length) {
        switch(input[offset++]) {
          case '<':
          case '[':
          case '$':
          case '_':
            throw new Error(`Invalid input @${offset}\n...${input.slice(offset - 5, offset + 5)}...`);
        }
      }
    }
  }
  enum DispatchResult {
    A,
    B,
    C,
    D,
    None
  }
  const TestNaiveDispatchRegex = /.*?(?:(a)|(b)|(c)|(d))/yi;
  function testNaiveRegexDispatch(startAt : number, input : string) : () => DispatchResult {
    return () => {
      TestNaiveDispatchRegex.lastIndex = startAt;
      const result = TestNaiveDispatchRegex.exec(input);
      if (result) {
        if (result[1]) { return DispatchResult.A }
        if (result[2]) { return DispatchResult.B }
        if (result[3]) { return DispatchResult.C }
        if (result[4]) { return DispatchResult.D }
      }
      return DispatchResult.None;
    }
  }
  // Probably not a fair test, as each submatch would need further evaluation
  const TestGreedyDispatchRegex = /[^abcd]*(?:(a)|(b)|(c)|(d))/yi;
  function testGreedyRegexDispatch(startAt : number, input : string) : () => DispatchResult {
    return () => {
      TestGreedyDispatchRegex.lastIndex = startAt;
      const result = TestGreedyDispatchRegex.exec(input);
      if (result) {
        if (result[1]) { return DispatchResult.A }
        if (result[2]) { return DispatchResult.B }
        if (result[3]) { return DispatchResult.C }
        if (result[4]) { return DispatchResult.D }
      }
      return DispatchResult.None;
    }
  }
  function testLoopDispatch(startAt : number, input : string) : () => DispatchResult {
    return () => {
      let offset = startAt;
      while(offset < input.length) {
        switch(input[offset++]) {
          case 'a':
          case 'A':
            return DispatchResult.A
          case 'b':
          case 'B':
            return DispatchResult.B
          case 'c':
          case 'C':
            return DispatchResult.C
          case 'd':
          case 'D':
            return DispatchResult.D
        }
      }
      return DispatchResult.None;
    }
  }
})
