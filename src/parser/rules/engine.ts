import { Parser, Err, Yield, Token } from "../types";
import { Definition as MainDefinition } from './main';
import { Definition as MacroDefinition } from './macro';
import { Definition as VariableDefinition } from './variable';
import { Definition as TwinescriptDefinition } from './twinescript';
import { Definition as TwinemarkupDefinition } from './twinemarkup';
import { Definition as JavascriptDefinition } from './javascript';

export const DefinitionTable : Record<Parser.RuleType, Parser.GenericDefinition> = {
  [Yield.Main.Type]: MainDefinition,
  [Yield.Macro.Type]: <Parser.GenericDefinition><any>MacroDefinition,
  [Yield.Variable.Type]: <Parser.GenericDefinition><any>VariableDefinition,
  [Yield.Twinemarkup.Type]: <Parser.GenericDefinition><any>TwinemarkupDefinition,
  [Yield.Twinescript.Type]: <Parser.GenericDefinition><any>TwinescriptDefinition,
  [Yield.Javascript.Type]: <Parser.GenericDefinition><any>JavascriptDefinition,
}

export function parse({ source, stack, lastYield } : Parser.EngineInput) : Parser.EngineOutput {
  const currentFrame : Parser.Frame = stack[stack.length - 1];
  const definition = DefinitionTable[currentFrame.state.type];
  // Reminder: frame state may mutate in the runner
  let runnerYield : Yield.Generic = definition.runner(
    source, 
    currentFrame.state, 
    lastYield,
  );
  let criticalError : Err.ParserError | undefined = (<Yield.Unrecoverable>runnerYield).criticalError;
  let errors : Err.TokenError[] = runnerYield.errors || [];
  const frameToken : Token | undefined = handleTokenBuilderIfRequired();
  manipulateStack(frameToken);
  const { lastIndex, type } = runnerYield;
  const nextYield = criticalError ?
    <Yield.Unrecoverable>{ type: Yield.Unrecoverable, criticalError, lastIndex, errors } :
    { type, lastIndex, token: frameToken, errors }
  return { stack, nextYield };

  function manipulateStack(tokenToAdd : Token | undefined) {
    let newStateStartIndex = (<Yield.Any>runnerYield).newStateStartIndex
    switch(runnerYield.type) {
      case Yield.Step:
        addTokenToCurrentFrameIfNeeded();
        break;
      case Yield.Pop:
        stack.pop();
        addTokenToCurrentFrameIfNeeded();
        break;
      case Yield.Goto:
        newStateStartIndex = stack.pop()?.startIndex;
        // fallthrough
      case Yield.Push:
        addTokenToCurrentFrameIfNeeded();
        const newStateYield = (<Yield.Goto & Yield.Push>runnerYield);
        stack.push(new Parser.Frame(
          newStateYield.newState, 
          newStateStartIndex ?? runnerYield.lastIndex + 1
        ));
        break;
      case Yield.Unrecoverable:
        // noop
    }
    function addTokenToCurrentFrameIfNeeded() {
      const nextFrame = stack[stack.length - 1];
      if (tokenToAdd) {
        nextFrame.tokenBuffer.push(tokenToAdd)
      }
    }
  }
  function handleTokenBuilderIfRequired() : Token | undefined {
    let token : Token | undefined = runnerYield.token;
    switch (runnerYield.type) {
      case Yield.Pop:
      case Yield.Goto:
        const tokenBuffer = token ? [...currentFrame.tokenBuffer, token] : [...currentFrame.tokenBuffer];
        const builderResult = definition.tokenBuilder(source, currentFrame.state, tokenBuffer, currentFrame.startIndex, runnerYield.lastIndex)
        if (builderResult.result instanceof Err.ParserError) {
          criticalError = builderResult.result
        } else {
          token = builderResult.result;
        }
        if (builderResult.errors) {
          errors = [...errors, ...builderResult.errors]
        }
    }
    return token;
  }
}
