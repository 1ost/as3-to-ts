import {
    CallExpression,
    CapabilityMapping,
    LoadedCapabilityAuthority,
    LoadedLocalTypeAuthority,
    LocalTypeMapping,
    NormalizedParserAst,
    NormalizedParserNode,
    SemanticClass,
    SemanticCatchClause,
    SemanticConstructor,
    SemanticExpression,
    SemanticField,
    SemanticGetter,
    SemanticIdentity,
    SemanticImport,
    ExpressionStatement,
    LocalDeclarationStatement,
    SemanticLocal,
    SemanticMember,
    SemanticMethod,
    SemanticModifier,
    SemanticParameter,
    SemanticProgram,
    SemanticSetter,
    SemanticStatement,
    SemanticType,
    HardenedSemanticError,
} from "./contracts";
import { assertLoadedCapabilityAuthority, Sha256Function, targetModuleSpecifier } from "./ledger";
import { assertLoadedLocalTypeAuthority } from "./local-types";

interface TreeNode extends NormalizedParserNode {
    children: TreeNode[];
}

interface MethodHeader {
    node: TreeNode;
    name: string;
    modifiers: SemanticModifier[];
    namespaceName: string | null;
    parameters: SemanticParameter[];
    returnType: SemanticType | null;
    block: TreeNode;
    constructor: boolean;
    accessor: "getter" | "setter" | null;
}

interface AccessorPair {
    getter?: MethodHeader;
    setter?: MethodHeader;
}

interface LocalHeader {
    node: TreeNode;
    name: string;
    readonly: boolean;
    type: SemanticType;
    lambdaSignature: { parameters: SemanticParameter[]; returnType: SemanticType } | null;
}

interface AdapterContext {
    className: string;
    classQualifiedName: string;
    extendsType: SemanticType | null;
    importsByLocal: { [name: string]: SemanticImport };
    mappingsBySource: { [name: string]: CapabilityMapping };
    memberMappingsByKey: { [name: string]: CapabilityMapping };
    baseSourceQName: string | null;
    fields: { [name: string]: SemanticField };
    methods: { [name: string]: MethodHeader };
    accessors: { [name: string]: AccessorPair };
    parameters: { [name: string]: SemanticParameter };
    locals: { [name: string]: LocalHeader };
    loopDepth: number;
    breakableDepth: number;
    labels: Array<{ name: string; continuable: boolean }>;
    namespaceNames: { [name: string]: true };
    lambdaDepth: number;
}

const SHA256 = /^[0-9a-f]{64}$/;
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const RESERVED = new Set([
    "await", "break", "case", "catch", "class", "const", "continue", "debugger", "default",
    "delete", "do", "else", "enum", "export", "extends", "false", "finally", "for", "function",
    "if", "implements", "import", "in", "instanceof", "interface", "let", "new", "null", "package",
    "private", "protected", "public", "return", "static", "super", "switch", "this", "throw", "true",
    "try", "typeof", "var", "void", "while", "with", "yield",
]);
const PRIMITIVE_TYPES: { [source: string]: string } = {
    Boolean: "boolean",
    Function: "Function",
    Number: "number",
    Object: "unknown",
    String: "string",
    Array: "Array",
    Class: "Function",
    Error: "Error",
    int: "number",
    uint: "number",
    void: "void",
};
const ALLOWED_MODIFIERS = new Set(["private", "protected", "public", "static", "override"]);
const VECTOR_METHODS = new Set([
    "concat", "every", "filter", "forEach", "indexOf", "join", "lastIndexOf", "map", "pop", "push",
    "reverse", "shift", "slice", "some", "sort", "splice", "toString", "unshift",
]);
const ADAPTED_PROGRAMS = new WeakSet<object>();

function compareUtf8(left: string, right: string): number {
    return left < right ? -1 : left > right ? 1 : 0;
}

function fail(code: string, message: string, node: TreeNode | null = null): never {
    throw new HardenedSemanticError(code, message, node === null ? null : node.id);
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

function isObject(value: unknown): value is { [key: string]: unknown } {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: { [key: string]: unknown }, keys: string[]): boolean {
    const actual = Object.keys(value).sort();
    const expected = keys.slice().sort();
    return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function identity(node: TreeNode): SemanticIdentity {
    return { sourceNodeId: node.id, sourceSpan: node.span };
}

function buildTree(ast: NormalizedParserAst, sourceText: string, sha256: Sha256Function): TreeNode {
    if (!isObject(ast) || !exactKeys(ast, ["fingerprintSha256", "nodes", "schema", "sourceSha256"])
        || ast.schema !== "authored-ui-as3-flat-ast@1" || typeof sourceText !== "string"
        || typeof sha256 !== "function" || !SHA256.test(ast.sourceSha256)
        || !SHA256.test(ast.fingerprintSha256) || !Array.isArray(ast.nodes) || ast.nodes.length === 0) {
        throw new HardenedSemanticError("HARDENED_NORMALIZED_AST", "normalized parser AST has the wrong boundary shape");
    }
    if (sha256(sourceText) !== ast.sourceSha256 || sha256(JSON.stringify(ast.nodes)) !== ast.fingerprintSha256) {
        throw new HardenedSemanticError("HARDENED_NORMALIZED_AST_HASH", "normalized parser AST or source bytes do not match their authenticated SHA-256");
    }
    const nodes: TreeNode[] = [];
    ast.nodes.forEach((raw, index) => {
        if (!isObject(raw) || !exactKeys(raw, ["id", "kind", "order", "parentId", "span", "text"])
            || (raw.span !== null && (!isObject(raw.span) || !exactKeys(raw.span, ["end", "start"])))
            || raw.id !== "n" + index || !Number.isInteger(raw.order) || raw.order < 0
            || typeof raw.kind !== "string" || (raw.text !== null && typeof raw.text !== "string")
            || (raw.span !== null && (!Number.isInteger(raw.span.start) || !Number.isInteger(raw.span.end)
                || raw.span.start < 0 || raw.span.end < raw.span.start || raw.span.end > sourceText.length))) {
            throw new HardenedSemanticError("HARDENED_NORMALIZED_NODE", "normalized parser node identity is invalid", raw.id);
        }
        const node: TreeNode = Object.assign({}, raw, { children: [] });
        if (index === 0) {
            if (raw.parentId !== null || raw.order !== 0) {
                throw new HardenedSemanticError("HARDENED_NORMALIZED_ROOT", "normalized parser root is invalid", raw.id);
            }
        } else {
            if (typeof raw.parentId !== "string" || !/^n[0-9]+$/.test(raw.parentId)) {
                throw new HardenedSemanticError("HARDENED_NORMALIZED_PARENT", "normalized parser parent is invalid", raw.id);
            }
            const parentIndex = Number(raw.parentId.slice(1));
            if (parentIndex >= index || !nodes[parentIndex]) {
                throw new HardenedSemanticError("HARDENED_NORMALIZED_PARENT", "normalized parser parent must precede its child", raw.id);
            }
            nodes[parentIndex]!.children.push(node);
        }
        nodes.push(node);
    });
    nodes.forEach((node) => {
        node.children.sort((left, right) => left.order - right.order);
        node.children.forEach((child, index) => {
            if (child.order !== index) {
                fail("HARDENED_NORMALIZED_ORDER", "normalized sibling orders must be contiguous", child);
            }
        });
    });
    return nodes[0]!;
}

function one(node: TreeNode, kind: string, optional: boolean = false): TreeNode | null {
    const matches = node.children.filter((child) => child.kind === kind);
    if (matches.length === 0 && optional) {
        return null;
    }
    if (matches.length !== 1) {
        fail("HARDENED_AST_CARDINALITY", "expected exactly one " + kind + " child", node);
    }
    return matches[0]!;
}

function onlyKinds(node: TreeNode, allowed: string[]): void {
    const accepted = new Set(allowed);
    const unexpected = node.children.find((child) => !accepted.has(child.kind));
    if (unexpected) {
        fail("HARDENED_UNSUPPORTED_CHILD", "normalized node contains an unsupported child kind: " + unexpected.kind, unexpected);
    }
}

function requiredText(node: TreeNode, label: string): string {
    if (typeof node.text !== "string" || node.text.length === 0) {
        fail("HARDENED_AST_TEXT", label + " must preserve non-empty source text", node);
    }
    return node.text;
}

function validateIdentifier(value: string, node: TreeNode): string {
    if (!IDENTIFIER.test(value) || RESERVED.has(value)) {
        fail("HARDENED_IDENTIFIER", "source identifier is not a valid TypeScript identity", node);
    }
    return value;
}

function parseModifiers(owner: TreeNode, classLevel: boolean): SemanticModifier[] {
    const list = one(owner, "MOD_LIST", true);
    if (list === null) {
        return [];
    }
    const seen: { [modifier: string]: true } = Object.create(null);
    const result: SemanticModifier[] = [];
    list.children.forEach((node) => {
        if (node.kind !== "MODIFIER") {
            fail("HARDENED_MODIFIER_NODE", "modifier list contains an unsupported node", node);
        }
        const modifier = requiredText(node, "modifier");
        if (!ALLOWED_MODIFIERS.has(modifier) || seen[modifier] || (classLevel && modifier !== "public")) {
            fail("HARDENED_MODIFIER", "modifier is unsupported, duplicated, or invalid in this position", node);
        }
        seen[modifier] = true;
        result.push(modifier as SemanticModifier);
    });
    const accessModifiers = result.filter((modifier) =>
        modifier === "private" || modifier === "protected" || modifier === "public");
    if (accessModifiers.length > 1) {
        fail("HARDENED_MODIFIER_ACCESS", "declaration has conflicting access modifiers", owner);
    }
    const staticIndex = result.indexOf("static");
    if (staticIndex >= 0 && accessModifiers.length === 1 && result.indexOf(accessModifiers[0]!) > staticIndex) {
        fail("HARDENED_MODIFIER_ORDER", "access modifier must precede static in the admitted TypeScript order", owner);
    }
    return result;
}

function validateNamespaceIdentifier(value: string, node: TreeNode): string {
    if (!IDENTIFIER.test(value) || value === "__proto__" || value === "prototype" || value === "constructor") {
        fail("HARDENED_NAMESPACE_NAME", "compile-time namespace name is not a safe AS3 identity", node);
    }
    return value;
}

function parseMemberModifiers(owner: TreeNode, context: AdapterContext): {
    modifiers: SemanticModifier[];
    namespaceName: string | null;
} {
    const list = one(owner, "MOD_LIST", true);
    if (list === null) return { modifiers: [], namespaceName: null };
    const seen: { [modifier: string]: true } = Object.create(null);
    const modifiers: SemanticModifier[] = [];
    let namespaceName: string | null = null;
    list.children.forEach((node) => {
        if (node.kind !== "MODIFIER") {
            fail("HARDENED_MODIFIER_NODE", "modifier list contains an unsupported node", node);
        }
        const modifier = requiredText(node, "modifier");
        if (context.namespaceNames[modifier]) {
            if (namespaceName !== null || seen[modifier]) {
                fail("HARDENED_NAMESPACE_MODIFIER", "member namespace modifier is duplicated or ambiguous", node);
            }
            namespaceName = modifier;
            seen[modifier] = true;
            return;
        }
        if (!ALLOWED_MODIFIERS.has(modifier) || seen[modifier]) {
            fail("HARDENED_MODIFIER", "modifier is unsupported or duplicated", node);
        }
        seen[modifier] = true;
        modifiers.push(modifier as SemanticModifier);
    });
    const accessModifiers = modifiers.filter((modifier) =>
        modifier === "private" || modifier === "protected" || modifier === "public");
    if (accessModifiers.length > 1) {
        fail("HARDENED_MODIFIER_ACCESS", "declaration has conflicting access modifiers", owner);
    }
    if (namespaceName !== null && accessModifiers.length > 0) {
        fail("HARDENED_NAMESPACE_MODIFIER", "compile-time namespace replaces the ordinary access modifier", owner);
    }
    const staticIndex = modifiers.indexOf("static");
    if (staticIndex >= 0 && accessModifiers.length === 1 && modifiers.indexOf(accessModifiers[0]!) > staticIndex) {
        fail("HARDENED_MODIFIER_ORDER", "access modifier must precede static in the admitted TypeScript order", owner);
    }
    if (modifiers.indexOf("override") >= 0) {
        const canonical: SemanticModifier[] = [];
        if (accessModifiers.length === 1) canonical.push(accessModifiers[0]!);
        if (staticIndex >= 0) canonical.push("static");
        canonical.push("override");
        return { modifiers: canonical, namespaceName };
    }
    return { modifiers, namespaceName };
}

function mappingForRole(authority: LoadedCapabilityAuthority, qname: string, role: string, node: TreeNode): CapabilityMapping {
    const mapping = authority.typeMappingsBySource[qname];
    if (!mapping || mapping.sourceMember !== null || mapping.sourceRoles.indexOf(role) < 0) {
        fail("HARDENED_CAPABILITY_ROLE", "Flash API " + qname
            + " lacks a double-pinned source/target mapping for role " + role, node);
    }
    return mapping!;
}

function memberMapping(context: AdapterContext, sourceQName: string, access: string, name: string, node: TreeNode): CapabilityMapping | null {
    const matches = Object.keys(context.memberMappingsByKey).map((key) => context.memberMappingsByKey[key])
        .filter((mapping): mapping is CapabilityMapping => mapping !== undefined).filter((mapping) =>
        mapping.sourceQName === sourceQName && mapping.sourceMember !== null
        && mapping.sourceMember.access === access && mapping.sourceMember.name === name);
    if (matches.length > 1) {
        fail("HARDENED_CAPABILITY_MEMBER_OVERLOAD", "Flash API " + sourceQName + "." + name
            + " has multiple mappings and requires a future typed overload resolver", node);
    }
    return matches.length === 1 ? matches[0]! : null;
}

function relativeLocalModule(currentModulePath: string, target: LocalTypeMapping): string {
    const prefix = target.module === "application" ? "game-client/layaair/src/application/" : "game-client/layaair/src/bootstrap/";
    const targetModule = target.targetPath.slice(prefix.length, -3);
    const currentSegments = currentModulePath.split("/");
    currentSegments.pop();
    const targetSegments = targetModule.split("/");
    let shared = 0;
    while (shared < currentSegments.length && shared < targetSegments.length
        && currentSegments[shared] === targetSegments[shared]) shared += 1;
    const relative = currentSegments.slice(shared).map(() => "..").concat(targetSegments.slice(shared)).join("/");
    return relative.startsWith(".") ? relative : `./${relative}`;
}

function oneType(node: TreeNode): TreeNode {
    const matches = node.children.filter(child => child.kind === "TYPE" || child.kind === "VECTOR");
    if (matches.length !== 1) fail("HARDENED_TYPE_CARDINALITY", "declaration requires exactly one type", node);
    return matches[0]!;
}

function parseImports(content: TreeNode, authority: LoadedCapabilityAuthority,
    localAuthority: LoadedLocalTypeAuthority | undefined, resolveCurrentLocal: (() => CurrentLocalType) | null): {
    imports: SemanticImport[];
    importsByLocal: { [name: string]: SemanticImport };
} {
    const imports: SemanticImport[] = [];
    const importsByLocal: { [name: string]: SemanticImport } = Object.create(null);
    const append = (item: SemanticImport, node: TreeNode): void => {
        const prior = importsByLocal[item.sourceLocalName];
        if (prior) {
            if (prior.sourceQualifiedName === item.sourceQualifiedName) return;
            fail("HARDENED_IMPORT_COLLISION", "import local identity is ambiguous across authenticated packages", node);
        }
        imports.push(item);
        importsByLocal[item.sourceLocalName] = item;
    };
    const flashImport = (qname: string, node: TreeNode): SemanticImport => {
        const localName = validateIdentifier(qname.slice(qname.lastIndexOf(".") + 1), node);
        const mapping = mappingForRole(authority, qname, "import", node);
        return Object.assign(identity(node), {
            authorityKind: "flash" as "flash", localNodeId: null,
            runtimeConstructible: mapping.targetKind === "class", runtimeInterface: mapping.targetKind === "interface",
            sourceQualifiedName: qname, sourceLocalName: localName,
            targetModule: targetModuleSpecifier(mapping.targetModule), targetExport: mapping.targetExport,
        });
    };
    const localImport = (target: LocalTypeMapping, currentLocal: CurrentLocalType,
        node: TreeNode): SemanticImport => {
        const localName = validateIdentifier(target.qname.slice(target.qname.lastIndexOf(".") + 1), node);
        return Object.assign(identity(node), {
            authorityKind: "local" as "local", localNodeId: target.nodeId,
            runtimeConstructible: target.typeKind === "class", runtimeInterface: target.typeKind === "interface",
            sourceQualifiedName: target.qname, sourceLocalName: localName,
            targetModule: relativeLocalModule(currentLocal.outputModulePath, target), targetExport: localName,
        });
    };
    content.children.filter((child) => child.kind === "IMPORT").forEach((node) => {
        const qname = requiredText(node, "import");
        if (qname.endsWith(".*")) {
            const prefix = qname.slice(0, -1);
            const flashMatches = Object.keys(authority.typeMappingsBySource)
                .filter(candidate => candidate.startsWith(prefix) && !candidate.slice(prefix.length).includes("."))
                .sort(compareUtf8);
            if (flashMatches.length > 0) {
                flashMatches.forEach(candidate => append(flashImport(candidate, node), node));
                return;
            }
            if (qname.startsWith("flash.")) return;
            if (!localAuthority || !resolveCurrentLocal) {
                fail("HARDENED_LOCAL_IMPORT_AUTHORITY", "project-local wildcard import requires the authenticated dependency type map", node);
            }
            const currentLocal = resolveCurrentLocal();
            const localMatches = localAuthority.entries.filter(target => target.module === currentLocal.entry.module
                && target.qname.startsWith(prefix) && !target.qname.slice(prefix.length).includes(".")
                && target.importable && target.typeKind !== "package"
                && currentLocal.entry.prerequisites.indexOf(target.nodeId) >= 0)
                .sort((left, right) => compareUtf8(left.qname, right.qname));
            // An unused wildcard contributes no emitted binding. Any source identity actually
            // consumed later must still resolve through importsByLocal, so this does not create
            // an open package lookup or a fallback type.
            localMatches.forEach(target => append(localImport(target, currentLocal, node), node));
            return;
        }
        const localName = validateIdentifier(qname.slice(qname.lastIndexOf(".") + 1), node);
        let item: SemanticImport;
        if (authority.typeMappingsBySource[qname]) {
            item = flashImport(qname, node);
        } else {
            if (!localAuthority || !resolveCurrentLocal) {
                fail("HARDENED_LOCAL_IMPORT_AUTHORITY", "project-local import requires the authenticated dependency type map", node);
            }
            const currentLocal = resolveCurrentLocal();
            const target = localAuthority.entriesByIdentity[`${currentLocal.entry.module}\u0000${qname}`];
            if (!target || !target.importable || target.typeKind === "package") {
                fail("HARDENED_LOCAL_IMPORT", "project-local import is absent, non-importable, or not a declared type: " + qname, node);
            }
            if (currentLocal.entry.prerequisites.indexOf(target.nodeId) < 0) {
                fail("HARDENED_LOCAL_IMPORT_EDGE", "project-local import lacks an authenticated dependency edge: " + qname, node);
            }
            item = localImport(target, currentLocal, node);
        }
        append(item, node);
    });
    return { imports, importsByLocal };
}

function semanticType(node: TreeNode, sourceName: string, emittedName: string,
    typeArguments: SemanticType[] = [], nullableOverride?: boolean): SemanticType {
    const nullable = nullableOverride === undefined
        ? !["Boolean", "Number", "int", "uint", "void"].includes(sourceName)
        : nullableOverride;
    return Object.assign(identity(node), { sourceName, emittedName, nullable, typeArguments });
}

function sameUnderlyingType(left: SemanticType, right: SemanticType): boolean {
    return left.sourceName === right.sourceName && left.emittedName === right.emittedName
        && left.typeArguments.length === right.typeArguments.length
        && left.typeArguments.every((item, index) => sameUnderlyingType(item, right.typeArguments[index]!));
}

function sameType(left: SemanticType, right: SemanticType): boolean {
    return left.nullable === right.nullable && sameUnderlyingType(left, right)
        && left.typeArguments.every((item, index) => sameType(item, right.typeArguments[index]!));
}

function withNullability(type: SemanticType, nullable: boolean): SemanticType {
    return Object.assign({}, type, { nullable });
}

function vectorElement(type: SemanticType): SemanticType | null {
    return type.emittedName === "AS3Vector" && type.typeArguments.length === 1 ? type.typeArguments[0]! : null;
}

function parseType(node: TreeNode, context: AdapterContext, allowVoid: boolean): SemanticType {
    if (node.kind === "VECTOR") {
        if (node.children.length !== 1 || (node.children[0]!.kind !== "TYPE" && node.children[0]!.kind !== "VECTOR")) {
            fail("HARDENED_VECTOR_TYPE", "Vector must have exactly one structurally admitted element type", node);
        }
        const element = parseType(node.children[0]!, context, false);
        const primitivePolicy = ["int", "uint", "Number", "Boolean", "String", "Object"].includes(element.sourceName);
        const imported = context.importsByLocal[element.sourceName];
        if (!primitivePolicy && element.sourceName !== context.className && element.emittedName !== "AS3Vector"
            && (!imported || !imported.runtimeConstructible)) {
            fail("HARDENED_VECTOR_ELEMENT_RUNTIME", "Vector reference element requires a proven runtime class identity", node.children[0]!);
        }
        return semanticType(node, `Vector.<${element.sourceName}>`, "AS3Vector", [element]);
    }
    if (node.kind !== "TYPE") {
        fail("HARDENED_TYPE_NODE", "only named or Vector source types are admitted", node);
    }
    const sourceName = requiredText(node, "type");
    if (sourceName === "void" && !allowVoid) {
        fail("HARDENED_VOID_TYPE", "void is not valid in this type position", node);
    }
    let emittedName = PRIMITIVE_TYPES[sourceName];
    if (!emittedName) {
        if (sourceName === context.className) {
            emittedName = sourceName;
        } else if (context.importsByLocal[sourceName]) {
            emittedName = sourceName;
        } else {
            fail("HARDENED_TYPE_UNMAPPED", "source type " + sourceName
                + " is not a proven primitive or double-pinned import", node);
        }
    }
    return semanticType(node, sourceName, emittedName);
}

function parseParameters(list: TreeNode, context: AdapterContext): SemanticParameter[] {
    onlyKinds(list, ["PARAMETER"]);
    const seen: { [name: string]: true } = Object.create(null);
    let sawDefault = false;
    return list.children.map((parameter, parameterIndex) => {
        if (parameter.kind !== "PARAMETER") {
            fail("HARDENED_PARAMETER_NODE", "only ordinary required parameters are admitted", parameter);
        }
        onlyKinds(parameter, ["NAME_TYPE_INIT", "REST"]);
        const restNode = one(parameter, "REST", true);
        if (restNode !== null) {
            if (parameter.children.length !== 1 || parameterIndex !== list.children.length - 1 || sawDefault) {
                fail("HARDENED_PARAMETER_REST", "rest parameter must be the final parameter and cannot follow a default", parameter);
            }
            const name = validateIdentifier(requiredText(restNode, "rest parameter name"), restNode);
            if (seen[name]) fail("HARDENED_PARAMETER_DUPLICATE", "parameter identity is duplicated", restNode);
            seen[name] = true;
            return Object.assign(identity(parameter), {
                defaultValue: null, name, rest: true, type: semanticType(restNode, "*", "unknown"),
            });
        }
        const declaration = one(parameter, "NAME_TYPE_INIT")!;
        onlyKinds(declaration, ["NAME", "TYPE", "VECTOR", "INIT"]);
        const nameNode = one(declaration, "NAME")!;
        const name = validateIdentifier(requiredText(nameNode, "parameter name"), nameNode);
        if (seen[name]) {
            fail("HARDENED_PARAMETER_DUPLICATE", "parameter identity is duplicated", nameNode);
        }
        seen[name] = true;
        const parameterType = parseType(oneType(declaration), context, false);
        const init = one(declaration, "INIT", true);
        let defaultValue: SemanticExpression | null = null;
        if (init !== null) {
            if (init.children.length !== 1 || (init.children[0]!.kind !== "LITERAL"
                && init.children[0]!.kind !== "IDENTIFIER")) {
                fail("HARDENED_PARAMETER_DEFAULT", "default parameter must be one admitted scalar literal", init);
            }
            const rawDefault = init.children[0]!;
            defaultValue = parseLiteral(rawDefault.kind === "IDENTIFIER"
                ? Object.assign({}, rawDefault, { kind: "LITERAL" }) : rawDefault);
            if (defaultValue.kind !== "literal") {
                fail("HARDENED_PARAMETER_DEFAULT", "default parameter must normalize to one scalar literal", init);
            }
            assertAssignmentCompatible(parameterType, assignmentType(defaultValue, context, init.children[0]!), init);
            sawDefault = true;
        } else if (sawDefault) {
            fail("HARDENED_PARAMETER_ORDER", "required parameter cannot follow a default parameter", declaration);
        }
        return Object.assign(identity(parameter), {
            defaultValue, name, rest: false, type: parameterType,
        });
    });
}

function admittedArity(parameters: SemanticParameter[], argumentCount: number): boolean {
    const minimum = parameters.filter(parameter => parameter.defaultValue === null && !parameter.rest).length;
    return argumentCount >= minimum && (parameters.some(parameter => parameter.rest) || argumentCount <= parameters.length);
}

function parseLiteral(node: TreeNode): SemanticExpression {
    const text = requiredText(node, "literal");
    let value: string | number | boolean | null;
    if (text === "true" || text === "false") {
        value = text === "true";
    } else if (text === "null") {
        value = null;
    } else if (/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(text)) {
        value = Number(text);
        if (!Number.isFinite(value)) {
            fail("HARDENED_LITERAL_NUMBER", "numeric literal is outside the finite subset", node);
        }
    } else if (text.startsWith('"') && text.endsWith('"')) {
        try {
            value = JSON.parse(text);
        } catch (_error) {
            fail("HARDENED_LITERAL_STRING", "string literal is not canonical JSON-compatible source", node);
        }
    } else {
        fail("HARDENED_LITERAL", "literal is outside the admitted scalar subset", node);
    }
    return Object.assign(identity(node), { kind: "literal" as "literal", value });
}

interface CurrentLocalType {
    entry: LocalTypeMapping;
    outputModulePath: string;
}

function implicitThisMember(node: TreeNode, name: string, capabilitySource: string | null = null): SemanticExpression {
    const target = Object.assign(identity(node), { kind: "this" as "this" });
    return Object.assign(identity(node), {
        kind: "member" as "member", target, targetNullable: false, name, capabilitySource,
    });
}

function assignmentType(expression: SemanticExpression, context: AdapterContext, node: TreeNode): SemanticType {
    if (expression.kind === "this") return semanticType(node, context.className, context.className, [], false);
    if (expression.kind === "identifier" && context.locals[expression.name]) {
        return context.locals[expression.name]!.type;
    }
    if (expression.kind === "identifier" && context.parameters[expression.name]) {
        return context.parameters[expression.name]!.type;
    }
    if (expression.kind === "member" && expression.target.kind === "this" && context.fields[expression.name]) {
        return context.fields[expression.name]!.type;
    }
    if (expression.kind === "member" && expression.target.kind === "this"
        && context.accessors[expression.name]?.getter) {
        return context.accessors[expression.name]!.getter!.returnType!;
    }
    if (expression.kind === "member") {
        const ownerType = assignmentType(expression.target, context, node);
        if (vectorElement(ownerType) !== null) {
            if (expression.name === "length") return semanticType(node, "uint", "number");
            if (expression.name === "fixed") return semanticType(node, "Boolean", "boolean");
        }
    }
    if (expression.kind === "literal") {
        if (expression.value === null) {
            return semanticType(node, "null", "null", [], true);
        }
        const sourceName = typeof expression.value === "number" ? "Number"
            : typeof expression.value === "string" ? "String" : "Boolean";
        return semanticType(node, sourceName, PRIMITIVE_TYPES[sourceName]!, [], false);
    }
    if (expression.kind === "methodClosure") {
        return semanticType(node, "Function", "Function", [], false);
    }
    if (expression.kind === "lambda") {
        return semanticType(node, "Function", "Function", [], false);
    }
    if (expression.kind === "object") return semanticType(node, "Object", "unknown", [], false);
    if (expression.kind === "new") {
        return withNullability(expression.sourceType, false);
    }
    if (expression.kind === "binary") {
        return expression.resultType;
    }
    if (expression.kind === "unary") {
        return expression.resultType;
    }
    if (expression.kind === "parenthesized") {
        return expression.resultType;
    }
    if (expression.kind === "conditional" || expression.kind === "update" || expression.kind === "index") {
        return expression.resultType;
    }
    if (expression.kind === "vectorConversion") return expression.vectorType;
    if (expression.kind === "runtimeType") return expression.resultType;
    if (expression.kind === "coercion") return expression.targetType;
    if (expression.kind === "assignment") {
        return assignmentTargetType(expression.target, context, node);
    }
    if (expression.kind === "call" && expression.resultType !== null) return expression.resultType;
    fail("HARDENED_ASSIGNMENT_TYPE", "assignment value type is not statically proven in the admitted subset", node);
}

function assignmentTargetType(expression: SemanticExpression, context: AdapterContext, node: TreeNode): SemanticType {
    if (expression.kind === "identifier" && context.locals[expression.name]) {
        const local = context.locals[expression.name]!;
        if (local.readonly) fail("HARDENED_ASSIGNMENT_READONLY", "local const is not writable", node);
        return local.type;
    }
    if (expression.kind === "identifier" && context.parameters[expression.name]) {
        return context.parameters[expression.name]!.type;
    }
    if (expression.kind === "member" && expression.target.kind === "this" && context.fields[expression.name]) {
        const field = context.fields[expression.name]!;
        if (field.readonly) {
            fail("HARDENED_ASSIGNMENT_READONLY", "AS3 const fields are not writable", node);
        }
        if (field.modifiers.indexOf("static") >= 0) {
            fail("HARDENED_ASSIGNMENT_STATIC", "static fields require class-qualified lowering", node);
        }
        return field.type;
    }
    if (expression.kind === "member" && expression.target.kind === "this"
        && context.accessors[expression.name]?.setter) {
        const setter = context.accessors[expression.name]!.setter!;
        if (setter.modifiers.indexOf("static") >= 0) {
            fail("HARDENED_ASSIGNMENT_STATIC", "static accessors require class-qualified lowering", node);
        }
        return setter.parameters[0]!.type;
    }
    if (expression.kind === "member") {
        const ownerType = assignmentType(expression.target, context, node);
        if (vectorElement(ownerType) !== null) {
            if (expression.name === "length") return semanticType(node, "uint", "number");
            if (expression.name === "fixed") return semanticType(node, "Boolean", "boolean");
        }
    }
    if (expression.kind === "index") return expression.resultType;
    fail("HARDENED_ASSIGNMENT_TARGET", "assignment target is not a writable parameter or instance field", node);
}

function assertAssignmentCompatible(target: SemanticType, value: SemanticType, node: TreeNode): void {
    if ((value.sourceName === "null" && target.nullable)
        || (sameUnderlyingType(target, value) && (target.nullable || !value.nullable))
        || target.sourceName === "Object" || sameType(target, value)
        || (["Number", "int", "uint"].includes(target.sourceName)
            && ["Number", "int", "uint"].includes(value.sourceName))) {
        return;
    }
    fail("HARDENED_ASSIGNMENT_TYPE", "assignment requires exact proven source types; implicit AS3 coercion is held", node);
}

function parseExpression(node: TreeNode, context: AdapterContext, valuePosition: boolean,
    allowSuperCall: boolean = false, allowMethodClosure: boolean = true,
    allowAssignment: boolean = false): SemanticExpression {
    if (node.kind === "LITERAL") {
        return parseLiteral(node);
    }
    if (node.kind === "ARRAY") {
        return Object.assign(identity(node), {
            kind: "array" as "array",
            elements: node.children.map(child => parseExpression(child, context, true)),
        });
    }
    if (node.kind === "OBJECT") {
        const seen = new Set<string>();
        const properties = node.children.map(property => {
            if (property.kind !== "PROP") fail("HARDENED_OBJECT_PROPERTY", "object literal requires property nodes", property);
            onlyKinds(property, ["NAME", "VALUE"]);
            const nameNode = one(property, "NAME")!;
            const valueNode = one(property, "VALUE")!;
            if (valueNode.children.length !== 1) {
                fail("HARDENED_OBJECT_VALUE", "object property requires exactly one value expression", valueNode);
            }
            const rawName = requiredText(nameNode, "object property name");
            let name: string;
            if (rawName.startsWith('"') && rawName.endsWith('"')) {
                try { name = JSON.parse(rawName); } catch (_error) {
                    fail("HARDENED_OBJECT_NAME", "quoted object property name must be canonical JSON string source", nameNode);
                }
                if (typeof name !== "string") fail("HARDENED_OBJECT_NAME", "object property name must be a string", nameNode);
            } else {
                name = validateIdentifier(rawName, nameNode);
            }
            if (["__proto__", "prototype", "constructor"].includes(name) || seen.has(name)) {
                fail("HARDENED_OBJECT_NAME", "object property identity is dangerous or duplicated", nameNode);
            }
            seen.add(name);
            return Object.assign(identity(property), {
                name, value: parseExpression(valueNode.children[0]!, context, true),
            });
        });
        return Object.assign(identity(node), { kind: "object" as "object", properties });
    }
    if (node.kind === "NEW") {
        if (node.children.length !== 1 || node.children[0]!.kind !== "CALL") {
            fail("HARDENED_NEW_SHAPE", "constructor expression must contain exactly one direct call", node);
        }
        const call = node.children[0]!;
        if (call.children.length !== 2 || (call.children[0]!.kind !== "IDENTIFIER" && call.children[0]!.kind !== "VECTOR")
            || call.children[1]!.kind !== "ARGUMENTS") {
            fail("HARDENED_NEW_TARGET", "constructor target must be one local or double-pinned imported class", call);
        }
        const nameNode = call.children[0]!;
        if (nameNode.kind === "VECTOR") {
            const sourceType = parseType(nameNode, context, false);
            const args = call.children[1]!.children.map(child => parseExpression(child, context, true));
            if (args.length > 2) fail("HARDENED_VECTOR_CONSTRUCTOR_ARITY", "Vector constructor accepts length and fixed only", call);
            if (args[0]) {
                const lengthType = assignmentType(args[0], context, call.children[1]!.children[0]!);
                if (!["Number", "int", "uint"].includes(lengthType.sourceName)) {
                    fail("HARDENED_VECTOR_LENGTH", "Vector length must be a proven numeric value", call.children[1]!.children[0]!);
                }
            }
            if (args[1] && assignmentType(args[1], context, call.children[1]!.children[1]!).sourceName !== "Boolean") {
                fail("HARDENED_VECTOR_FIXED", "Vector fixed argument must be a proven Boolean", call.children[1]!.children[1]!);
            }
            return Object.assign(identity(node), { kind: "new" as "new", sourceType, arguments: args });
        }
        const name = validateIdentifier(requiredText(nameNode, "constructor target"), nameNode);
        const args = call.children[1]!.children.map((child) => parseExpression(child, context, true));
        let sourceType: SemanticType;
        if (name === context.className) {
            const local = context.methods[name];
            if (!local || !local.constructor || !admittedArity(local.parameters, args.length)) {
                fail("HARDENED_NEW_LOCAL_ARITY", "local constructor call does not match its exact declaration", call);
            }
            args.forEach((argument, index) => assertAssignmentCompatible(
                local.parameters[index]!.type,
                assignmentType(argument, context, call.children[1]!.children[index]!),
                call.children[1]!.children[index]!,
            ));
            sourceType = semanticType(nameNode, name, name);
        } else {
            const imported = context.importsByLocal[name];
            const typeMapping = imported ? context.mappingsBySource[imported.sourceQualifiedName] : undefined;
            if (!imported || !typeMapping || typeMapping.sourceRoles.indexOf("constructor") < 0) {
                fail("HARDENED_NEW_AUTHORITY", "constructor target lacks a double-pinned source and target constructor", nameNode);
            }
            if (args.length !== 0) {
                fail("HARDENED_NEW_ARGUMENT_TYPES",
                    "imported constructor arguments remain held until every source parameter type is structurally mapped", call);
            }
            const matches = Object.keys(context.memberMappingsByKey)
                .map((key) => context.memberMappingsByKey[key])
                .filter((mapping): mapping is CapabilityMapping => mapping !== undefined)
                .filter((mapping) => mapping.sourceQName === imported.sourceQualifiedName
                    && mapping.sourceRoles.indexOf("constructor") >= 0
                    && mapping.sourceMember !== null && mapping.sourceMember.name === name
                    && mapping.targetMember !== null && mapping.targetMember.kind === "constructor"
                    && args.length >= mapping.sourceMember.minArgs && args.length <= mapping.sourceMember.maxArgs);
            if (matches.length !== 1) {
                fail("HARDENED_NEW_ARITY", "constructor arity lacks one exact double-pinned signature", call);
            }
            sourceType = semanticType(nameNode, name, name);
        }
        return Object.assign(identity(node), { kind: "new" as "new", sourceType, arguments: args });
    }
    if (node.kind === "RELATION" && node.children.length === 3
        && (node.children[1]!.kind === "AS" || (node.children[1]!.kind === "OP"
            && ["as", "is"].includes(String(node.children[1]!.text))))) {
        const operatorText = requiredText(node.children[1]!, "runtime type operator");
        if (operatorText !== "as" && operatorText !== "is") {
            fail("HARDENED_RUNTIME_TYPE_OPERATOR", "runtime type expression requires as or is", node.children[1]!);
        }
        const operator = operatorText as "as" | "is";
        const value = parseExpression(node.children[0]!, context, true);
        const rawTarget = node.children[2]!;
        let targetType: SemanticType;
        if (rawTarget.kind === "VECTOR") {
            targetType = parseType(rawTarget, context, false);
        } else if (rawTarget.kind === "IDENTIFIER") {
            targetType = parseType(Object.assign({}, rawTarget, { kind: "TYPE" }), context, false);
        } else {
            fail("HARDENED_RUNTIME_TYPE_TARGET", "runtime type target must be a named class, primitive, or Vector", rawTarget);
        }
        const runtimePrimitives = new Set(["int", "uint", "Number", "Boolean", "String", "Object", "Array", "Class", "Function"]);
        let targetKind: "primitive" | "class" | "interface" | "vector";
        let runtimeName = targetType.sourceName;
        if (targetType.emittedName === "AS3Vector") {
            targetKind = "vector";
        } else if (runtimePrimitives.has(targetType.sourceName)) {
            targetKind = "primitive";
        } else if (context.importsByLocal[targetType.sourceName]?.runtimeInterface) {
            targetKind = "interface";
            runtimeName = context.importsByLocal[targetType.sourceName]!.sourceQualifiedName;
        } else if (targetType.sourceName === context.className
            || context.importsByLocal[targetType.sourceName]?.runtimeConstructible) {
            targetKind = "class";
            runtimeName = targetType.sourceName === context.className ? context.classQualifiedName
                : context.importsByLocal[targetType.sourceName]!.sourceQualifiedName;
        } else {
            fail("HARDENED_RUNTIME_TYPE_IDENTITY", "runtime type target lacks a proven class or primitive identity", rawTarget);
        }
        const resultType = operator === "is" ? semanticType(node, "Boolean", "boolean") : targetType;
        return Object.assign(identity(node), {
            kind: "runtimeType" as "runtimeType", operator, value, targetType, targetKind, runtimeName, resultType,
        });
    }
    if (node.kind === "B_AND" || node.kind === "B_OR" || node.kind === "B_XOR" || node.kind === "SHIFT") {
        if (node.children.length !== 3 || node.children[1]!.kind !== "OP") {
            fail("HARDENED_BITWISE_SHAPE", "bitwise expression requires exactly one operator and two operands", node);
        }
        const operator = requiredText(node.children[1]!, "bitwise operator");
        const admitted = new Set(["&", "|", "^", "<<", ">>", ">>>"]);
        if (!admitted.has(operator)) fail("HARDENED_BITWISE_OPERATOR", "bitwise operator is unsupported", node.children[1]!);
        const left = parseExpression(node.children[0]!, context, true);
        const right = parseExpression(node.children[2]!, context, true);
        const numeric = (type: SemanticType): boolean => ["Number", "int", "uint"].includes(type.sourceName)
            && type.emittedName === "number";
        if (!numeric(assignmentType(left, context, node.children[0]!))
            || !numeric(assignmentType(right, context, node.children[2]!))) {
            fail("HARDENED_BITWISE_TYPE", "bitwise operands require proven numeric values", node);
        }
        const resultType = semanticType(node, operator === ">>>" ? "uint" : "int", "number");
        return Object.assign(identity(node), {
            kind: "binary" as "binary",
            operator: operator as "&" | "|" | "^" | "<<" | ">>" | ">>>", left, right, resultType,
        });
    }
    if (node.kind === "RELATION" || node.kind === "EQUALITY" || node.kind === "AND" || node.kind === "OR"
        || node.kind === "ADD" || (node.kind === "MINUS" && node.children.length === 3)
        || node.kind === "MULTIPLICATION") {
        if (node.children.length !== 3 || node.children[1]!.kind !== "OP") {
            fail("HARDENED_BINARY_SHAPE", "binary expression must contain exactly one operator and two operands", node);
        }
        const operator = requiredText(node.children[1]!, "binary operator");
        const admitted = new Set(["<", "<=", ">", ">=", "===", "!==", "&&", "||", "+", "-", "*", "/", "%"]);
        if (!admitted.has(operator)) {
            fail("HARDENED_BINARY_OPERATOR", "coercive or runtime-dependent binary operator remains held", node.children[1]!);
        }
        const left = parseExpression(node.children[0]!, context, true);
        const right = parseExpression(node.children[2]!, context, true);
        const leftType = assignmentType(left, context, node.children[0]!);
        const rightType = assignmentType(right, context, node.children[2]!);
        const nullComparison = (leftType.sourceName === "null" && rightType.nullable)
            || (rightType.sourceName === "null" && leftType.nullable);
        const strictEquality = operator === "===" || operator === "!==";
        if (!sameType(leftType, rightType)
            && !(strictEquality && (nullComparison || sameUnderlyingType(leftType, rightType)))) {
            fail("HARDENED_BINARY_TYPE", "binary operands require the exact same proven source type", node);
        }
        if ((operator === "&&" || operator === "||") && leftType.sourceName !== "Boolean") {
            fail("HARDENED_BINARY_BOOLEAN", "logical operators require exact Boolean operands", node);
        }
        if (["<", "<=", ">", ">="].indexOf(operator) >= 0
            && leftType.sourceName !== "Number" && leftType.sourceName !== "String") {
            fail("HARDENED_BINARY_RELATION", "ordered relations require exact Number or String operands", node);
        }
        if (["-", "*", "/", "%"].indexOf(operator) >= 0 && leftType.sourceName !== "Number") {
            fail("HARDENED_BINARY_NUMBER", "numeric operators require exact Number operands", node);
        }
        if (operator === "+" && leftType.sourceName !== "Number" && leftType.sourceName !== "String") {
            fail("HARDENED_BINARY_ADD", "addition requires exact Number or exact String operands", node);
        }
        const booleanResult = ["<", "<=", ">", ">=", "===", "!==", "&&", "||"].indexOf(operator) >= 0;
        const resultType = booleanResult
            ? semanticType(node, "Boolean", "boolean")
            : leftType;
        return Object.assign(identity(node), {
            kind: "binary" as "binary",
            operator: operator as "<" | "<=" | ">" | ">=" | "===" | "!==" | "&&" | "||" |
                "+" | "-" | "*" | "/" | "%",
            left, right, resultType,
        });
    }
    if (node.kind === "PLUS" || node.kind === "MINUS" || node.kind === "NOT" || node.kind === "B_NOT") {
        if (node.children.length !== 1) {
            fail("HARDENED_UNARY_SHAPE", "unary expression requires exactly one operand", node);
        }
        const operand = parseExpression(node.children[0]!, context, true);
        const operandType = assignmentType(operand, context, node.children[0]!);
        const operator = node.kind === "PLUS" ? "+" : node.kind === "MINUS" ? "-" : node.kind === "NOT" ? "!" : "~";
        if (operator === "!" && operandType.sourceName !== "Boolean") {
            fail("HARDENED_UNARY_BOOLEAN", "logical negation requires exact Boolean input", node);
        }
        if (operator === "~" && (!["Number", "int", "uint"].includes(operandType.sourceName)
            || operandType.emittedName !== "number")) {
            fail("HARDENED_UNARY_BITWISE", "bitwise complement requires a proven numeric input", node);
        }
        if (operator !== "!" && operator !== "~" && operandType.sourceName !== "Number") {
            fail("HARDENED_UNARY_NUMBER", "numeric unary operators require exact Number input", node);
        }
        return Object.assign(identity(node), {
            kind: "unary" as "unary", operator: operator as "+" | "-" | "!" | "~", operand,
            resultType: operator === "~" ? semanticType(node, "int", "number") : operandType,
        });
    }
    if (node.kind === "ENCAPSULATED") {
        if (node.children.length !== 1) {
            fail("HARDENED_PARENTHESIZED_SHAPE", "parenthesized expression requires exactly one expression", node);
        }
        const expression = parseExpression(node.children[0]!, context, true);
        return Object.assign(identity(node), {
            kind: "parenthesized" as "parenthesized", expression,
            resultType: assignmentType(expression, context, node.children[0]!),
        });
    }
    if (node.kind === "CONDITIONAL") {
        if (node.children.length !== 3) {
            fail("HARDENED_CONDITIONAL_SHAPE", "conditional expression requires condition, true, and false branches", node);
        }
        const condition = parseExpression(node.children[0]!, context, true);
        const conditionType = assignmentType(condition, context, node.children[0]!);
        if (conditionType.sourceName !== "Boolean" || conditionType.emittedName !== "boolean") {
            fail("HARDENED_CONDITIONAL_BOOLEAN", "conditional expression requires an exact Boolean condition", node.children[0]!);
        }
        const whenTrue = parseExpression(node.children[1]!, context, true);
        const whenFalse = parseExpression(node.children[2]!, context, true);
        const trueType = assignmentType(whenTrue, context, node.children[1]!);
        const falseType = assignmentType(whenFalse, context, node.children[2]!);
        const trueNull = trueType.sourceName === "null" && falseType.nullable;
        const falseNull = falseType.sourceName === "null" && trueType.nullable;
        if (!sameType(trueType, falseType) && !trueNull && !falseNull) {
            fail("HARDENED_CONDITIONAL_TYPE", "conditional branches require the exact same proven source type", node);
        }
        const resultType = trueNull ? falseType : falseNull ? trueType : trueType;
        return Object.assign(identity(node), {
            kind: "conditional" as "conditional", condition, whenTrue, whenFalse,
            resultType: withNullability(resultType, trueNull || falseNull || resultType.nullable),
        });
    }
    if (node.kind === "PRE_INC" || node.kind === "PRE_DEC" || node.kind === "POST_INC" || node.kind === "POST_DEC") {
        if (node.children.length !== 1) {
            fail("HARDENED_UPDATE_SHAPE", "update expression requires exactly one writable target", node);
        }
        const parsedTarget = parseExpression(node.children[0]!, context, false);
        if (parsedTarget.kind !== "identifier" && parsedTarget.kind !== "member" && parsedTarget.kind !== "index") {
            fail("HARDENED_UPDATE_TARGET", "update target must be a proven writable identity", node.children[0]!);
        }
        const resultType = assignmentTargetType(parsedTarget, context, node.children[0]!);
        if (!["Number", "int", "uint"].includes(resultType.sourceName) || resultType.emittedName !== "number") {
            fail("HARDENED_UPDATE_NUMBER", "increment and decrement require an exact writable Number", node);
        }
        return Object.assign(identity(node), {
            kind: "update" as "update",
            operator: (node.kind === "PRE_INC" || node.kind === "POST_INC" ? "++" : "--") as "++" | "--",
            prefix: node.kind === "PRE_INC" || node.kind === "PRE_DEC",
            target: parsedTarget,
            resultType,
        });
    }
    if (node.kind === "LAMBDA") {
        onlyKinds(node, ["BLOCK", "PARAMETER_LIST", "TYPE", "VECTOR"]);
        const parameters = parseParameters(one(node, "PARAMETER_LIST")!, context);
        const returnType = parseType(oneType(node), context, true);
        const block = one(node, "BLOCK")!;
        const priorParameters = context.parameters;
        const priorLocals = context.locals;
        const priorLoopDepth = context.loopDepth;
        const priorBreakableDepth = context.breakableDepth;
        const priorLabels = context.labels;
        context.parameters = Object.assign(Object.create(null), priorParameters);
        parameters.forEach(parameter => { context.parameters[parameter.name] = parameter; });
        context.locals = Object.assign(Object.create(null), priorLocals);
        context.loopDepth = 0;
        context.breakableDepth = 0;
        context.labels = [];
        context.lambdaDepth += 1;
        let statements: SemanticStatement[];
        try {
            predeclareLocals(block, context);
            statements = parseBlock(block, context, false, false, returnType, false);
        } finally {
            context.lambdaDepth -= 1;
            context.parameters = priorParameters;
            context.locals = priorLocals;
            context.loopDepth = priorLoopDepth;
            context.breakableDepth = priorBreakableDepth;
            context.labels = priorLabels;
        }
        if (returnType.sourceName !== "void" && !statementsAlwaysReturn(statements)) {
            fail("HARDENED_LAMBDA_RETURN_PATH", "non-void lambda must return a proven value on every admitted path", node);
        }
        return Object.assign(identity(node), {
            kind: "lambda" as "lambda", parameters, returnType, statements,
        });
    }
    if (node.kind === "IDENTIFIER") {
        const name = requiredText(node, "identifier");
        if (name === "true" || name === "false" || name === "null") {
            return parseLiteral(Object.assign({}, node, { kind: "LITERAL", text: name }));
        }
        if (name === "this") {
            if (context.lambdaDepth > 0) {
                fail("HARDENED_LAMBDA_THIS", "anonymous functions using dynamic AS3 this remain held", node);
            }
            return Object.assign(identity(node), { kind: "this" as "this" });
        }
        if (name === "super") {
            fail("HARDENED_SUPER_CONTEXT", "super is admitted only as the first zero-argument statement of a derived constructor", node);
        }
        if (context.locals[name] || context.parameters[name] || context.importsByLocal[name]) {
            return Object.assign(identity(node), { kind: "identifier" as "identifier", name });
        }
        if (context.fields[name]) {
            if (context.lambdaDepth > 0) fail("HARDENED_LAMBDA_THIS", "implicit this in anonymous functions remains held", node);
            return implicitThisMember(node, name);
        }
        if (context.accessors[name]) {
            if (context.lambdaDepth > 0) fail("HARDENED_LAMBDA_THIS", "implicit this in anonymous functions remains held", node);
            const accessor = context.accessors[name]!;
            if (valuePosition && !accessor.getter) {
                fail("HARDENED_ACCESSOR_WRITE_ONLY", "write-only accessor cannot be read", node);
            }
            if ((accessor.getter?.modifiers.indexOf("static") ?? -1) >= 0
                || (accessor.setter?.modifiers.indexOf("static") ?? -1) >= 0) {
                fail("HARDENED_ACCESSOR_STATIC", "static accessors require class-qualified lowering", node);
            }
            return implicitThisMember(node, name);
        }
        if (context.methods[name]) {
            if (context.lambdaDepth > 0) fail("HARDENED_LAMBDA_THIS", "implicit this in anonymous functions remains held", node);
            const method = context.methods[name]!;
            if (valuePosition) {
                if (!allowMethodClosure) {
                    fail("HARDENED_METHOD_CLOSURE_INITIALIZER", "method closures in field initializers are not admitted before per-instance binding", node);
                }
                if (method.constructor || method.modifiers.indexOf("static") >= 0) {
                    fail("HARDENED_METHOD_CLOSURE_SCOPE", "only non-static instance methods have admitted AS3 closure identity", node);
                }
                return Object.assign(identity(node), { kind: "methodClosure" as "methodClosure", methodName: name });
            }
            if (method.constructor || method.modifiers.indexOf("static") >= 0) {
                fail("HARDENED_METHOD_INSTANCE_SCOPE", "constructor or static method cannot be resolved through implicit this", node);
            }
            return implicitThisMember(node, name);
        }
        {
            fail("HARDENED_IDENTIFIER_SCOPE", "identifier is not a parameter or proven import", node);
        }
    }
    if (node.kind === "ASSIGN") {
        if (!allowAssignment || valuePosition || node.children.length !== 3 || node.children[1]!.kind !== "OP") {
            fail("HARDENED_ASSIGNMENT_CONTEXT", "assignment is admitted only as one top-level expression statement", node);
        }
        const operator = requiredText(node.children[1]!, "assignment operator");
        const target = parseExpression(node.children[0]!, context, false);
        if (target.kind !== "identifier" && target.kind !== "member" && target.kind !== "index") {
            fail("HARDENED_ASSIGNMENT_TARGET", "assignment target is not a writable lvalue", node.children[0]!);
        }
        const targetType = assignmentTargetType(target, context, node.children[0]!);
        let value = parseExpression(node.children[2]!, context, true);
        const valueType = assignmentType(value, context, node.children[2]!);
        if (operator === "=") {
            assertAssignmentCompatible(targetType, valueType, node);
        } else {
            const binaryOperator = operator.slice(0, -1);
            if (!["+", "-", "*", "/", "%", "&", "|", "^", "<<", ">>", ">>>", "&&", "||"].includes(binaryOperator)) {
                fail("HARDENED_ASSIGNMENT_OPERATOR", "compound assignment operator is unsupported", node.children[1]!);
            }
            if (target.kind === "index" || (target.kind === "member" && target.target.kind !== "this")) {
                fail("HARDENED_COMPOUND_TARGET", "compound assignment requires a once-evaluated local, parameter, or direct this field", node.children[0]!);
            }
            const numeric = (type: SemanticType): boolean => ["Number", "int", "uint"].includes(type.sourceName)
                && type.emittedName === "number";
            const stringAdd = binaryOperator === "+" && targetType.sourceName === "String"
                && valueType.sourceName === "String";
            const logical = (binaryOperator === "&&" || binaryOperator === "||")
                && targetType.sourceName === "Boolean" && valueType.sourceName === "Boolean";
            if (!stringAdd && !logical && (!numeric(targetType) || !numeric(valueType))) {
                fail("HARDENED_COMPOUND_TYPE", "compound assignment requires exact String addition or proven numeric operands", node);
            }
            const bitwise = ["&", "|", "^", "<<", ">>", ">>>"].includes(binaryOperator);
            const resultType = stringAdd ? semanticType(node, "String", "string")
                : logical ? semanticType(node, "Boolean", "boolean")
                : bitwise ? semanticType(node, binaryOperator === ">>>" ? "uint" : "int", "number")
                    : semanticType(node, "Number", "number");
            const binary: SemanticExpression = Object.assign(identity(node), {
                kind: "binary" as "binary",
                operator: binaryOperator as "+" | "-" | "*" | "/" | "%" | "&" | "|" | "^" | "<<" | ">>" | ">>>" | "&&" | "||",
                left: target, right: value, resultType,
            });
            value = (targetType.sourceName === "int" || targetType.sourceName === "uint")
                ? Object.assign(identity(node), { kind: "coercion" as "coercion", targetType, argument: binary })
                : binary;
        }
        return Object.assign(identity(node), {
            kind: "assignment" as "assignment", operator: "=" as "=", target, value,
        });
    }
    if (node.kind === "ARRAY_ACCESSOR") {
        if (node.children.length !== 2) {
            fail("HARDENED_INDEX_SHAPE", "indexed access requires one target and one index", node);
        }
        const target = parseExpression(node.children[0]!, context, true);
        const ownerType = assignmentType(target, context, node.children[0]!);
        const element = vectorElement(ownerType);
        if (!element) fail("HARDENED_INDEX_TARGET", "indexed access currently requires a proven Vector", node);
        const index = parseExpression(node.children[1]!, context, true);
        const indexType = assignmentType(index, context, node.children[1]!);
        if (!["Number", "int", "uint"].includes(indexType.sourceName)) {
            fail("HARDENED_INDEX_TYPE", "Vector index must be a proven numeric value", node.children[1]!);
        }
        return Object.assign(identity(node), {
            kind: "index" as "index", target, targetNullable: ownerType.nullable, index, resultType: element,
        });
    }
    if (node.kind === "DOT") {
        if (node.children.length !== 2 || node.children[1]!.kind !== "LITERAL") {
            fail("HARDENED_MEMBER_SHAPE", "member expression has the wrong normalized shape", node);
        }
        const target = parseExpression(node.children[0]!, context, false);
        const name = validateIdentifier(requiredText(node.children[1]!, "member name"), node.children[1]!);
        if (target.kind === "this" && context.methods[name] && valuePosition) {
            if (!allowMethodClosure) {
                fail("HARDENED_METHOD_CLOSURE_INITIALIZER", "method closures in field initializers are not admitted before per-instance binding", node);
            }
            const method = context.methods[name]!;
            if (method.constructor || method.modifiers.indexOf("static") >= 0) {
                fail("HARDENED_METHOD_CLOSURE_SCOPE", "only non-static instance methods have admitted AS3 closure identity", node);
            }
            return Object.assign(identity(node), { kind: "methodClosure" as "methodClosure", methodName: name });
        }
        let capabilitySource: string | null = null;
        let targetNullable = false;
        if (target.kind === "this") {
            if (context.methods[name] && (context.methods[name].constructor
                || context.methods[name].modifiers.indexOf("static") >= 0)) {
                fail("HARDENED_METHOD_INSTANCE_SCOPE", "constructor or static method cannot be resolved through this", node);
            }
            if (!context.methods[name] && !context.fields[name] && !context.accessors[name]) {
                const mapping = context.baseSourceQName === null ? null
                    : memberMapping(context, context.baseSourceQName, "call", name, node);
                if (mapping === null) {
                    fail("HARDENED_MEMBER_UNMAPPED", "instance member is neither local nor double-pinned in the minimal subset", node);
                }
                capabilitySource = mapping.sourceQName;
            }
        } else if (target.kind === "identifier" && context.importsByLocal[target.name]) {
            fail("HARDENED_STATIC_MEMBER", "Flash static members require an explicit paired member mapping", node);
        } else {
            const targetType = assignmentType(target, context, node.children[0]!);
            targetNullable = targetType.nullable;
            if (vectorElement(targetType) === null
                || (name !== "length" && name !== "fixed" && !VECTOR_METHODS.has(name))) {
                fail("HARDENED_MEMBER_TARGET", "member target is outside the admitted subset", node);
            }
            capabilitySource = targetType.sourceName;
        }
        return Object.assign(identity(node), {
            kind: "member" as "member", target, targetNullable, name, capabilitySource,
        });
    }
    if (node.kind === "CALL") {
        if (node.children.length !== 2 || node.children[1]!.kind !== "ARGUMENTS") {
            fail("HARDENED_CALL_SHAPE", "call expression has the wrong normalized shape", node);
        }
        const rawCallee = node.children[0]!;
        if (rawCallee.kind === "VECTOR") {
            const vectorType = parseType(rawCallee, context, false);
            if (node.children[1]!.children.length !== 1) {
                fail("HARDENED_VECTOR_CONVERSION_ARITY", "Vector conversion requires exactly one source value", node);
            }
            const source = parseExpression(node.children[1]!.children[0]!, context, true);
            if (source.kind !== "array" && vectorElement(assignmentType(source, context, node.children[1]!.children[0]!)) === null) {
                fail("HARDENED_VECTOR_CONVERSION_SOURCE", "Vector conversion requires an Array literal or proven Vector", node);
            }
            return Object.assign(identity(node), { kind: "vectorConversion" as "vectorConversion", vectorType, source });
        }
        if (rawCallee.kind === "IDENTIFIER" && typeof rawCallee.text === "string"
            && ["int", "uint", "Number", "Boolean", "String"].includes(rawCallee.text)
            && !context.importsByLocal[rawCallee.text] && !context.locals[rawCallee.text]
            && !context.parameters[rawCallee.text] && !context.fields[rawCallee.text]) {
            const rawArguments = node.children[1]!.children;
            if (rawArguments.length > 1) {
                fail("HARDENED_COERCION_ARITY", "primitive AS3 coercion accepts zero or one argument", node);
            }
            const targetType = withNullability(
                parseType(Object.assign({}, rawCallee, { kind: "TYPE" }), context, false), false);
            const argument = rawArguments.length === 0 ? null : parseExpression(rawArguments[0]!, context, true);
            return Object.assign(identity(node), { kind: "coercion" as "coercion", targetType, argument });
        }
        let callee: SemanticExpression;
        if (rawCallee.kind === "IDENTIFIER" && rawCallee.text === "super") {
            if (!allowSuperCall) {
                fail("HARDENED_SUPER_CONTEXT", "super is admitted only as the first zero-argument statement of a derived constructor", rawCallee);
            }
            callee = Object.assign(identity(rawCallee), { kind: "super" as "super" });
        } else {
            if (rawCallee.kind === "IDENTIFIER" && typeof rawCallee.text === "string"
                && !context.parameters[rawCallee.text] && !context.importsByLocal[rawCallee.text]
                && !context.locals[rawCallee.text] && !context.fields[rawCallee.text] && !context.methods[rawCallee.text]
                && context.baseSourceQName !== null) {
                const mapping = memberMapping(context, context.baseSourceQName, "call", rawCallee.text, rawCallee);
                callee = mapping === null ? parseExpression(rawCallee, context, false)
                    : implicitThisMember(rawCallee, rawCallee.text, mapping.sourceQName);
            } else {
                callee = parseExpression(rawCallee, context, false);
            }
        }
        const args = node.children[1]!.children.map((child) => parseExpression(child, context, true));
        let capabilitySource: string | null = null;
        let capabilityMember: string | null = null;
        let resultType: SemanticType | null = null;
        let calleeNullable = false;
        if (callee.kind === "super") {
            if (args.length !== 0) {
                fail("HARDENED_SUPER_ARITY", "minimal derived constructor admits only zero-argument super", node);
            }
        } else if (callee.kind === "identifier" && context.locals[callee.name]?.lambdaSignature) {
            const signature = context.locals[callee.name]!.lambdaSignature!;
            calleeNullable = context.locals[callee.name]!.type.nullable;
            if (!admittedArity(signature.parameters, args.length)) {
                fail("HARDENED_LAMBDA_CALL_ARITY", "lambda call does not match its exact local declaration", node);
            }
            const restIndex = signature.parameters.findIndex(parameter => parameter.rest);
            args.slice(0, restIndex < 0 ? signature.parameters.length : restIndex)
                .forEach((argument, index) => assertAssignmentCompatible(signature.parameters[index]!.type,
                    assignmentType(argument, context, node.children[1]!.children[index]!),
                    node.children[1]!.children[index]!));
            resultType = signature.returnType;
        } else if (callee.kind === "member" && callee.target.kind === "this" && context.methods[callee.name]) {
            const parameters = context.methods[callee.name]!.parameters;
            if (!admittedArity(parameters, args.length)) {
                fail("HARDENED_LOCAL_CALL_ARITY", "local method call does not match its declared arity", node);
            }
            args.slice(0, parameters.findIndex(parameter => parameter.rest) < 0
                ? parameters.length : parameters.findIndex(parameter => parameter.rest))
                .forEach((argument, index) => assertAssignmentCompatible(parameters[index]!.type,
                    assignmentType(argument, context, node.children[1]!.children[index]!), node.children[1]!.children[index]!));
            resultType = context.methods[callee.name]!.returnType;
        } else if (callee.kind === "member" && callee.target.kind === "this" && callee.capabilitySource !== null) {
            const mapping = memberMapping(context, callee.capabilitySource, "call", callee.name, node);
            if (mapping === null || mapping.sourceMember === null
                || args.length < mapping.sourceMember.minArgs || args.length > mapping.sourceMember.maxArgs) {
                fail("HARDENED_CAPABILITY_CALL_ARITY", "Flash bridge call does not match the double-pinned source signature", node);
            }
            capabilitySource = mapping.sourceQName;
            capabilityMember = mapping.sourceMember.name;
        } else if (callee.kind === "member" && vectorElement(assignmentType(callee.target, context, rawCallee)) !== null) {
            const ownerType = assignmentType(callee.target, context, rawCallee);
            const element = vectorElement(ownerType)!;
            const name = callee.name;
            const arities: { [name: string]: [number, number] } = {
                concat: [0, Number.MAX_SAFE_INTEGER], every: [1, 2], filter: [1, 2], forEach: [1, 2],
                indexOf: [1, 2], join: [0, 1], lastIndexOf: [1, 2], map: [1, 2], pop: [0, 0],
                push: [0, Number.MAX_SAFE_INTEGER], reverse: [0, 0], shift: [0, 0], slice: [0, 2],
                some: [1, 2], sort: [0, 1], splice: [1, Number.MAX_SAFE_INTEGER],
                unshift: [0, Number.MAX_SAFE_INTEGER],
            };
            const arity: [number, number] | undefined = name === "toString" ? [0, 0] : arities[name];
            if (!arity || args.length < arity[0] || args.length > arity[1]) {
                fail("HARDENED_VECTOR_MEMBER_ARITY", "Vector member call has unsupported identity or arity", node);
            }
            if (name === "push" || name === "unshift") {
                args.forEach((argument, index) => assertAssignmentCompatible(element,
                    assignmentType(argument, context, node.children[1]!.children[index]!), node.children[1]!.children[index]!));
            }
            resultType = name === "pop" || name === "shift" ? element
                : ["concat", "filter", "map", "reverse", "slice", "sort", "splice"].includes(name) ? ownerType
                    : ["every", "some"].includes(name) ? semanticType(node, "Boolean", "boolean")
                        : name === "join" || name === "toString" ? semanticType(node, "String", "string", [], false)
                            : name === "forEach" ? semanticType(node, "void", "void")
                                : semanticType(node, "int", "number");
        } else {
            fail("HARDENED_CALL_TARGET", "call target is not a proven local method or super", node);
        }
        const result: CallExpression = Object.assign(identity(node), {
            kind: "call" as "call", callee, calleeNullable, arguments: args,
            capabilitySource, capabilityMember, resultType,
        });
        return result;
    }
    fail("HARDENED_EXPRESSION_UNSUPPORTED", "normalized expression kind is unsupported: " + node.kind, node);
}

function parseStatementNode(node: TreeNode, context: AdapterContext, constructor: boolean,
    derived: boolean, expectedReturn: SemanticType | null, allowSuperCall: boolean): SemanticStatement {
        if (node.kind === "CALL" || node.kind === "ASSIGN" || node.kind === "PRE_INC"
            || node.kind === "PRE_DEC" || node.kind === "POST_INC" || node.kind === "POST_DEC") {
            return Object.assign(identity(node), {
                kind: "expression" as "expression",
                expression: parseExpression(node, context, false,
                    allowSuperCall, true, node.kind === "ASSIGN"),
            });
        }
        if (node.kind === "RETURN") {
            if (constructor || expectedReturn === null || expectedReturn.sourceName === "void") {
                if (node.children.length !== 0) {
                    fail("HARDENED_RETURN_VOID", "constructor or void callable cannot return a value", node);
                }
                return Object.assign(identity(node), { kind: "return" as "return", expression: null });
            }
            if (node.children.length !== 1) {
                fail("HARDENED_RETURN_REQUIRED", "non-void callable must return one proven expression", node);
            }
            const expression = parseExpression(node.children[0]!, context, true);
            assertAssignmentCompatible(expectedReturn, assignmentType(expression, context, node.children[0]!), node);
            return Object.assign(identity(node), {
                kind: "return" as "return",
                expression,
            });
        }
        if (node.kind === "IF") {
            if (node.children.length < 2 || node.children.length > 3 || node.children[0]!.kind !== "CONDITION") {
                fail("HARDENED_IF_SHAPE", "if statement has the wrong normalized shape", node);
            }
            const conditionOwner = node.children[0]!;
            if (conditionOwner.children.length !== 1) {
                fail("HARDENED_IF_CONDITION", "if statement requires exactly one condition expression", conditionOwner);
            }
            const condition = parseExpression(conditionOwner.children[0]!, context, true);
            const conditionType = assignmentType(condition, context, conditionOwner.children[0]!);
            if (conditionType.sourceName !== "Boolean" || conditionType.emittedName !== "boolean") {
                fail("HARDENED_IF_BOOLEAN", "if condition requires an exact Boolean expression", conditionOwner);
            }
            const parseBranch = (branch: TreeNode): SemanticStatement[] => branch.kind === "BLOCK"
                ? parseBlock(branch, context, constructor, derived, expectedReturn, false)
                : [parseStatementNode(branch, context, constructor, derived, expectedReturn, false)];
            return Object.assign(identity(node), {
                kind: "if" as "if", condition,
                thenStatements: parseBranch(node.children[1]!),
                elseStatements: node.children.length === 3 ? parseBranch(node.children[2]!) : null,
            });
        }
        if (node.kind === "WHILE") {
            if (node.children.length !== 2 || node.children[0]!.kind !== "CONDITION") {
                fail("HARDENED_WHILE_SHAPE", "while statement has the wrong normalized shape", node);
            }
            const conditionOwner = node.children[0]!;
            if (conditionOwner.children.length !== 1) {
                fail("HARDENED_WHILE_CONDITION", "while statement requires exactly one condition expression", conditionOwner);
            }
            const condition = parseExpression(conditionOwner.children[0]!, context, true);
            const conditionType = assignmentType(condition, context, conditionOwner.children[0]!);
            if (conditionType.sourceName !== "Boolean" || conditionType.emittedName !== "boolean") {
                fail("HARDENED_WHILE_BOOLEAN", "while condition requires an exact Boolean expression", conditionOwner);
            }
            const branch = node.children[1]!;
            context.loopDepth += 1;
            context.breakableDepth += 1;
            try {
                return Object.assign(identity(node), {
                    kind: "while" as "while", condition,
                    statements: branch.kind === "BLOCK"
                        ? parseBlock(branch, context, constructor, derived, expectedReturn, false)
                        : [parseStatementNode(branch, context, constructor, derived, expectedReturn, false)],
                });
            } finally {
                context.loopDepth -= 1;
                context.breakableDepth -= 1;
            }
        }
        if (node.kind === "DO") {
            if (node.children.length !== 2 || node.children[1]!.kind !== "CONDITION") {
                fail("HARDENED_DO_SHAPE", "do-while statement has the wrong normalized shape", node);
            }
            const conditionOwner = node.children[1]!;
            if (conditionOwner.children.length !== 1) {
                fail("HARDENED_DO_CONDITION", "do-while statement requires exactly one condition expression", conditionOwner);
            }
            const condition = parseExpression(conditionOwner.children[0]!, context, true);
            const conditionType = assignmentType(condition, context, conditionOwner.children[0]!);
            if (conditionType.sourceName !== "Boolean" || conditionType.emittedName !== "boolean") {
                fail("HARDENED_DO_BOOLEAN", "do-while condition requires an exact Boolean expression", conditionOwner);
            }
            const branch = node.children[0]!;
            context.loopDepth += 1;
            context.breakableDepth += 1;
            try {
                return Object.assign(identity(node), {
                    kind: "doWhile" as "doWhile", condition,
                    statements: branch.kind === "BLOCK"
                        ? parseBlock(branch, context, constructor, derived, expectedReturn, false)
                        : [parseStatementNode(branch, context, constructor, derived, expectedReturn, false)],
                });
            } finally {
                context.loopDepth -= 1;
                context.breakableDepth -= 1;
            }
        }
        if (node.kind === "SWITCH") {
            if (node.children.length !== 2 || node.children[0]!.kind !== "CONDITION"
                || node.children[1]!.kind !== "CASES" || node.children[0]!.children.length !== 1) {
                fail("HARDENED_SWITCH_SHAPE", "switch statement has the wrong normalized shape", node);
            }
            const expressionNode = node.children[0]!.children[0]!;
            const expression = parseExpression(expressionNode, context, true);
            const expressionType = assignmentType(expression, context, expressionNode);
            let defaultSeen = false;
            context.breakableDepth += 1;
            try {
                const cases = node.children[1]!.children.map((caseNode) => {
                    if (caseNode.kind !== "CASE" || caseNode.children.length !== 2
                        || caseNode.children[1]!.kind !== "SWITCH_BLOCK") {
                        fail("HARDENED_SWITCH_CASE_SHAPE", "switch case has the wrong normalized shape", caseNode);
                    }
                    const rawTest = caseNode.children[0]!;
                    let test: SemanticExpression | null;
                    if (rawTest.kind === "DEFAULT") {
                        if (rawTest.children.length !== 0 || defaultSeen) {
                            fail("HARDENED_SWITCH_DEFAULT", "switch admits exactly one default clause", rawTest);
                        }
                        defaultSeen = true;
                        test = null;
                    } else {
                        test = parseExpression(rawTest, context, true);
                        assertAssignmentCompatible(expressionType, assignmentType(test, context, rawTest), rawTest);
                    }
                    return Object.assign(identity(caseNode), {
                        test,
                        statements: parseBlock(caseNode.children[1]!, context, constructor, derived, expectedReturn, false),
                    });
                });
                return Object.assign(identity(node), { kind: "switch" as "switch", expression, cases });
            } finally {
                context.breakableDepth -= 1;
            }
        }
        if (node.kind === "THROW") {
            if (node.children.length !== 1) {
                fail("HARDENED_THROW_SHAPE", "throw statement requires exactly one admitted expression", node);
            }
            return Object.assign(identity(node), {
                kind: "throw" as "throw", expression: parseExpression(node.children[0]!, context, true),
            });
        }
        if (node.kind === "FOR") {
            const body = node.children[node.children.length - 1]!;
            if (!body || ["INIT", "COND", "ITER"].includes(body.kind)
                || node.children.filter(child => child.kind === "INIT").length > 1
                || node.children.filter(child => child.kind === "COND").length > 1
                || node.children.filter(child => child.kind === "ITER").length > 1) {
                fail("HARDENED_FOR_SHAPE", "for statement has the wrong normalized shape", node);
            }
            const initOwner = node.children.find(child => child.kind === "INIT") || null;
            const conditionOwner = node.children.find(child => child.kind === "COND") || null;
            const updateOwner = node.children.find(child => child.kind === "ITER") || null;
            let initializer: LocalDeclarationStatement | ExpressionStatement | null = null;
            if (initOwner !== null) {
                if (initOwner.children.length !== 1) fail("HARDENED_FOR_INIT", "for initializer requires one expression or declaration", initOwner);
                const raw = initOwner.children[0]!;
                initializer = raw.kind === "VAR_LIST"
                    ? parseStatementNode(raw, context, constructor, derived, expectedReturn, false) as LocalDeclarationStatement
                    : Object.assign(identity(raw), {
                        kind: "expression" as "expression",
                        expression: parseExpression(raw, context, false, false, true, raw.kind === "ASSIGN"),
                    });
            }
            let condition: SemanticExpression | null = null;
            if (conditionOwner !== null) {
                if (conditionOwner.children.length !== 1) fail("HARDENED_FOR_CONDITION", "for condition requires one expression", conditionOwner);
                condition = parseExpression(conditionOwner.children[0]!, context, true);
                const conditionType = assignmentType(condition, context, conditionOwner.children[0]!);
                if (conditionType.sourceName !== "Boolean" || conditionType.emittedName !== "boolean") {
                    fail("HARDENED_FOR_BOOLEAN", "for condition requires an exact Boolean expression", conditionOwner);
                }
            }
            let update: SemanticExpression | null = null;
            if (updateOwner !== null) {
                if (updateOwner.children.length !== 1) fail("HARDENED_FOR_UPDATE", "for update admits exactly one expression", updateOwner);
                const raw = updateOwner.children[0]!;
                if (raw.kind === "EXPR_LIST") fail("HARDENED_FOR_UPDATE", "comma-separated for updates remain held", raw);
                update = parseExpression(raw, context, false, false, true, raw.kind === "ASSIGN");
            }
            context.loopDepth += 1;
            context.breakableDepth += 1;
            try {
                return Object.assign(identity(node), {
                    kind: "for" as "for", initializer, condition, update,
                    statements: body.kind === "BLOCK"
                        ? parseBlock(body, context, constructor, derived, expectedReturn, false)
                        : [parseStatementNode(body, context, constructor, derived, expectedReturn, false)],
                });
            } finally {
                context.loopDepth -= 1;
                context.breakableDepth -= 1;
            }
        }
        if (node.kind === "FOREACH") {
            if (node.children.length !== 3 || node.children[0]!.kind !== "VAR"
                || node.children[1]!.kind !== "IN" || node.children[0]!.children.length !== 1
                || node.children[1]!.children.length !== 1) {
                fail("HARDENED_FOREACH_SHAPE", "for each requires one typed var binding and one iterable", node);
            }
            const declaration = node.children[0]!.children[0]!;
            const header = Object.values(context.locals).find(local => local.node === declaration);
            if (!header) fail("HARDENED_FOREACH_BINDING", "for each binding lacks its predeclared local identity", declaration);
            const iterable = parseExpression(node.children[1]!.children[0]!, context, true);
            const iterableType = assignmentType(iterable, context, node.children[1]!.children[0]!);
            const elementType = vectorElement(iterableType);
            if (elementType === null) fail("HARDENED_FOREACH_ITERABLE", "for each currently requires a proven typed Vector", node.children[1]!);
            assertAssignmentCompatible(header.type, elementType, declaration);
            const body = node.children[2]!;
            context.loopDepth += 1;
            context.breakableDepth += 1;
            try {
                return Object.assign(identity(node), {
                    kind: "forEach" as "forEach", binding: Object.assign(identity(declaration), {
                        name: header.name, type: header.type,
                    }), iterable, iterableType,
                    statements: body.kind === "BLOCK"
                        ? parseBlock(body, context, constructor, derived, expectedReturn, false)
                        : [parseStatementNode(body, context, constructor, derived, expectedReturn, false)],
                });
            } finally {
                context.loopDepth -= 1;
                context.breakableDepth -= 1;
            }
        }
        if (node.kind === "FORIN") {
            if (node.children.length !== 3 || node.children[0]!.kind !== "INIT"
                || node.children[1]!.kind !== "IN" || node.children[0]!.children.length !== 1
                || node.children[1]!.children.length !== 1) {
                fail("HARDENED_FORIN_SHAPE", "for-in requires one target, one enumerable, and one body", node);
            }
            const targetOwner = node.children[0]!.children[0]!;
            let target: SemanticExpression;
            let targetType: SemanticType;
            let declaresTarget = false;
            if (targetOwner.kind === "VAR_LIST") {
                if (targetOwner.children.length !== 1) {
                    fail("HARDENED_FORIN_TARGET", "for-in declares exactly one variable", targetOwner);
                }
                const declaration = targetOwner.children[0]!;
                onlyKinds(declaration, ["NAME", "TYPE"]);
                const nameNode = one(declaration, "NAME")!;
                const name = validateIdentifier(requiredText(nameNode, "for-in variable"), nameNode);
                const header = context.locals[name];
                if (!header || header.node !== declaration) {
                    fail("HARDENED_FORIN_TARGET", "for-in variable lacks its predeclared identity", declaration);
                }
                targetType = header.type;
                target = Object.assign(identity(nameNode), { kind: "identifier" as "identifier", name });
                declaresTarget = true;
            } else {
                target = parseExpression(targetOwner, context, false, false, true);
                if (target.kind !== "identifier") {
                    fail("HARDENED_FORIN_TARGET", "for-in currently admits one existing local or parameter identity", targetOwner);
                }
                targetType = assignmentType(target, context, targetOwner);
            }
            if (targetType.sourceName !== "String" && targetType.sourceName !== "*") {
                fail("HARDENED_FORIN_KEY", "for-in property keys require a String or dynamic binding", targetOwner);
            }
            const iterableOwner = node.children[1]!.children[0]!;
            const iterable = parseExpression(iterableOwner, context, true);
            const iterableType = assignmentType(iterable, context, iterableOwner);
            if (["Boolean", "Number", "int", "uint", "String", "void"].includes(iterableType.sourceName)) {
                fail("HARDENED_FORIN_ITERABLE", "for-in requires a proven object/reference enumerable", iterableOwner);
            }
            const body = node.children[2]!;
            context.loopDepth += 1;
            context.breakableDepth += 1;
            try {
                return Object.assign(identity(node), {
                    kind: "forIn" as "forIn", target, declaresTarget, targetType, iterable, iterableType,
                    statements: body.kind === "BLOCK"
                        ? parseBlock(body, context, constructor, derived, expectedReturn, false)
                        : [parseStatementNode(body, context, constructor, derived, expectedReturn, false)],
                });
            } finally {
                context.loopDepth -= 1;
                context.breakableDepth -= 1;
            }
        }
        if (node.kind === "TRY" || node.kind === "CATCH" || node.kind === "FINALLY") {
            fail("HARDENED_TRY_SEQUENCE", "try/catch/finally must be consumed as one adjacent statement sequence", node);
        }
        if (node.kind === "LABEL") {
            if (node.children.length !== 1) fail("HARDENED_LABEL_SHAPE", "label requires exactly one statement", node);
            const label = validateIdentifier(requiredText(node, "statement label"), node);
            if (context.labels.some(item => item.name === label)) {
                fail("HARDENED_LABEL_DUPLICATE", "active statement label is duplicated", node);
            }
            const child = node.children[0]!;
            context.labels.push({ name: label, continuable: ["DO", "FOR", "FOREACH", "FORIN", "WHILE"].includes(child.kind) });
            try {
                return Object.assign(identity(node), {
                    kind: "label" as "label", label,
                    statement: parseStatementNode(child, context, constructor, derived, expectedReturn, false),
                });
            } finally {
                context.labels.pop();
            }
        }
        if (node.kind === "BREAK" || node.kind === "CONTINUE") {
            if (node.children.length > 1 || (node.children.length === 1 && node.children[0]!.kind !== "IDENTIFIER")) {
                fail("HARDENED_LOOP_LABEL", "loop-control label has the wrong normalized shape", node);
            }
            const label = node.children.length === 0 ? null
                : validateIdentifier(requiredText(node.children[0]!, "loop-control label"), node.children[0]!);
            const target = label === null ? null : context.labels.slice().reverse().find(item => item.name === label);
            if (label !== null && (!target || (node.kind === "CONTINUE" && !target.continuable))) {
                fail("HARDENED_LOOP_LABEL", "loop-control label is absent or not an iteration target", node);
            }
            if (label === null && (node.kind === "BREAK" ? context.breakableDepth : context.loopDepth) === 0) {
                fail("HARDENED_LOOP_CONTEXT", "break requires a loop or switch and continue requires a loop", node);
            }
            return Object.assign(identity(node), {
                kind: node.kind === "BREAK" ? "break" as "break" : "continue" as "continue", label,
            });
        }
        if (node.kind === "VAR_LIST" || node.kind === "CONST_LIST") {
            onlyKinds(node, ["NAME_TYPE_INIT"]);
            if (node.children.length === 0) {
                fail("HARDENED_LOCAL_EMPTY", "local declaration must contain at least one declarator", node);
            }
            const declarations = node.children.map((declaration): SemanticLocal => {
                onlyKinds(declaration, ["INIT", "NAME", "TYPE", "VECTOR"]);
                const nameNode = one(declaration, "NAME")!;
                const name = validateIdentifier(requiredText(nameNode, "local name"), nameNode);
                const header = context.locals[name];
                if (!header || header.node !== declaration || header.readonly !== (node.kind === "CONST_LIST")) {
                    fail("HARDENED_LOCAL_AUTHORITY", "local declaration does not match its predeclared function identity", declaration);
                }
                const init = one(declaration, "INIT", true);
                if (init === null || init.children.length !== 1) {
                    fail("HARDENED_LOCAL_INITIALIZER", "locals require exactly one explicit admitted initializer", declaration);
                }
                const initializer = parseExpression(init.children[0]!, context, true);
                assertAssignmentCompatible(header.type, assignmentType(initializer, context, init.children[0]!), declaration);
                if (initializer.kind === "lambda") {
                    if (header.type.sourceName !== "Function") {
                        fail("HARDENED_LAMBDA_TARGET", "anonymous function initializer requires an exact Function local", declaration);
                    }
                    header.lambdaSignature = { parameters: initializer.parameters, returnType: initializer.returnType };
                }
                return Object.assign(identity(declaration), {
                    name, readonly: header.readonly, type: header.type, initializer,
                });
            });
            return Object.assign(identity(node), { kind: "local" as "local", declarations });
        }
        fail("HARDENED_STATEMENT_UNSUPPORTED", "normalized statement kind is unsupported: " + node.kind, node);
}

function predeclareLocals(block: TreeNode, context: AdapterContext): void {
    const visit = (node: TreeNode): void => {
        if (node.kind === "VAR_LIST" || node.kind === "CONST_LIST") {
            onlyKinds(node, ["NAME_TYPE_INIT"]);
            if (node.children.length === 0) {
                fail("HARDENED_LOCAL_EMPTY", "local declaration must contain at least one declarator", node);
            }
            node.children.forEach((declaration) => {
                onlyKinds(declaration, ["INIT", "NAME", "TYPE", "VECTOR"]);
                const nameNode = one(declaration, "NAME")!;
                const name = validateIdentifier(requiredText(nameNode, "local name"), nameNode);
                if (context.parameters[name]) {
                    fail("HARDENED_LOCAL_PARAMETER_COLLISION", "local identity duplicates a parameter", nameNode);
                }
                if (context.locals[name]) {
                    fail("HARDENED_LOCAL_DUPLICATE", "function-scoped local identity is duplicated", nameNode);
                }
                context.locals[name] = {
                    node: declaration,
                    name,
                    readonly: node.kind === "CONST_LIST",
                    type: parseType(oneType(declaration), context, false),
                    lambdaSignature: null,
                };
            });
            return;
        }
        if (node.kind === "VAR" && node.children.length === 1 && node.children[0]!.kind === "NAME_TYPE_INIT") {
            const declaration = node.children[0]!;
            onlyKinds(declaration, ["NAME", "TYPE", "VECTOR"]);
            const nameNode = one(declaration, "NAME")!;
            const name = validateIdentifier(requiredText(nameNode, "for each local name"), nameNode);
            if (context.parameters[name]) fail("HARDENED_LOCAL_PARAMETER_COLLISION", "for each local duplicates a parameter", nameNode);
            if (context.locals[name]) fail("HARDENED_LOCAL_DUPLICATE", "function-scoped local identity is duplicated", nameNode);
            context.locals[name] = {
                node: declaration, name, readonly: false,
                type: parseType(oneType(declaration), context, false), lambdaSignature: null,
            };
            return;
        }
        if (node.kind === "BLOCK") {
            node.children.forEach(visit);
            return;
        }
        if (node.kind === "INIT") {
            node.children.forEach(visit);
            return;
        }
        if (node.kind === "LABEL" && node.children.length === 1) {
            visit(node.children[0]!);
            return;
        }
        if (node.kind === "IF") {
            node.children.slice(1).forEach(visit);
            return;
        }
        if (node.kind === "WHILE" && node.children.length >= 2) {
            visit(node.children[1]!);
            return;
        }
        if (node.kind === "DO" && node.children.length >= 1) {
            visit(node.children[0]!);
            return;
        }
        if (node.kind === "SWITCH" && node.children.length >= 2) {
            node.children[1]!.children.forEach((caseNode) => {
                const block = caseNode.children.find((child) => child.kind === "SWITCH_BLOCK");
                if (block) visit(block);
            });
            return;
        }
        if (node.kind === "FOR") {
            node.children.forEach(child => {
                if (child.kind === "INIT" || child.kind === "BLOCK") visit(child);
            });
            return;
        }
        if (node.kind === "FOREACH") {
            visit(node.children[0]!);
            if (node.children.length >= 3) visit(node.children[2]!);
            return;
        }
        if (node.kind === "FORIN") {
            if (node.children.length >= 1) visit(node.children[0]!);
            if (node.children.length >= 3) visit(node.children[2]!);
            return;
        }
        if (node.kind === "TRY" || node.kind === "CATCH" || node.kind === "FINALLY") {
            node.children.filter(child => child.kind === "BLOCK").forEach(visit);
        }
    };
    visit(block);
}

function parseBlock(block: TreeNode, context: AdapterContext, constructor: boolean,
    derived: boolean, expectedReturn: SemanticType | null, allowLeadingSuper: boolean = true): SemanticStatement[] {
    const statements: SemanticStatement[] = [];
    for (let statementIndex = 0; statementIndex < block.children.length; statementIndex += 1) {
        const node = block.children[statementIndex]!;
        if (node.kind !== "TRY") {
            statements.push(parseStatementNode(node, context, constructor, derived, expectedReturn,
                allowLeadingSuper && constructor && statementIndex === 0));
            continue;
        }
        if (node.children.length !== 1 || node.children[0]!.kind !== "BLOCK") {
            fail("HARDENED_TRY_SHAPE", "try requires exactly one statement block", node);
        }
        const next = block.children[statementIndex + 1];
        const afterNext = block.children[statementIndex + 2];
        const catchNode = next?.kind === "CATCH" ? next : null;
        const finallyNode = catchNode !== null
            ? (afterNext?.kind === "FINALLY" ? afterNext : null)
            : (next?.kind === "FINALLY" ? next : null);
        if (catchNode === null && finallyNode === null) {
            fail("HARDENED_TRY_HANDLER", "try requires one adjacent catch or finally clause", node);
        }
        if (catchNode !== null && afterNext?.kind === "CATCH") {
            fail("HARDENED_TRY_MULTICATCH", "multiple typed catch clauses remain held", afterNext);
        }
        let catchClause: SemanticCatchClause | null = null;
        if (catchNode !== null) {
            onlyKinds(catchNode, ["BLOCK", "NAME", "TYPE"]);
            const nameNode = one(catchNode, "NAME")!;
            const typeNode = one(catchNode, "TYPE")!;
            const catchBlock = one(catchNode, "BLOCK")!;
            const name = validateIdentifier(requiredText(nameNode, "catch binding"), nameNode);
            const type = withNullability(parseType(typeNode, context, false), false);
            if (type.sourceName !== "Error" || type.emittedName !== "Error") {
                fail("HARDENED_CATCH_TYPE", "this wave admits only the canonical AS3 Error catch type", typeNode);
            }
            const temporaryName = `__as3Caught${catchNode.id.slice(1)}`;
            if (context.locals[temporaryName] || context.parameters[temporaryName] || context.fields[temporaryName]
                || context.methods[temporaryName] || context.accessors[temporaryName] || temporaryName === context.className) {
                fail("HARDENED_CATCH_TEMPORARY", "generated catch identity collides with source identity", catchNode);
            }
            const previous = context.locals[name];
            context.locals[name] = { node: nameNode, name, readonly: true, type, lambdaSignature: null };
            let catchStatements: SemanticStatement[];
            try {
                catchStatements = parseBlock(catchBlock, context, constructor, derived, expectedReturn, false);
            } finally {
                if (previous) context.locals[name] = previous;
                else delete context.locals[name];
            }
            catchClause = Object.assign(identity(catchNode), { name, temporaryName, type, statements: catchStatements });
        }
        let finallyStatements: SemanticStatement[] | null = null;
        if (finallyNode !== null) {
            if (finallyNode.children.length !== 1 || finallyNode.children[0]!.kind !== "BLOCK") {
                fail("HARDENED_FINALLY_SHAPE", "finally requires exactly one statement block", finallyNode);
            }
            finallyStatements = parseBlock(finallyNode.children[0]!, context, constructor, derived, expectedReturn, false);
        }
        statements.push(Object.assign(identity(node), {
            kind: "try" as "try",
            tryStatements: parseBlock(node.children[0]!, context, constructor, derived, expectedReturn, false),
            catchClause,
            finallyStatements,
        }));
        statementIndex += (catchNode === null ? 0 : 1) + (finallyNode === null ? 0 : 1);
    }
    return statements;
}

function statementsAlwaysReturn(statements: SemanticStatement[]): boolean {
    if (statements.length === 0) return false;
    const last = statements[statements.length - 1]!;
    return last.kind === "return" || (last.kind === "label" && statementsAlwaysReturn([last.statement]))
        || (last.kind === "if" && last.elseStatements !== null
        && statementsAlwaysReturn(last.thenStatements) && statementsAlwaysReturn(last.elseStatements));
}

function parseField(list: TreeNode, context: AdapterContext, readonly: boolean): SemanticField[] {
    onlyKinds(list, ["MOD_LIST", "NAME_TYPE_INIT"]);
    const memberModifiers = parseMemberModifiers(list, context);
    const modifiers = memberModifiers.modifiers;
    if (modifiers.indexOf("override") >= 0) {
        fail("HARDENED_OVERRIDE_TARGET", "AS3 override is admitted only on instance methods and accessors", list);
    }
    const declarations = list.children.filter((child) => child.kind === "NAME_TYPE_INIT");
    if (declarations.length === 0) {
        fail("HARDENED_FIELD_EMPTY", "field declaration must contain at least one source declarator", list);
    }
    return declarations.map((declaration) => {
        onlyKinds(declaration, ["INIT", "NAME", "TYPE", "VECTOR"]);
        const nameNode = one(declaration, "NAME")!;
        const name = validateIdentifier(requiredText(nameNode, "field name"), nameNode);
        if (context.fields[name] || context.methods[name] || context.accessors[name]) {
            fail("HARDENED_MEMBER_DUPLICATE", "class member identity is duplicated", nameNode);
        }
        const init = one(declaration, "INIT", true);
        let initializer: SemanticExpression | null = null;
        if (init !== null) {
            if (init.children.length !== 1) {
                fail("HARDENED_INITIALIZER_SHAPE", "field initializer has the wrong normalized shape", init);
            }
            initializer = parseExpression(init.children[0]!, context, true, false, false);
        } else if (readonly) {
            fail("HARDENED_CONST_INITIALIZER", "AS3 const fields require an explicit admitted initializer", declaration);
        }
        const fieldType = parseType(oneType(declaration), context, false);
        if (initializer !== null) {
            assertAssignmentCompatible(fieldType, assignmentType(initializer, context, init!), declaration);
        }
        const field: SemanticField = Object.assign(identity(declaration), {
            kind: "field" as "field",
            sharedDeclarationNodeId: list.id,
            name,
            modifiers: modifiers.slice(),
            namespaceName: memberModifiers.namespaceName,
            readonly,
            type: fieldType,
            initializer,
        });
        context.fields[name] = field;
        return field;
    });
}

function parseMethodHeader(node: TreeNode, className: string, context: AdapterContext): MethodHeader {
    if (node.kind !== "FUNCTION" && node.kind !== "GET" && node.kind !== "SET") {
        fail("HARDENED_METHOD_KIND", "callable form is unsupported", node);
    }
    onlyKinds(node, ["BLOCK", "MOD_LIST", "NAME", "PARAMETER_LIST", "TYPE", "VECTOR"]);
    const nameNode = one(node, "NAME")!;
    const name = validateIdentifier(requiredText(nameNode, "method name"), nameNode);
    const accessor = node.kind === "GET" ? "getter" : node.kind === "SET" ? "setter" : null;
    const constructor = accessor === null && name === className;
    const returnNode = oneType(node);
    const returnType = constructor ? null : parseType(returnNode, context, true);
    if (constructor && (returnNode.text !== null && returnNode.text !== "")) {
        fail("HARDENED_CONSTRUCTOR_RETURN", "constructor must not declare a return type", returnNode);
    }
    const parameters = parseParameters(one(node, "PARAMETER_LIST")!, context);
    const memberModifiers = parseMemberModifiers(node, context);
    const modifiers = memberModifiers.modifiers;
    if (constructor && (modifiers.indexOf("static") >= 0 || modifiers.indexOf("override") >= 0
        || memberModifiers.namespaceName !== null)) {
        fail("HARDENED_CONSTRUCTOR_STATIC", "constructor cannot be static", node);
    }
    if (modifiers.indexOf("override") >= 0
        && (context.extendsType === null || modifiers.indexOf("static") >= 0
            || memberModifiers.namespaceName !== null)) {
        fail("HARDENED_OVERRIDE_TARGET", "override requires a derived instance method or accessor", node);
    }
    if (accessor === "getter" && (parameters.length !== 0 || returnType === null || returnType.sourceName === "void")) {
        fail("HARDENED_GETTER_SIGNATURE", "getter requires zero parameters and one non-void return type", node);
    }
    if (accessor === "setter" && (parameters.length !== 1 || returnType === null || returnType.sourceName !== "void")) {
        fail("HARDENED_SETTER_SIGNATURE", "setter requires exactly one parameter and an explicit void return type", node);
    }
    if (accessor !== null && parameters.some(parameter => parameter.defaultValue !== null || parameter.rest)) {
        fail("HARDENED_ACCESSOR_DEFAULT", "accessor parameters cannot have default or rest values", node);
    }
    if (modifiers.indexOf("override") >= 0) {
        if (context.baseSourceQName === null) {
            fail("HARDENED_OVERRIDE_AUTHORITY", "local-base override requires a future authenticated local member signature authority", node);
        }
        const access = accessor === "getter" ? "read" : accessor === "setter" ? "write" : "call";
        const mapping = memberMapping(context, context.baseSourceQName, access, name, node);
        const required = parameters.filter(parameter => parameter.defaultValue === null && !parameter.rest).length;
        if (!mapping || !mapping.sourceMember || mapping.targetMember === null
            || mapping.targetMember.scope !== "instance" || parameters.some(parameter => parameter.rest)
            || mapping.sourceMember.minArgs !== required || mapping.sourceMember.maxArgs !== parameters.length) {
            fail("HARDENED_OVERRIDE_AUTHORITY", "override lacks one exact base member signature and instance bridge mapping", node);
        }
    }
    return { node, name, modifiers, namespaceName: memberModifiers.namespaceName,
        parameters, returnType, block: one(node, "BLOCK")!, constructor, accessor };
}

function superCall(statement: SemanticStatement): boolean {
    return statement.kind === "expression" && statement.expression.kind === "call"
        && statement.expression.callee.kind === "super";
}

function modulePath(packageName: string, className: string, node: TreeNode): string {
    const segments = packageName === "" ? [] : packageName.split(".");
    segments.forEach((segment) => validateIdentifier(segment, node));
    return segments.concat([className + ".ts"]).join("/");
}

export function adaptNormalizedParserAst(ast: NormalizedParserAst, authority: LoadedCapabilityAuthority,
    sourceText: string, sha256: Sha256Function, localAuthority?: LoadedLocalTypeAuthority,
    sourceLogicalPath?: string): SemanticProgram {
    assertLoadedCapabilityAuthority(authority);
    const root = buildTree(ast, sourceText, sha256);
    if (root.kind !== "COMPILATION_UNIT") {
        fail("HARDENED_ROOT_KIND", "normalized AST root must be COMPILATION_UNIT", root);
    }
    const packageNode = one(root, "PACKAGE")!;
    const trailing = root.children.filter((child) => child.kind === "CONTENT" && child !== packageNode);
    if (root.children.some((child) => child !== packageNode && child.kind !== "CONTENT")
        || trailing.some((content) => content.children.length !== 0)) {
        fail("HARDENED_OUTSIDE_PACKAGE", "declarations outside the package are not admitted", root);
    }
    const packageNameNode = one(packageNode, "NAME")!;
    onlyKinds(packageNode, ["CONTENT", "NAME"]);
    const packageName = packageNameNode.text === null ? "" : packageNameNode.text;
    const content = one(packageNode, "CONTENT")!;
    const declarationPosition = content.children.findIndex((child) => child.kind === "CLASS" || child.kind === "INTERFACE");
    if (declarationPosition >= 0 && content.children.slice(declarationPosition + 1)
        .some((child) => child.kind === "IMPORT" || child.kind === "USE")) {
        fail("HARDENED_IMPORT_ORDER", "source imports and namespace directives must precede the declaration", content);
    }
    const declarations = content.children.filter((child) => child.kind === "CLASS" || child.kind === "INTERFACE");
    if (declarations.length !== 1 || content.children.some((child) => child.kind !== "IMPORT" && child.kind !== "USE"
        && child.kind !== "CLASS" && child.kind !== "INTERFACE")) {
        fail("HARDENED_PACKAGE_CONTENT", "semantic adapter requires imports followed by exactly one class or interface", content);
    }
    const classNode = declarations[0]!;
    onlyKinds(classNode, ["CONTENT", "EXTENDS", "IMPLEMENTS_LIST", "MOD_LIST", "NAME"]);
    const classNameNode = one(classNode, "NAME")!;
    const className = validateIdentifier(requiredText(classNameNode, "class name"), classNameNode);
    const outputModulePath = modulePath(packageName, className, packageNameNode);
    const classContentForNamespaces = one(classNode, "CONTENT")!;
    const firstClassMember = classContentForNamespaces.children.findIndex(child => child.kind !== "USE");
    if (firstClassMember >= 0 && classContentForNamespaces.children.slice(firstClassMember + 1)
        .some(child => child.kind === "USE")) {
        fail("HARDENED_NAMESPACE_ORDER", "class namespace directives must precede every member", classContentForNamespaces);
    }
    const namespaceNames: { [name: string]: true } = Object.create(null);
    content.children.filter(child => child.kind === "USE")
        .concat(classContentForNamespaces.children.filter(child => child.kind === "USE"))
        .forEach((node) => {
            onlyKinds(node, []);
            const name = validateNamespaceIdentifier(requiredText(node, "namespace directive"), node);
            namespaceNames[name] = true;
        });
    let currentLocal: CurrentLocalType | null = null;
    let resolveCurrentLocal: (() => CurrentLocalType) | null = null;
    if (localAuthority !== undefined || sourceLogicalPath !== undefined) {
        if (!localAuthority || typeof sourceLogicalPath !== "string" || sourceLogicalPath.length === 0) {
            fail("HARDENED_LOCAL_SOURCE_AUTHORITY", "local source authentication requires authority and logical path together", classNode);
        }
        assertLoadedLocalTypeAuthority(localAuthority);
        resolveCurrentLocal = () => {
            if (currentLocal) return currentLocal;
            const qname = packageName === "" ? className : `${packageName}.${className}`;
            const currentSourceSha256 = sha256(sourceText.replace(/\r\n?/g, "\n"));
            const candidates = (["application", "bootstrap"] as const).map(module =>
                localAuthority.entriesByIdentity[`${module}\u0000${qname}`]).filter((entry): entry is LocalTypeMapping => !!entry)
                .filter(entry => entry.sourcePath === (entry.module === "application"
                    ? `game-client/tapplication_main/src/${sourceLogicalPath}` : `game-client/tmain/src/${sourceLogicalPath}`)
                    && entry.sourceContentSha256 === currentSourceSha256
                    && entry.typeKind === (classNode.kind === "CLASS" ? "class" : "interface"));
            if (candidates.length !== 1) {
                const known = (["application", "bootstrap"] as const).map(module =>
                    localAuthority.entriesByIdentity[`${module}\u0000${qname}`]).filter((entry): entry is LocalTypeMapping => !!entry)
                    .map(entry => `${entry.module}:${entry.sourcePath}:${entry.sourceContentSha256}:${entry.typeKind}`);
                fail("HARDENED_LOCAL_SOURCE_AUTHORITY", `current class ${qname} at ${sourceLogicalPath} with canonical source ${currentSourceSha256} lacks one exact graph identity; authority=${known.join("|") || "absent"}`, classNode);
            }
            currentLocal = { entry: candidates[0]!, outputModulePath };
            return currentLocal;
        };
    }
    const parsedImports = parseImports(content, authority, localAuthority, resolveCurrentLocal);
    const placeholder: AdapterContext = {
        className,
        classQualifiedName: packageName === "" ? className : `${packageName}.${className}`,
        extendsType: null,
        importsByLocal: parsedImports.importsByLocal,
        mappingsBySource: authority.typeMappingsBySource,
        memberMappingsByKey: authority.memberMappingsByKey,
        baseSourceQName: null,
        fields: Object.create(null),
        methods: Object.create(null),
        accessors: Object.create(null),
        parameters: Object.create(null),
        locals: Object.create(null),
        loopDepth: 0,
        breakableDepth: 0,
        labels: [],
        namespaceNames,
        lambdaDepth: 0,
    };
    if (classNode.kind === "INTERFACE") {
        const modifiers = parseModifiers(classNode, true);
        if (modifiers.some(modifier => modifier !== "public")) {
            fail("HARDENED_INTERFACE_MODIFIER", "source interface admits only the public package modifier", classNode);
        }
        const interfaceExtendsTypes: SemanticType[] = [];
        const seenExtends = new Set<string>();
        classNode.children.filter(child => child.kind === "EXTENDS").forEach((extendsNode) => {
            const sourceName = requiredText(extendsNode, "extended interface");
            const localName = sourceName.slice(sourceName.lastIndexOf(".") + 1);
            const imported = parsedImports.importsByLocal[localName];
            if (!imported || !imported.runtimeInterface
                || (sourceName.indexOf(".") >= 0 && imported.sourceQualifiedName !== sourceName)) {
                fail("HARDENED_INTERFACE_EXTENDS", "extended interface must be one authenticated imported interface", extendsNode);
            }
            if (seenExtends.has(imported.sourceQualifiedName)) {
                fail("HARDENED_INTERFACE_EXTENDS", "extended interface is duplicated", extendsNode);
            }
            seenExtends.add(imported.sourceQualifiedName);
            interfaceExtendsTypes.push(semanticType(extendsNode, localName, localName));
        });
        const interfaceContent = one(classNode, "CONTENT")!;
        if (interfaceContent.children.some(child => !["FUNCTION", "GET", "SET"].includes(child.kind))) {
            fail("HARDENED_INTERFACE_MEMBER", "interface body admits only callable signatures", interfaceContent);
        }
        const members: SemanticMember[] = [];
        const names = new Set<string>();
        const accessors: { [name: string]: { getter?: SemanticGetter; setter?: SemanticSetter } } = Object.create(null);
        interfaceContent.children.forEach((node) => {
            onlyKinds(node, ["NAME", "PARAMETER_LIST", "TYPE", "VECTOR"]);
            const name = validateIdentifier(requiredText(one(node, "NAME")!, "interface member name"), one(node, "NAME")!);
            const parameters = parseParameters(one(node, "PARAMETER_LIST")!, placeholder);
            if (parameters.some(parameter => parameter.defaultValue !== null)) {
                fail("HARDENED_INTERFACE_DEFAULT", "interface signatures cannot declare default parameter values", node);
            }
            const returnType = parseType(oneType(node), placeholder, true);
            if (node.kind === "FUNCTION") {
                if (names.has(name) || accessors[name]) fail("HARDENED_INTERFACE_DUPLICATE", "interface member is duplicated", node);
                names.add(name);
                members.push(Object.assign(identity(node), {
                    kind: "method" as "method", name, modifiers: [], namespaceName: null,
                    parameters, returnType, body: [],
                }));
            } else if (node.kind === "GET") {
                if (names.has(name) || parameters.length !== 0 || returnType.sourceName === "void") {
                    fail("HARDENED_INTERFACE_ACCESSOR", "interface getter signature is invalid or duplicated", node);
                }
                const pair = accessors[name] || {};
                if (pair.getter) fail("HARDENED_INTERFACE_DUPLICATE", "interface getter is duplicated", node);
                pair.getter = Object.assign(identity(node), {
                    kind: "getter" as "getter", name, modifiers: [], namespaceName: null, returnType, body: [],
                });
                accessors[name] = pair;
            } else {
                if (names.has(name) || parameters.length !== 1 || returnType.sourceName !== "void"
                    || parameters[0]!.rest) {
                    fail("HARDENED_INTERFACE_ACCESSOR", "interface setter signature is invalid or duplicated", node);
                }
                const pair = accessors[name] || {};
                if (pair.setter) fail("HARDENED_INTERFACE_DUPLICATE", "interface setter is duplicated", node);
                pair.setter = Object.assign(identity(node), {
                    kind: "setter" as "setter", name, modifiers: [], namespaceName: null,
                    parameter: parameters[0]!, body: [],
                });
                accessors[name] = pair;
            }
        });
        Object.keys(accessors).sort().forEach((name) => {
            const pair = accessors[name]!;
            if (pair.getter && pair.setter && !sameType(pair.getter.returnType, pair.setter.parameter.type)) {
                fail("HARDENED_INTERFACE_ACCESSOR", "paired interface accessor types must match", pair.setter as unknown as TreeNode);
            }
            if (pair.getter) members.push(pair.getter);
            if (pair.setter) members.push(pair.setter);
        });
        const declaration: SemanticClass = Object.assign(identity(classNode), {
            declarationKind: "interface" as "interface", name: className, modifiers,
            extendsType: null, interfaceExtendsTypes, implementsTypes: [], members,
        });
        const program: SemanticProgram = Object.assign(identity(root), {
            schema: "as3-semantic-ir@1" as "as3-semantic-ir@1", sourceSha256: ast.sourceSha256,
            fingerprintSha256: ast.fingerprintSha256, packageName, outputModulePath,
            imports: parsedImports.imports, declaration,
            sourceCapabilitySha256: authority.sourceCensusSha256,
            targetCapabilitySha256: authority.targetCapabilitiesSha256,
            capabilityMappingSha256: authority.mappingSha256,
        });
        deepFreeze(program);
        ADAPTED_PROGRAMS.add(program);
        return program;
    }
    const extendsNode = one(classNode, "EXTENDS", true);
    let extendsType: SemanticType | null = null;
    if (extendsNode !== null) {
        const sourceName = requiredText(extendsNode, "base type");
        const imported = parsedImports.importsByLocal[sourceName];
        if (!imported) {
            fail("HARDENED_BASE_TYPE", "base type " + extendsNode.text
                + " must be a double-pinned imported Flash class", extendsNode);
        }
        if (imported.authorityKind === "flash") {
            mappingForRole(authority, imported.sourceQualifiedName, "base-type", extendsNode);
        } else {
            const localBase = localAuthority!.entriesByIdentity[`${resolveCurrentLocal!().entry.module}\u0000${imported.sourceQualifiedName}`];
            if (!localBase || localBase.typeKind !== "class") {
                fail("HARDENED_BASE_TYPE", "local base type must resolve to an authenticated class", extendsNode);
            }
        }
        extendsType = semanticType(extendsNode, sourceName, sourceName);
        placeholder.extendsType = extendsType;
        placeholder.baseSourceQName = imported.authorityKind === "flash" ? imported.sourceQualifiedName : null;
    }
    const implementsTypes: Array<{ type: SemanticType; runtimeName: string }> = [];
    const implementsNode = one(classNode, "IMPLEMENTS_LIST", true);
    if (implementsNode !== null) {
        onlyKinds(implementsNode, ["IMPLEMENTS"]);
        if (implementsNode.children.length === 0) fail("HARDENED_IMPLEMENTS_EMPTY", "implements list must not be empty", implementsNode);
        const seen = new Set<string>();
        implementsNode.children.forEach(item => {
            const sourceName = requiredText(item, "implemented interface");
            const localName = sourceName.slice(sourceName.lastIndexOf(".") + 1);
            const imported = parsedImports.importsByLocal[localName];
            if (!imported || (sourceName.indexOf(".") >= 0 && imported.sourceQualifiedName !== sourceName)
                || !imported.runtimeInterface) {
                fail("HARDENED_IMPLEMENTS_TYPE", "implemented type must be one authenticated imported interface", item);
            }
            if (seen.has(imported.sourceQualifiedName)) fail("HARDENED_IMPLEMENTS_DUPLICATE", "implemented interface is duplicated", item);
            seen.add(imported.sourceQualifiedName);
            implementsTypes.push({ type: semanticType(item, localName, localName), runtimeName: imported.sourceQualifiedName });
        });
    }
    const classContent = one(classNode, "CONTENT")!;
    const functionNodes = classContent.children.filter((child) =>
        child.kind === "FUNCTION" || child.kind === "GET" || child.kind === "SET");
    functionNodes.forEach((node) => {
        const header = parseMethodHeader(node, className, placeholder);
        if (header.accessor === null) {
            if (placeholder.methods[header.name] || placeholder.accessors[header.name]) {
                fail("HARDENED_METHOD_DUPLICATE", "callable identity is duplicated", node);
            }
            placeholder.methods[header.name] = header;
        } else {
            if (placeholder.methods[header.name]) {
                fail("HARDENED_METHOD_DUPLICATE", "accessor conflicts with a method", node);
            }
            const pair = placeholder.accessors[header.name] || {};
            if (header.accessor === "getter") {
                if (pair.getter) fail("HARDENED_ACCESSOR_DUPLICATE", "getter identity is duplicated", node);
                pair.getter = header;
            } else {
                if (pair.setter) fail("HARDENED_ACCESSOR_DUPLICATE", "setter identity is duplicated", node);
                pair.setter = header;
            }
            placeholder.accessors[header.name] = pair;
        }
    });
    Object.keys(placeholder.accessors).forEach((name) => {
        const pair = placeholder.accessors[name]!;
        if (pair.getter && pair.setter) {
            const getterType = pair.getter.returnType!;
            const setterType = pair.setter.parameters[0]!.type;
            if (!sameType(getterType, setterType)
                || pair.getter.modifiers.join("\u0000") !== pair.setter.modifiers.join("\u0000")
                || pair.getter.namespaceName !== pair.setter.namespaceName) {
                fail("HARDENED_ACCESSOR_PAIR", "paired getter/setter type and modifiers must match exactly", pair.setter.node);
            }
        }
    });
    if (extendsType !== null && !functionNodes.some((node) =>
        node.kind === "FUNCTION" && requiredText(one(node, "NAME")!, "method name") === className)) {
        fail("HARDENED_DERIVED_CONSTRUCTOR", "minimal derived classes require an explicit constructor with proven zero-argument super semantics", classNode);
    }
    const members: SemanticMember[] = [];
    classContent.children.forEach((node) => {
        if (node.kind === "VAR_LIST" || node.kind === "CONST_LIST") {
            members.push.apply(members, parseField(node, placeholder, node.kind === "CONST_LIST"));
            return;
        }
        if (node.kind === "FUNCTION" || node.kind === "GET" || node.kind === "SET") {
            const callableName = requiredText(one(node, "NAME")!, "method name");
            const header = node.kind === "GET" ? placeholder.accessors[callableName]!.getter!
                : node.kind === "SET" ? placeholder.accessors[callableName]!.setter!
                : placeholder.methods[callableName]!;
            const oldParameters = placeholder.parameters;
            const oldLocals = placeholder.locals;
            placeholder.parameters = Object.create(null);
            placeholder.locals = Object.create(null);
            header.parameters.forEach((parameter) => { placeholder.parameters[parameter.name] = parameter; });
            predeclareLocals(header.block, placeholder);
            const body = parseBlock(header.block, placeholder, header.constructor, extendsType !== null, header.returnType);
            placeholder.parameters = oldParameters;
            placeholder.locals = oldLocals;
            if (header.constructor) {
                const count = body.filter(superCall).length;
                if (extendsType !== null && (count !== 1 || !superCall(body[0]!))) {
                    fail("HARDENED_SUPER_ORDER", "derived constructor requires exactly one first-position super call and it is never reordered", node);
                }
                if (extendsType === null) {
                    if (count > 1 || (count === 1 && !superCall(body[0]!))) {
                        fail("HARDENED_SUPER_ORDER", "implicit Object constructor permits only one first-position zero-argument super call", node);
                    }
                    if (count === 1) body.shift();
                }
                const constructor: SemanticConstructor = Object.assign(identity(node), {
                    kind: "constructor" as "constructor", modifiers: header.modifiers,
                    parameters: header.parameters, body,
                });
                members.push(constructor);
            } else if (header.accessor === "getter") {
                if (!statementsAlwaysReturn(body)) {
                    fail("HARDENED_RETURN_PATH", "getter must return a proven value on every admitted path", node);
                }
                const getter: SemanticGetter = Object.assign(identity(node), {
                    kind: "getter" as "getter", name: header.name, modifiers: header.modifiers,
                    namespaceName: header.namespaceName, returnType: header.returnType!, body,
                });
                members.push(getter);
            } else if (header.accessor === "setter") {
                const setter: SemanticSetter = Object.assign(identity(node), {
                    kind: "setter" as "setter", name: header.name, modifiers: header.modifiers,
                    namespaceName: header.namespaceName, parameter: header.parameters[0]!, body,
                });
                members.push(setter);
            } else {
                if (header.returnType!.sourceName !== "void" && !statementsAlwaysReturn(body)) {
                    fail("HARDENED_RETURN_PATH", "non-void method must return a proven value on every admitted path", node);
                }
                const method: SemanticMethod = Object.assign(identity(node), {
                    kind: "method" as "method", name: header.name, modifiers: header.modifiers,
                    namespaceName: header.namespaceName, parameters: header.parameters,
                    returnType: header.returnType!, body,
                });
                members.push(method);
            }
            return;
        }
        if (node.kind !== "USE") {
            fail("HARDENED_CLASS_MEMBER", "class member kind is unsupported: " + node.kind, node);
        }
    });
    const declaration: SemanticClass = Object.assign(identity(classNode), {
        declarationKind: "class" as "class", name: className,
        modifiers: parseModifiers(classNode, true),
        extendsType,
        interfaceExtendsTypes: [],
        implementsTypes,
        members,
    });
    const program: SemanticProgram = Object.assign(identity(root), {
        schema: "as3-semantic-ir@1" as "as3-semantic-ir@1",
        sourceSha256: ast.sourceSha256,
        fingerprintSha256: ast.fingerprintSha256,
        packageName,
        outputModulePath,
        imports: parsedImports.imports,
        declaration,
        sourceCapabilitySha256: authority.sourceCensusSha256,
        targetCapabilitySha256: authority.targetCapabilitiesSha256,
        capabilityMappingSha256: authority.mappingSha256,
    });
    deepFreeze(program);
    ADAPTED_PROGRAMS.add(program);
    return program;
}

export function assertAdaptedSemanticProgram(program: SemanticProgram): void {
    if (!program || !ADAPTED_PROGRAMS.has(program as unknown as object) || !Object.isFrozen(program)) {
        throw new HardenedSemanticError("HARDENED_SEMANTIC_IR_INSTANCE", "emitter requires immutable semantic IR returned by adaptNormalizedParserAst");
    }
}
