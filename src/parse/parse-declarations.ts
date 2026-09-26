import Node, {createNode} from '../syntax/node';
import NodeKind from '../syntax/nodeKind';
import Token from './token';
import * as Keywords from '../syntax/keywords';
import * as Operators from '../syntax/operators';
import AS3Parser, {
    nextToken, nextTokenIgnoringDocumentation, consume, skip, tokIs,
    getParserCheckPoint, rewindParser, assertProgress, assertNotEOF, parseError,
} from './parser';
import {parseQualifiedName, parseBlock, parseParameterList, parseNameTypeInit} from './parse-common';
import {parseExpression} from './parse-expressions';
import {startsWith} from '../string';
import {parseStatement} from './parse-statements';
import {parseOptionalType} from './parse-types';

/**
 * tok is empty, since nextToken has not been called before
 */
export function parseCompilationUnit(parser:AS3Parser):Node {
    let result:Node = createNode(NodeKind.COMPILATION_UNIT);

    nextTokenIgnoringDocumentation(parser);
    if (tokIs(parser, Keywords.PACKAGE)) {
        result.children.push(parsePackage(parser));
        if (!tokIs(parser, Keywords.EOF)) {
            result.children.push(parsePackageContent(parser, true));
        }
    } else {
        result.children.push(parsePackageContent(parser, true));
    }
    if (!tokIs(parser, Keywords.EOF)) {
        throw parseError(parser, 'AS3_PARSE_TRAILING_INPUT', 'end of input', 'compilation unit');
    }
    result.start = 0;
    result.end = parser.sourceFile.content.length;
    result.trivia = parser.trivia.slice();
    return result;
}


function parsePackage(parser:AS3Parser):Node {
    let tok = consume(parser, Keywords.PACKAGE);
    let result:Node = createNode(NodeKind.PACKAGE, {start: tok.index});
    let nameBuffer = '';

    let index = parser.tok.index;
    let nameEnd = index;
    while (!tokIs(parser, Operators.LEFT_CURLY_BRACKET)) {
        assertNotEOF(parser, 'package declaration');
        const checkpoint = getParserCheckPoint(parser);
        nameBuffer += parser.tok.text;
        nameEnd = parser.tok.end;
        nextToken(parser);
        assertProgress(parser, checkpoint, 'package declaration');
    }
    result.children.push(createNode(NodeKind.NAME, {start: index, end: nameEnd, text: nameBuffer}));
    consume(parser, Operators.LEFT_CURLY_BRACKET);
    result.children.push(parsePackageContent(parser, true));
    tok = consume(parser, Operators.RIGHT_CURLY_BRACKET);
    result.end = tok.end;
    return result;
}


function parsePackageContent(parser:AS3Parser, allowScriptStatements:boolean):Node {

    let result:Node = createNode(NodeKind.CONTENT, {start: parser.tok.index});
    let modifiers:Token[] = [];
    let meta:Node[] = [];

    while (!tokIs(parser, Operators.RIGHT_CURLY_BRACKET) && !tokIs(parser, Keywords.EOF)) {
        const checkpoint = getParserCheckPoint(parser);
        if (tokIs(parser, Keywords.IMPORT)) {
            result.children.push(parseImport(parser));
        } else if (tokIs(parser, Keywords.USE)) {
            result.children.push(parseUse(parser));
        } else if (tokIs(parser, Keywords.INCLUDE) || tokIs(parser, Keywords.INCLUDE_AS2)) {
            result.children.push(parseIncludeExpression(parser));
        } else if (tokIs(parser, Operators.LEFT_SQUARE_BRACKET)) {
            meta.push(parseMetaData(parser));
        } else if (tokIs(parser, Keywords.CLASS)) {
            result.children.push(parseClass(parser, meta, modifiers));
            modifiers.length = 0;
            meta.length = 0;
        } else if (tokIs(parser, Keywords.INTERFACE)) {
            result.children.push(parseInterface(parser, meta, modifiers));
            modifiers.length = 0;
            meta.length = 0;
        } else if (tokIs(parser, Keywords.FUNCTION)) {
            parseClassFunctions(parser, result, modifiers, meta);
        } else if (allowScriptStatements && tokIs(parser, Keywords.VAR)) {
            result.children.push(parseVarList(parser, meta, modifiers));
            skip(parser, Operators.SEMI_COLUMN);
            modifiers.length = 0;
            meta.length = 0;
        } else if (allowScriptStatements && tokIs(parser, Keywords.CONST)) {
            result.children.push(parseConstList(parser, meta, modifiers));
            skip(parser, Operators.SEMI_COLUMN);
            modifiers.length = 0;
            meta.length = 0;
        } else if (allowScriptStatements && tokIs(parser, Keywords.NAMESPACE)) {
            result.children.push(parseNativeNamespaceDeclaration(parser, modifiers));
            skip(parser, Operators.SEMI_COLUMN);
            modifiers.length = 0;
            meta.length = 0;
        } else if (isDeclarationModifier(parser.tok.text)) {
            modifiers.push(parser.tok);
            nextTokenIgnoringDocumentation(parser);
        } else if (allowScriptStatements && modifiers.length === 0 && meta.length === 0) {
            result.children.push(parseExpression(parser));
            skip(parser, Operators.SEMI_COLUMN);
        } else {
            throw parseError(parser, 'AS3_PARSE_UNEXPECTED_TOKEN',
                'a package declaration or declaration modifier', 'package content');
        }
        assertProgress(parser, checkpoint, 'package content');
    }
    if (modifiers.length || meta.length) {
        throw parseError(parser, 'AS3_PARSE_UNEXPECTED_EOF', 'a declaration after modifiers or metadata',
            'package content', 'EOF');
    }
    result.end = parser.tok.index;
    return result;
}

function parseNamespaceDeclaration(parser:AS3Parser, meta:Node[], modifiers:Token[]):Node {
    const tok = consume(parser, Keywords.NAMESPACE);
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(parser.tok.text)) {
        throw parseError(parser, 'AS3_PARSE_UNEXPECTED_TOKEN', 'a namespace identifier', 'namespace declaration');
    }
    const name = parser.tok;
    nextToken(parser);
    const result = createNode(NodeKind.NAMESPACE, { start: tok.index, end: name.end, text: name.text });
    if (tokIs(parser, Operators.EQUAL)) {
        const assignment = consume(parser, Operators.EQUAL);
        const value = parseExpression(parser);
        const init = createNode(NodeKind.INIT, {start:assignment.index,end:value.end});
        init.children.push(value);
        result.children.push(init);
        result.end = value.end;
    }
    appendIfPresent(result, convertMeta(parser, meta));
    appendIfPresent(result, convertModifiers(parser, modifiers));
    result.start = result.children.reduce((index:number, child:Node) => Math.min(index, child.start), tok.index);
    return result;
}


function parseImport(parser:AS3Parser):Node {

    const keyword = consume(parser, Keywords.IMPORT);
    const nameStart = parser.tok.index;
    let name = parseImportName(parser);
    // Imported identifiers are syntactic namespace candidates; semantic authority resolves their kind.
    const importedName = name.text.slice(name.text.lastIndexOf(".") + 1);
    if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(importedName)) parser.activeNamespaces.add(importedName);
    let result:Node = createNode(NodeKind.IMPORT, {start: nameStart, end: name.end, text: name.text});
    result.importKeywordStart = keyword.index;
    skip(parser, Operators.SEMI_COLUMN);
    return result;
}


/**
 * tok is the first part of a name the last part can be a star exit tok is
 * the first token, which doesn't belong to the name
 */
function parseImportName(parser:AS3Parser):{text:string, end:number} {
    let result = '';
    let end = parser.tok.end;

    result += parser.tok.text;
    nextToken(parser);
    while (tokIs(parser, Operators.DOT)) {
        result += Operators.DOT;
        nextToken(parser); // .
        result += parser.tok.text;
        end = parser.tok.end;
        nextToken(parser); // part of name
    }
    return {text: result, end};
}


function parseUse(parser:AS3Parser):Node {
    let tok = consume(parser, Keywords.USE);
    consume(parser, Keywords.NAMESPACE);
    let nameIndex = parser.tok.index;
    let namespace = parseNamespaceName(parser);
    parser.activeNamespaces.add(namespace);
    let result:Node = createNode(NodeKind.USE, {
        start: tok.index,
        end: nameIndex + namespace.length,
        text: namespace
    });
    skip(parser, Operators.SEMI_COLUMN);
    return result;
}


function parseNativeNamespaceDeclaration(parser:AS3Parser, modifiers:Token[]):Node {
    let token = consume(parser, Keywords.NAMESPACE);
    let name = createNode(NodeKind.NAME, {tok: parser.tok});
    nextToken(parser);
    if (!tokIs(parser, Operators.EQUAL)) {
        throw new Error('AS3_NAMESPACE_UNSUPPORTED: namespace requires an explicit literal URI or alias');
    }
    nextToken(parser);
    let value = parseExpression(parser);
    let end = value.end;
    if (tokIs(parser, Operators.SEMI_COLUMN)) end = consume(parser, Operators.SEMI_COLUMN).end;
    return createNode(NodeKind.NAMESPACE_DECLARATION,
        {start: modifiers.length ? modifiers[0].index : token.index, end: end},
        convertModifiers(parser, modifiers), name, value);
}


function parseNamespaceName(parser:AS3Parser):string {
    let name:string = parser.tok.text;
    nextToken(parser); // simple name for now
    return name;
}


function parseIncludeExpression(parser:AS3Parser):Node {
    let result:Node = createNode(NodeKind.INCLUDE, {start: parser.tok.index});
    let tok:Token;
    if (tokIs(parser, Keywords.INCLUDE)) {
        tok = consume(parser, Keywords.INCLUDE);
    } else if (tokIs(parser, Keywords.INCLUDE_AS2)) {
        tok = consume(parser, Keywords.INCLUDE_AS2);
    }
    if (tok) {
        result.start = tok.index;
    }
    result.children.push(parseExpression(parser));
    result.end = result.children.reduce((index:number, child:Node) => {
        return Math.max(index, child ? child.end : 0);
    }, 0);
    skip(parser, Operators.SEMI_COLUMN);
    return result;
}


function parseMetaData(parser:AS3Parser):Node {
    const start = consume(parser, Operators.LEFT_SQUARE_BRACKET).index;
    const expression = parseExpression(parser);
    const end = consume(parser, Operators.RIGHT_SQUARE_BRACKET).end;
    const result = createNode(NodeKind.META, {start, end});
    result.children.push(expression);
    return result;
}


function parseClass(parser:AS3Parser, meta:Node[], modifier:Token[]):Node {
    let tok = consume(parser, Keywords.CLASS);
    let result:Node = createNode(NodeKind.CLASS, {start: tok.index, end: tok.end});

    if (parser.currentAsDoc) {
        result.children.push(parser.currentAsDoc);
        parser.currentAsDoc = null;
    }
    if (parser.currentMultiLineComment) {
        result.children.push(parser.currentMultiLineComment);
        parser.currentMultiLineComment = null;
    }

    let index = parser.tok.index,
        name = parseQualifiedName(parser, true);
    result.children.push(createNode(NodeKind.NAME, {start: index, text: name}));

    appendIfPresent(result, convertMeta(parser, meta));
    appendIfPresent(result, convertModifiers(parser, modifier));

    // nextToken(parser,  true ); // name

    while (!tokIs(parser, Operators.LEFT_CURLY_BRACKET)) {
        assertNotEOF(parser, 'class header');
        const checkpoint = getParserCheckPoint(parser);
        if (tokIs(parser, Keywords.EXTENDS)) {
            nextToken(parser, true); // extends
            index = parser.tok.index;
            name = parseQualifiedName(parser, false);
            result.children.push(createNode(NodeKind.EXTENDS, {start: index, text: name}));
        } else if (tokIs(parser, Keywords.IMPLEMENTS)) {
            result.children.push(parseImplementsList(parser));
        } else {
            throw parseError(parser, 'AS3_PARSE_UNEXPECTED_TOKEN',
                'extends, implements, or {', 'class header');
        }
        assertProgress(parser, checkpoint, 'class header');
    }
    consume(parser, Operators.LEFT_CURLY_BRACKET);
    result.children.push(parseClassContent(parser));
    tok = consume(parser, Operators.RIGHT_CURLY_BRACKET);

    result.end = tok.end;
    result.start = result.children.reduce((index:number, child:Node) => {
        return Math.min(index, child ? child.start : Infinity);
    }, index);

    return result;
}


function parseImplementsList(parser:AS3Parser):Node {
    consume(parser, Keywords.IMPLEMENTS);
    let result:Node = createNode(NodeKind.IMPLEMENTS_LIST, {start: parser.tok.index});
    let index = parser.tok.index;
    let name = parseQualifiedName(parser, false);
    result.children.push(createNode(NodeKind.IMPLEMENTS, {start: index, text: name}));
    while (tokIs(parser, Operators.COMMA)) {
        nextToken(parser, true);
        let index = parser.tok.index;
        let name = parseQualifiedName(parser, false);
        result.children.push(createNode(NodeKind.IMPLEMENTS, {start: index, text: name}));
    }
    result.end = result.lastChild.end;
    return result;
}


function parseClassContent(parser:AS3Parser):Node {

    let result:Node = createNode(NodeKind.CONTENT, {start: parser.tok.index});
    let modifiers:Token[] = [];
    let meta:Node[] = [];

    while (!tokIs(parser, Operators.RIGHT_CURLY_BRACKET)) {
        assertNotEOF(parser, 'class body');
        const checkpoint = getParserCheckPoint(parser);
        if (tokIs(parser, Operators.LEFT_SQUARE_BRACKET) && classMetadataPrefix(parser)) {
            meta.push(parseMetaData(parser));
        } else if (tokIs(parser, Keywords.VAR)) {
            parseClassField(parser, result, modifiers, meta);
        } else if (tokIs(parser, Keywords.CONST)) {
            parseClassConstant(parser, result, modifiers, meta);
        } else if (tokIs(parser, Keywords.IMPORT)) {
            result.children.push(parseImport(parser));
        } else if (tokIs(parser, Keywords.USE)) {
            result.children.push(parseUse(parser));
        } else if (tokIs(parser, Keywords.NAMESPACE)) {
            throw new Error('AS3_NAMESPACE_UNSUPPORTED: class-local namespace declaration');
        } else if (tokIs(parser, Keywords.INCLUDE) || tokIs(parser, Keywords.INCLUDE_AS2)) {
            result.children.push(parseIncludeExpression(parser));
        } else if (tokIs(parser, Keywords.FUNCTION)) {
            parseClassFunctions(parser, result, modifiers, meta);
        } else if (tokIs(parser, Operators.SEMI_COLUMN)) {
            nextToken(parser);
        } else if (classDeclarationPrefix(parser)) {
            modifiers.push(parser.tok);
            nextTokenIgnoringDocumentation(parser);
        } else {
            if (modifiers.length || meta.length)
                throw parseError(parser, 'AS3_PARSE_UNEXPECTED_TOKEN',
                    'a class member following declaration metadata and modifiers', 'class body');
            const start = parser.tok.index;
            const statement = parseStatement(parser);
            result.children.push(createNode(NodeKind.CLASS_INITIALIZER,
                {start, end: statement.end}, statement));
        }
        assertProgress(parser, checkpoint, 'class body');
    }
    result.end = parser.tok.index;
    return result;
}

/** A namespace qualifier is a declaration prefix only before a declaration.
 * Expression tokens (including a call's array argument) must never accumulate
 * in the next field's MOD_LIST/META_LIST. Lookahead restores all scanner state.
 */
function classDeclarationPrefix(parser: AS3Parser): boolean {
    const modifiers = ['public', 'private', 'protected', 'internal', 'static',
        'override', 'final', 'native', 'dynamic'];
    if (modifiers.indexOf(parser.tok.text) >= 0) return true;
    if (!/^[A-Za-z_$][\w$]*$/.test(parser.tok.text)) return false;
    const scanner: any = parser.scn;
    const saved: any = {};
    Object.keys(scanner).forEach(key => saved[key] = scanner[key]);
    try {
        let token = scanner.nextToken();
        while (token.text === '\n' || modifiers.indexOf(token.text) >= 0
            || startsWith(token.text, '/*') || startsWith(token.text, '//')) token = scanner.nextToken();
        return ['var', 'const', 'function'].indexOf(token.text) >= 0;
    } finally {
        Object.keys(scanner).forEach(key => { if (!Object.prototype.hasOwnProperty.call(saved, key)) delete scanner[key]; });
        Object.keys(saved).forEach(key => scanner[key] = saved[key]);
    }
}

function classMetadataPrefix(parser: AS3Parser): boolean {
    const scanner: any = parser.scn, saved: any = {};
    Object.keys(scanner).forEach(key => saved[key] = scanner[key]);
    try {
        let token = scanner.nextToken();
        if (!/^[A-Za-z_$][\w$]*$/.test(token.text)) return false;
        token = scanner.nextToken();
        if (token.text !== '(' && token.text !== ']') return false;
        let depth = token.text === ']' ? 0 : 1;
        while (depth) {
            token = scanner.nextToken();
            if (!token.text || token.text === Keywords.EOF)
                throw new Error('AS3_CLASS_INITIALIZER_UNSUPPORTED: unterminated class metadata or array expression');
            if (token.text === '[') depth++;
            if (token.text === ']') depth--;
        }
        do { token = scanner.nextToken(); }
        while (token.text === '\n' || startsWith(token.text, '/*') || startsWith(token.text, '//'));
        if (['[', 'var', 'const', 'function', 'public', 'private', 'protected', 'internal',
            'static', 'override', 'final', 'native', 'dynamic'].indexOf(token.text) >= 0) return true;
        if (!/^[A-Za-z_$][\w$]*$/.test(token.text)) return false;
        token = scanner.nextToken();
        return ['var', 'const', 'function', 'static'].indexOf(token.text) >= 0;
    } finally {
        Object.keys(scanner).forEach(key => { if (!Object.prototype.hasOwnProperty.call(saved, key)) delete scanner[key]; });
        Object.keys(saved).forEach(key => scanner[key] = saved[key]);
    }
}


function parseClassField(parser:AS3Parser, result:Node, modifiers:Token[], meta:Node[]):void {
    let varList:Node = parseVarList(parser, meta, modifiers);
    result.children.push(varList);
    if (parser.currentAsDoc) {
        varList.children.push(parser.currentAsDoc);
        parser.currentAsDoc = null;
    }
    if (parser.currentMultiLineComment) {
        result.children.push(parser.currentMultiLineComment);
        parser.currentMultiLineComment = null;
    }
    if (tokIs(parser, Operators.SEMI_COLUMN)) {
        nextToken(parser);
    }
    meta.length = 0;
    modifiers.length = 0;
}


function parseClassConstant(parser:AS3Parser, result:Node, modifiers:Token[], meta:Node[]):void {
    result.children.push(parseConstList(parser, meta, modifiers));
    if (tokIs(parser, Operators.SEMI_COLUMN)) {
        nextToken(parser);
    }
    meta.length = 0;
    modifiers.length = 0;
}


function parseInterface(parser:AS3Parser, meta:Node[], modifier:Token[]):Node {
    let tok = consume(parser, Keywords.INTERFACE);
    let result:Node = createNode(NodeKind.INTERFACE, {start: tok.index});

    if (parser.currentAsDoc) {
        result.children.push(parser.currentAsDoc);
        parser.currentAsDoc = null;
    }
    if (parser.currentMultiLineComment) {
        result.children.push(parser.currentMultiLineComment);
        parser.currentMultiLineComment = null;
    }
    let nameStart = parser.tok.index;
    let name = parseQualifiedName(parser, true);
    result.children.push(createNode(NodeKind.NAME, {start: nameStart, text: name}));

    appendIfPresent(result, convertMeta(parser, meta));
    appendIfPresent(result, convertModifiers(parser, modifier));

    if (tokIs(parser, Keywords.EXTENDS)) {
        nextToken(parser); // extends
        nameStart = parser.tok.index;
        name = parseQualifiedName(parser, false);
        result.children.push(createNode(NodeKind.EXTENDS, {start: nameStart, text: name}));
    }
    while (tokIs(parser, Operators.COMMA)) {
        nextToken(parser); // comma
        nameStart = parser.tok.index;
        name = parseQualifiedName(parser, false);
        result.children.push(createNode(NodeKind.EXTENDS, {start: nameStart, text: name}));
    }
    consume(parser, Operators.LEFT_CURLY_BRACKET);
    result.children.push(parseInterfaceContent(parser));
    tok = consume(parser, Operators.RIGHT_CURLY_BRACKET);
    result.end = tok.end;
    result.start = result.children.reduce((index:number, child:Node) => {
        return Math.min(index, child ? child.start : Infinity);
    }, tok.index);
    return result;
}


function parseInterfaceContent(parser:AS3Parser):Node {
    let result:Node = createNode(NodeKind.CONTENT, {start: parser.tok.index});

    while (!tokIs(parser, Operators.RIGHT_CURLY_BRACKET)) {
        assertNotEOF(parser, 'interface body');
        const checkpoint = getParserCheckPoint(parser);
        if (tokIs(parser, Keywords.IMPORT)) {
            result.children.push(parseImport(parser));
        } else if (tokIs(parser, Keywords.FUNCTION)) {
            result.children.push(parseFunctionSignature(parser));
        } else if (tokIs(parser, Keywords.INCLUDE) || tokIs(parser, Keywords.INCLUDE_AS2)) {
            result.children.push(parseIncludeExpression(parser));
        } else if (tokIs(parser, Operators.LEFT_SQUARE_BRACKET)) {
            while (!tokIs(parser, Operators.RIGHT_SQUARE_BRACKET)) {
                assertNotEOF(parser, 'interface metadata');
                const metadataCheckpoint = getParserCheckPoint(parser);
                nextToken(parser);
                assertProgress(parser, metadataCheckpoint, 'interface metadata');
            }
            nextToken(parser);
        } else {
            throw parseError(parser, 'AS3_PARSE_UNEXPECTED_TOKEN',
                'an interface member', 'interface body');
        }
        assertProgress(parser, checkpoint, 'interface body');
    }
    result.end = parser.tok.index;
    return result;
}


function parseClassFunctions(parser:AS3Parser, result:Node, modifiers:Token[], meta:Node[]):void {

    result.children.push(parseFunction(parser, meta, modifiers));
    meta.length = 0;
    modifiers.length = 0;
}


function parseFunction(parser:AS3Parser, meta:Node[], modifiers:Token[]):Node {

    let {type, name, params, returnType} = doParseSignature(parser);
    let result:Node = createNode(findFunctionTypeFromTypeNode(type), {start: type.start, end: -1, text: type.text});

    if (parser.currentAsDoc) {
        result.children.push(parser.currentAsDoc);
        parser.currentAsDoc = null;
    }
    if (parser.currentMultiLineComment) {
        result.children.push(parser.currentMultiLineComment);
        parser.currentMultiLineComment = null;
    }

    appendIfPresent(result, convertMeta(parser, meta));
    appendIfPresent(result, convertModifiers(parser, modifiers));
    result.children.push(name);
    result.children.push(params);
    result.children.push(returnType);

    if (tokIs(parser, Operators.SEMI_COLUMN)) {
        consume(parser, Operators.SEMI_COLUMN);
    } else {
        result.children.push(parseFunctionBlock(parser));
    }
    parser.currentFunctionNode = null;
    result.start = result.children.reduce((index:number, child:Node) => {
        return Math.min(index, child ? child.start : Infinity);
    }, result.start);
    result.end = result.children.reduce((index:number, child:Node) => {
        return Math.max(index, child ? child.end : 0);
    }, 0);
    return result;
}


function parseFunctionSignature(parser:AS3Parser):Node {
    let {type, name, params, returnType} = doParseSignature(parser);
    skip(parser, Operators.SEMI_COLUMN);
    let result:Node = createNode(
        findFunctionTypeFromTypeNode(type),
        {start: type.start, end: -1, text: type.text},
        name,
        params,
        returnType);
    result.end = result.children.reduce((index:number, child:Node) => {
        return Math.max(index, child ? child.end : 0);
    }, 0);
    return result;
}


function doParseSignature(parser:AS3Parser) {

    let tok = consume(parser, Keywords.FUNCTION);
    let type:Node = createNode(NodeKind.TYPE, {tok: tok});

    let isGet = tokIs(parser, Keywords.GET);
    let isSet = tokIs(parser, Keywords.SET);

    if (isGet || isSet) {
        let checkpoint = getParserCheckPoint(parser);

        nextToken(parser); // set or get
        let valid: boolean = (parser.tok.text !== "(");

        if (valid) {
            type = createNode((isGet) ? NodeKind.GET : NodeKind.SET, {
                start: tok.index,
                end: parser.tok.end,
                text: parser.tok.text
            });

        } else {
            rewindParser(parser, checkpoint);
        }

    }
    let name:Node = createNode(NodeKind.NAME, {tok: parser.tok});
    nextToken(parser); // name
    let params:Node = parseParameterList(parser);
    let returnType:Node = parseOptionalType(parser);
    return {type, name, params, returnType};
}


function findFunctionTypeFromTypeNode(node: Node):NodeKind {
    if (node.text === Keywords.SET || node.kind === NodeKind.SET) {
        return NodeKind.SET;
    }
    if (node.text === Keywords.GET || node.kind === NodeKind.GET) {
        return NodeKind.GET;
    }
    return NodeKind.FUNCTION;
}


function parseFunctionBlock(parser:AS3Parser):Node {
    let block:Node = createNode(NodeKind.BLOCK, {start: parser.tok.index});

    parser.currentFunctionNode = block;

    parseBlock(parser, block);

    return block;
}


export function parseVarList(parser:AS3Parser, meta:Node[], modifiers:Token[]):Node {
    let tok = consume(parser, Keywords.VAR);
    let result:Node = createNode(NodeKind.VAR_LIST, {start: tok.index, end: tok.end});
    appendIfPresent(result, convertMeta(parser, meta));
    appendIfPresent(result, convertModifiers(parser, modifiers));
    collectVarListContent(parser, result);
    result.start = result.children.reduce((index:number, child:Node) => {
        return Math.min(index, child ? child.start : Infinity);
    }, tok.index);
    result.end = result.children.reduce((index:number, child:Node) => {
        return Math.max(index, child ? child.end : 0);
    }, tok.end);
    return result;
}


export function parseConstList(parser:AS3Parser, meta:Node[], modifiers:Token[]):Node {
    let tok = consume(parser, Keywords.CONST);
    let result:Node = createNode(NodeKind.CONST_LIST, {start: tok.index});
    appendIfPresent(result, convertMeta(parser, meta));
    appendIfPresent(result, convertModifiers(parser, modifiers));
    collectVarListContent(parser, result);

    result.start = result.children.reduce((index:number, child:Node) => {
        return Math.min(index, child ? child.start : Infinity);
    }, tok.index);
    result.end = result.children.reduce((index:number, child:Node) => {
        return Math.max(index, child ? child.end : 0);
    }, 0);

    return result;
}


function collectVarListContent(parser:AS3Parser, result:Node):Node {
    result.children.push(parseNameTypeInit(parser));
    while (tokIs(parser, Operators.COMMA)) {
        const checkpoint = getParserCheckPoint(parser);
        nextToken(parser, true);
        result.children.push(parseNameTypeInit(parser));
        assertProgress(parser, checkpoint, 'variable declaration list');
    }
    return result;
}


function convertMeta(parser:AS3Parser, metadataList:Node[]):Node {
    if (!metadataList || metadataList.length === 0) {
        return null;
    }

    let result:Node = createNode(NodeKind.META_LIST, {start: parser.tok.index});
    result.children = metadataList ? metadataList.slice(0) : [];
    if (result.lastChild) {
        result.end = result.lastChild.end;
    }
    result.start = result.children.reduce((index:number, child:Node) => {
        return Math.min(index, child ? child.start : Infinity);
    }, result.start);
    return result;
}


function convertModifiers(parser:AS3Parser, modifierList:Token[]):Node {
    if (!modifierList || modifierList.length === 0) {
        return null;
    }

    let result:Node = createNode(NodeKind.MOD_LIST, {start: parser.tok.index});

    let end = parser.tok.index;
    result.children = modifierList.map(tok => {
        end = tok.end;
        return createNode(NodeKind.MODIFIER, {tok: tok});
    });
    result.end = end;
    result.start = result.children.reduce((index:number, child:Node) => {
        return Math.min(index, child ? child.start : Infinity);
    }, result.start);
    return result;
}

function isDeclarationModifier(text:string):boolean {
    return text === Keywords.PUBLIC || text === Keywords.PRIVATE || text === Keywords.PROTECTED
        || text === Keywords.INTERNAL || text === Keywords.STATIC || text === Keywords.FINAL
        || text === Keywords.OVERRIDE || text === Keywords.DYNAMIC || text === Keywords.INTRINSIC;
}

function appendIfPresent(parent:Node, child:Node):void {
    if (child) parent.children.push(child);
}

