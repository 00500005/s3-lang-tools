import { Parser, SourceIndex, RawRangeLike, Err, Main, ParseReturn, ParseYield } from '../parser'
import { Diagnostic, Range, DiagnosticSeverity, Connection, WorkDoneProgressReport, WorkDoneProgressEnd, WorkDoneProgressCreateRequest, WorkDoneProgressBegin, WorkDoneProgress } from 'vscode-languageserver';
import { ProgressOptions, TaskQueue, CallbackResult, Priority } from '../manager';
import { DebugConsole } from '../config/log';

export type DiagnosticParseReturn = { diagnostics: Diagnostic[], root: Main.Token | null }
export class VsSugarcubeParser {
  constructor(connection: Connection, debugConsole: DebugConsole, queue: TaskQueue) {
    this.connection = connection;
    this.queue = queue;
    this.debugConsole = debugConsole;
  }
  connection: Connection;
  debugConsole: DebugConsole;
  queue: TaskQueue;
  *generate(
    contents: string,
    onError: (index: SourceIndex, err: GenericError) => void,
    onComplete: (index: SourceIndex, token: Main.Token) => void
  ): Generator<Parser, Parser, ProgressOptions> {
    const parser = new Parser();
    const iterator = parser.parseIter(contents);
    let next = iterator.next();
    let options = yield parser;
    while (!next.done && !options.cancel) {
      const [index, errors] = <ParseYield>next.value
      errors.forEach(e => onError(index, e))
      next = iterator.next();
      options = yield parser;
    }
    if (options.cancel) {
      return parser;
    }

    const [index, result] = <ParseReturn>next.value;
    if (result instanceof Err.ParserError) {
      onError(index, { endIndex: contents.length, ...result })
    } else if (result) {
      onComplete(index, result)
    }
    return parser
  }
  *parse(name: string, contents: string): Generator<[Parser, null], [Parser, DiagnosticParseReturn], ProgressOptions> {
    const diagnostics: Diagnostic[] = [];
    let root: Main.Token | null = null;
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
      let options = ProgressOptions.Default, result;
      do {
        result = iterator.next(options);
        options = yield [result.value, null];
      } while (!result.done);
      return <[Parser, DiagnosticParseReturn]>[result.value, { diagnostics, root }];
    } catch (e) {
      throw e
    }
  }
}

function getRangeFromTokenLike(index: SourceIndex, token: RawRangeLike): Range {
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
