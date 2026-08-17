import SourceFile from './source-file';

export type AS3ParseDiagnosticCode =
    'AS3_PARSE_UNEXPECTED_TOKEN'
    | 'AS3_PARSE_UNEXPECTED_EOF'
    | 'AS3_PARSE_NO_PROGRESS'
    | 'AS3_PARSE_TRAILING_INPUT'
    | 'AS3_PARSE_UNTERMINATED_COMMENT'
    | 'AS3_PARSE_UNTERMINATED_STRING'
    | 'AS3_PARSE_THROW_LINE_BREAK'
    | 'AS3_PARSE_INTERNAL';

export interface AS3ParseDiagnostic {
    code: AS3ParseDiagnosticCode;
    path: string;
    index: number;
    line: number;
    column: number;
    found: string;
    expected: string;
    context: string;
}

function oneLine(value: string): string {
    return (value == null ? '' : String(value)).replace(/\r\n?|\n/g, '\\n');
}

export function canonicalPath(path: string): string {
    return oneLine(path || '<memory>').replace(/\\/g, '/');
}

/** Stable, parser-owned failure envelope. Consumers should branch on code, never message text. */
export class AS3ParseError extends SyntaxError implements AS3ParseDiagnostic {
    code: AS3ParseDiagnosticCode;
    path: string;
    index: number;
    line: number;
    column: number;
    found: string;
    expected: string;
    context: string;

    constructor(code: AS3ParseDiagnosticCode, source: SourceFile, index: number,
            found: string = '', expected: string = '', context: string = '') {
        const safeIndex = Math.max(0, Math.min(index, source.content.length));
        const position = source.getLineAndCharacterFromPosition(safeIndex);
        const path = canonicalPath(source.path);
        const line = position.line + 1;
        const column = position.col + 1;
        const safeFound = oneLine(found);
        const safeExpected = oneLine(expected);
        const safeContext = oneLine(context);
        const detail = [
            safeContext ? `context=${JSON.stringify(safeContext)}` : '',
            safeExpected ? `expected=${JSON.stringify(safeExpected)}` : '',
            safeFound ? `found=${JSON.stringify(safeFound)}` : '',
        ].filter(value => !!value).join(' ');
        super(`${code} ${path}:${line}:${column}${detail ? ' ' + detail : ''}`);
        this.name = 'AS3ParseError';
        this.code = code;
        this.path = path;
        this.index = safeIndex;
        this.line = line;
        this.column = column;
        this.found = safeFound;
        this.expected = safeExpected;
        this.context = safeContext;
        Object.setPrototypeOf(this, AS3ParseError.prototype);
    }
}

export function isAS3ParseError(value: any): value is AS3ParseError {
    return value instanceof AS3ParseError;
}
