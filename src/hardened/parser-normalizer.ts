import Node from "../syntax/node";
import { nodeKindName } from "../syntax/nodeKind";
import { NormalizedParserAst, NormalizedParserNode, SourceSpan } from "./contracts";
import { Sha256Function } from "./ledger";

const SHA256 = /^[0-9a-f]{64}$/;

// This is deliberately the intersection of the hardened parser's node kinds
// and the closed structural vocabulary consumed by adapter.ts. Expanding it is
// an admission decision, not a parser compatibility convenience.
const ADMITTED_KINDS = new Set([
    "ADD", "AND", "ARGUMENTS", "ARRAY", "ARRAY_ACCESSOR", "AS", "ASSIGN", "B_AND", "B_NOT", "B_OR", "B_XOR", "BLOCK", "BREAK", "CALL", "CLASS", "COMPILATION_UNIT", "CONDITION", "CONDITIONAL", "CONST_LIST", "CONTENT", "CONTINUE", "DOT",
    "CASE", "CASES", "CATCH", "COND", "DEFAULT", "DO", "ENCAPSULATED", "EQUALITY", "EXPR_LIST", "EXTENDS", "FINALLY", "FOR", "FOREACH", "FUNCTION", "GET", "IDENTIFIER", "IF", "IMPLEMENTS", "IMPLEMENTS_LIST", "IMPORT", "IN", "INIT", "ITER", "LITERAL", "MODIFIER",
    "MINUS", "MOD_LIST", "MULTIPLICATION", "NAME", "NAME_TYPE_INIT", "NEW", "NOT", "OBJECT", "OP", "PACKAGE", "PARAMETER", "PARAMETER_LIST", "PLUS",
    "OR", "POST_DEC", "POST_INC", "PRE_DEC", "PRE_INC", "PROP", "RELATION", "REST", "RETURN", "SET", "SHIFT", "SWITCH", "SWITCH_BLOCK", "THROW", "TRY", "TYPE", "VALUE", "VAR", "VAR_LIST", "VECTOR", "WHILE",
]);

const RECOVERY_FIELDS = ["diagnostics", "errors", "recovered", "recovery"];

interface ParserTrivia {
    text: string;
    index: number;
    end: number;
}

export class ParserNormalizationError extends Error {
    public readonly code: string;
    public readonly nodeId: string | null;

    public constructor(code: string, message: string, nodeId: string | null = null) {
        super(message);
        this.name = "ParserNormalizationError";
        this.code = code;
        this.nodeId = nodeId;
    }
}

function fail(code: string, message: string, nodeId: string | null = null): never {
    throw new ParserNormalizationError(code, message, nodeId);
}

function isObject(value: unknown): value is { [key: string]: unknown } {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepFreeze<T>(value: T): T {
    if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
        Object.keys(value as unknown as { [key: string]: unknown }).forEach((key) => {
            deepFreeze((value as unknown as { [key: string]: unknown })[key]);
        });
        Object.freeze(value);
    }
    return value;
}

function exactTrivia(value: unknown, sourceText: string, label: string): ParserTrivia {
    if (!isObject(value) || typeof value.text !== "string"
        || !Number.isInteger(value.index) || !Number.isInteger(value.end)) {
        fail("PARSER_NORMALIZER_TRIVIA", label + " is not exact parser trivia");
    }
    const index = Number(value.index);
    const end = Number(value.end);
    if (index < 0 || end < index || end > sourceText.length
        || sourceText.slice(index, end) !== value.text
        || (!value.text.startsWith("//") && !value.text.startsWith("/*"))) {
        fail("PARSER_NORMALIZER_TRIVIA", label + " does not preserve an exact comment span");
    }
    return value as unknown as ParserTrivia;
}

function validateTrivia(root: Node, sourceText: string, nodes: Node[]): void {
    const rootValue = root as unknown as { [key: string]: unknown };
    if (!Array.isArray(rootValue.trivia)) {
        fail("PARSER_NORMALIZER_TRIVIA", "compilation unit must expose the parser's complete trivia list", "n0");
    }
    const complete = rootValue.trivia.map((value, index) =>
        exactTrivia(value, sourceText, "compilation trivia[" + index + "]"));
    const completeObjects = new Set(rootValue.trivia as unknown[]);
    let previousEnd = -1;
    complete.forEach((token, index) => {
        if (token.index < previousEnd) {
            fail("PARSER_NORMALIZER_TRIVIA_ORDER", "compilation trivia is not unique source order", "n0");
        }
        previousEnd = token.end;
        if (index > 0 && token.index === complete[index - 1].index && token.end === complete[index - 1].end) {
            fail("PARSER_NORMALIZER_TRIVIA_ORDER", "compilation trivia contains a duplicate", "n0");
        }
    });
    nodes.forEach((node, nodeIndex) => {
        const value = node as unknown as { [key: string]: unknown };
        if (!Array.isArray(value.leadingTrivia)) {
            fail("PARSER_NORMALIZER_TRIVIA", "parser node lacks its leading trivia list", "n" + nodeIndex);
        }
        value.leadingTrivia.forEach((token, triviaIndex) => {
            exactTrivia(token, sourceText, "n" + nodeIndex + ".leadingTrivia[" + triviaIndex + "]");
            if (!completeObjects.has(token)) {
                fail("PARSER_NORMALIZER_TRIVIA", "leading trivia is absent from complete parser trivia", "n" + nodeIndex);
            }
        });
    });
}

function normalizedText(
    node: Node,
    sourceText: string,
    span: SourceSpan,
    id: string,
): string | null {
    const value = (node as unknown as { text?: unknown }).text;
    if (value === undefined) {
        return null;
    }
    if (typeof value !== "string") {
        fail("PARSER_NORMALIZER_TEXT", "parser node text must be a string or absent", id);
    }
    // Some legacy structural spans begin at their keyword while semantic text
    // names a later token (IMPORT and FUNCTION). The exact text must still be
    // present inside the owning source region; it may never be invented.
    if (value.length > 0 && sourceText.slice(span.start, span.end).indexOf(value) < 0) {
        fail("PARSER_NORMALIZER_TEXT", "parser node text is not exact text within its normalized source span", id);
    }
    return value;
}

function exactSpan(
    node: Node,
    sourceText: string,
    rawSpan: SourceSpan,
    parentSpan: SourceSpan | null,
    siblingBoundary: number,
    childCount: number,
    id: string,
): SourceSpan {
    const value = (node as unknown as { text?: unknown }).text;
    if (childCount !== 0 || typeof value !== "string"
        || sourceText.slice(rawSpan.start, rawSpan.end) === value) {
        return rawSpan;
    }
    const owner = parentSpan === null ? rawSpan : parentSpan;
    const regionStart = Math.max(owner.start, rawSpan.start);
    const regionEnd = Math.min(owner.end, siblingBoundary);
    const start = sourceText.indexOf(value, regionStart);
    const duplicate = start < 0 ? -1 : sourceText.indexOf(value, start + Math.max(1, value.length));
    if (start < 0 || start + value.length > regionEnd
        || (duplicate >= 0 && duplicate + value.length <= regionEnd)) {
        fail("PARSER_NORMALIZER_TEXT", "leaf parser text lacks one unambiguous exact source span in its owner", id);
    }
    return { start, end: start + value.length };
}

function validateRecovery(root: Node): void {
    const value = root as unknown as { [key: string]: unknown };
    const field = RECOVERY_FIELDS.find((name) => Object.prototype.hasOwnProperty.call(value, name));
    if (field !== undefined) {
        fail("PARSER_NORMALIZER_RECOVERY", "parser recovery metadata is never admitted: " + field, "n0");
    }
}

export function normalizeParserAst(
    root: Node,
    sourceText: string,
    sha256: Sha256Function,
): NormalizedParserAst {
    if (!isObject(root) || typeof sourceText !== "string" || typeof sha256 !== "function") {
        fail("PARSER_NORMALIZER_INPUT", "normalizer requires a parser Node, exact source text, and SHA-256 function");
    }
    validateRecovery(root);
    const seen = new Set<Node>();
    const parserNodes: Node[] = [];
    const nodes: NormalizedParserNode[] = [];

    function visit(
        node: Node,
        parentId: string | null,
        order: number,
        parentSpan: SourceSpan | null,
        siblingBoundary: number,
    ): void {
        const id = "n" + nodes.length;
        if (!isObject(node)) {
            fail("PARSER_NORMALIZER_NULL_CHILD", "parser child must be a non-null Node", id);
        }
        if (seen.has(node)) {
            fail("PARSER_NORMALIZER_GRAPH", "parser tree contains a cycle or shared child", id);
        }
        seen.add(node);
        const raw = node as unknown as { [key: string]: unknown };
        if (!Number.isInteger(raw.start) || !Number.isInteger(raw.end)) {
            fail("PARSER_NORMALIZER_SPAN", "parser node span must contain integer offsets", id);
        }
        const rawSpan: SourceSpan = { start: Number(raw.start), end: Number(raw.end) };
        if (rawSpan.start < 0 || rawSpan.end < rawSpan.start || rawSpan.end > sourceText.length
            || (parentSpan !== null && (rawSpan.start < parentSpan.start || rawSpan.end > parentSpan.end))) {
            fail("PARSER_NORMALIZER_SPAN", "parser node has an invalid or escaping source span", id);
        }
        if (!Number.isInteger(raw.kind)) {
            fail("PARSER_NORMALIZER_KIND", "parser node kind must be a known numeric NodeKind", id);
        }
        const kind = nodeKindName(Number(raw.kind));
        if (typeof kind !== "string" || !ADMITTED_KINDS.has(kind)) {
            fail("PARSER_NORMALIZER_UNSUPPORTED_KIND", "parser node kind is unsupported: " + String(kind), id);
        }
        if (!Array.isArray(raw.children)) {
            fail("PARSER_NORMALIZER_CHILDREN", "parser node children must be an array", id);
        }
        const children = raw.children as unknown[];
        const span = exactSpan(node, sourceText, rawSpan, parentSpan, siblingBoundary, children.length, id);
        const output: NormalizedParserNode = {
            id,
            parentId,
            order,
            kind,
            span,
            text: normalizedText(node, sourceText, span, id),
        };
        nodes.push(output);
        parserNodes.push(node);
        children.forEach((child, childIndex) => {
            if (child === null || child === undefined) {
                fail("PARSER_NORMALIZER_NULL_CHILD", "parser child arrays may not contain null placeholders", id);
            }
            const next = children[childIndex + 1] as { start?: unknown } | undefined;
            const nextStart = next && Number.isInteger(next.start) && Number(next.start) > Number(raw.start)
                ? Number(next.start) : span.end;
            visit(child as Node, id, childIndex, span, nextStart);
        });
    }

    visit(root, null, 0, null, sourceText.length);
    if (nodes[0].kind !== "COMPILATION_UNIT" || nodes[0].span!.start !== 0
        || nodes[0].span!.end !== sourceText.length) {
        fail("PARSER_NORMALIZER_ROOT", "compilation unit must cover the exact complete source", "n0");
    }
    validateTrivia(root, sourceText, parserNodes);
    const sourceSha256 = sha256(sourceText);
    const fingerprintSha256 = sha256(JSON.stringify(nodes));
    if (!SHA256.test(sourceSha256) || !SHA256.test(fingerprintSha256)) {
        fail("PARSER_NORMALIZER_HASH", "SHA-256 function returned a non-canonical digest");
    }
    return deepFreeze({
        schema: "authored-ui-as3-flat-ast@1",
        sourceSha256,
        fingerprintSha256,
        nodes,
    });
}
