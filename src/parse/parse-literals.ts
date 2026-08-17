import Node, {createNode} from '../syntax/node';
import NodeKind from '../syntax/nodeKind';
import * as Operators from '../syntax/operators';
import AS3Parser, {
    nextToken, consume, skip, tokIs, getParserCheckPoint, assertProgress, assertNotEOF, parseError,
} from "./parser";
import {parseExpression} from "./parse-expressions";
import {parseType} from "./parse-types";


export function parseArrayLiteral(parser:AS3Parser):Node {
    let tok = consume(parser, Operators.LEFT_SQUARE_BRACKET);
    let result:Node = createNode(NodeKind.ARRAY, {start: tok.index});
    while (!tokIs(parser, Operators.RIGHT_SQUARE_BRACKET)) {
        assertNotEOF(parser, 'array literal');
        const checkpoint = getParserCheckPoint(parser);
        result.children.push(parseExpression(parser));
        if (!tokIs(parser, Operators.RIGHT_SQUARE_BRACKET)) {
            if (!tokIs(parser, Operators.COMMA)) {
                throw parseError(parser, 'AS3_PARSE_UNEXPECTED_TOKEN', ', or ]', 'array literal');
            }
            nextToken(parser);
        }
        assertProgress(parser, checkpoint, 'array literal');
    }
    result.end = consume(parser, Operators.RIGHT_SQUARE_BRACKET).end;
    return result;
}


export function parseObjectLiteral(parser:AS3Parser):Node {
    let tok = consume(parser, Operators.LEFT_CURLY_BRACKET);
    let result:Node = createNode(NodeKind.OBJECT, {start: tok.index, end: tok.end});
    while (!tokIs(parser, Operators.RIGHT_CURLY_BRACKET)) {
        assertNotEOF(parser, 'object literal');
        const checkpoint = getParserCheckPoint(parser);
        result.children.push(parseObjectLiteralPropertyDeclaration(parser));
        if (!tokIs(parser, Operators.RIGHT_CURLY_BRACKET)) {
            if (!tokIs(parser, Operators.COMMA)) {
                throw parseError(parser, 'AS3_PARSE_UNEXPECTED_TOKEN', ', or }', 'object literal');
            }
            nextToken(parser);
        }
        assertProgress(parser, checkpoint, 'object literal');
    }
    tok = consume(parser, Operators.RIGHT_CURLY_BRACKET);
    result.end = tok.end;
    return result;
}


function parseObjectLiteralPropertyDeclaration(parser:AS3Parser):Node {
    let result:Node = createNode(NodeKind.PROP, {start: parser.tok.index, end: parser.tok.end});
    let name:Node = createNode(NodeKind.NAME, {tok: parser.tok});
    result.children.push(name);
    nextToken(parser); // name
    consume(parser, Operators.COLUMN);
    let expr = parseExpression(parser);
    let val = createNode(NodeKind.VALUE, {start: expr.start, end: expr.end}, expr);
    result.children.push(val);
    result.end = val.end;
    return result;
}


export function parseShortVector(parser:AS3Parser):Node {
    let vector:Node = createNode(NodeKind.VECTOR, {start: parser.tok.index});
    consume(parser, Operators.INFERIOR);
    vector.children.push(parseType(parser));
    vector.end = consume(parser, Operators.SUPERIOR).end;

    let arrayLiteral = parseArrayLiteral(parser);

    return createNode(NodeKind.SHORT_VECTOR, {start: vector.start, end: arrayLiteral.end}, vector, arrayLiteral);
}
