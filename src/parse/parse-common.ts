import Node, {createNode} from '../syntax/node';
import NodeKind from '../syntax/nodeKind';
import * as Operators from '../syntax/operators';
import AS3Parser, {
    nextToken, consume, tokIs, getParserCheckPoint, assertProgress, assertNotEOF, parseError,
} from './parser';
import {parseStatement} from './parse-statements';
import {parseExpression} from './parse-expressions';
import {parseOptionalType} from './parse-types';


export function parseQualifiedName(parser:AS3Parser, skipPackage:boolean):string {
    let buffer = '';

    assertNotEOF(parser, 'qualified name');
    if (!isNamePart(parser.tok.text)) {
        throw parseError(parser, 'AS3_PARSE_UNEXPECTED_TOKEN', 'a qualified-name segment', 'qualified name');
    }
    buffer += parser.tok.text;
    nextToken(parser);
    while (tokIs(parser, Operators.DOT) || tokIs(parser, Operators.DOUBLE_COLUMN)) {
        const checkpoint = getParserCheckPoint(parser);
        buffer += parser.tok.text;
        nextToken(parser);
        assertNotEOF(parser, 'qualified name');
        if (!isNamePart(parser.tok.text)) {
            throw parseError(parser, 'AS3_PARSE_UNEXPECTED_TOKEN', 'a qualified-name segment', 'qualified name');
        }
        buffer += parser.tok.text;
        nextToken(parser); // name
        assertProgress(parser, checkpoint, 'qualified name');
    }

    if (skipPackage) {
        return buffer.substring(buffer.lastIndexOf(Operators.DOT) + 1);
    }
    return buffer;
}


export function parseBlock(parser:AS3Parser, result?:Node):Node {

    let tok = consume(parser, Operators.LEFT_CURLY_BRACKET);
    if (!result) {
        result = createNode(NodeKind.BLOCK, {start: tok.index, end: parser.tok.end});
    } else {
        result.start = tok.index;
    }
    while (!tokIs(parser, Operators.RIGHT_CURLY_BRACKET)) {
        assertNotEOF(parser, 'block');
        const checkpoint = getParserCheckPoint(parser);
        result.children.push(parseStatement(parser));
        assertProgress(parser, checkpoint, 'block');
    }
    result.end = consume(parser, Operators.RIGHT_CURLY_BRACKET).end;
    return result;
}


export function parseParameterList(parser:AS3Parser):Node {
    let tok = consume(parser, Operators.LEFT_PARENTHESIS);

    let result:Node = createNode(NodeKind.PARAMETER_LIST, {start: tok.index});
    while (!tokIs(parser, Operators.RIGHT_PARENTHESIS)) {
        assertNotEOF(parser, 'parameter list');
        const checkpoint = getParserCheckPoint(parser);
        result.children.push(parseParameter(parser));
        if (tokIs(parser, Operators.COMMA)) {
            nextToken(parser, true);
        } else {
            break;
        }
        assertProgress(parser, checkpoint, 'parameter list');
    }
    tok = consume(parser, Operators.RIGHT_PARENTHESIS);
    result.end = tok.end;
    return result;
}


/**
 * tok is the name of a parameter or ...
 */
function parseParameter(parser:AS3Parser):Node {
    let result:Node = createNode(NodeKind.PARAMETER, {start: parser.tok.index});
    if (tokIs(parser, Operators.REST_PARAMETERS)) {
        let index = parser.tok.index;
        nextToken(parser, true); // ...
        let rest:Node = createNode(NodeKind.REST, {start: index, end: parser.tok.end, text: parser.tok.text});
        nextToken(parser, true); // rest
        result.children.push(rest);
    } else {
        result.children.push(parseNameTypeInit(parser));
    }
    result.end = result.children.reduce((index:number, child:Node) => {
        return Math.max(index, child ? child.end : 0);
    }, result.end);
    return result;
}


export function parseNameTypeInit(parser:AS3Parser):Node {
    let result:Node = createNode(NodeKind.NAME_TYPE_INIT, {start: parser.tok.index});
    result.children.push(createNode(NodeKind.NAME, {tok: parser.tok}));
    nextToken(parser, true); // name
    result.children.push(parseOptionalType(parser));
    const initializer = parseOptionalInit(parser);
    if (initializer) result.children.push(initializer);
    result.end = result.children.reduce((index:number, child:Node) => {
        return Math.max(index, child ? child.end : 0);
    }, result.end);
    return result;
}


/**
 * if tok is "=" parse the expression otherwise do nothing
 *
 * @return
 */
function parseOptionalInit(parser:AS3Parser):Node {
    let result:Node = null;
    if (tokIs(parser, Operators.EQUAL)) {
        nextToken(parser, true);
        let index = parser.tok.index;
        let expr = parseExpression(parser);
        result = createNode(NodeKind.INIT, {start: index, end: expr.end}, expr);
    }
    return result;
}

function isNamePart(text:string):boolean {
    return text === Operators.TIMES || /^[A-Za-z_$][\w$]*$/.test(text);
}
