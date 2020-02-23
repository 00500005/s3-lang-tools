import { Token, TokenType, Source, EndIndex, StartIndex, RangeLike } from "./common";
import { YieldInstance, GenericState } from "./rules";

export namespace Err {
  export type ErrorOptions = { message ?: string, sourceFn ?: Function, stackLimit ?: number };
  export class KnownError implements Error {
    constructor(errorType : Err.Type, { message, sourceFn, stackLimit } : ErrorOptions) {
      this.errorType = errorType;
      this.name = KnownError.getErrorName(errorType);
      // TODO: create default messages based on errorType
      this.message = message || this.name;
      const normalLimit = Error.stackTraceLimit;
      Error.stackTraceLimit = stackLimit || KnownError.defaultStackLimit;
      Error.captureStackTrace(this, sourceFn);
      Error.stackTraceLimit = normalLimit;
    }
    name: string;
    message: string;
    stack?: string | undefined;
    errorType : Err.Type;
  }
  export namespace KnownError {
    export const defaultStackLimit = 5;
    export function getErrorName(errType : Err.Type) : string {
      return errType.replace(/([A-Z])/g, ' $1').trim().toLowerCase().replace(/^./, s => s.toUpperCase());
    }
  }
  export enum Type {
    UnclosedMacroInvocation = 'UnclosedMacroInvocation',
    UnclosedMacroContent = 'UnclosedMacroContent',
    NestedWidget = 'NestedWidget',
    UnclosedString = 'UnclosedString',
    UnclosedMacroEntry = "UnclosedMacroEntry",
    RedefinedWidget = 'RedefinedWidget',
    MissingArgument = 'MissingArgument',
    UnexpectedArguments = 'UnexpectedArguments',
    InvalidArgument = 'InvalidArgument',
    Undefined = "Undefined",
    TwineNameConfusion = "TwineNameConfusion",
    UnexpectedEndOfContent = "UnexpectedEndOfContent",
    UnrecoverableParserError = "UnrecoverableLexerError",
    InvalidName = "InvalidName",
    UnmatchedMacroClose = "UnmatchedMacroClose",
    UnclosedWidget = "UnclosedWidget",
    DeepWidget = "DeepWidget",
    RedefinedPassage = "RedefinedPassage",
    InvalidString = "InvalidString",
    InvalidScriptMacroInvocation = "InvalidScriptEntry",
    MissingMacroName = "MissingMacroName",
    UnclosedTwinemarkup = "UnclosedTwinemarkup",
    InvalidTwinemarkup = "InvalidTwinemarkup",
    InvalidOperation = "InvalidOperation",
    UnexpectedToken = "UnexpectedToken",
    UnrecommendedName = "UnrecommendedName",
    UnclosedJavascript = "UnclosedJavascript",
    UnexpectedInvocation = "UnexpectedInvocation",
    UnclosedTwinescript = "UnclosedTwinescript"
  }
  export type ParserErrorOptions = { recoverable ?: boolean } & ErrorOptions;
  export class ParserError extends KnownError {
    constructor(errorType : Type, startOffset : number, { recoverable, ...errorOptions } : ParserErrorOptions = {}) {
      super(errorType, errorOptions);
      this.startIndex = startOffset;
      this.recoverable = recoverable || false;
    }
    startIndex : number;
    recoverable : boolean;
  }
  export class TokenError extends ParserError {
    constructor(errorType : Type, token : Token, parserOptions ?: ParserErrorOptions) {
      super(errorType, token.startIndex, {recoverable: true, ...parserOptions});
      this.tokenType = token.tokenType;
      this.endIndex = token.endIndex;
    }
    endIndex : number;
    tokenType : TokenType;
  }
  export function tokenError(errorType : Type, token : Token, options ?: ErrorOptions) : TokenError {
    return new TokenError(errorType, token, Object.assign({ sourceFn: Err.tokenError }, options));
  }
  export function unrecoverable(errorType : Type, startIndex : StartIndex, options ?: ErrorOptions) : ParserError {
    return new ParserError(errorType, startIndex, Object.assign({ sourceFn: Err.unrecoverable }, options));
  }
  interface RuleMetadata {
    lastRule: YieldInstance,
    source : Source, 
    state : GenericState,
    atIndex : StartIndex,
    startIndex : StartIndex,
    endIndex : EndIndex,
    tokens : Token[],
    sourceFn : Function,
  }
  export type ProgrammingErrorMetadata = Partial<RuleMetadata>;
  export class ProgrammingError extends Error {
    constructor(msg : string, metadata : ProgrammingErrorMetadata) {
      super(ProgrammingError.messageString(msg, metadata));
      this.metadata = metadata;
      if (metadata.sourceFn) {
        Error.captureStackTrace(this, metadata.sourceFn);
      }
    }
    metadata: ProgrammingErrorMetadata;
    static messageString(msg : string, metadata : ProgrammingErrorMetadata) : string {
      const shortenMessage = /[^:\.?-\s]*/.exec(msg);
      return `${shortenMessage ? shortenMessage[0] : msg}: \n${this.dumpMetadata(metadata, { level: 1 })}`
    }
    static dumpMetadata(metadata : ProgrammingErrorMetadata, options: { level ?: number }={}) {
      const { 
        atIndex, state, lastRule, source,
        startIndex, endIndex, tokens,
      } = metadata;
      const metadataPreview = [
        atIndex !== undefined ? `atIndex = ${atIndex}` : null,
        startIndex !== undefined ? `startIndex = ${startIndex}` : null,
        endIndex !== undefined ? `endIndex = ${endIndex}` : null,
        tokens !== undefined ? `tokens = ${toJson(1, tokens)}` : null,
        state !== undefined ? `state = ${toJson(1, state)}` : null,
        lastRule !== undefined ? `lastRule = ${toJson(1, lastRule)}` : null,
        source !== undefined ? `sourcePreview:\n${toJson(1, source.slice(0, 60))}${source.length > 60 ? '...' : ''}` : null,
      ]
      const output = metadataPreview.filter(m => m !== null).join('\n');
      if (options.level) {
        return '  '.repeat(options.level) + levelizer(options.level, output);
      } else {
        return output;
      }

      function toJson(level : number, o: any) : string {
        return levelizer(level, JSON.stringify(o));
      }
      function levelizer(level : number, s: string) : string {
        return s.split('\n').join('\n' + '  '.repeat(level));
      }
    }
  }
  // thrown errors
  export function programmingError(msg : string, metadata : ProgrammingErrorMetadata = {}) : Error {
    return new ProgrammingError(msg, Object.assign({ sourceFn: Err.unexpected }, metadata));
  }
  export function unexpected(metadata : ProgrammingErrorMetadata = {}) : Error {
    return new ProgrammingError('Unexpected programming error', Object.assign({ sourceFn: Err.unexpected }, metadata));
  }
}

