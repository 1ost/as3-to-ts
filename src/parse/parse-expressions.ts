import Node, {createNode} from '../syntax/node';
import NodeKind from '../syntax/nodeKind';
import * as Keywords from '../syntax/keywords';
import * as Operators from '../syntax/operators';
import AS3Parser, {
    nextToken, tryParse, skip, consume, tokIs, VECTOR,
    getParserCheckPoint, assertProgress, assertNotEOF, parseError,
} from './parser';
import {parseParameterList, parseBlock} from './parse-common';
import {parseOptionalType, parseVector} from './parse-types';
import {parseArrayLiteral, parseObjectLiteral, parseShortVector} from './parse-literals';

export function parseExpressionList(parser:AS3Parser):Node {
    let result:Node = createNode(NodeKind.EXPR_LIST, {start: parser.tok.index}, parseAssignmentExpression(parser));
    while (tokIs(parser, Operators.COMMA)) {
        nextToken(parser, true);
        result.children.push(parseAssignmentExpression(parser));
    }
    result.end = result.children.reduce((index:number, child:Node) => {
        return Math.max(index, child ? child.end : 0);
    }, 0);
    return result.children.length > 1 ? result : result.children[0];
}


export function parseExpression(parser:AS3Parser):Node {
    return parseAssignmentExpression(parser);
}


export function parsePrimaryExpression(parser:AS3Parser):Node {
    let result:Node;
    assertNotEOF(parser, 'primary expression');

    if (tokIs(parser, Operators.LEFT_SQUARE_BRACKET)) {
        return parseArrayLiteral(parser);
    } else if (tokIs(parser, Operators.LEFT_CURLY_BRACKET)) {
        return parseObjectLiteral(parser);
    } else if (tokIs(parser, Keywords.FUNCTION)) {
        return parseLambdaExpression(parser);
    } else if (tokIs(parser, Keywords.NEW)) {
        return parseNewExpression(parser);
    } else if (tokIs(parser, Operators.LEFT_PARENTHESIS)) {
        return parseEncapsulatedExpression(parser);
    } else if (parser.tok.text === VECTOR) {
        return parseVector(parser);
    } else if (tokIs(parser, Operators.INFERIOR)) {
        let res = tryParse(parser, () => parseShortVector(parser));
        if (res) {
            return res;
        }
    }

    if (parser.tok.text === '/' || parser.tok.text === '/=') {
        let tok = parser.scn.scanRegExp();
        if (tok) {
            nextToken(parser, true);
            return createNode(NodeKind.LITERAL, {tok: tok});
        }
    }

    if (parser.tok.isXML) {
        result = createNode(NodeKind.XML_LITERAL, {tok: parser.tok});
    } else if (parser.tok.isNumeric || /('|")/.test(parser.tok.text[0])) {
        result = createNode(NodeKind.LITERAL, {tok: parser.tok});
    } else if (!/^[A-Za-z_$][\w$]*$/.test(parser.tok.text)) {
        throw parseError(parser, 'AS3_PARSE_UNEXPECTED_TOKEN', 'a primary expression', 'expression');
    } else {
        result = createNode(NodeKind.IDENTIFIER, {tok: parser.tok});
    }
    nextToken(parser, true);
    return result;
}


function parseLambdaExpression(parser:AS3Parser):Node {

    let tok = consume(parser, Keywords.FUNCTION);
    let result:Node;

    if (parser.tok.text === Operators.LEFT_PARENTHESIS) {
        result = createNode(NodeKind.LAMBDA, {start: tok.index, end: parser.tok.end});
    } else {
        result = createNode(NodeKind.FUNCTION, {start: tok.index, end: parser.tok.end, text: parser.tok.text});
        nextToken(parser, true);
    }
    result.children.push(parseParameterList(parser));
    result.children.push(parseOptionalType(parser));
    result.children.push(parseBlock(parser));
    result.end = result.children.reduce((index:number, child:Node) => {
        return Math.max(index, child ? child.end : 0);
    }, result.end);
    return result;
}


function parseNewExpression(parser:AS3Parser):Node {
    const tok = consume(parser, Keywords.NEW);
    const result = createNode(NodeKind.NEW, {start: tok.index});
    let target = parsePrimaryExpression(parser);
    // A constructor consumes its target and one argument list. Casts, binary
    // operators and accesses on the new instance belong to the enclosing
    // expression (for example, new Asset() as Bitmap).
    if (target.kind !== NodeKind.SHORT_VECTOR) {
        while (tokIs(parser, Operators.DOT) || tokIs(parser, Operators.DOUBLE_COLUMN)
            || tokIs(parser, Operators.LEFT_SQUARE_BRACKET)) {
            target = tokIs(parser, Operators.LEFT_SQUARE_BRACKET)
                ? parseArrayAccessor(parser, target) : parseDot(parser, target);
        }
        if (tokIs(parser, Operators.LEFT_PARENTHESIS)) {
            const args = parseArgumentList(parser);
            target = createNode(NodeKind.CALL, {start: target.start, end: args.end}, target, args);
        }
    }
    result.children.push(target);
    result.end = target.end;
    return result;
}


function parseEncapsulatedExpression(parser:AS3Parser):Node {

    let tok = consume(parser, Operators.LEFT_PARENTHESIS);
    let result:Node = createNode(NodeKind.ENCAPSULATED, {start: tok.index});
    result.children.push(parseExpressionList(parser));
    tok = consume(parser, Operators.RIGHT_PARENTHESIS);
    result.end = tok.end;
    return result;
}


function parseAssignmentExpression(parser:AS3Parser):Node {
    let result = createNode(
        NodeKind.ASSIGN,
        {start: parser.tok.index, end: parser.tok.end},
        parseConditionalExpression(parser));
    while (tokIs(parser, Operators.EQUAL)
    || tokIs(parser, Operators.PLUS_EQUAL) || tokIs(parser, Operators.MINUS_EQUAL)
    || tokIs(parser, Operators.TIMES_EQUAL) || tokIs(parser, Operators.DIVIDED_EQUAL)
    || tokIs(parser, Operators.MODULO_EQUAL) || tokIs(parser, Operators.AND_EQUAL) || tokIs(parser, Operators.OR_EQUAL)
    || tokIs(parser, Operators.XOR_EQUAL) || tokIs(parser, Operators.DOUBLE_SHIFT_LEFT_EQUAL)
    || tokIs(parser, Operators.DOUBLE_SHIFT_RIGHT_EQUAL) || tokIs(parser, Operators.TRIPLE_SHIFT_RIGHT_EQUAL)
    || tokIs(parser, Operators.LOGICAL_AND_EQUAL) || tokIs(parser, Operators.LOGICAL_OR_EQUAL)) {
        result.children.push(createNode(NodeKind.OP, {tok: parser.tok}));
        nextToken(parser, true);
        result.children.push(parseExpression(parser));
    }
    if (result.lastChild) {
        result.end = result.lastChild.end;
    }
    return result.children.length > 1 ? result : result.lastChild;
}


function parseConditionalExpression(parser:AS3Parser):Node {
    let result:Node = parseOrExpression(parser);
    if (tokIs(parser, Operators.QUESTION_MARK)) {
        let conditional:Node = createNode(NodeKind.CONDITIONAL, {start: result.start}, result);
        nextToken(parser, true); // ?
        conditional.children.push(parseExpression(parser));
        consume(parser, Operators.COLUMN);
        conditional.children.push(parseExpression(parser));
        conditional.end = conditional.lastChild.end;
        return conditional;
    }
    return result;
}


function parseOrExpression(parser:AS3Parser):Node {
    let result:Node = createNode(NodeKind.OR, {start: parser.tok.index}, parseAndExpression(parser));
    while (tokIs(parser, Operators.LOGICAL_OR) || tokIs(parser, Operators.LOGICAL_OR_AS2)) {
        result.children.push(createNode(NodeKind.OP, {tok: parser.tok}));
        nextToken(parser, true);
        result.children.push(parseAndExpression(parser));
    }
    result.end = result.children.reduce((index:number, child:Node) => {
        return Math.max(index, child ? child.end : 0);
    }, result.end);
    return result.children.length > 1 ? result : result.children[0];
}


function parseAndExpression(parser:AS3Parser):Node {
    let result = createNode(
        NodeKind.AND,
        {start: parser.tok.index, end: parser.tok.end},
        parseBitwiseOrExpression(parser));
    while (tokIs(parser, Operators.AND) || tokIs(parser, Operators.AND_AS2)) {
        result.children.push(createNode(NodeKind.OP, {tok: parser.tok}));
        nextToken(parser, true);
        result.children.push(parseBitwiseOrExpression(parser));
    }
    if (result.lastChild) {
        result.end = result.lastChild.end;
    }
    return result.children.length > 1 ? result : result.lastChild;
}


function parseBitwiseOrExpression(parser:AS3Parser):Node {
    let result = createNode(NodeKind.B_OR, {tok: parser.tok}, parseBitwiseXorExpression(parser));
    while (tokIs(parser, Operators.B_OR)) {
        result.children.push(createNode(NodeKind.OP, {tok: parser.tok}));
        nextToken(parser, true);
        result.children.push(parseBitwiseXorExpression(parser));
    }
    if (result.lastChild) {
        result.end = result.lastChild.end;
    }
    return result.children.length > 1 ? result : result.lastChild;
}


function parseBitwiseXorExpression(parser:AS3Parser):Node {
    let result = createNode(NodeKind.B_XOR, {tok: parser.tok}, parseBitwiseAndExpression(parser));
    while (tokIs(parser, Operators.B_XOR)) {
        result.children.push(createNode(NodeKind.OP, {tok: parser.tok}));
        nextToken(parser, true);
        result.children.push(parseBitwiseAndExpression(parser));
    }
    if (result.lastChild) {
        result.end = result.lastChild.end;
    }
    return result.children.length > 1 ? result : result.lastChild;
}


function parseBitwiseAndExpression(parser:AS3Parser):Node {
    let result = createNode(NodeKind.B_AND, {tok: parser.tok}, parseEqualityExpression(parser));
    while (tokIs(parser, Operators.B_AND)) {
        result.children.push(createNode(NodeKind.OP, {tok: parser.tok}));
        nextToken(parser, true);
        result.children.push(parseEqualityExpression(parser));
    }
    if (result.lastChild) {
        result.end = result.lastChild.end;
    }
    return result.children.length > 1 ? result : result.lastChild;
}


function parseEqualityExpression(parser:AS3Parser):Node {
    let result:Node = createNode(NodeKind.EQUALITY, {start: parser.tok.index}, parseRelationalExpression(parser));
    while (
    tokIs(parser, Operators.DOUBLE_EQUAL) || tokIs(parser, Operators.DOUBLE_EQUAL_AS2) ||
    tokIs(parser, Operators.STRICTLY_EQUAL) || tokIs(parser, Operators.NON_EQUAL) ||
    tokIs(parser, Operators.NON_EQUAL_AS2_1) || tokIs(parser, Operators.NON_EQUAL_AS2_2) ||
    tokIs(parser, Operators.NON_STRICTLY_EQUAL)
        ) {
        result.children.push(createNode(NodeKind.OP, {tok: parser.tok}));
        nextToken(parser, true);
        result.children.push(parseRelationalExpression(parser));
    }
    result.end = result.children.reduce((index:number, child:Node) => {
        return Math.max(index, child ? child.end : 0);
    }, 0);
    return result.children.length > 1 ? result : result.children[0];
}


function parseRelationalExpression(parser:AS3Parser):Node {
    let result:Node = createNode(NodeKind.RELATION, {start: parser.tok.index}, parseShiftExpression(parser));
    while (tokIs(parser, Operators.INFERIOR)
    || tokIs(parser, Operators.INFERIOR_AS2) || tokIs(parser, Operators.INFERIOR_OR_EQUAL)
    || tokIs(parser, Operators.INFERIOR_OR_EQUAL_AS2) || tokIs(parser, Operators.SUPERIOR)
    || tokIs(parser, Operators.SUPERIOR_AS2) || tokIs(parser, Operators.SUPERIOR_OR_EQUAL)
    || tokIs(parser, Operators.SUPERIOR_OR_EQUAL_AS2) || tokIs(parser, Keywords.IS) || tokIs(parser, Keywords.IN)
    && !parser.isInFor || tokIs(parser, Keywords.AS) || tokIs(parser, Keywords.INSTANCE_OF)) {
        if (!tokIs(parser, Keywords.AS)) {
            result.children.push(createNode(NodeKind.OP, {tok: parser.tok}));
        } else {
            result.children.push(createNode(NodeKind.AS, {tok: parser.tok}));
        }
        nextToken(parser, true);
        result.children.push(parseShiftExpression(parser));
    }
    result.end = result.children.reduce((index:number, child:Node) => {
        return Math.max(index, child ? child.end : 0);
    }, result.end);
    return result.children.length > 1 ? result : result.children[0];
}


function parseShiftExpression(parser:AS3Parser):Node {
    let result:Node = createNode(NodeKind.SHIFT, {start: parser.tok.index}, parseAdditiveExpression(parser));
    while (tokIs(parser, Operators.DOUBLE_SHIFT_LEFT)
    || tokIs(parser, Operators.TRIPLE_SHIFT_LEFT) || tokIs(parser, Operators.DOUBLE_SHIFT_RIGHT)
    || tokIs(parser, Operators.TRIPLE_SHIFT_RIGHT)) {
        result.children.push(createNode(NodeKind.OP, {tok: parser.tok}));
        nextToken(parser, true);
        result.children.push(parseAdditiveExpression(parser));
    }
    result.end = result.children.reduce((index:number, child:Node) => {
        return Math.max(index, child ? child.end : 0);
    }, result.end);
    return result.children.length > 1 ? result : result.children[0];
}


function parseAdditiveExpression(parser:AS3Parser):Node {
    let result = createNode(
        NodeKind.ADD,
        {start: parser.tok.index, end: parser.tok.end},
        parseMultiplicativeExpression(parser));
    //
    // Having PLUS_AS2 emits wrong AST when a method is called "add"
    // while (tokIs(parser, Operators.PLUS) || tokIs(parser, Operators.PLUS_AS2) || tokIs(parser, Operators.MINUS)) {
    //
    while (tokIs(parser, Operators.PLUS) || tokIs(parser, Operators.MINUS)) {
        result.children.push(createNode(NodeKind.OP, {tok: parser.tok}));
        nextToken(parser, true);
        result.children.push(parseMultiplicativeExpression(parser));
    }
    if (result.lastChild) {
        result.end = result.lastChild.end;
    }
    return result.children.length > 1 ? result : result.lastChild;
}


function parseMultiplicativeExpression(parser:AS3Parser):Node {
    let result:Node = createNode(NodeKind.MULTIPLICATION, {start: parser.tok.index}, parseUnaryExpression(parser));
    while (tokIs(parser, Operators.TIMES) || tokIs(parser, Operators.SLASH) || tokIs(parser, Operators.MODULO)) {
        result.children.push(createNode(NodeKind.OP, {tok: parser.tok}));
        nextToken(parser, true);
        result.children.push(parseUnaryExpression(parser));
    }
    result.end = result.children.reduce((index:number, child:Node) => {
        return Math.max(index, child ? child.end : 0);
    }, result.end);
    return result.children.length > 1 ? result : result.children[0];
}


function parseUnaryExpression(parser:AS3Parser):Node {
    let result:Node,
        index = parser.tok.index;
    if (tokIs(parser, Operators.INCREMENT)) {
        nextToken(parser);
        const operand = parseUnaryExpression(parser);
        result = createNode(NodeKind.PRE_INC, {start: index, end: operand.end}, operand);
    } else if (tokIs(parser, Operators.DECREMENT)) {
        nextToken(parser);
        const operand = parseUnaryExpression(parser);
        result = createNode(NodeKind.PRE_DEC, {start: index, end: operand.end}, operand);
    } else if (tokIs(parser, Operators.MINUS)) {
        nextToken(parser);
        const operand = parseUnaryExpression(parser);
        result = createNode(NodeKind.MINUS, {start: index, end: operand.end}, operand);
    //
    // Having PLUS_AS2 emits wrong AST when a method is called "add"
    // } else if (tokIs(parser, Operators.PLUS) || tokIs(parser, Operators.PLUS_AS2)) {
    //
    } else if (tokIs(parser, Operators.PLUS)) {
        nextToken(parser);
        const operand = parseUnaryExpression(parser);
        result = createNode(NodeKind.PLUS, {start: index, end: operand.end}, operand);
    } else {
        return parseUnaryExpressionNotPlusMinus(parser);
    }
    return result;
}


function parseUnaryExpressionNotPlusMinus(parser:AS3Parser):Node {
    let result:Node;
    let index = parser.tok.index;
    if (tokIs(parser, Keywords.DELETE)) {
        nextToken(parser, true);
        let expr = parseExpression(parser);
        result = createNode(NodeKind.DELETE, {start: index, end: expr.end}, expr);
    } else if (tokIs(parser, Keywords.VOID)) {
        nextToken(parser, true);
        let expr = parseExpression(parser);
        result = createNode(NodeKind.VOID, {start: index, end: expr.end}, expr);
    } else if (tokIs(parser, Keywords.TYPEOF)) {
        nextToken(parser, true);
        let expr = parseExpression(parser);
        result = createNode(NodeKind.TYPEOF, {start: index, end: expr.end}, expr);
    } else if (tokIs(parser, '!') || tokIs(parser, 'not')) {
        nextToken(parser, true);
        // Unary negation binds to the next unary operand. Parsing a complete
        // expression here changed `!a && b` into `!(a && b)`.
        let expr = parseUnaryExpression(parser);
        result = createNode(NodeKind.NOT, {start: index, end: expr.end}, expr);
    } else if (tokIs(parser, '~')) {
        nextToken(parser, true);
        let expr = parseExpression(parser);
        result = createNode(NodeKind.B_NOT, {start: index, end: expr.end}, expr);
    } else {
        result = parseUnaryPostfixExpression(parser);
    }
    return result;
}


function parseUnaryPostfixExpression(parser:AS3Parser):Node {
    let node:Node = parseAccessExpression(parser);

    if (tokIs(parser, Operators.INCREMENT)) {
        node = parseIncrement(parser, node);
    } else if (tokIs(parser, Operators.DECREMENT)) {
        node = parseDecrement(parser, node);
    }
    return node;
}


function parseIncrement(parser:AS3Parser, node:Node):Node {
    const operatorEnd = parser.tok.end;
    nextToken(parser, true);
    let result:Node = createNode(NodeKind.POST_INC, {start: node.start, end: operatorEnd});
    result.children.push(node);
    return result;
}


function parseDecrement(parser:AS3Parser, node:Node):Node {
    const operatorEnd = parser.tok.end;
    nextToken(parser, true);
    let result:Node = createNode(NodeKind.POST_DEC, {start: node.start, end: operatorEnd});
    result.children.push(node);
    return result;
}


function parseAccessExpression(parser:AS3Parser):Node {
    let node:Node = parsePrimaryExpression(parser);

    while (true) {
        if (tokIs(parser, Operators.LEFT_PARENTHESIS)) {
            node = parseFunctionCall(parser, node);
            continue;
        }
        if (tokIs(parser, Operators.DOT) || tokIs(parser, Operators.DOUBLE_COLUMN)) {
            node = parseDot(parser, node);
        } else if (tokIs(parser, Operators.LEFT_SQUARE_BRACKET)) {
            node = parseArrayAccessor(parser, node);
        } else {
            break;
        }
    }
    return node;
}


function parseFunctionCall(parser:AS3Parser, node:Node):Node {

    let result:Node = createNode(NodeKind.CALL, {start: node.start});
    result.children.push(node);

    result.children.push(parseArgumentList(parser));
    result.end = result.children.reduce((index:number, child:Node) => {
        return Math.max(index, child ? child.end : 0);
    }, 0);
    return result;
}


function parseArgumentList(parser:AS3Parser):Node {
    let tok = consume(parser, Operators.LEFT_PARENTHESIS);
    let result:Node = createNode(NodeKind.ARGUMENTS, {start: tok.index});
    while (!tokIs(parser, Operators.RIGHT_PARENTHESIS)) {
        assertNotEOF(parser, 'argument list');
        const checkpoint = getParserCheckPoint(parser);
        result.children.push(parseExpression(parser));
        if (!tokIs(parser, Operators.RIGHT_PARENTHESIS)) {
            if (!tokIs(parser, Operators.COMMA)) {
                throw parseError(parser, 'AS3_PARSE_UNEXPECTED_TOKEN', ', or )', 'argument list');
            }
            nextToken(parser);
        }
        assertProgress(parser, checkpoint, 'argument list');
    }
    tok = consume(parser, Operators.RIGHT_PARENTHESIS);
    result.end = tok.end;
    return result;
}



function parseDot(parser:AS3Parser, node:Node):Node {
    const separator = parser.tok.text;
    nextToken(parser);
    if (tokIs(parser, Operators.LEFT_PARENTHESIS)) {
        nextToken(parser);
        let result:Node = createNode(NodeKind.E4X_FILTER, {start: parser.tok.index});
        result.children.push(node);
        result.children.push(parseExpression(parser));
        result.end = consume(parser, Operators.RIGHT_PARENTHESIS).end;
        return result;
    } else if (tokIs(parser, Operators.TIMES)) {
        let result:Node = createNode(NodeKind.E4X_STAR, {start: parser.tok.index});
        result.children.push(node);
        result.end = node.end;
        return result;
    }
    let result:Node = createNode(NodeKind.DOT, {start: node.start, ...(separator === Operators.DOUBLE_COLUMN ? {text:separator} : {})});
    result.children.push(node);
    result.children.push(createNode(NodeKind.LITERAL, {tok: parser.tok}));
    nextToken(parser, true);
    result.end = result.children.reduce((index:number, child:Node) => {
        return Math.max(index, child ? child.end : 0);
    }, 0);
    return result;
}


function parseArrayAccessor(parser:AS3Parser, node:Node):Node {
    let result:Node = createNode(NodeKind.ARRAY_ACCESSOR, {start: node.start});
    result.children.push(node);
    while (tokIs(parser, Operators.LEFT_SQUARE_BRACKET)) {
        nextToken(parser, true);
        result.children.push(parseExpression(parser));
        result.end = consume(parser, Operators.RIGHT_SQUARE_BRACKET).end;
    }
    return result;
}

