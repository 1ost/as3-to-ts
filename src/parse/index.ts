import Node from '../syntax/node';
import AS3Parser from './parser';
import SourceFile from './source-file';
import AS3Scanner from './scanner';
import {parseCompilationUnit} from './parse-declarations';
import {AS3ParseError, isAS3ParseError} from './diagnostic';

export default function parse(filePath:string, content:string):Node {

    let parser = new AS3Parser();
    parser.sourceFile = new SourceFile(content, filePath);
    parser.scn = new AS3Scanner();
    parser.scn.setContent(content, filePath);
    try {
        return parseCompilationUnit(parser);
    } catch (error) {
        if (isAS3ParseError(error)) throw error;
        const token = parser.tok;
        const failureMessage = error instanceof Error ? error.message : String(error);
        const failure = new AS3ParseError('AS3_PARSE_INTERNAL', parser.sourceFile,
            token ? token.index : 0,
            failureMessage,
            'successful parser production', 'parser');
        throw failure;
    }
}

export {AS3ParseError, AS3ParseDiagnostic, AS3ParseDiagnosticCode} from './diagnostic';
