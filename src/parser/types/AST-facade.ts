/**
 * Multiple facades for each specific token type
 * 
 * Note, users of types should use this facade, rather than the raw types
 */
import { StartIndex, EndIndex, Token as GenericToken, TokenType as AllTokenTypes } from "./common";
import * as AST from './AST';
import { TwinescriptEndMode } from "./rule-states";

export type AnyToken = Partial<
  AST.MainToken 
  & AST.TwinescriptToken
  & AST.TwinemarkupToken
  & AST.MacroToken
  & AST.VariableToken
  & AST.PassageDefinitionToken
  & AST.ContentToken
  & AST.StringToken
>;

class GenericChainableTokenBuilder<B extends GenericChainableTokenBuilder<B, T, P>, T extends GenericToken, P> {
  constructor(args : TokenBuilderArgs, parentBuilder : P | undefined) {
    this.args = args;
    this._parent = parentBuilder;
  }
  protected args : TokenBuilderArgs;
  private _parent : P | undefined;
  hasParent() : boolean {
    return !!this._parent;
  }
  getParent() : P {
    if (!this._parent) {
      throw new Error('Requested builder parent of top level builder');
    }
    return this._parent;
  }
  setStartIndex(startIndex : StartIndex) : B {
    this.args.startIndex = startIndex;
    return <B><any>this;
  }
  setEndIndex(endIndex : EndIndex) : B {
    this.args.endIndex = endIndex;
    return <B><any>this;
  }
  setParentToken(parentToken : GenericToken) : B {
    this.args.parent = parentToken;
    return <B><any>this;
  }
  build() : T {
    return <T>this.args.build();
  }
}
export type GenericTokenChainBuilder = GenericChainableTokenBuilder<GenericTokenChainBuilder, AST.Token, void>;
function withArgs(type: AllTokenTypes, otherArgs : Partial<TokenBuilderArgs> = {}) : TokenBuilderArgs {
  return Object.assign(new TokenBuilderArgs(type), otherArgs);
}
export namespace Content {
  export class Builder<SELF extends Builder<SELF, P>, P> extends GenericChainableTokenBuilder<SELF, AST.ContentToken, P> {
    static builder<P>(parent ?: P)  : Builder.Chainable<P> { 
      return new Builder(withArgs(TokenType), parent); 
    }
  }
  export namespace Builder {
    export type Chainable<P> = Builder<Chainable<P>, P>;
    export type Generic = Builder<Chainable<void>, void>;
  }

  export const builder = Builder.builder;
  export type Token = AST.ContentToken;
  export type TokenType = AllTokenTypes.Content;
  export const TokenType = AllTokenTypes.Content;
}
export namespace Main {
  type ToContent<P> = Content.Builder.Chainable<Builder.Chainable<P>>;
  type ToPassage<P>  = Passage.Builder.Chainable<Builder.Chainable<P>>;
  type ToVariable<P> = Variable.Builder.Chainable<Builder.Chainable<P>>;
  type ToMacro<P> = Macro.Builder.Chainable<Builder.Chainable<P>>;
  type ToTwinemarkup<P> = Twinemarkup.Builder.Chainable<Builder.Chainable<P>>;
  type ToTwinescript<P> = Twinescript.Builder.Chainable<Builder.Chainable<P>>;
  export class Builder<SELF extends Builder<SELF, P>, P> extends GenericChainableTokenBuilder<SELF, AST.MainToken, P> {
    static builder<P>(parent ?: P) : Builder.Chainable<P> { 
      return new Builder(withArgs(TokenType), parent); 
    }
    setChunks(statements : AST.StatementToken[]) : SELF {
      this.args.mainChunks = statements;
      return <SELF><Builder.Chainable<P>>this;
    }
    addChunks(...statements : AST.StatementToken[]) : SELF {
      this.args.mainChunks.splice(
        this.args.mainChunks.length - 1, 0, ...statements);
      return <SELF><Builder.Chainable<P>>this;
    }
    addContent() : ToContent<P> { 
      return <ToContent<P>>this.appendToChunks(<Content.Builder.Generic>Content.builder(this));
    }
    addPassage() : ToPassage<P> { 
      return <ToPassage<P>>this.appendToChunks(<Passage.Builder.Generic>Passage.builder(this));
    }
    addVariable(variableType : AST.VariableType) : ToVariable<P> { 
      return <ToVariable<P>>this.appendToChunks(<Variable.Builder.Generic>Variable.builder(variableType, this)); 
    }
    addMacro() : ToMacro<P> {
      return <ToMacro<P>>this.appendToChunks(<Macro.Builder.Generic>Macro.builder(this));
    }
    addTwinescript() : ToTwinescript<P> {
      return <ToTwinescript<P>>this.appendToChunks(<Twinescript.Builder.Generic>Twinescript.builder(this));
    }
    addTwinemarkup(markupType : AST.TwinemarkupType) : ToTwinemarkup<P> {
      return <ToTwinemarkup<P>>this.appendToChunks(<Twinemarkup.Builder.Generic>Twinemarkup.builder(markupType, this));
    }
    private appendToChunks<T extends StatementBuilderValue>(builder : T) : T {
      this.args.mainChunks.push(builder);
      return builder;
    }
  }
  export namespace Builder {
    export type Chainable<P> = Builder<Chainable<P>, P>;
    export type Generic = Builder<Chainable<void>, void>;
  }
  export const builder = Builder.builder;
  export type Token = AST.MainToken;
  export type TokenType = AllTokenTypes.Main;
  export const TokenType = AllTokenTypes.Main;
}
export namespace Passage {
  export class Builder<SELF extends Builder<SELF, P>, P> extends GenericChainableTokenBuilder<SELF, AST.PassageDefinitionToken, P> {
    static builder<P>(parent ?: P) : Builder.Chainable<P> { 
      return new Builder(withArgs(TokenType), parent); 
    }
    setPassageName(passageName : string) : SELF {
      this.args.passageName = passageName;
      return <SELF><Builder.Chainable<P>>this;
    }
  }
  export namespace Builder {
    export type Chainable<P> = Builder<Chainable<P>, P>;
    export type Generic = Builder<Chainable<void>, void>;
  }
  export const builder = Builder.builder;
  export type Type = AST.PassageDefinitionToken;
  export type TokenType = AllTokenTypes.PassageDefinition;
  export const TokenType = AllTokenTypes.PassageDefinition;
}
export namespace String {
  export class Builder<SELF extends Builder<SELF, P>, P> extends GenericChainableTokenBuilder<SELF, AST.PassageDefinitionToken, P> {
    static builder<P>(stringType : AST.StringType, parent ?: P) : Builder.Chainable<P> { 
      return new Builder(withArgs(TokenType, { stringType }), parent);
    }
  }
  export namespace Builder {
    export type Chainable<P> = Builder<Chainable<P>, P>;
    export type Generic = Builder<Chainable<void>, void>;
  }
  export const builder = Builder.builder;
  export type Type = AST.StringType;
  export const Type = AST.StringType;
  export type Token = AST.StringToken;
  export type TokenType = AllTokenTypes.String;
  export const TokenType = AllTokenTypes.String;
}
export namespace Macro {
  export function keyword(maybeKeyword : string) : Type {
    switch(maybeKeyword.toLowerCase()) {
      case 'script':
        return Type.JAVASCRIPT;
      default:
        return Type.USER;
    }
  }
  type ToContent<P> = Content.Builder.Chainable<Builder.Chainable<P>>;
  type ToPassage<P>  = Passage.Builder.Chainable<Builder.Chainable<P>>;
  type ToVariable<P> = Variable.Builder.Chainable<Builder.Chainable<P>>;
  type ToMacro<P> = Macro.Builder.Chainable<Builder.Chainable<P>>;
  type ToTwinemarkup<P> = Twinemarkup.Builder.Chainable<Builder.Chainable<P>>;
  type ToTwinescript<P> = Twinescript.Builder.Chainable<Builder.Chainable<P>>;
  export class Builder<SELF extends Builder<SELF, P>, P> extends GenericChainableTokenBuilder<SELF, AST.MacroToken, P> {
    static builder<P>(parent ?: P) : Builder.Chainable<P> { 
      return new Builder(withArgs(TokenType), parent); 
    }
    setMacroType(macroType : AST.MacroType) : SELF {
      this.args.macroType = macroType;
      return <SELF><Builder.Chainable<P>>this;
    }
    setMacroName(macroName : string) : SELF {
      this.args.macroName = macroName;
      return <SELF><Builder.Chainable<P>>this;
    }
    addContent(...statements : StatementBuilderValue[]) : SELF {
      this.args.macroContent.splice(
        this.args.macroContent.length - 1, 0, ...statements);
      return <SELF><Builder.Chainable<P>>this;
    }
    setArgs(args : AST.Token[]) : SELF {
      this.args.macroArgs = args;
      return <SELF><Builder.Chainable<P>>this;
    }
    addArgs(...args : MacroArgBuilderValue[]) : SELF {
      this.args.macroArgs.splice(
        this.args.macroArgs.length - 1, 0, ...args);
      return <SELF><Builder.Chainable<P>>this;
    }
    addContentToArgs() : ToContent<P> { 
      return <ToContent<P>>this.appendToArgs(<Content.Builder.Generic>Content.builder(this));
    }
    addVariableToArgs(variableType : AST.VariableType) : ToVariable<P> { 
      return <ToVariable<P>>this.appendToArgs(<Variable.Builder.Generic>Variable.builder(variableType, this)); 
    }
    addTwinescriptToArgs() : ToTwinescript<P> {
      return <ToTwinescript<P>>this.appendToArgs(<Twinescript.Builder.Generic>Twinescript.builder(this));
    }
    addTwinemarkupToArgs(markupType : AST.TwinemarkupType) : ToTwinemarkup<P> {
      return <ToTwinemarkup<P>>this.appendToArgs(<Twinemarkup.Builder.Generic>Twinemarkup.builder(markupType, this));
    }
    addContentToContent() : ToContent<P> { 
      return <ToContent<P>>this.appendToContent(<Content.Builder.Generic>Content.builder(this));
    }
    addPassageToContent() : ToPassage<P> { 
      return <ToPassage<P>>this.appendToContent(<Passage.Builder.Generic>Passage.builder(this));
    }
    addVariableToContent(variableType : AST.VariableType) : ToVariable<P> { 
      return <ToVariable<P>>this.appendToContent(<Variable.Builder.Generic>Variable.builder(variableType, this)); 
    }
    addMacroToContent() : ToMacro<P> {
      return <ToMacro<P>>this.appendToContent(<Macro.Builder.Generic>Macro.builder(this));
    }
    addTwinescriptToContent() : ToTwinescript<P> {
      return <ToTwinescript<P>>this.appendToContent(<Twinescript.Builder.Generic>Twinescript.builder(this));
    }
    addTwinemarkupToContent(markupType : AST.TwinemarkupType) : ToTwinemarkup<P> {
      return <ToTwinemarkup<P>>this.appendToContent(<Twinemarkup.Builder.Generic>Twinemarkup.builder(markupType, this));
    }
    private appendToArgs<T extends MacroArgBuilderValue>(builder : T) : T {
      this.args.macroArgs.push(builder);
      return builder;
    }
    private appendToContent<T extends StatementBuilderValue>(builder : T) : T {
      this.args.macroContent.push(builder);
      return builder;
    }
  }
  export namespace Builder {
    export type Chainable<P> = Builder<Chainable<P>, P>;
    export type Generic = Builder<Chainable<void>, void>;
  }
  export const builder = Builder.builder;
  export type Type = AST.MacroType;
  export const Type = AST.MacroType;
  export type Token = AST.MacroToken;
  export type TokenType = AllTokenTypes.Macro;
  export const TokenType = AllTokenTypes.Macro;
}
export namespace Twinemarkup {
  type ToTwinescript<P> = Twinescript.Builder.Chainable<Builder.Chainable<P>>;
  export class Builder<SELF extends Builder<SELF, P>, P> extends GenericChainableTokenBuilder<SELF, AST.TwinemarkupToken, P> {
    static builder<P>(markupType : AST.TwinemarkupType, parent ?: P) : Builder.Chainable<P> {
      return new Builder(withArgs(TokenType, { markupType }), parent);
    }
    setMarkupLink(link ?: string) : SELF {
      this.args.markupLink = link;
      return <SELF><Builder.Chainable<P>>this;
    }
    setMarkupTitle(title ?: string) : SELF {
      this.args.markupTitle = title;
      return <SELF><Builder.Chainable<P>>this;
    }
    setMarkupSetter(setter : AST.TwinescriptToken) : SELF {
      this.args.markupSetter = setter;
      return <SELF><Builder.Chainable<P>>this;
    }
    buildMarkupSetter<T extends StatementBuilderValue>(builder : T) : ToTwinescript<P> {
      const setterBuilder = Twinescript.builder(this);
      this.args.markupSetter = <Twinescript.Builder.Generic>setterBuilder;
      return setterBuilder;
    }
    setImagePath(path ?: string) : SELF {
      this.args.markupImgPath = path;
      return <SELF><Builder.Chainable<P>>this;
    }
  }
  export namespace Builder {
    export type Chainable<P> = Builder<Chainable<P>, P>;
    export type Generic = Builder<Chainable<void>, void>;
  }
  export const builder = Builder.builder;
  export type Type = AST.TwinemarkupType;
  export const Type = AST.TwinemarkupType;
  export type Token = AST.TwinemarkupToken;
  export type TokenType = AllTokenTypes.Twinemarkup;
  export const TokenType = AllTokenTypes.Twinemarkup;
}
export namespace Variable {
  type ToContent<P> = Content.Builder.Chainable<Builder.Chainable<P>>;
  type ToTwinescript<P> = Twinescript.Builder.Chainable<Builder.Chainable<P>>;
  export class Builder<SELF extends Builder<SELF, P>, P> extends GenericChainableTokenBuilder<SELF, AST.VariableToken, P> {
    static builder<P>(variableType : AST.VariableType, parentBuilder ?: P) : Builder.Chainable<P> { 
      return new Builder(withArgs(TokenType, { variableType }), parentBuilder);
    }
    addVariableNameParts(...parts : AST.VariableNamePartToken[]) : SELF {
      this.args.variableName
      this.args.variableName.splice(
        this.args.variableName.length - 1, 0, ...parts);
      return <SELF><Builder.Chainable<P>>this;
    }
    addVariableNameText() : ToContent<P> {
      return <ToContent<P>>this.appendNamePart(<Content.Builder.Generic>Content.builder(this));
    }
    addTwinescriptIndex() : ToTwinescript<P> {
      return <ToTwinescript<P>>this.appendNamePart(<Twinescript.Builder.Generic>Twinescript.builder(this));
    }
    private appendNamePart<T extends VariableNameBuilderValue>(builder : T) : any {
      this.args.variableName.push(builder);
      return builder;
    }
  }
  export namespace Builder {
    export type Chainable<P> = Builder<Chainable<P>, P>;
    export type Generic = Builder<Chainable<void>, void>;
  }
  export const builder = Builder.builder;
  export type Type = AST.VariableType;
  export const Type = AST.VariableType;
  export type Token = AST.VariableToken;
  export type TokenType = AllTokenTypes.Variable;
  export const TokenType = AllTokenTypes.Variable;
}
export namespace Twinescript {
  type ToContent<P> = Content.Builder.Chainable<Builder.Chainable<P>>;
  type ToVariable<P> = Variable.Builder.Chainable<Builder.Chainable<P>>;
  type ToTwinescript<P> = Twinescript.Builder.Chainable<Builder.Chainable<P>>;
  type ToTwinemarkup<P> = Twinemarkup.Builder.Chainable<Builder.Chainable<P>>;
  export class Builder<SELF extends Builder<SELF, P>, P> extends GenericChainableTokenBuilder<SELF, AST.TwinescriptToken, P> {
    static builder<P>(parentBuilder ?: P) : Builder.Chainable<P> { 
      return new Builder(withArgs(TokenType), parentBuilder);
    }
    addTwinescriptContent(...content : AST.TwinescriptContentToken[]) : SELF {
      this.args.twinescriptContent
      this.args.twinescriptContent.splice(
        this.args.twinescriptContent.length - 1, 0, ...content);
      return <SELF><Builder.Chainable<P>>this;
    }
    addContent() : ToContent<P> { 
      return <ToContent<P>>this.appendToContent(<Content.Builder.Generic>Content.builder(this));
    }
    addVariable(variableType : AST.VariableType) : ToVariable<P> { 
      return <ToVariable<P>>this.appendToContent(<Variable.Builder.Generic>Variable.builder(variableType, this)); 
    }
    addTwinescript() : ToTwinescript<P> {
      return <ToTwinescript<P>>this.appendToContent(<Twinescript.Builder.Generic>Twinescript.builder(this));
    }
    addTwinemarkup(markupType : AST.TwinemarkupType) : ToTwinemarkup<P> {
      return <ToTwinemarkup<P>>this.appendToContent(<Twinemarkup.Builder.Generic>Twinemarkup.builder(markupType, this));
    }
    private appendToContent<T extends TwinescriptContentBuilderValue>(builder : T) : T {
      this.args.twinescriptContent.push(builder);
      return builder;
    }
  }
  export namespace Builder {
    export type Chainable<P> = Builder<Chainable<P>, P>;
    export type Generic = Builder<Chainable<void>, void>;
  }
  export const builder = Builder.builder;
  export type EndMode = TwinescriptEndMode;
  export const EndMode = TwinescriptEndMode;
  export type Token = AST.TwinescriptToken;
  export type TokenType = AllTokenTypes.Twinescript;
  export const TokenType = AllTokenTypes.Twinescript;
}

type StatementBuilderValue = AST.StatementToken 
  | Content.Builder.Generic | Macro.Builder.Generic | Passage.Builder.Generic 
  | Twinemarkup.Builder.Generic | Variable.Builder.Generic | Twinescript.Builder.Generic;
type VariableNameBuilderValue = AST.VariableNamePartToken 
  | Content.Builder.Generic | Twinescript.Builder.Generic;
type MacroArgBuilderValue = AST.MacroArgToken 
  | String.Builder.Generic | Content.Builder.Generic | Variable.Builder.Generic;
type TwinescriptContentBuilderValue = AST.TwinescriptContentToken
  | Content.Builder.Generic | Twinemarkup.Builder.Generic | Variable.Builder.Generic | Twinescript.Builder.Generic;

class TokenBuilderArgs {
  tokenType : AllTokenTypes;
  parent ?: GenericToken;
  startIndex ?: StartIndex;
  endIndex ?: EndIndex;
  mainChunks : StatementBuilderValue[] = [];
  stringType ?: AST.StringType;
  passageName ?: string;
  macroType ?: AST.MacroType;
  macroName ?: string;
  macroArgs : MacroArgBuilderValue[] = [];
  macroContent : StatementBuilderValue[] = [];
  markupType ?: AST.TwinemarkupType;
  markupLink ?: string;
  markupTitle ?: string;
  markupSetter ?: AST.TwinescriptToken | Twinescript.Builder.Generic;
  markupImgPath ?: string;
  variableType ?: AST.VariableType;
  variableName : VariableNameBuilderValue[] = [];
  twinescriptContent : TwinescriptContentBuilderValue[] = []
  build() : GenericToken {
    const tokenType = this.tokenType;
    const startIndex = builderAssert(this.startIndex, 'startIndex');
    const endIndex = builderAssert(this.endIndex, 'endIndex');
    const standard : GenericToken = { startIndex, endIndex, tokenType };
    if (this.parent) {
      standard.parent = this.parent;
    }
    switch(this.tokenType) {
      case AllTokenTypes.Content:
        return standard;
      case AllTokenTypes.RawJavascript:
        if (this.macroType !== AST.MacroType.JAVASCRIPT) {
          throw new Error(
            `Tokentype ${AllTokenTypes.RawJavascript} must have a macroType === ${AST.MacroType.JAVASCRIPT}`);
        }
      case AllTokenTypes.Macro:
        return <AST.MacroToken>{
          ...standard,
          macroType: builderAssert(this.macroType, 'macroType'),
          name: builderAssert(this.macroName, 'macroName'),
          args: processBuilderValueArray(this.macroArgs),
          content: processBuilderValueArray(this.macroContent),
        }
      case AllTokenTypes.Main:
        return <AST.MainToken>{
          ...standard,
          chunks: processBuilderValueArray(this.mainChunks),
        }
      case AllTokenTypes.PassageDefinition:
        return <AST.PassageDefinitionToken>{
          ...standard,
          name: builderAssert(this.passageName, 'passageName')
        }
      case AllTokenTypes.String:
        return <AST.StringToken>{
          ...standard,
          stringType: builderAssert(this.stringType, 'stringType')
        }
      case AllTokenTypes.Twinemarkup:
        return <AST.TwinemarkupToken>{
          ...standard,
          markupType: builderAssert(this.markupType, 'markupType'),
          // making these properties optional, as there are circumstances
          // where we want to produce an incorrect token
          link: this.markupLink,
          imagePath: this.markupImgPath,
          // link: this.markupType === AST.TwinemarkupType.LINK ? 
          //   builderAssert(this.markupLink, 'markupLink') : this.markupLink,
          // imagePath: this.markupType === AST.TwinemarkupType.IMAGE ? 
          //   builderAssert(this.markupImgPath, 'markupImgPath') : this.markupImgPath,
          title: this.markupTitle,
          setter: (<Twinescript.Builder.Generic>this.markupSetter)?.build ? (<Twinescript.Builder.Generic>this.markupSetter).build() : this.markupSetter,
        };
      case AllTokenTypes.Twinescript:
        return <AST.TwinescriptToken>{ 
          ...standard, 
          content: processBuilderValueArray(this.twinescriptContent),
        };
      case AllTokenTypes.Variable:
        return <AST.VariableToken>{ 
          ...standard, 
          variablePath: processBuilderValueArray(this.variableName),
          variableType: builderAssert(this.variableType, 'variableType')
        };
    }
  }
  constructor(type : AllTokenTypes) {
    this.tokenType = type;
  }
}
function builderAssert<T>(value : T | undefined, name : string, reason ?: string) : T {
  if (value === undefined) {
    throw new Error(`${name} is required${reason ? ` as ${reason}` : ''}`);
  }
  return <T>value;
}
function processBuilderValueArray<T>(array : any[]) : T[] {
  return array.map(b => {
    return b.build ? b.build() : b
  });
}
