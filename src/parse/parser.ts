/**
 *    Copyright (c) 2009, Adobe Systems, Incorporated
 *    All rights reserved.
 *
 *    Redistribution  and  use  in  source  and  binary  forms, with or without
 *    modification,  are  permitted  provided  that  the  following  conditions
 *    are met:
 *
 *      * Redistributions  of  source  code  must  retain  the  above copyright
 *        notice, this list of conditions and the following disclaimer.
 *      * Redistributions  in  binary  form  must reproduce the above copyright
 *        notice,  this  list  of  conditions  and  the following disclaimer in
 *        the    documentation   and/or   other  materials  provided  with  the
 *        distribution.
 *      * Neither the name of the Adobe Systems, Incorporated. nor the names of
 *        its  contributors  may be used to endorse or promote products derived
 *        from this software without specific prior written permission.
 *
 *    THIS  SOFTWARE  IS  PROVIDED  BY THE  COPYRIGHT  HOLDERS AND CONTRIBUTORS
 *    "AS IS"  AND  ANY  EXPRESS  OR  IMPLIED  WARRANTIES,  INCLUDING,  BUT NOT
 *    LIMITED  TO,  THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
 *    PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER
 *    OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,  INCIDENTAL,  SPECIAL,
 *    EXEMPLARY,  OR  CONSEQUENTIAL  DAMAGES  (INCLUDING,  BUT  NOT  LIMITED TO,
 *    PROCUREMENT  OF  SUBSTITUTE   GOODS  OR   SERVICES;  LOSS  OF  USE,  DATA,
 *    OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 *    LIABILITY,  WHETHER  IN  CONTRACT,  STRICT  LIABILITY, OR TORT (INCLUDING
 *    NEGLIGENCE  OR  OTHERWISE)  ARISING  IN  ANY  WAY  OUT OF THE USE OF THIS
 *    SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import SourceFile from './source-file';
import AS3Scanner from './scanner';
import Token from './token';
import Node from '../syntax/node';
import {startsWith} from '../string';
import * as Keywords from '../syntax/keywords';
import {CheckPoint as ScannerCheckPoint} from './scanner';
import {AS3ParseError, AS3ParseDiagnosticCode, isAS3ParseError} from './diagnostic';

export const ASDOC_COMMENT = '/**';
export const MULTIPLE_LINES_COMMENT = '/*';
export const NEW_LINE = '\n';
const SINGLE_LINE_COMMENT = '//';
export const VECTOR = 'Vector';

/**
 * @author xagnetti
 */
export default class AS3Parser {
    sourceFile:SourceFile;
    currentAsDoc:Node;
    currentFunctionNode:Node;
    currentMultiLineComment:Node;
    isInFor:boolean = false;
    scn:AS3Scanner;
    tok:Token;
    /** Complete source-ordered comment trivia consumed by the parser. */
    trivia:Token[] = [];
    pendingTrivia:Token[] = [];
}

export interface ParserCheckPoint {
    scanner: ScannerCheckPoint;
    tok: Token;
    triviaLength: number;
    pendingTrivia: Token[];
    currentAsDoc: Node;
    currentFunctionNode: Node;
    currentMultiLineComment: Node;
    isInFor: boolean;
}

export function getParserCheckPoint(parser:AS3Parser):ParserCheckPoint {
    return {
        scanner: parser.scn.getCheckPoint(),
        tok: parser.tok,
        triviaLength: parser.trivia.length,
        pendingTrivia: parser.pendingTrivia.slice(),
        currentAsDoc: parser.currentAsDoc,
        currentFunctionNode: parser.currentFunctionNode,
        currentMultiLineComment: parser.currentMultiLineComment,
        isInFor: parser.isInFor,
    };
}

export function rewindParser(parser:AS3Parser, checkpoint:ParserCheckPoint):void {
    parser.scn.rewind(checkpoint.scanner);
    parser.tok = checkpoint.tok;
    parser.trivia.length = checkpoint.triviaLength;
    parser.pendingTrivia = checkpoint.pendingTrivia.slice();
    parser.currentAsDoc = checkpoint.currentAsDoc;
    parser.currentFunctionNode = checkpoint.currentFunctionNode;
    parser.currentMultiLineComment = checkpoint.currentMultiLineComment;
    parser.isInFor = checkpoint.isInFor;
}

export function parseError(parser:AS3Parser, code:AS3ParseDiagnosticCode, expected:string,
        context:string, found?:string):AS3ParseError {
    const token = parser.tok;
    return new AS3ParseError(code, parser.sourceFile,
        token ? token.index : parser.sourceFile.content.length,
        found == null ? (token ? token.text : 'EOF') : found, expected, context);
}

export function assertProgress(parser:AS3Parser, checkpoint:ParserCheckPoint, context:string):void {
    const scanner = parser.scn.getCheckPoint();
    if (scanner.index === checkpoint.scanner.index
            && (!parser.tok || !checkpoint.tok
                || (parser.tok.index === checkpoint.tok.index && parser.tok.text === checkpoint.tok.text))) {
        throw parseError(parser, 'AS3_PARSE_NO_PROGRESS', 'a consuming production', context);
    }
}

export function assertNotEOF(parser:AS3Parser, context:string):void {
    if (tokIs(parser, Keywords.EOF)) {
        throw parseError(parser, 'AS3_PARSE_UNEXPECTED_EOF', 'more source input', context, 'EOF');
    }
}

function isComment(token:Token):boolean {
    return startsWith(token.text, SINGLE_LINE_COMMENT) || startsWith(token.text, MULTIPLE_LINES_COMMENT);
}


export function nextToken(parser:AS3Parser, ignoreDocumentation:boolean = false):void {
    do {
        if (ignoreDocumentation) {
            nextTokenIgnoringDocumentation(parser);
        } else {
            nextTokenAllowNewLine(parser);
        }
    }
    while (parser.tok.text === NEW_LINE);
}


export function tryParse<T>(parser:AS3Parser, func:() => T):T {
    let checkPoint = getParserCheckPoint(parser);
    try {
        return func();
    } catch (e) {
        rewindParser(parser, checkPoint);
        if (isAS3ParseError(e)) return null;
        throw e;
    }
}


/**
 * Compare the current token to the parameter. If it equals, get the next
 * token. If not, throw a runtime exception.
 */
export function consume(parser:AS3Parser, text:string):Token {
    if (!tokIs(parser, text)) {
        /*throw new UnExpectedTokenException(parser.tok.text,
         new Position(parser.tok.index, parser.tok.getColumn()),
         fileName,
         text);*/

        const code = tokIs(parser, Keywords.EOF) ? 'AS3_PARSE_UNEXPECTED_EOF' : 'AS3_PARSE_UNEXPECTED_TOKEN';
        throw parseError(parser, code, text, 'consume', tokIs(parser, Keywords.EOF) ? 'EOF' : undefined);
    }
    let result = parser.tok;
    nextToken(parser);
    return result;
}


/**
 * Get the next token Skip comments but keep newlines We need parser method for
 * beeing able to decide if a returnStatement has an expression
 *
 * @throws UnExpectedTokenException
 */
export function nextTokenAllowNewLine(parser:AS3Parser):void {
    for (;;) {
        const token = parser.scn.nextToken();
        if (!token || token.text == null) {
            throw new AS3ParseError('AS3_PARSE_INTERNAL', parser.sourceFile,
                parser.tok ? parser.tok.end : 0, token ? 'null token text' : 'null token',
                'scanner token', 'scanner');
        }
        if (isComment(token)) {
            parser.trivia.push(token);
            parser.pendingTrivia.push(token);
            continue;
        }
        token.leadingTrivia = parser.pendingTrivia.slice();
        parser.pendingTrivia.length = 0;
        parser.tok = token;
        return;
    }
}


export function nextTokenIgnoringDocumentation(parser:AS3Parser):void {
    nextToken(parser);
}


export function skip(parser:AS3Parser, text:string):void {
    if (tokIs(parser, text)) {
        nextToken(parser);
    }
}


export function tokIs(parser:AS3Parser, text:string):boolean {
    return !!parser.tok && parser.tok.text === text;
}
