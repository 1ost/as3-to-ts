import {
    CallExpression,
    CapabilityMapping,
    LoadedCapabilityAuthority,
    NormalizedParserAst,
    NormalizedParserNode,
    SemanticClass,
    SemanticConstructor,
    SemanticExpression,
    SemanticField,
    SemanticIdentity,
    SemanticImport,
    SemanticMember,
    SemanticMethod,
    SemanticModifier,
    SemanticParameter,
    SemanticProgram,
    SemanticStatement,
    SemanticType,
    HardenedSemanticError,
} from "./contracts";
import { assertLoadedCapabilityAuthority, Sha256Function, targetModuleSpecifier } from "./ledger";

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
    parameters: { [name: string]: SemanticParameter };
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
    void: "void",
};
const ALLOWED_MODIFIERS = new Set(["private", "protected", "public", "static"]);
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
        fail("HARDENED_CAPABILITY_ROLE", "Flash API use lacks a double-pinned source/target mapping for role " + role, node);
    }
    return mapping!;
}

function memberMapping(context: AdapterContext, sourceQName: string, access: string, name: string, node: TreeNode): CapabilityMapping | null {
    const matches = Object.keys(context.memberMappingsByKey).map((key) => context.memberMappingsByKey[key])
        .filter((mapping): mapping is CapabilityMapping => mapping !== undefined).filter((mapping) =>
        mapping.sourceQName === sourceQName && mapping.sourceMember !== null
        && mapping.sourceMember.access === access && mapping.sourceMember.name === name);
    if (matches.length > 1) {
        fail("HARDENED_CAPABILITY_MEMBER_OVERLOAD", "multiple member mappings require a future typed overload resolver", node);
    }
    return matches.length === 1 ? matches[0]! : null;
}

function parseImports(content: TreeNode, authority: LoadedCapabilityAuthority): {
    imports: SemanticImport[];
    importsByLocal: { [name: string]: SemanticImport };
} {
    const imports: SemanticImport[] = [];
    const importsByLocal: { [name: string]: SemanticImport } = Object.create(null);
    content.children.filter((child) => child.kind === "IMPORT").forEach((node) => {
        const qname = requiredText(node, "import");
        const mapping = mappingForRole(authority, qname, "import", node);
        const localName = validateIdentifier(qname.slice(qname.lastIndexOf(".") + 1), node);
        if (importsByLocal[localName]) {
            fail("HARDENED_IMPORT_COLLISION", "import local identity is duplicated", node);
        }
        const item: SemanticImport = Object.assign(identity(node), {
            sourceQualifiedName: qname,
            sourceLocalName: localName,
            targetModule: targetModuleSpecifier(mapping.targetModule),
            targetExport: mapping.targetExport,
        });
        imports.push(item);
        importsByLocal[localName] = item;
    });
    return { imports, importsByLocal };
}

function parseType(node: TreeNode, context: AdapterContext, allowVoid: boolean): SemanticType {
    if (node.kind !== "TYPE") {
        fail("HARDENED_TYPE_NODE", "only named source types are admitted", node);
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
            fail("HARDENED_TYPE_UNMAPPED", "source type is not a proven primitive or double-pinned import", node);
        }
    }
    return Object.assign(identity(node), { sourceName, emittedName });
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
        onlyKinds(declaration, ["NAME", "TYPE", "INIT"]);
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
            type: parseType(one(declaration, "TYPE")!, context, false),
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

function implicitThisMember(node: TreeNode, name: string, capabilitySource: string | null = null): SemanticExpression {
    const target = Object.assign(identity(node), { kind: "this" as "this" });
    return Object.assign(identity(node), {
        kind: "member" as "member", target, name, capabilitySource,
    });
}

function assignmentType(expression: SemanticExpression, context: AdapterContext, node: TreeNode): SemanticType {
    if (expression.kind === "identifier" && context.parameters[expression.name]) {
        return context.parameters[expression.name]!.type;
    }
    if (expression.kind === "member" && expression.target.kind === "this" && context.fields[expression.name]) {
        return context.fields[expression.name]!.type;
    }
    if (expression.kind === "literal") {
        if (expression.value === null) {
            fail("HARDENED_ASSIGNMENT_NULL", "null assignment requires an explicit nullable source-to-target type policy", node);
        }
        const sourceName = typeof expression.value === "number" ? "Number"
            : typeof expression.value === "string" ? "String" : "Boolean";
        return Object.assign(identity(node), { sourceName, emittedName: PRIMITIVE_TYPES[sourceName]! });
    }
    if (expression.kind === "methodClosure") {
        return Object.assign(identity(node), { sourceName: "Function", emittedName: "Function" });
    }
    if (expression.kind === "new") {
        return expression.sourceType;
    }
    fail("HARDENED_ASSIGNMENT_TYPE", "assignment value type is not statically proven in the admitted subset", node);
}

function assignmentTargetType(expression: SemanticExpression, context: AdapterContext, node: TreeNode): SemanticType {
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
    fail("HARDENED_ASSIGNMENT_TARGET", "assignment target is not a writable parameter or instance field", node);
}

function assertAssignmentCompatible(target: SemanticType, value: SemanticType, node: TreeNode): void {
    if (target.sourceName === "Object" || (target.sourceName === value.sourceName
        && target.emittedName === value.emittedName)) {
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
    if (node.kind === "NEW") {
        if (node.children.length !== 1 || node.children[0]!.kind !== "CALL") {
            fail("HARDENED_NEW_SHAPE", "constructor expression must contain exactly one direct call", node);
        }
        const call = node.children[0]!;
        if (call.children.length !== 2 || call.children[0]!.kind !== "IDENTIFIER"
            || call.children[1]!.kind !== "ARGUMENTS") {
            fail("HARDENED_NEW_TARGET", "constructor target must be one local or double-pinned imported class", call);
        }
        const nameNode = call.children[0]!;
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
            sourceType = Object.assign(identity(nameNode), { sourceName: name, emittedName: name });
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
            sourceType = Object.assign(identity(nameNode), { sourceName: name, emittedName: name });
        }
        return Object.assign(identity(node), { kind: "new" as "new", sourceType, arguments: args });
    }
    if (node.kind === "IDENTIFIER") {
        const name = requiredText(node, "identifier");
        if (name === "this") {
            return Object.assign(identity(node), { kind: "this" as "this" });
        }
        if (name === "super") {
            fail("HARDENED_SUPER_CONTEXT", "super is admitted only as the first zero-argument statement of a derived constructor", node);
        }
        if (context.parameters[name] || context.importsByLocal[name]) {
            return Object.assign(identity(node), { kind: "identifier" as "identifier", name });
        }
        if (context.fields[name]) {
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
        if (target.kind !== "identifier" && target.kind !== "member") {
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
            if (!context.methods[name] && !context.fields[name]) {
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
            fail("HARDENED_MEMBER_TARGET", "member target is outside the admitted subset", node);
        }
        return Object.assign(identity(node), { kind: "member" as "member", target, name, capabilitySource });
    }
    if (node.kind === "CALL") {
        if (node.children.length !== 2 || node.children[1]!.kind !== "ARGUMENTS") {
            fail("HARDENED_CALL_SHAPE", "call expression has the wrong normalized shape", node);
        }
        onlyKinds(node.children[1]!, ["ARRAY_ACCESSOR", "CALL", "DOT", "IDENTIFIER", "LITERAL"]);
        const rawCallee = node.children[0]!;
        let callee: SemanticExpression;
        if (rawCallee.kind === "IDENTIFIER" && rawCallee.text === "super") {
            if (!allowSuperCall) {
                fail("HARDENED_SUPER_CONTEXT", "super is admitted only as the first zero-argument statement of a derived constructor", rawCallee);
            }
            callee = Object.assign(identity(rawCallee), { kind: "super" as "super" });
        } else {
            if (rawCallee.kind === "IDENTIFIER" && typeof rawCallee.text === "string"
                && !context.parameters[rawCallee.text] && !context.importsByLocal[rawCallee.text]
                && !context.fields[rawCallee.text] && !context.methods[rawCallee.text]
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
        if (callee.kind === "super") {
            if (args.length !== 0) {
                fail("HARDENED_SUPER_ARITY", "minimal derived constructor admits only zero-argument super", node);
            }
        } else if (callee.kind === "member" && callee.target.kind === "this" && context.methods[callee.name]) {
            if (context.methods[callee.name]!.parameters.length !== args.length) {
                fail("HARDENED_LOCAL_CALL_ARITY", "local method call does not match its declared arity", node);
            }
        } else if (callee.kind === "member" && callee.target.kind === "this" && callee.capabilitySource !== null) {
            const mapping = memberMapping(context, callee.capabilitySource, "call", callee.name, node);
            if (mapping === null || mapping.sourceMember === null
                || args.length < mapping.sourceMember.minArgs || args.length > mapping.sourceMember.maxArgs) {
                fail("HARDENED_CAPABILITY_CALL_ARITY", "Flash bridge call does not match the double-pinned source signature", node);
            }
            capabilitySource = mapping.sourceQName;
            capabilityMember = mapping.sourceMember.name;
        } else {
            fail("HARDENED_CALL_TARGET", "call target is not a proven local method or super", node);
        }
        const result: CallExpression = Object.assign(identity(node), {
            kind: "call" as "call", callee, arguments: args, capabilitySource, capabilityMember,
        });
        return result;
    }
    fail("HARDENED_EXPRESSION_UNSUPPORTED", "normalized expression kind is unsupported: " + node.kind, node);
}

function parseBlock(block: TreeNode, context: AdapterContext, constructor: boolean,
    derived: boolean): SemanticStatement[] {
    return block.children.map((node, statementIndex): SemanticStatement => {
        if (node.kind === "CALL" || node.kind === "ASSIGN") {
            return Object.assign(identity(node), {
                kind: "expression" as "expression",
                expression: parseExpression(node, context, false,
                    constructor && derived && statementIndex === 0, true, node.kind === "ASSIGN"),
            });
        }
        if (node.kind === "RETURN") {
            if (node.children.length !== 0) {
                fail("HARDENED_RETURN_VALUE", "expression returns remain blocked because the pinned parser historically aliases throw as RETURN", node);
            }
            return Object.assign(identity(node), {
                kind: "return" as "return",
                expression: null,
            });
        }
        fail("HARDENED_STATEMENT_UNSUPPORTED", "normalized statement kind is unsupported: " + node.kind, node);
    });
}

function parseField(list: TreeNode, context: AdapterContext, readonly: boolean): SemanticField[] {
    onlyKinds(list, ["MOD_LIST", "NAME_TYPE_INIT"]);
    const modifiers = parseModifiers(list, false);
    const declarations = list.children.filter((child) => child.kind === "NAME_TYPE_INIT");
    if (declarations.length === 0) {
        fail("HARDENED_FIELD_EMPTY", "field declaration must contain at least one source declarator", list);
    }
    return declarations.map((declaration) => {
        onlyKinds(declaration, ["INIT", "NAME", "TYPE"]);
        const nameNode = one(declaration, "NAME")!;
        const name = validateIdentifier(requiredText(nameNode, "field name"), nameNode);
        if (context.fields[name] || context.methods[name]) {
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
        const fieldType = parseType(one(declaration, "TYPE")!, context, false);
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
    if (node.kind !== "FUNCTION") {
        fail("HARDENED_METHOD_KIND", "getters, setters, and other callable forms are not admitted yet", node);
    }
    onlyKinds(node, ["BLOCK", "MOD_LIST", "NAME", "PARAMETER_LIST", "TYPE"]);
    const nameNode = one(node, "NAME")!;
    const name = validateIdentifier(requiredText(nameNode, "method name"), nameNode);
    const constructor = name === className;
    const returnNode = one(node, "TYPE")!;
    const returnType = constructor ? null : parseType(returnNode, context, true);
    if (constructor && (returnNode.text !== null && returnNode.text !== "")) {
        fail("HARDENED_CONSTRUCTOR_RETURN", "constructor must not declare a return type", returnNode);
    }
    const parameters = parseParameters(one(node, "PARAMETER_LIST")!, context);
    const modifiers = parseModifiers(node, false);
    if (constructor && modifiers.indexOf("static") >= 0) {
        fail("HARDENED_CONSTRUCTOR_STATIC", "constructor cannot be static", node);
    }
    return { node, name, modifiers, parameters, returnType, block: one(node, "BLOCK")!, constructor };
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
    sourceText: string, sha256: Sha256Function): SemanticProgram {
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
    const parsedImports = parseImports(content, authority);
    const classes = content.children.filter((child) => child.kind === "CLASS");
    if (classes.length !== 1 || content.children.some((child) => child.kind !== "IMPORT" && child.kind !== "CLASS")) {
        fail("HARDENED_PACKAGE_CONTENT", "minimal semantic adapter requires imports followed by exactly one class", content);
    }
    const classNode = classes[0]!;
    onlyKinds(classNode, ["CONTENT", "EXTENDS", "MOD_LIST", "NAME"]);
    const classNameNode = one(classNode, "NAME")!;
    const className = validateIdentifier(requiredText(classNameNode, "class name"), classNameNode);
    const placeholder: AdapterContext = {
        className,
        extendsType: null,
        importsByLocal: parsedImports.importsByLocal,
        mappingsBySource: authority.typeMappingsBySource,
        memberMappingsByKey: authority.memberMappingsByKey,
        baseSourceQName: null,
        fields: Object.create(null),
        methods: Object.create(null),
        parameters: Object.create(null),
    };
    const extendsNode = one(classNode, "EXTENDS", true);
    let extendsType: SemanticType | null = null;
    if (extendsNode !== null) {
        const sourceName = requiredText(extendsNode, "base type");
        const imported = parsedImports.importsByLocal[sourceName];
        if (!imported) {
            fail("HARDENED_BASE_TYPE", "base type must be a double-pinned imported Flash class", extendsNode);
        }
        mappingForRole(authority, imported!.sourceQualifiedName, "base-type", extendsNode);
        extendsType = Object.assign(identity(extendsNode), { sourceName, emittedName: sourceName });
        placeholder.extendsType = extendsType;
        placeholder.baseSourceQName = imported.sourceQualifiedName;
    }
    const classContent = one(classNode, "CONTENT")!;
    const functionNodes = classContent.children.filter((child) => child.kind === "FUNCTION");
    functionNodes.forEach((node) => {
        const header = parseMethodHeader(node, className, placeholder);
        if (placeholder.methods[header.name]) {
            fail("HARDENED_METHOD_DUPLICATE", "method identity is duplicated", node);
        }
        placeholder.methods[header.name] = header;
    });
    if (extendsType !== null && !functionNodes.some((node) =>
        requiredText(one(node, "NAME")!, "method name") === className)) {
        fail("HARDENED_DERIVED_CONSTRUCTOR", "minimal derived classes require an explicit constructor with proven zero-argument super semantics", classNode);
    }
    const members: SemanticMember[] = [];
    classContent.children.forEach((node) => {
        if (node.kind === "VAR_LIST" || node.kind === "CONST_LIST") {
            members.push.apply(members, parseField(node, placeholder, node.kind === "CONST_LIST"));
            return;
        }
        if (node.kind === "FUNCTION") {
            const header = placeholder.methods[requiredText(one(node, "NAME")!, "method name")]!;
            const oldParameters = placeholder.parameters;
            placeholder.parameters = Object.create(null);
            header.parameters.forEach((parameter) => { placeholder.parameters[parameter.name] = parameter; });
            const body = parseBlock(header.block, placeholder, header.constructor, extendsType !== null);
            placeholder.parameters = oldParameters;
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
            } else {
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
        outputModulePath: modulePath(packageName, className, packageNameNode),
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
