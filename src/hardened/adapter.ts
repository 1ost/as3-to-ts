import {
    CallExpression,
    CapabilityMapping,
    LoadedCapabilityAuthority,
    LoadedLocalTypeAuthority,
    LocalTypeMapping,
    NormalizedParserAst,
    NormalizedParserNode,
    SemanticClass,
    SemanticConstructor,
    SemanticExpression,
    SemanticField,
    SemanticGetter,
    SemanticIdentity,
    SemanticImport,
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
}

interface AdapterContext {
    className: string;
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
    int: "number",
    uint: "number",
    void: "void",
};
const ALLOWED_MODIFIERS = new Set(["private", "protected", "public", "static"]);
const VECTOR_METHODS = new Set([
    "concat", "every", "filter", "forEach", "indexOf", "join", "lastIndexOf", "map", "pop", "push",
    "reverse", "shift", "slice", "some", "sort", "splice", "toString", "unshift",
]);
const ADAPTED_PROGRAMS = new WeakSet<object>();

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
    content.children.filter((child) => child.kind === "IMPORT").forEach((node) => {
        const qname = requiredText(node, "import");
        const localName = validateIdentifier(qname.slice(qname.lastIndexOf(".") + 1), node);
        if (importsByLocal[localName]) {
            fail("HARDENED_IMPORT_COLLISION", "import local identity is duplicated", node);
        }
        let item: SemanticImport;
        if (authority.typeMappingsBySource[qname]) {
            const mapping = mappingForRole(authority, qname, "import", node);
            item = Object.assign(identity(node), {
                authorityKind: "flash" as "flash", localNodeId: null, runtimeConstructible: mapping.targetKind === "class",
                sourceQualifiedName: qname, sourceLocalName: localName,
                targetModule: targetModuleSpecifier(mapping.targetModule), targetExport: mapping.targetExport,
            });
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
            item = Object.assign(identity(node), {
                authorityKind: "local" as "local", localNodeId: target.nodeId, runtimeConstructible: target.typeKind === "class",
                sourceQualifiedName: qname, sourceLocalName: localName,
                targetModule: relativeLocalModule(currentLocal.outputModulePath, target), targetExport: localName,
            });
        }
        imports.push(item);
        importsByLocal[localName] = item;
    });
    return { imports, importsByLocal };
}

function semanticType(node: TreeNode, sourceName: string, emittedName: string,
    typeArguments: SemanticType[] = []): SemanticType {
    return Object.assign(identity(node), { sourceName, emittedName, typeArguments });
}

function sameType(left: SemanticType, right: SemanticType): boolean {
    return left.sourceName === right.sourceName && left.emittedName === right.emittedName
        && left.typeArguments.length === right.typeArguments.length
        && left.typeArguments.every((item, index) => sameType(item, right.typeArguments[index]!));
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
    return list.children.map((parameter) => {
        if (parameter.kind !== "PARAMETER") {
            fail("HARDENED_PARAMETER_NODE", "only ordinary required parameters are admitted", parameter);
        }
        onlyKinds(parameter, ["NAME_TYPE_INIT"]);
        const declaration = one(parameter, "NAME_TYPE_INIT")!;
        onlyKinds(declaration, ["NAME", "TYPE", "VECTOR", "INIT"]);
        if (declaration.children.some((child) => child.kind === "INIT")) {
            fail("HARDENED_PARAMETER_DEFAULT", "default parameters are not admitted in the minimal emitter", declaration);
        }
        const nameNode = one(declaration, "NAME")!;
        const name = validateIdentifier(requiredText(nameNode, "parameter name"), nameNode);
        if (seen[name]) {
            fail("HARDENED_PARAMETER_DUPLICATE", "parameter identity is duplicated", nameNode);
        }
        seen[name] = true;
        return Object.assign(identity(parameter), {
            name,
            type: parseType(oneType(declaration), context, false),
        });
    });
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
        kind: "member" as "member", target, name, capabilitySource,
    });
}

function assignmentType(expression: SemanticExpression, context: AdapterContext, node: TreeNode): SemanticType {
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
            fail("HARDENED_ASSIGNMENT_NULL", "null assignment requires an explicit nullable source-to-target type policy", node);
        }
        const sourceName = typeof expression.value === "number" ? "Number"
            : typeof expression.value === "string" ? "String" : "Boolean";
        return semanticType(node, sourceName, PRIMITIVE_TYPES[sourceName]!);
    }
    if (expression.kind === "methodClosure") {
        return semanticType(node, "Function", "Function");
    }
    if (expression.kind === "new") {
        return expression.sourceType;
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
    if (target.sourceName === "Object" || sameType(target, value)
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
            if (!local || !local.constructor || local.parameters.length !== args.length) {
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
    if (node.kind === "RELATION" || node.kind === "EQUALITY" || node.kind === "AND" || node.kind === "OR"
        || node.kind === "ADD" || node.kind === "MULTIPLICATION") {
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
        if (!sameType(leftType, rightType)) {
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
    if (node.kind === "PLUS" || node.kind === "MINUS" || node.kind === "NOT") {
        if (node.children.length !== 1) {
            fail("HARDENED_UNARY_SHAPE", "unary expression requires exactly one operand", node);
        }
        const operand = parseExpression(node.children[0]!, context, true);
        const operandType = assignmentType(operand, context, node.children[0]!);
        const operator = node.kind === "PLUS" ? "+" : node.kind === "MINUS" ? "-" : "!";
        if (operator === "!" && operandType.sourceName !== "Boolean") {
            fail("HARDENED_UNARY_BOOLEAN", "logical negation requires exact Boolean input", node);
        }
        if (operator !== "!" && operandType.sourceName !== "Number") {
            fail("HARDENED_UNARY_NUMBER", "numeric unary operators require exact Number input", node);
        }
        return Object.assign(identity(node), {
            kind: "unary" as "unary", operator: operator as "+" | "-" | "!", operand,
            resultType: operandType,
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
        if (!sameType(trueType, falseType)) {
            fail("HARDENED_CONDITIONAL_TYPE", "conditional branches require the exact same proven source type", node);
        }
        return Object.assign(identity(node), {
            kind: "conditional" as "conditional", condition, whenTrue, whenFalse, resultType: trueType,
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
    if (node.kind === "IDENTIFIER") {
        const name = requiredText(node, "identifier");
        if (name === "true" || name === "false" || name === "null") {
            return parseLiteral(Object.assign({}, node, { kind: "LITERAL", text: name }));
        }
        if (name === "this") {
            return Object.assign(identity(node), { kind: "this" as "this" });
        }
        if (name === "super") {
            fail("HARDENED_SUPER_CONTEXT", "super is admitted only as the first zero-argument statement of a derived constructor", node);
        }
        if (context.locals[name] || context.parameters[name] || context.importsByLocal[name]) {
            return Object.assign(identity(node), { kind: "identifier" as "identifier", name });
        }
        if (context.fields[name]) {
            return implicitThisMember(node, name);
        }
        if (context.accessors[name]) {
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
        if (operator !== "=") {
            fail("HARDENED_ASSIGNMENT_OPERATOR", "compound assignment requires an explicit coercion policy", node.children[1]!);
        }
        const target = parseExpression(node.children[0]!, context, false);
        if (target.kind !== "identifier" && target.kind !== "member" && target.kind !== "index") {
            fail("HARDENED_ASSIGNMENT_TARGET", "assignment target is not a writable lvalue", node.children[0]!);
        }
        const value = parseExpression(node.children[2]!, context, true);
        assertAssignmentCompatible(
            assignmentTargetType(target, context, node.children[0]!),
            assignmentType(value, context, node.children[2]!),
            node,
        );
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
        return Object.assign(identity(node), { kind: "index" as "index", target, index, resultType: element });
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
            if (vectorElement(targetType) === null
                || (name !== "length" && name !== "fixed" && !VECTOR_METHODS.has(name))) {
                fail("HARDENED_MEMBER_TARGET", "member target is outside the admitted subset", node);
            }
            capabilitySource = targetType.sourceName;
        }
        return Object.assign(identity(node), { kind: "member" as "member", target, name, capabilitySource });
    }
    if (node.kind === "CALL") {
        if (node.children.length !== 2 || node.children[1]!.kind !== "ARGUMENTS") {
            fail("HARDENED_CALL_SHAPE", "call expression has the wrong normalized shape", node);
        }
        onlyKinds(node.children[1]!, ["AND", "ARRAY", "ARRAY_ACCESSOR", "CALL", "DOT", "EQUALITY", "IDENTIFIER",
            "LITERAL", "NEW", "OR", "RELATION", "VECTOR"]);
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
        if (callee.kind === "super") {
            if (args.length !== 0) {
                fail("HARDENED_SUPER_ARITY", "minimal derived constructor admits only zero-argument super", node);
            }
        } else if (callee.kind === "member" && callee.target.kind === "this" && context.methods[callee.name]) {
            if (context.methods[callee.name]!.parameters.length !== args.length) {
                fail("HARDENED_LOCAL_CALL_ARITY", "local method call does not match its declared arity", node);
            }
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
                        : name === "join" || name === "toString" ? semanticType(node, "String", "string")
                            : name === "forEach" ? semanticType(node, "void", "void")
                                : semanticType(node, "int", "number");
        } else {
            fail("HARDENED_CALL_TARGET", "call target is not a proven local method or super", node);
        }
        const result: CallExpression = Object.assign(identity(node), {
            kind: "call" as "call", callee, arguments: args, capabilitySource, capabilityMember, resultType,
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
            try {
                return Object.assign(identity(node), {
                    kind: "while" as "while", condition,
                    statements: branch.kind === "BLOCK"
                        ? parseBlock(branch, context, constructor, derived, expectedReturn, false)
                        : [parseStatementNode(branch, context, constructor, derived, expectedReturn, false)],
                });
            } finally {
                context.loopDepth -= 1;
            }
        }
        if (node.kind === "BREAK" || node.kind === "CONTINUE") {
            if (node.children.length !== 0) {
                fail("HARDENED_LOOP_LABEL", "labelled loop control remains held", node);
            }
            if (context.loopDepth === 0) {
                fail("HARDENED_LOOP_CONTEXT", "break and continue require an admitted enclosing loop", node);
            }
            return Object.assign(identity(node), { kind: node.kind === "BREAK" ? "break" as "break" : "continue" as "continue" });
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
                };
            });
            return;
        }
        if (node.kind === "BLOCK") {
            node.children.forEach(visit);
            return;
        }
        if (node.kind === "IF") {
            node.children.slice(1).forEach(visit);
            return;
        }
        if (node.kind === "WHILE" && node.children.length >= 2) {
            visit(node.children[1]!);
        }
    };
    visit(block);
}

function parseBlock(block: TreeNode, context: AdapterContext, constructor: boolean,
    derived: boolean, expectedReturn: SemanticType | null, allowLeadingSuper: boolean = true): SemanticStatement[] {
    return block.children.map((node, statementIndex): SemanticStatement => parseStatementNode(
        node, context, constructor, derived, expectedReturn,
        allowLeadingSuper && constructor && derived && statementIndex === 0,
    ));
}

function statementsAlwaysReturn(statements: SemanticStatement[]): boolean {
    if (statements.length === 0) return false;
    const last = statements[statements.length - 1]!;
    return last.kind === "return" || (last.kind === "if" && last.elseStatements !== null
        && statementsAlwaysReturn(last.thenStatements) && statementsAlwaysReturn(last.elseStatements));
}

function parseField(list: TreeNode, context: AdapterContext, readonly: boolean): SemanticField[] {
    onlyKinds(list, ["MOD_LIST", "NAME_TYPE_INIT"]);
    const modifiers = parseModifiers(list, false);
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
            onlyKinds(init, ["ARRAY", "CALL", "DOT", "IDENTIFIER", "LITERAL", "NEW", "OBJECT"]);
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
    const modifiers = parseModifiers(node, false);
    if (constructor && modifiers.indexOf("static") >= 0) {
        fail("HARDENED_CONSTRUCTOR_STATIC", "constructor cannot be static", node);
    }
    if (accessor === "getter" && (parameters.length !== 0 || returnType === null || returnType.sourceName === "void")) {
        fail("HARDENED_GETTER_SIGNATURE", "getter requires zero parameters and one non-void return type", node);
    }
    if (accessor === "setter" && (parameters.length !== 1 || returnType === null || returnType.sourceName !== "void")) {
        fail("HARDENED_SETTER_SIGNATURE", "setter requires exactly one parameter and an explicit void return type", node);
    }
    return { node, name, modifiers, parameters, returnType, block: one(node, "BLOCK")!, constructor, accessor };
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
    const classPosition = content.children.findIndex((child) => child.kind === "CLASS");
    if (classPosition >= 0 && content.children.slice(classPosition + 1).some((child) => child.kind === "IMPORT")) {
        fail("HARDENED_IMPORT_ORDER", "source imports must precede the class and are preserved in source order", content);
    }
    const classes = content.children.filter((child) => child.kind === "CLASS");
    if (classes.length !== 1 || content.children.some((child) => child.kind !== "IMPORT" && child.kind !== "CLASS")) {
        fail("HARDENED_PACKAGE_CONTENT", "minimal semantic adapter requires imports followed by exactly one class", content);
    }
    const classNode = classes[0]!;
    onlyKinds(classNode, ["CONTENT", "EXTENDS", "MOD_LIST", "NAME"]);
    const classNameNode = one(classNode, "NAME")!;
    const className = validateIdentifier(requiredText(classNameNode, "class name"), classNameNode);
    const outputModulePath = modulePath(packageName, className, packageNameNode);
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
            const candidates = (["application", "bootstrap"] as const).map(module =>
                localAuthority.entriesByIdentity[`${module}\u0000${qname}`]).filter((entry): entry is LocalTypeMapping => !!entry)
                .filter(entry => entry.sourcePath === (entry.module === "application"
                    ? `game-client/tapplication_main/src/${sourceLogicalPath}` : `game-client/tmain/src/${sourceLogicalPath}`)
                    && entry.sourceSha256 === sha256(sourceText.replace(/\r\n?/g, "\n")) && entry.typeKind === "class");
            if (candidates.length !== 1) {
                fail("HARDENED_LOCAL_SOURCE_AUTHORITY", "current class path, hash, module, kind, and qname lack one exact graph identity", classNode);
            }
            currentLocal = { entry: candidates[0]!, outputModulePath };
            return currentLocal;
        };
    }
    const parsedImports = parseImports(content, authority, localAuthority, resolveCurrentLocal);
    const placeholder: AdapterContext = {
        className,
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
    };
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
                || pair.getter.modifiers.join("\u0000") !== pair.setter.modifiers.join("\u0000")) {
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
                if ((extendsType !== null && (count !== 1 || !superCall(body[0]!))) || (extendsType === null && count !== 0)) {
                    fail("HARDENED_SUPER_ORDER", "derived constructor requires exactly one first-position super call and it is never reordered", node);
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
                    returnType: header.returnType!, body,
                });
                members.push(getter);
            } else if (header.accessor === "setter") {
                const setter: SemanticSetter = Object.assign(identity(node), {
                    kind: "setter" as "setter", name: header.name, modifiers: header.modifiers,
                    parameter: header.parameters[0]!, body,
                });
                members.push(setter);
            } else {
                if (header.returnType!.sourceName !== "void" && !statementsAlwaysReturn(body)) {
                    fail("HARDENED_RETURN_PATH", "non-void method must return a proven value on every admitted path", node);
                }
                const method: SemanticMethod = Object.assign(identity(node), {
                    kind: "method" as "method", name: header.name, modifiers: header.modifiers,
                    parameters: header.parameters, returnType: header.returnType!, body,
                });
                members.push(method);
            }
            return;
        }
        fail("HARDENED_CLASS_MEMBER", "class member kind is unsupported: " + node.kind, node);
    });
    const declaration: SemanticClass = Object.assign(identity(classNode), {
        name: className,
        modifiers: parseModifiers(classNode, true),
        extendsType,
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
