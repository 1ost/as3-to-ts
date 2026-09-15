import Node, {createNode} from '../syntax/node';
import NodeKind from '../syntax/nodeKind';
import * as Operators from '../syntax/operators';
import AS3Parser, {nextToken, consume, tokIs, VECTOR} from './parser';
import {parseQualifiedName} from './parse-common';


/**
 * if tok is ":" parse the type otherwise do nothing
 */
export function parseOptionalType(parser:AS3Parser):Node {
    let result:Node = createNode(NodeKind.TYPE, {start: parser.tok.index, end: parser.tok.index});
    if (tokIs(parser, Operators.COLUMN)) {
        nextToken(parser, true);
        result = parseType(parser);
    }
    return result;
}

export function parseType(parser:AS3Parser):Node {
    let result:Node;
    if (parser.tok.text === VECTOR) {
        result = parseVector(parser);
    } else {
        let index = parser.tok.index;
        let qualified = parseQualifiedName(parser, false);
        let name = qualified.substring(qualified.lastIndexOf('.') + 1);
        const end = index + parser.sourceFile.content.slice(index, parser.tok.index).replace(/\s+$/, '').length;
        result = createNode(NodeKind.TYPE, {start: index, end, text: name});
        if (qualified !== name) result.qualifiedName = qualified;
        // nextToken(parser,  true );
    }
    return result;
}

export function parseVector(parser:AS3Parser):Node {
    let result:Node = createNode(NodeKind.VECTOR, {start: parser.tok.index});
    if (parser.tok.text === VECTOR) {
        nextToken(parser);
    }
    consume(parser, Operators.VECTOR_START);

    result.children.push(parseType(parser));

    result.end = consume(parser, Operators.SUPERIOR).end;

    return result;
}
