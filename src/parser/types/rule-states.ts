/* 
Common definition for all rule states
Needed as rules have cross dependencies between rule states
*/

import * as Rule from "./rules";
import * as AST from "./AST";

// Only used as a placeholder state in the parser
export class MainStateless implements Rule.State<MainStateless> {
  type: Rule.Type = Rule.Type.Main;

  static create(): MainStateless {
    return MainStateless.INSTANCE;
  }
  equals(other: any): boolean {
    return this.type === other.type;
  }
  clone(): MainStateless {
    return MainStateless.INSTANCE;
  }

  private constructor() { }
  private static INSTANCE = new MainStateless();
}
export class RawJavascriptState implements Rule.State<RawJavascriptState> {
  type: Rule.Type = Rule.Type.Javascript;

  static create(): RawJavascriptState {
    return RawJavascriptState.INSTANCE;
  }
  equals(other: any): boolean {
    return this.type === other.type;
  }
  clone(): RawJavascriptState {
    return RawJavascriptState.INSTANCE;
  }

  private constructor() { }
  private static INSTANCE = new RawJavascriptState();
}
export class TwinescriptState implements Rule.State<TwinescriptState> {
  type: Rule.Type = Rule.Type.Twinescript;
  endMode: TwinescriptEndMode;

  static create(endMode: TwinescriptEndMode): TwinescriptState {
    return new TwinescriptState(endMode);
  }
  clone(): TwinescriptState {
    return new TwinescriptState(this.endMode);
  }
  equals(other: any): boolean {
    return this.endMode === other.endMode
      && this.type === other.type;
  }

  private constructor(endMode: TwinescriptEndMode) {
    this.endMode = endMode;
  }
}
export enum TwinescriptEndMode {
  QUOTE = '`',
  MACROLIKE = '>>',
  INDEX = "]",
  ARRAY = "]",
  TWINEMARKUP = "]]",
  PAREN = ")",
  BRACE = "}"
}
export enum MacroEndMode {
  MACROENTRY = '>>'
}
export class MacroState implements Rule.State<MacroState> {
  type: Rule.Type = Rule.Type.Macro;
  endMode: MacroEndMode;
  macroType?: AST.MacroType;
  macroName?: string;

  static create(endMode: MacroEndMode): MacroState {
    return new MacroState(endMode);
  }
  clone(): MacroState {
    return new MacroState(this.endMode);
  }
  equals(other: any): boolean {
    return this.endMode === other.endMode
      && this.type === other.type;
  }

  private constructor(endMode: MacroEndMode) {
    this.endMode = endMode;
  }
}
export class VariableState implements Rule.State<VariableState> {
  type: Rule.Type = Rule.Type.Variable;
  variableType: AST.VariableType;
  dot: boolean = false;

  static create(variableType: AST.VariableType): VariableState {
    return new VariableState(variableType);
  }
  equals(other: any): boolean {
    return this.variableType === other.variableType
      && this.type === other.type
      && this.dot === other.dot;
  }
  clone(): VariableState {
    const state = new VariableState(this.variableType);
    state.dot = this.dot;
    return state;
  }

  private constructor(variableType: AST.VariableType) {
    this.variableType = variableType;
  }
}
export enum TwinemarkupMode {
  // Mode describes the next expected token
  LINK_START = "LINK_START",
  LINK_LINK = "LINK_LINK",
  IMG_START = "IMG_START",
  IMG_IMG = "IMG_IMG",
  IMG_LINK_OR_END = "IMG_LINK_OR_END",
  SETTER_OR_END = "SETTER_OR_END",
  TWINESCRIPT_END = "END",
  NO_MORE = "NO_MORE",
}
export class TwinemarkupState implements Rule.State<TwinemarkupState> {
  type: Rule.Type = Rule.Type.Twinemarkup;
  markupType: AST.TwinemarkupType;
  nextMode: TwinemarkupMode;
  link: AST.Token[] = [];
  title: AST.Token[] = [];
  imgpath: AST.Token[] = [];
  setter?: AST.TwinescriptToken;
  static create(markupType: AST.TwinemarkupType): TwinemarkupState {
    return new TwinemarkupState(markupType);
  }
  equals(other: any): boolean {
    return this.markupType === other.markupType
      && this.nextMode === other.mode
      && this.type === other.type;
    /** @todo: implement proper equality for link,title,imgpath props */
  }
  clone(): TwinemarkupState {
    const newState = new TwinemarkupState(this.markupType);
    newState.nextMode = this.nextMode;
    newState.title = this.title
    newState.link = this.link
    newState.imgpath = this.imgpath
    return newState;
  }
  private constructor(markupType: AST.TwinemarkupType) {
    this.markupType = markupType;
    this.nextMode = markupType === AST.TwinemarkupType.IMAGE ?
      TwinemarkupMode.IMG_START : TwinemarkupMode.LINK_START
  }
}


