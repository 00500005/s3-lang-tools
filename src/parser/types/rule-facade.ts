/**
 * A facade (Yield) for various rule types
 * 
 * Note, users of types should use this facade, rather than the raw types
 */
import * as Rule from './rules';
import * as AST from './AST';
import * as TokenBuilder from './AST-facade';
import { Token, EndIndex } from './common';
import { VariableState, MainStateless, MacroState, TwinescriptState, TwinemarkupState, TwinescriptEndMode, MacroEndMode, RawJavascriptState, TwinemarkupMode } from './rule-states';
import { Err } from './errors';
import { StartIndex } from '.';

export namespace Yield {
  export const START : Rule.YieldInstance = Object.freeze(<Rule.YieldInstance>{
    type : Rule.YieldType.START,
    lastIndex : -1,
  })
  export type Push = Rule.YieldPush;
  export const Push = Rule.YieldType.PUSH;
  export type Pop = Rule.YieldPop;
  export const Pop = Rule.YieldType.POP;
  export type Step = Rule.YieldStep;
  export const Step = Rule.YieldType.STEP;
  export type Goto = Rule.YieldGoto;
  export const Goto = Rule.YieldType.GOTO;
  export type Unrecoverable = Rule.YieldUnrecoverable;
  export const Unrecoverable = Rule.YieldType.UNRECOVERABLE;
  export const Start = Rule.YieldType.START;
  export type Generic = Rule.YieldInstance;
  export type Any = Partial<Push & Pop & Step & Goto & Unrecoverable & Generic>;
  export type Type = Rule.YieldType;
  export const Type = Rule.YieldType;
  export type RawState<T extends Rule.State<T>> = Rule.State<T>;
  export type StateType = Rule.Type;
  export const StateType = Rule.Type;
  export type GenericState = Rule.GenericState;
  export type AnyState = Partial<Main.State & Variable.State & Macro.State & Javascript.State & Twinescript.State & Twinemarkup.State>;
  export type AllState = Partial<Main.State | Variable.State | Macro.State | Javascript.State | Twinescript.State | Twinemarkup.State>;
  export namespace Main {
    export type State = MainStateless;
    export const State = MainStateless;
    export const Type = Rule.Type.Main;
  }
  export namespace Variable {
    export type State = VariableState;
    export const State = VariableState;
    export const Type = Rule.Type.Variable;
    export type VariableType = AST.VariableType;
    export const VariableType = AST.VariableType;
  }
  export namespace Macro {
    export type State = MacroState;
    export const State = MacroState;
    export type EndMode = MacroEndMode;
    export const EndMode = MacroEndMode;
    export const Type = Rule.Type.Macro;
    export type MacroType = AST.MacroType;
    export const MacroType = AST.MacroType;
  }
  export namespace Javascript {
    export type State = RawJavascriptState;
    export const State = RawJavascriptState;
    export const Type = Rule.Type.Javascript;
  }
  export namespace Twinescript {
    export type State = TwinescriptState;
    export const State = TwinescriptState;
    export type EndMode = TwinescriptEndMode;
    export const EndMode = TwinescriptEndMode;
    export const Type = Rule.Type.Twinescript;
  }
  export namespace Twinemarkup {
    export type State = TwinemarkupState;
    export const State = TwinemarkupState;
    export type MarkupType = AST.TwinemarkupType;
    export const MarkupType = AST.TwinemarkupType;
    export const Type = Rule.Type.Twinemarkup;
    export type MarkupMode = TwinemarkupMode;
    export const MarkupMode = TwinemarkupMode;
  }
  type ToMain<T extends Rule.YieldInstance> = TokenBuilder.Main.Builder.Chainable<Builder<T>>;
  type ToContent<T extends Rule.YieldInstance> = TokenBuilder.Content.Builder.Chainable<Builder<T>>;
  type ToPassage<T extends Rule.YieldInstance> = TokenBuilder.Passage.Builder.Chainable<Builder<T>>;
  type ToMacro<T extends Rule.YieldInstance> = TokenBuilder.Macro.Builder.Chainable<Builder<T>>;
  type ToString<T extends Rule.YieldInstance> = TokenBuilder.String.Builder.Chainable<Builder<T>>;
  type ToTwinemarkup<T extends Rule.YieldInstance> = TokenBuilder.Twinemarkup.Builder.Chainable<Builder<T>>;
  type ToVariable<T extends Rule.YieldInstance> = TokenBuilder.Variable.Builder.Chainable<Builder<T>>;
  type ToTwinescript<T extends Rule.YieldInstance> = TokenBuilder.Twinescript.Builder.Chainable<Builder<T>>;

  type YieldTokenBuilder<T extends Rule.YieldInstance> =
    | ToMain<T>
    | ToContent<T> 
    | ToPassage<T>
    | ToMacro<T>
    | ToString<T>
    | ToTwinemarkup<T>
    | ToVariable<T>
    | ToTwinescript<T>

  export function push() : Builder<Rule.YieldPush> {
    return Builder.builder(Rule.YieldType.PUSH)
  }
  export function pop() : Builder<Rule.YieldPop> {
    return Builder.builder(Rule.YieldType.POP)
  }
  export function goto() : Builder<Rule.YieldGoto> {
    return Builder.builder(Rule.YieldType.GOTO)
  }
  export function unrecoverable() : Builder<Rule.YieldUnrecoverable> {
    return Builder.builder(Rule.YieldType.UNRECOVERABLE);
  }
  export function step() : Builder<Rule.YieldStep> {
    return Builder.builder(Rule.YieldType.STEP)
  }

  export class Builder<T extends Rule.YieldInstance> {
    static builder<T extends Rule.YieldInstance>(type : Rule.YieldType) : Builder<T> {
      return new Builder(type);
    }
    setLastIndex(lastIndex : EndIndex) : Builder<T> {
      this.lastIndex = lastIndex;
      return this;
    }
    setToken(token : Token) : Builder<T> {
      this.token = token;
      return this;
    }
    setNewState(newState : Rule.GenericState) : Builder<T> {
      this.newState = newState;
      return this;
    }
    setNewStateStartIndex(startIndex ?: StartIndex) : Builder<T> {
      this.newStateStartIndex = startIndex;
      return this;
    }
    setCriticalError(criticalError : Err.ParserError) : Builder<T> {
      if (this.type !== Rule.YieldType.UNRECOVERABLE) {
        throw new Error(`critical error can only be assigned to a ${Rule.YieldType.UNRECOVERABLE} rule type`);
      }
      this.criticalError = criticalError;
      return this;
    }
    addErrors(...errors : Err.TokenError[]) : Builder<T> {
      this.errors.splice(this.errors.length - 1, 0, ...errors);
      return this;
    }
    buildContentToken() : ToContent<T> {
      return this.tokenBuilder = TokenBuilder.Content.builder(this);
    }
    buildMainToken() : ToMain<T> {
      return this.tokenBuilder = TokenBuilder.Main.builder(this);
    }
    buildPassageToken() : ToPassage<T> {
      return this.tokenBuilder = TokenBuilder.Passage.builder(this);
    }
    buildStringToken(stringType : AST.StringType) : ToString<T> {
      return this.tokenBuilder = TokenBuilder.String.builder(stringType, this);
    }
    buildMacroToken() : ToMacro<T> {
      return this.tokenBuilder = TokenBuilder.Macro.builder(this);
    }
    buildTwinemarkupToken(markupType : AST.TwinemarkupType) : ToTwinemarkup<T> {
      return this.tokenBuilder = TokenBuilder.Twinemarkup.builder(markupType, this);
    }
    buildVariableToken(variableType : AST.VariableType) : ToVariable<T> {
      return this.tokenBuilder = TokenBuilder.Variable.builder(variableType, this);
    }
    buildTwinescriptToken() : ToTwinescript<T> {
      return this.tokenBuilder = TokenBuilder.Twinescript.builder(this);
    }

    private type : Rule.YieldType;
    private lastIndex ?: EndIndex;
    private token ?: Token;
    private tokenBuilder ?: YieldTokenBuilder<T>;
    private newState ?: Rule.GenericState;
    private newStateStartIndex ?: number;
    private criticalError ?: Err.ParserError;
    private errors : Err.TokenError[] = []
    build() : T {
      const type = this.type;
      const lastIndex = this.inferLastIndex();
      const result : Yield.Generic = { type, lastIndex };
      if (this.errors.length) {
        result.errors = this.errors;
      }
      const token = this.getActualToken();
      if (token) {
        result.token = token;
      }
      assert(!(this.criticalError && type !== Rule.YieldType.UNRECOVERABLE))
      switch (type) {
        case Rule.YieldType.UNRECOVERABLE:
          (<Yield.Unrecoverable>result).criticalError = assert(this.criticalError, 'criticalError');
          break;
        case Rule.YieldType.PUSH:
        case Rule.YieldType.GOTO:
          (<Yield.Goto & Yield.Push>result).newState = assert(this.newState, 'newState');
          (<Yield.Goto & Yield.Push>result).newStateStartIndex = this.newStateStartIndex;
          break;
        case Rule.YieldType.STEP:
          // step rules no longer require a token
          // assert(token, 'token');
        case Rule.YieldType.POP: break;
        default:
          throw new Error(`unsupported yield type: '${type}'`);
      }
      return <T>result;
      function assert<T>(value : T | undefined, name ?: string) : T {
        if (value === undefined) {
          if (name) {
            throw new Error(`${name} is required for ${type} rule types`);
          } else {
            throw new Error(`Invalid construction of ${type} rule type`)
          }
        }
        return <T>value;
      }
    }
    private constructor(type : Rule.YieldType) {
      this.type = type;
    }
    private getActualToken() : Token | undefined {
      if (this.token && this.tokenBuilder) {
        throw new Error(`using token setters with tokenBuilder is not supported`);
      }
      if (this.token) {
        return this.token;
      } else if(this.tokenBuilder) {
        return this.tokenBuilder.build();
      }
      return undefined;
    }
    private inferLastIndex() : number {
      const token = this.getActualToken();
      if (token) {
        return Math.max(this.lastIndex || 0, token.endIndex);
      } else if (this.lastIndex !== undefined) {
        return this.lastIndex;
      } else if (this.type === Rule.YieldType.UNRECOVERABLE) {
        return -1;
      } else {
        throw new Error(`Unable to infer last index. Either lastIndex or token must be set. Possible inference sources:`
          + `\n\tlastIndex: ${this.lastIndex}`
          + `\n\ttoken: ${this.token}`
          + `\n\ttokenBuilder: ${this.tokenBuilder}`);
      }
    }
  }
  export const builder = Builder.builder;
}

