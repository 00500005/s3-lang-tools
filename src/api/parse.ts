import { Parser, SourceIndex } from '../parser'
import { Diagnostic, Range, DiagnosticSeverity } from 'vscode-languageserver';
import { RawRangeLike, Err, Main, AnyToken, Token } from '../parser/types';
import { unexpectedEnds } from '../parser/parser';

function getRangeFromTokenLike(index : SourceIndex, token : RawRangeLike) : Range {
  return Range.create(
    index.getPositionFromOffset(token.startIndex), 
    // we always use an inclusive end index, but VS expects an exclusive end index
    index.getPositionFromOffset(token.endIndex + 1)
  );
}
function simpleTree(contents : string, node : AnyToken) : any {
  const newNode : any = {};
  newNode.text = contents.slice(node.startIndex, node.endIndex! + 1).replace('\n','').slice(0, 40);
  newNode.type = node.tokenType;
  forChildren(node.args, 'args');
  forChildren(node.chunks, 'chunks');
  forChildren(node.content, 'content');
  forChildren(node.variablePath, 'variablePath');
  if(node.setter) { forChildren([node.setter], 'setter'); }
  return newNode;

  function forChildren(children : Token[] | undefined, name : string) {
    if (children) { 
      newNode[name] = children.map((n : AnyToken) => simpleTree(contents, n))
    }
  }
}
export class VsSugarcubeParser {
  diagnostics(name : string, contents : string) : Diagnostic[] {
    const parser = new Parser();
    try {
      const [errors, index, result] = parser.parse(contents);
      console.log('Got tree/error', JSON.stringify(simpleTree(contents, <any>result), undefined, '  '));
      let diagnostics = errors.map(e => {
        return Diagnostic.create(getRangeFromTokenLike(index, e), e.message, DiagnosticSeverity.Error, undefined, name);
      })
      if (result instanceof Err.ParserError) {
        console.log(result);
        diagnostics.push(Diagnostic.create(Range.create(
          index.getPositionFromOffset(result.startIndex), 
          index.getPositionFromOffset(contents.length)
        ), result.message, DiagnosticSeverity.Error))
      }
      return diagnostics;
    } catch(e) {
      console.error('Got critical error', e);
      return [];
    }
  }
}
