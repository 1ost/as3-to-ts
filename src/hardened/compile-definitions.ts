import { verifyIncludeExpansion } from "./source-includes";
import type { NormalizedParserAst, NormalizedParserNode } from "./contracts";
import type { Sha256Function } from "./ledger";

/** Exact compiler inputs, never runtime environment or application substitutions. */
export interface CompileDefinitions {
    schema: "as3-boolean-compile-definitions@1";
    definitions: { [qname: string]: boolean };
}

export function loadCompileDefinitions(json: string): CompileDefinitions {
    const value = JSON.parse(json) as CompileDefinitions;
    if (!value || Object.keys(value).sort().join("|") !== "definitions|schema"
        || value.schema !== "as3-boolean-compile-definitions@1" || !value.definitions
        || typeof value.definitions !== "object" || Array.isArray(value.definitions)
        || Object.keys(value.definitions).length > 256
        || Object.keys(value.definitions).some(key => !/^CONFIG::[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
            || typeof value.definitions[key] !== "boolean")) {
        throw new Error("HARDENED_COMPILE_DEFINITIONS: expected exact Boolean CONFIG definitions");
    }
    const definitions: { [qname: string]: boolean } = Object.create(null);
    Object.keys(value.definitions).sort().forEach(key => { definitions[key] = value.definitions[key]!; });
    return Object.freeze({ schema: value.schema, definitions: Object.freeze(definitions) });
}

export function compileDefinitionsHash(value: CompileDefinitions, sha256: Sha256Function): string {
    return sha256(JSON.stringify(loadCompileDefinitions(JSON.stringify(value))));
}

/** Project parsed statement guards. Original bytes/spans and include provenance survive. */
export function projectCompileDefinitions(ast: NormalizedParserAst, input: CompileDefinitions,
    sha256: Sha256Function, originalSource: string): NormalizedParserAst {
    const source = ast.includeExpansion ? verifyIncludeExpansion(ast.includeExpansion, originalSource, sha256) : originalSource;
    if (sha256(originalSource) !== ast.sourceSha256) throw new Error("HARDENED_COMPILE_SOURCE: source hash differs");
    const config = loadCompileDefinitions(JSON.stringify(input));
    const children = new Map<string, NormalizedParserNode[]>();
    for (const node of ast.nodes) if (node.parentId !== null) {
        const siblings = children.get(node.parentId) || [];
        siblings.push(node); children.set(node.parentId, siblings);
    }
    const nodes: NormalizedParserNode[] = [];
    const guard = (node: NormalizedParserNode): string | null => {
        const parts = children.get(node.id) || [];
        if (node.kind !== "DOT" || node.text !== "::" || parts[0]?.text !== "CONFIG") return null;
        if (parts.length !== 2 || parts[0]!.kind !== "IDENTIFIER"
            || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(parts[1]!.text || ""))
            throw new Error("HARDENED_COMPILE_GUARD: invalid CONFIG reference");
        return "CONFIG::" + parts[1]!.text;
    };
    // AIR resolves configuration names even inside an excluded outer block.
    const byId = new Map(ast.nodes.map(node => [node.id, node]));
    for (const node of ast.nodes) {
        const name = guard(node);
        if (name === null) continue;
        const parent = node.parentId === null ? undefined : byId.get(node.parentId);
        const siblings = parent ? children.get(parent.id) || [] : [];
        const block = siblings[siblings.indexOf(node) + 1];
        if (parent?.kind !== "BLOCK" || !block || block.kind !== "BLOCK" || !node.span || !block.span
            || !/^(?:\s|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*(?:\r?\n|$))*$/.test(source.slice(node.span.end, block.span.start)))
            throw new Error("HARDENED_COMPILE_GUARD: CONFIG requires a standalone guarded statement block");
        if (!Object.prototype.hasOwnProperty.call(config.definitions, name))
            throw new Error("HARDENED_COMPILE_DEFINITION_MISSING: " + name);
    }
    function visit(node: NormalizedParserNode, parentId: string | null, order: number): void {
        if (guard(node)) throw new Error("HARDENED_COMPILE_GUARD: CONFIG requires a standalone guarded statement block");
        const id = "n" + nodes.length;
        nodes.push({ ...node, id, parentId, order });
        let outputOrder = 0;
        function appendChildren(owner: NormalizedParserNode): void {
        const siblings = children.get(owner.id) || [];
        for (let i = 0; i < siblings.length; i++) {
            const child = siblings[i]!, name = guard(child);
            if (name !== null) {
                const block = siblings[++i];
                // AS3 guarded blocks do not introduce a lexical variable scope.
                if (config.definitions[name]) appendChildren(block!);
            } else visit(child, id, outputOrder++);
        }
        }
        appendChildren(node);
    }
    visit(ast.nodes[0]!, null, 0);
    nodes.forEach(node => Object.freeze(node));
    return Object.freeze({ ...ast, nodes, fingerprintSha256: sha256(JSON.stringify(nodes)),
        compileDefinitionsSha256: compileDefinitionsHash(config, sha256) });
}
