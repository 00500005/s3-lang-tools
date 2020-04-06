import { Parser, SourceIndex, RawRangeLike, Err, Main, ParseReturn, ParseYield  } from '../parser'
import { Diagnostic, Range, DiagnosticSeverity, Connection } from 'vscode-languageserver';
import { ProgressOptions, TaskQueue, CallbackResult } from '../manager';
import { SugarcubeDoc } from './doc';

export type DiagnosticParseReturn = { diagnostics: Diagnostic[], root: Main.Token | null }
export class VsSugarcubeParser {
  constructor(connection : Connection, queue : TaskQueue) {
    this.connection = connection;
    this.queue = queue;
  }
  connection : Connection;
  queue : TaskQueue;
  queueTask(document : SugarcubeDoc) : void {
    const iterator = this.parse(document.uri, document.content)
    /** @todo cancellation support */
    const cancelToken = this.queue.queueTask({
      callback: (options : ProgressOptions) : CallbackResult => {
        const {value, done} = iterator.next(options);
        if (done) {
          this.connection.sendDiagnostics({
            uri: document.uri,
            diagnostics: (<DiagnosticParseReturn>value).diagnostics
          });
        }
        /** @todo emit progress report */
        return <IteratorResult<void, void>>{ done }
      }
    })
  }
  *generate(
    contents : string,
    onError : (index : SourceIndex, err : GenericError) => void,
    onComplete : (index : SourceIndex, token : Main.Token) => void
  ) : Generator<void, void, ProgressOptions> {
    const parser = new Parser();
    const iterator = parser.parseIter(contents);
    let next = iterator.next();
    let options = yield;
    while (!next.done && !options.cancel) {
      const [index, errors] = <ParseYield>next.value
      errors.forEach(e => onError(index, e))
      next = iterator.next();
      options = yield;
    }
    if(options.cancel) {
      return;
    }

    const [index, result] = <ParseReturn>next.value;
    if (result instanceof Err.ParserError) {
      onError(index, { endIndex: contents.length, ...result })
    } else if(result) {
      onComplete(index, result)
    }
  }
  *parse(name : string, contents : string) : Generator<void, DiagnosticParseReturn, ProgressOptions> {
    const diagnostics : Diagnostic[] = [];
    let root : Main.Token | null = null;
    try {
      const iterator = this.generate(
        contents,
        (index, e) => {
          diagnostics.push(Diagnostic.create(
            getRangeFromTokenLike(index, e),
            e.message,
            DiagnosticSeverity.Error,
            undefined,
            name
          ))
        },
        (index, t) => {
          root = t
        }
      )
      let options;
      do {
        options = yield;
      }
      while(!iterator.next(options).done);
    } catch(e) {
      throw e
    }
    return <DiagnosticParseReturn>{ diagnostics, root };
  }
}

function getRangeFromTokenLike(index : SourceIndex, token : RawRangeLike) : Range {
  return Range.create(
    index.getPositionFromOffset(token.startIndex),
    // we always use an inclusive end index, but VS expects an exclusive end index
    index.getPositionFromOffset(token.endIndex + 1)
  );
}
interface GenericError extends Error {
  startIndex: number,
  endIndex: number,
  severity?: DiagnosticSeverity
}
