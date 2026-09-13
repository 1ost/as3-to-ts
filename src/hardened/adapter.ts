import {
    CallExpression,
    CapabilityMapping,
    LoadedCapabilityAuthority,
    LoadedLocalMemberAuthority,
    LoadedLocalTypeAuthority,
    LocalDeclarationMember,
    FileLocalClassDeclaration,
    LocalMemberAuthorityEntry,
    LocalTypeMapping,
    NativeTimerFunctionMapping,
    NormalizedParserAst,
    NormalizedParserNode,
    SemanticClass,
    InheritedAccessorForward,
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
    SemanticPackageField,
    SemanticPackageFunction,
    SemanticProgram,
    SemanticSetter,
    SemanticStatement,
    SemanticType,
    ReferenceCoercion,
    HardenedSemanticError,
} from "./contracts";
import { assertLoadedCapabilityAuthority, Sha256Function, targetModuleSpecifier } from "./ledger";
import { assertLoadedLocalTypeAuthority } from "./local-types";
import { assertLoadedLocalMemberAuthority } from "./local-members";
import { extractLocalDeclaration } from "./local-declarations";
import { AS3FileLocalClassScope, fileLocalClassIdentity } from "../hardened-runtime/internal/AS3FileLocalIdentity";
import { assertAuthenticatedRuntimeAuthoritySources, type RuntimeAuthoritySource } from "./type-authority";
import { assertLoadedSourceMemberAuthority, type LoadedSourceMemberAuthority } from "./source-member-authority";

export interface TreeNode extends NormalizedParserNode {
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
    enumerationBinding?: true;
    node: TreeNode;
    name: string;
    readonly: boolean;
    type: SemanticType;
    lambdaSignature: { parameters: SemanticParameter[]; returnType: SemanticType } | null;
}

interface SignatureTypeProof { ownerQName: string; member: LocalDeclarationMember; }

interface AdapterContext {
    packageFunction?: true;
    fileCompilation?: FileLocalCompilation;
    className: string;
    classQualifiedName: string;
    extendsType: SemanticType | null;
    importsByLocal: { [name: string]: SemanticImport };
    resolveImportedType: (sourceName: string, expectedKind: "class" | "interface" | null,
        node: TreeNode, signature?: SignatureTypeProof) => SemanticImport | null;
    mappingsBySource: { [name: string]: CapabilityMapping };
    memberMappingsByKey: { [name: string]: CapabilityMapping };
    intrinsicMembersByKey: LoadedCapabilityAuthority["intrinsicMembersByKey"];
    nativeTimerFunctionsBySource: { [name: string]: NativeTimerFunctionMapping };
    baseSourceQName: string | null;
    baseLocalQName: string | null;
    localTypeAuthority: LoadedLocalTypeAuthority | null;
    localMemberAuthority: LoadedLocalMemberAuthority | null;
    resolveCurrentLocal: (() => CurrentLocalType) | null;
    runtimeReferenceParentsByQName: ReadonlyMap<string, readonly string[]>;
    sourceMemberAuthority: LoadedSourceMemberAuthority | null;
    currentInterfaceQNames: readonly string[];
    fields: { [name: string]: SemanticField };
    methods: { [name: string]: MethodHeader };
    accessors: { [name: string]: AccessorPair };
    inheritedAccessors?: InheritedAccessorForward[];
    parameters: { [name: string]: SemanticParameter };
    locals: { [name: string]: LocalHeader };
    loopDepth: number;
    breakableDepth: number;
    labels: Array<{ name: string; continuable: boolean }>;
    namespaceNames: { [name: string]: true };
    lambdaDepth: number;
    lexicalThisUses: number;
    currentCallable: MethodHeader | null;
    ownRecordTargetDepth: number;
    ownRecordInitializations: number;
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
    Class: "__as3ClassValue",
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

export function buildTree(ast: NormalizedParserAst, sourceText: string, sha256: Sha256Function): TreeNode {
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
    if (value.toLowerCase().startsWith("__as3")) {
        fail("HARDENED_IDENTIFIER", "source identifier is reserved for the authenticated AS3 emitter", node);
    }
    if (value === "WeakSet" || value === "WeakMap" || value === "isAS3ClassInstance"
        || value === "as3ConstructionTarget" || value === "isAS3ConstructionProof") {
        fail("HARDENED_IDENTIFIER", "source identifier collides with an authenticated AS3 emitter binding", node);
    }
    return value;
}

function parseModifiers(owner: TreeNode, classLevel: boolean, arrayDynamic:boolean = false): SemanticModifier[] {
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
        const finalClass = classLevel && owner.kind === "CLASS" && modifier === "final";
        if ((!ALLOWED_MODIFIERS.has(modifier) && !(arrayDynamic && modifier === "dynamic") && !finalClass)
            || seen[modifier] || (classLevel && modifier !== "public" && !(arrayDynamic && modifier === "dynamic") && !finalClass)) {
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
    if (matches.length === 1) return matches[0]!;
    const seen = new Set<string>();
    let current = sourceQName;
    while (context.sourceMemberAuthority !== null) {
        if (seen.has(current)) fail("HARDENED_CAPABILITY_MEMBER_ANCESTRY", "Native member ancestry is cyclic", node);
        seen.add(current);
        const declaration = context.sourceMemberAuthority.entriesByQName[current];
        // An unmapped declaration shadows its bases; never bypass that hold.
        if (!declaration || declaration.ownInstanceMemberNames.includes(name) || declaration.baseQName === null) return null;
        current = declaration.baseQName;
        const inherited = Object.values(context.memberMappingsByKey).filter((mapping): mapping is CapabilityMapping =>
            !!mapping && mapping.sourceQName === current && mapping.sourceMember?.access === access && mapping.sourceMember.name === name);
        if (inherited.length > 1) fail("HARDENED_CAPABILITY_MEMBER_OVERLOAD", "Inherited native member requires overload resolution", node);
        if (inherited.length === 1) return inherited[0]!;
    }
    return null;
}

function flashBaseMemberMapping(context: AdapterContext, access: string, name: string, node: TreeNode): CapabilityMapping | null {
    let qname = context.baseLocalQName || context.baseSourceQName;
    const seen = new Set<string>();
    while (qname !== null) {
        if (seen.has(qname) || seen.size >= 1024) fail("HARDENED_LOCAL_MEMBER_CYCLE", "base member lineage is cyclic", node);
        seen.add(qname);
        if (context.mappingsBySource[qname] || qname === "Array" && nativeArrayBase(context))
            return memberMapping(context, qname, access, name, node);
        const moduleName = context.resolveCurrentLocal?.().entry.module;
        const local = moduleName ? contextLocalMember(context, moduleName, qname) : undefined;
        if (!local || local.status !== "complete" || !local.declaration)
            fail("HARDENED_LOCAL_MEMBER_HELD", `base member authority is incomplete for ${qname}`, node);
        if (local.declaration.baseQNames.length > 1) fail("HARDENED_LOCAL_MEMBER_BASE", "base member lineage is ambiguous", node);
        qname = local.declaration.baseQNames[0] || null;
    }
    return null;
}

interface AuthenticatedSourceMemberSignature {
    parameterTypes: string[];
    restParameterType?: string;
    returnType: string;
}

function splitSignatureParameters(text: string, node: TreeNode): string[] {
    if (text.trim() === "") return [];
    const result: string[] = [];
    let start = 0;
    let depth = 0;
    for (let index = 0; index < text.length; index += 1) {
        const char = text[index]!;
        if ("(<[{".indexOf(char) >= 0) depth += 1;
        else if (")>]}".indexOf(char) >= 0) depth -= 1;
        else if (char === "," && depth === 0) {
            result.push(text.slice(start, index).trim());
            start = index + 1;
        }
        if (depth < 0) fail("HARDENED_SOURCE_MEMBER_SIGNATURE", "source member parameter syntax is unbalanced", node);
    }
    if (depth !== 0) fail("HARDENED_SOURCE_MEMBER_SIGNATURE", "source member parameter syntax is unbalanced", node);
    result.push(text.slice(start).trim());
    return result;
}

function authenticatedSourceMemberSignature(mapping: CapabilityMapping, node: TreeNode): AuthenticatedSourceMemberSignature {
    if (mapping.sourceMember === null) {
        fail("HARDENED_SOURCE_MEMBER_SIGNATURE", "member mapping lacks its source signature", node);
    }
    const member = mapping.sourceMember!;
    const escapedName = member.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const callable = new RegExp(`^public (?:static )?(?:native )?function (?:(?:get|set) )?${escapedName}\\((.*)\\)\\s*:\\s*([^;\\s]+)\\s*;?$`)
        .exec(member.signature);
    const constructor = new RegExp(`^public function ${escapedName}\\((.*)\\)$`).exec(member.signature);
    const variable = new RegExp(`^public (?:static )?(?:const|var) ${escapedName}:([^;\\s]+)(?:\\s*=\\s*[^;]+)?;$`)
        .exec(member.signature);
    if (variable) {
        const type = variable[1]!;
        return { parameterTypes: member.access === "write" ? [type] : [], returnType: type };
    }
    const match = callable || constructor;
    if (!match) {
        fail("HARDENED_SOURCE_MEMBER_SIGNATURE", `source member signature is outside the closed AS3 callable/property grammar: ${mapping.sourceQName}.${member.name}: ${member.signature.slice(0,500)}`, node);
    }
    const rawParameters = splitSignatureParameters(match![1]!, node);
    const restIndex = rawParameters.findIndex(parameter => parameter.startsWith("..."));
    if (restIndex >= 0 && (restIndex !== rawParameters.length - 1 || rawParameters[restIndex]!.includes("=")))
        fail("HARDENED_SOURCE_MEMBER_SIGNATURE", "native rest parameter must be final and have no default", node);
    const parameters = rawParameters.map(parameter => {
        const parameterMatch = /^(?:\.\.\.)?[A-Za-z_$][A-Za-z0-9_$]*\s*:\s*([^=\s]+)(?:\s*=.*)?$/.exec(parameter);
        if (!parameterMatch) {
            fail("HARDENED_SOURCE_MEMBER_SIGNATURE", "source member parameter lacks one exact source type", node);
        }
        return parameterMatch![1]!;
    });
    const returnType = constructor ? mapping.sourceQName : callable![2]!;
    const required = rawParameters.filter(parameter => !parameter.startsWith("...") && !parameter.includes("=")).length;
    if ((restIndex < 0 ? parameters.length : 1000000) !== member.maxArgs || member.minArgs !== required) {
        fail("HARDENED_SOURCE_MEMBER_SIGNATURE", "source member signature and authenticated arity disagree", node);
    }
    return { parameterTypes: parameters, returnType,
        ...(restIndex < 0 ? {} : {restParameterType:parameters[restIndex]!}) };
}

function mappedFlashQNameForType(type: SemanticType, context: AdapterContext): string | null {
    const imported = context.importsByLocal[type.sourceName];
    return imported?.authorityKind === "flash" ? imported.sourceQualifiedName : null;
}

function mappedMemberType(mapping: CapabilityMapping, access: "read" | "write",
    context: AdapterContext, node: TreeNode): SemanticType {
    const signature = authenticatedSourceMemberSignature(mapping, node);
    const typeName = access === "write" ? signature.parameterTypes[0] : signature.returnType;
    if (!typeName) {
        fail("HARDENED_SOURCE_MEMBER_SIGNATURE", "mapped property lacks its authenticated source value type", node);
    }
    return authoritySemanticType(typeName!, context, node);
}

function adaptMappedCall(mapping: CapabilityMapping, argumentsList: SemanticExpression[], argumentNodes: TreeNode[],
    context: AdapterContext, node: TreeNode): SemanticType {
    if (mapping.sourceMember === null || argumentsList.length < mapping.sourceMember.minArgs
        || argumentsList.length > mapping.sourceMember.maxArgs) {
        fail("HARDENED_CAPABILITY_CALL_ARITY", "Flash bridge call does not match its double-pinned source arity", node);
    }
    const signature = authenticatedSourceMemberSignature(mapping, node);
    argumentsList.forEach((argument, index) => {
        const parameterType = signature.parameterTypes[index] || signature.restParameterType;
        if (!parameterType) {
            fail("HARDENED_CAPABILITY_CALL_TYPE", `Flash bridge argument ${index} lacks an authenticated source type`,
                argumentNodes[index] || node);
        }
        try {
            const expected = authoritySemanticType(parameterType!, context, node);
            const valueType = assignmentType(argument, context, argumentNodes[index] || node);
            const adapted = adaptAssignmentValue(expected, argument, context, argumentNodes[index] || node);
            argumentsList[index] = expected.nullable && valueType.nullable
                && !["Object", "*"].includes(expected.sourceName)
                ? Object.assign(identity(argumentNodes[index] || node), {
                    kind: "nonNull" as "nonNull", expression: adapted,
                    resultType: withNullability(expected, false),
                }) : adapted;
        } catch (error) {
            if (error instanceof HardenedSemanticError) {
                fail("HARDENED_CAPABILITY_CALL_TYPE", `Flash bridge ${mapping.sourceQName}.${mapping.sourceMember!.name} argument ${index} must match ${parameterType}: ${error.message}`,
                    argumentNodes[index] || node);
            }
            throw error;
        }
    });
    return authoritySemanticType(signature.returnType, context, node);
}

function intrinsicMember(context: AdapterContext, sourceQName: string, access: "call" | "read" | "write",
    name: string): LoadedCapabilityAuthority["intrinsicMembersByKey"][string] | null {
    return context.intrinsicMembersByKey[`${sourceQName}\u0000${access}\u0000${name}`] || null;
}

function intrinsicSourceForType(type: SemanticType, context: AdapterContext): string | null {
    const imported = context.importsByLocal[type.sourceName];
    return imported?.authorityKind === "intrinsic" ? imported.sourceQualifiedName : null;
}

function relativeLocalModule(currentModulePath: string, target: LocalTypeMapping,
    authority: LoadedLocalTypeAuthority): string {
    const prefix = authority.targetRoots[target.module];
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

function assertPackageRuntimeValue(authority: LoadedLocalMemberAuthority, module: "application" | "bootstrap",
    entry: LocalMemberAuthorityEntry, node: TreeNode): void {
    const declaration = entry.declaration;
    if (declaration === null || declaration.members.length !== 1 || declaration.packageInitializer === null) {
        fail("HARDENED_LOCAL_PACKAGE_OUTPUT", "package runtime value lacks one authenticated initializer", node);
    }
    const field = declaration.members[0]!;
    const initializer = declaration.packageInitializer!;
    if (field.kind !== "field" || field.fieldType === null || initializer.targetQName !== field.fieldType
        || initializer.argumentCount !== 0) {
        fail("HARDENED_LOCAL_PACKAGE_OUTPUT", "package runtime value initializer disagrees with its exact field type", node);
    }
    const target = authority.entriesByIdentity[`${module}\u0000${initializer.targetQName}`];
    if (!target || target.status !== "complete" || target.typeKind !== "class" || target.declaration === null) {
        fail("HARDENED_LOCAL_PACKAGE_INITIALIZER_HELD",
            `package runtime value constructor ${initializer.targetQName} is not complete`, node);
    }
    const constructors = target.declaration.members.filter(member => member.kind === "constructor");
    const constructorParameters = constructors.length === 1 ? constructors[0]!.parameters : [];
    const required = constructorParameters.filter(parameter => !parameter.optional && !parameter.rest).length;
    const visibility = constructors.length === 1 ? memberVisibility(constructors[0]!.modifiers) : "public";
    if (constructors.length > 1 || required !== 0 || visibility === "private" || visibility === "protected") {
        fail("HARDENED_LOCAL_PACKAGE_INITIALIZER_ARITY",
            `package runtime value constructor ${initializer.targetQName} is not visible zero-argument construction`, node);
    }
}

function localSemanticImport(target: LocalTypeMapping, currentLocal: CurrentLocalType,
    node: TreeNode, localTypeAuthority: LoadedLocalTypeAuthority,
    localMemberAuthority: LoadedLocalMemberAuthority | null = null, fileLocalName?: string): SemanticImport {
    const localName = validateIdentifier(fileLocalName ?? target.qname.slice(target.qname.lastIndexOf(".") + 1), node);
    let localValueType: string | null = null;
    let compileTimeNamespace = false;
    let localFunction: true | undefined;
    if (target.typeKind === "package") {
        if (localMemberAuthority === null) {
            fail("HARDENED_LOCAL_MEMBER_AUTHORITY", "package symbol import requires local member authority", node);
        }
        assertLoadedLocalMemberAuthority(localMemberAuthority);
        const entry = localMemberAuthority.entriesByIdentity[`${target.module}\u0000${target.qname}`];
        if (!entry || entry.status !== "complete" || entry.declaration === null
            || entry.declaration.members.length !== 1) {
            fail("HARDENED_LOCAL_MEMBER_HELD", `package symbol ${target.qname} lacks one complete declaration`, node);
        }
        const member = entry.declaration.members[0]!;
        if (member.name !== localName || (member.kind !== "field" && member.kind !== "namespace" && member.kind !== "method")) {
            fail("HARDENED_LOCAL_PACKAGE_SYMBOL", "package symbol declaration disagrees with its import identity", node);
        }
        if (member.kind === "field") {
            if (!member.readonly || member.fieldType === null || member.modifiers.length !== 1
                || member.modifiers[0] !== "public") {
                fail("HARDENED_LOCAL_PACKAGE_OUTPUT",
                    "package runtime value is not one authenticated public const declaration", node);
            }
            assertPackageRuntimeValue(localMemberAuthority, target.module, entry, node);
            localValueType = member.fieldType;
        }
        if (member.kind === "method") {
            if (member.modifiers.length !== 1 || member.modifiers[0] !== "public" || member.namespaceName !== null)
                fail("HARDENED_LOCAL_PACKAGE_OUTPUT", "package function must retain its public declaration", node);
            localValueType = "Function"; localFunction = true;
        }
        compileTimeNamespace = member.kind === "namespace";
    }
    return Object.assign(identity(node), {
        authorityKind: "local" as "local", localNodeId: target.nodeId,
        runtimeConstructible: target.typeKind === "class", runtimeInterface: target.typeKind === "interface",
        localValueType, compileTimeNamespace, ...(localFunction ? {localFunction} : {}),
        sourceQualifiedName: target.qname, sourceLocalName: localName,
        targetModule: relativeLocalModule(currentLocal.outputModulePath, target, localTypeAuthority),
        targetExport: fileLocalName ? "__as3FileLocalClass" : localName,
    });
}

function oneType(node: TreeNode): TreeNode {
    const matches = node.children.filter(child => child.kind === "TYPE" || child.kind === "VECTOR");
    if (matches.length !== 1) fail("HARDENED_TYPE_CARDINALITY", "declaration requires exactly one type", node);
    return matches[0]!;
}

/** Import a type proved by a used declaration without granting a source-level name. */
function signatureTypeImport(typeName:string, proof:SignatureTypeProof | undefined,
    current:CurrentLocalType, types:LoadedLocalTypeAuthority, members:LoadedLocalMemberAuthority | null,
    imports:SemanticImport[], importsByLocal:{[name:string]:SemanticImport}, node:TreeNode):SemanticImport | null {
    if (!proof) return null;
    const target=types.entriesByIdentity[`${current.entry.module}\u0000${typeName}`];
    if (!target || !target.importable || !["class","interface"].includes(target.typeKind)) return null;
    const owner=types.entriesByIdentity[`${current.entry.module}\u0000${proof.ownerQName}`];
    const declaration=members?.entriesByIdentity[`${current.entry.module}\u0000${proof.ownerQName}`];
    const element=(name:string):string=>name.startsWith("Vector.<") && name.endsWith(">")
        ? element(name.slice(8,-1)) : name;
    const signatureNames=[proof.member.returnType,proof.member.fieldType,...proof.member.parameters.map(parameter=>parameter.type)];
    if (!owner || !declaration || declaration.status !== "complete" || !declaration.declaration?.members.includes(proof.member)
        || !signatureNames.some(name=>name !== null && element(name) === typeName)
        || (owner.nodeId !== current.entry.nodeId && !current.entry.prerequisites.includes(owner.nodeId)
            && !imports.some(item=>item.authorityKind === "local" && item.localNodeId === owner.nodeId))
        || (owner.nodeId !== target.nodeId && !owner.prerequisites.includes(target.nodeId)))
        fail("HARDENED_SIGNATURE_TYPE_EDGE","signature type lacks its authenticated owner, member or dependency edge: "+typeName,node);
    const name=typeName.slice(typeName.lastIndexOf(".")+1);
    if (current.entry.prerequisites.includes(target.nodeId)
        && (!importsByLocal[name] || importsByLocal[name]!.sourceQualifiedName === typeName)) return null;
    const existing=imports.find(item=>item.sourceQualifiedName === typeName);
    if(existing) return existing;
    // Reserved aliases cannot be spelled by admitted original AS3 declarations.
    const alias="__as3Signature"+imports.length;
    const item={...localSemanticImport(target,current,node,types,members),sourceLocalName:alias};
    imports.push(item);importsByLocal[alias]=item;
    return item;
}

function flashSemanticImport(authority: LoadedCapabilityAuthority, qname: string, node: TreeNode): SemanticImport {
        const localName = validateIdentifier(qname.slice(qname.lastIndexOf(".") + 1), node);
        const mapping = mappingForRole(authority, qname, "import", node);
        return Object.assign(identity(node), {
            authorityKind: "flash" as "flash", localNodeId: null,
            runtimeConstructible: mapping.targetKind === "class", runtimeInterface: mapping.targetKind === "interface",
            localValueType: null, compileTimeNamespace: false,
            sourceQualifiedName: qname, sourceLocalName: localName,
            targetModule: targetModuleSpecifier(mapping.targetModule), targetExport: mapping.targetExport,
        });
}

function parseImports(content: TreeNode, authority: LoadedCapabilityAuthority,
    localAuthority: LoadedLocalTypeAuthority | undefined, resolveCurrentLocal: (() => CurrentLocalType) | null,
    localMemberAuthority: LoadedLocalMemberAuthority | null): {
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
    const flashImport = (qname: string, node: TreeNode): SemanticImport => flashSemanticImport(authority, qname, node);
    const intrinsicImport = (qname: string, node: TreeNode): SemanticImport => {
        const localName = validateIdentifier(qname.slice(qname.lastIndexOf(".") + 1), node);
        const mapping = authority.intrinsicTypesBySource[qname];
        if (!mapping || mapping.sourceRoles.indexOf("import") < 0) {
            fail("HARDENED_INTRINSIC_IMPORT", "intrinsic import lacks exact source-census authority", node);
        }
        return Object.assign(identity(node), {
            authorityKind: "intrinsic" as "intrinsic", localNodeId: null,
            runtimeConstructible: true, runtimeInterface: false,
            localValueType: null, compileTimeNamespace: false,
            sourceQualifiedName: qname, sourceLocalName: localName,
            targetModule: mapping.targetModule, targetExport: mapping.targetExport,
        });
    };
    const nativeTimerImport = (qname: string, node: TreeNode): SemanticImport => {
        const localName = validateIdentifier(qname.slice(qname.lastIndexOf(".") + 1), node);
        const mapping = authority.nativeTimerFunctionsBySource[qname];
        if (!mapping || mapping.sourceRoles.indexOf("import") < 0) {
            fail("HARDENED_NATIVE_TIMER_IMPORT", "native timer lacks exact import authority", node);
        }
        return Object.assign(identity(node), {
            authorityKind: "native-timer-function" as "native-timer-function", localNodeId: null,
            runtimeConstructible: false, runtimeInterface: false, localValueType: null,
            compileTimeNamespace: false, sourceQualifiedName: qname, sourceLocalName: localName,
            targetModule: mapping.targetModule, targetExport: mapping.targetExport,
        });
    };
    const localImport = (target: LocalTypeMapping, currentLocal: CurrentLocalType,
        node: TreeNode): SemanticImport => {
        return localSemanticImport(target, currentLocal, node, localAuthority!, localMemberAuthority);
    };
    content.children.filter((child) => child.kind === "IMPORT").forEach((node) => {
        const qname = requiredText(node, "import");
        if (qname.endsWith(".*")) {
            const prefix = qname.slice(0, -1);
            const flashMatches = Object.keys(authority.typeMappingsBySource)
                .filter(candidate => candidate.startsWith(prefix) && !candidate.slice(prefix.length).includes("."))
                .sort(compareUtf8);
            const intrinsicMatches = Object.keys(authority.intrinsicTypesBySource)
                .filter(candidate => candidate.startsWith(prefix) && !candidate.slice(prefix.length).includes("."))
                .sort(compareUtf8);
            const nativeTimerMatches = Object.keys(authority.nativeTimerFunctionsBySource)
                .filter(candidate => candidate.startsWith(prefix) && !candidate.slice(prefix.length).includes(".")
                    && authority.nativeTimerFunctionsBySource[candidate]!.sourceRoles.indexOf("wildcard-resolution") >= 0)
                .sort(compareUtf8);
            if (flashMatches.length > 0 || intrinsicMatches.length > 0 || nativeTimerMatches.length > 0) {
                flashMatches.forEach(candidate => append(flashImport(candidate, node), node));
                intrinsicMatches.forEach(candidate => append(intrinsicImport(candidate, node), node));
                nativeTimerMatches.forEach(candidate => append(nativeTimerImport(candidate, node), node));
                return;
            }
            if (qname.startsWith("flash.")) return;
            if (!localAuthority || !resolveCurrentLocal) {
                fail("HARDENED_LOCAL_IMPORT_AUTHORITY", "project-local wildcard import requires the authenticated dependency type map", node);
            }
            const currentLocal = resolveCurrentLocal();
            const localMatches = localAuthority.entries.filter(target => target.module === currentLocal.entry.module
                && target.qname.startsWith(prefix) && !target.qname.slice(prefix.length).includes(".")
                && target.importable
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
        } else if (authority.intrinsicTypesBySource[qname]) {
            item = intrinsicImport(qname, node);
        } else if (authority.nativeTimerFunctionsBySource[qname]) {
            item = nativeTimerImport(qname, node);
        } else {
            if (qname.startsWith("flash.")) {
                fail("HARDENED_FLASH_IMPORT_UNMAPPED",
                    "Flash import lacks an admitted source/target capability mapping: " + qname, node);
            }
            if (!localAuthority || !resolveCurrentLocal) {
                fail("HARDENED_LOCAL_IMPORT_AUTHORITY", "project-local import requires the authenticated dependency type map", node);
            }
            const currentLocal = resolveCurrentLocal();
            const target = localAuthority.entriesByIdentity[`${currentLocal.entry.module}\u0000${qname}`];
            if (!target || !target.importable) {
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
    typeArguments: SemanticType[] = [], nullableOverride?: boolean, runtimeName: string | null = null): SemanticType {
    const nullable = nullableOverride === undefined
        ? !["Boolean", "Number", "int", "uint", "void"].includes(sourceName)
        : nullableOverride;
    return Object.assign(identity(node), { sourceName, emittedName, runtimeName, nullable, typeArguments });
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

function referenceParents(qname: string, context: AdapterContext): readonly string[] | null {
    if (qname === "Array" && nativeArrayBase(context)) return [];
    const mapped = context.runtimeReferenceParentsByQName.get(qname);
    if (mapped !== undefined) {
        if (context.localMemberAuthority !== null && context.resolveCurrentLocal !== null) {
            const moduleName = context.resolveCurrentLocal().entry.module;
            if (contextLocalMember(context, moduleName, qname)) return null;
        }
        return mapped;
    }
    if (qname === context.classQualifiedName) {
        return Object.freeze((context.extendsType?.runtimeName === null || context.extendsType === null
            ? [] : [context.extendsType.runtimeName]).concat(context.currentInterfaceQNames));
    }
    if (context.localMemberAuthority === null || context.resolveCurrentLocal === null) return null;
    const moduleName = context.resolveCurrentLocal().entry.module;
    const entry = contextLocalMember(context, moduleName, qname);
    if (!entry || entry.status !== "complete" || entry.declaration === null
        || (entry.typeKind !== "class" && entry.typeKind !== "interface")) return null;
    return entry.declaration.baseQNames.concat(entry.declaration.interfaceQNames);
}

function provenReferenceSubtype(source: SemanticType, target: SemanticType, context: AdapterContext): boolean {
    if (sameUnderlyingType(source, target)) return true;
    if (target.sourceName === "Array" && target.emittedName === "Array" && isArrayType(source,context)) return true;
    if (context.sourceMemberAuthority !== null && source.sourceName === "ArgumentError"
        && source.emittedName === "__AS3ArgumentError" && source.runtimeName === "ArgumentError"
        && target.sourceName === "Error" && target.emittedName === "Error") return true;
    if (source.runtimeName === null || target.runtimeName === null || source.typeArguments.length !== 0
        || target.typeArguments.length !== 0) return false;
    const states = new Map<string, "visiting" | "complete">();
    const remaining: Array<{ qname: string; exiting: boolean }> = [{ qname: source.runtimeName, exiting: false }];
    let containsTarget = false;
    while (remaining.length > 0) {
        if (states.size >= 4096) return false;
        const current = remaining.pop()!;
        if (current.exiting) {
            states.set(current.qname, "complete");
            continue;
        }
        const state = states.get(current.qname);
        if (state === "visiting") return false;
        if (state === "complete") continue;
        states.set(current.qname, "visiting");
        if (current.qname === target.runtimeName) containsTarget = true;
        const parents = referenceParents(current.qname, context);
        if (parents === null || parents.some(parent => typeof parent !== "string" || parent.length === 0)
            || new Set(parents).size !== parents.length) return false;
        remaining.push({ qname: current.qname, exiting: true });
        for (let index = parents.length - 1; index >= 0; index -= 1) {
            remaining.push({ qname: parents[index]!, exiting: false });
        }
    }
    return containsTarget;
}

function runtimeReferenceParents(sources: readonly RuntimeAuthoritySource[] | undefined): ReadonlyMap<string, readonly string[]> {
    const result = new Map<string, readonly string[]>();
    if (sources === undefined) return result;
    assertAuthenticatedRuntimeAuthoritySources(sources);
    sources.forEach(source => {
        if (!source || typeof source !== "object" || typeof source.qname !== "string" || source.qname.length === 0
            || result.has(source.qname)) {
            throw new HardenedSemanticError("HARDENED_VECTOR_REFERENCE_AUTHORITY", "runtime reference authority contains an invalid or duplicate identity");
        }
        const baseNames = source.kind === "interface" ? source.bases : source.base === null ? [] : [source.base];
        const interfaces = source.kind === "class" ? source.interfaces : [];
        if (!Array.isArray(baseNames) || !Array.isArray(interfaces)
            || baseNames.some(name => typeof name !== "string" || name.length === 0)
            || interfaces.some(name => typeof name !== "string" || name.length === 0)) {
            throw new HardenedSemanticError("HARDENED_VECTOR_REFERENCE_AUTHORITY", `runtime reference authority ${source.qname} has invalid parents`);
        }
        const parents = [...baseNames, ...interfaces];
        if (new Set(parents).size !== parents.length) {
            throw new HardenedSemanticError("HARDENED_VECTOR_REFERENCE_AUTHORITY", `runtime reference authority ${source.qname} repeats a parent`);
        }
        result.set(source.qname, Object.freeze(parents));
    });
    return result;
}

function nativeArrayBase(context: AdapterContext): boolean {
    const source = context.sourceMemberAuthority;
    if (!source) return false;
    assertLoadedSourceMemberAuthority(source);
    const entry = source.entriesByQName.Array;
    return !!entry && entry.baseQName === "Object" && entry.ownInstanceMemberNames.includes("length");
}

function isArrayType(type: SemanticType, context?: AdapterContext): boolean {
    if (context?.className === "Array" && type.runtimeName === context.classQualifiedName)
        return context.extendsType !== null && context.extendsType.runtimeName !== context.classQualifiedName
            && isArrayType(context.extendsType,context);
    if (type.sourceName === "Array" && type.emittedName === "Array"
        && (type.runtimeName === null || type.runtimeName === "Array")) return true;
    if (!context || !nativeArrayBase(context) || !type.runtimeName) return false;
    const visited = new Set<string>();
    let current:string | null = type.runtimeName;
    while (current !== null) {
        if (current === "Array") return true;
        if (visited.has(current) || visited.size >= 1024) return false;
        visited.add(current);
        if (current === context.classQualifiedName) current = context.extendsType?.runtimeName ?? null;
        else {
            const moduleName = context.resolveCurrentLocal?.().entry.module;
            const entry: LocalMemberAuthorityEntry | null | undefined = moduleName ? contextLocalMember(context, moduleName, current) : null;
            if (!entry || entry.status !== "complete" || !entry.declaration || entry.declaration.baseQNames.length > 1) return false;
            current = entry.declaration.baseQNames[0] || null;
        }
    }
    return false;
}

const TREE_NODE_QNAME = "Foundation.SensitiveWord.TTreeNode";
const TREE_NODE_SOURCE_PATH = "game-client/tapplication_main/src/Foundation/SensitiveWord/TTreeNode.as";

const BIG_TURN_TABLE_INNER_CONSUMERS: { [qname: string]: string } = Object.freeze({
    "Logics.HDActivityBigTurnTable.TBigTurnTableGoldLotteryInner":
        "game-client/tapplication_main/src/Logics/HDActivityBigTurnTable/TBigTurnTableGoldLotteryInner.as",
    "Logics.HDActivityBigTurnTable.TBigTurnTableLuckyLotteryInner":
        "game-client/tapplication_main/src/Logics/HDActivityBigTurnTable/TBigTurnTableLuckyLotteryInner.as",
});
const BIG_TURN_TABLE_INNER_MEMBERS: { [qname: string]: ReadonlySet<string> } = Object.freeze({
    "Logics.HDActivityBigTurnTable.TBigTurnTableGoldLotteryInner":
        new Set(["index", "des", "costChip", "flag"]),
    "Logics.HDActivityBigTurnTable.TBigTurnTableLuckyLotteryInner":
        new Set(["index", "des", "costChip", "flag"]),
});
export const BIG_TURN_TABLE_INNER_DTO_AUTHORITY_SHA256 =
    "ecaaaca59ba9e94795be12e90659c52042f573443cb500eccd03826c70db2bc4";

const BIG_TURN_TABLE_INNER_ENTRY = "__bleachBigTurnTableInnerEntry";
const BIG_TURN_TABLE_INNER_COST_TUPLE = "__bleachBigTurnTableInnerCostTuple";
const BIG_TURN_TABLE_INNER_COST_ENTRY = "__bleachBigTurnTableInnerCostEntry";
const BIG_TURN_TABLE_INNER_FLAGS = "__bleachBigTurnTableInnerFlags";
const BIG_TURN_TABLE_INNER_CONFIG = "__bleachBigTurnTableInnerConfig";

function isBigTurnTableInnerContext(context: AdapterContext): boolean {
    const sourcePath = BIG_TURN_TABLE_INNER_CONSUMERS[context.classQualifiedName];
    if (sourcePath === undefined || context.resolveCurrentLocal === null) return false;
    const current = context.resolveCurrentLocal().entry;
    return current.module === "application" && current.qname === context.classQualifiedName
        && current.sourcePath === sourcePath && current.typeKind === "class";
}

function bigTurnTableInnerType(node: TreeNode, sourceName: string): SemanticType {
    return semanticType(node, sourceName, sourceName, [], false);
}

function innerRootTarget(expression: SemanticExpression, context: AdapterContext): boolean {
    return isBigTurnTableInnerContext(context) && context.currentCallable?.constructor === true
        && expression.kind === "identifier" && expression.name === "param1"
        && context.parameters.param1?.type.sourceName === BIG_TURN_TABLE_INNER_CONFIG
        && context.parameters.param1.type.emittedName === "__BigTurnTableInnerConfig";
}

function authenticateBigTurnTableInnerConstructorParameters(
    parameters: SemanticParameter[], constructor: boolean, context: AdapterContext, node: TreeNode,
): SemanticParameter[] {
    if (!constructor || !isBigTurnTableInnerContext(context)) return parameters;
    const parameter = parameters[0];
    if (parameters.length !== 1 || parameter === undefined || parameter.name !== "param1"
        || parameter.rest || parameter.defaultValue !== null || parameter.type.sourceName !== "Object"
        || parameter.type.emittedName !== "unknown" || parameter.type.nullable !== true) {
        fail("HARDENED_BIG_TURN_TABLE_DTO_CONSTRUCTOR",
            "authenticated Big Turntable Inner constructors require the exact source Object parameter", node);
    }
    return [Object.assign({}, parameter, {
        type: semanticType(node, BIG_TURN_TABLE_INNER_CONFIG, "__BigTurnTableInnerConfig", [], false),
    })];
}

function innerMemberType(context: AdapterContext, ownerType: SemanticType, name: string, node: TreeNode): SemanticType | null {
    if (ownerType.sourceName === BIG_TURN_TABLE_INNER_ENTRY) {
        if (!BIG_TURN_TABLE_INNER_MEMBERS[context.classQualifiedName]?.has(name)) return null;
        if (name === "index") return semanticType(node, "int", "number", [], false);
        if (name === "des") return semanticType(node, "String", "string", [], false);
        if (name === "costChip") return bigTurnTableInnerType(node, BIG_TURN_TABLE_INNER_COST_TUPLE);
        if (name === "flag") return bigTurnTableInnerType(node, BIG_TURN_TABLE_INNER_FLAGS);
        return null;
    }
    if (ownerType.sourceName === BIG_TURN_TABLE_INNER_COST_ENTRY && name === "value") {
        return semanticType(node, "int", "number", [], false);
    }
    return null;
}

function isTreeNodeContext(context: AdapterContext): boolean {
    if (context.classQualifiedName !== TREE_NODE_QNAME || context.resolveCurrentLocal === null) return false;
    const current = context.resolveCurrentLocal().entry;
    return current.module === "application" && current.qname === TREE_NODE_QNAME
        && current.sourcePath === TREE_NODE_SOURCE_PATH && current.typeKind === "class";
}

function ownRecordValue(type: SemanticType): SemanticType | null {
    return type.emittedName === "AS3OwnRecord" && type.typeArguments.length === 1 ? type.typeArguments[0]! : null;
}

function isTreeNodeRecordMember(expression: SemanticExpression, context: AdapterContext): boolean {
    return isTreeNodeContext(context) && expression.kind === "member" && expression.target.kind === "this"
        && expression.name === "FData" && expression.capabilitySource === null;
}

function callbackSignature(expression: SemanticExpression, context: AdapterContext):
    { parameters: SemanticParameter[]; returnType: SemanticType } | null {
    if (expression.kind === "lambda") {
        return { parameters: expression.parameters, returnType: expression.returnType };
    }
    if (expression.kind === "methodClosure") {
        if (expression.staticTarget && (expression.staticTarget.kind !== "identifier"
            || expression.staticTarget.bindingKind !== "current-class")) return null;
        const method = context.methods[expression.methodName];
        return method === undefined || method.returnType === null
            ? null : { parameters: method.parameters, returnType: method.returnType };
    }
    if (expression.kind === "identifier") {
        return context.locals[expression.name]?.lambdaSignature || null;
    }
    return null;
}

function assertVectorCallback(name: string, expression: SemanticExpression, element: SemanticType,
    owner: SemanticType, context: AdapterContext, node: TreeNode): void {
    const signature = callbackSignature(expression, context);
    if (signature === null) {
        fail("HARDENED_VECTOR_CALLBACK_IDENTITY",
            `Vector.${name} callback must be a proven local lambda or stable instance-method closure`, node);
    }
    const expected = name === "sort" ? [element, element]
        : [element, semanticType(node, "int", "number"), owner];
    if (signature.parameters.length > expected.length || signature.parameters.some(parameter => parameter.rest)) {
        fail("HARDENED_VECTOR_CALLBACK_ARITY",
            `Vector.${name} callback declares unsupported parameters`, node);
    }
    signature.parameters.forEach((parameter, index) => {
        const wanted = expected[index]!;
        const acceptsAny = parameter.type.sourceName === "Object" || parameter.type.sourceName === "*";
        const numericIndex = index === 1 && name !== "sort"
            && ["Number", "int", "uint"].includes(parameter.type.sourceName);
        if (!acceptsAny && !numericIndex && !sameUnderlyingType(parameter.type, wanted)) {
            fail("HARDENED_VECTOR_CALLBACK_TYPE",
                `Vector.${name} callback parameter ${index} has an unproven source type`, node);
        }
    });
    if (name === "sort" && !["Number", "int", "uint"].includes(signature.returnType.sourceName)) {
        fail("HARDENED_VECTOR_CALLBACK_RETURN", "Vector.sort callback must return a proven numeric value", node);
    }
    if (["every", "filter", "some"].includes(name) && signature.returnType.sourceName !== "Boolean") {
        fail("HARDENED_VECTOR_CALLBACK_RETURN", `Vector.${name} callback must return Boolean`, node);
    }
}

function isDictionaryType(type: SemanticType): boolean {
    return type.sourceName === "Dictionary" && type.emittedName === "Dictionary";
}

function parseType(node: TreeNode, context: AdapterContext, allowVoid: boolean): SemanticType {
    if (node.kind === "VECTOR") {
        if (node.children.length !== 1 || (node.children[0]!.kind !== "TYPE" && node.children[0]!.kind !== "VECTOR")) {
            fail("HARDENED_VECTOR_TYPE", "Vector must have exactly one structurally admitted element type", node);
        }
        const element = parseType(node.children[0]!, context, false);
        const primitivePolicy = ["int", "uint", "Number", "Boolean", "String", "Object", "Array", "Class", "Function"]
            .includes(element.sourceName);
        const imported = context.importsByLocal[element.sourceName];
        if (!primitivePolicy && element.sourceName !== context.className && element.emittedName !== "AS3Vector"
            && (!imported || (!imported.runtimeConstructible && !imported.runtimeInterface))) {
            fail("HARDENED_VECTOR_ELEMENT_RUNTIME",
                "Vector reference element requires a proven runtime class or interface identity", node.children[0]!);
        }
        return semanticType(node, `Vector.<${element.sourceName}>`, "AS3Vector", [element]);
    }
    if (node.kind !== "TYPE") {
        fail("HARDENED_TYPE_NODE", "only named or Vector source types are admitted", node);
    }
    const sourceName = node.text === null && context.sourceMemberAuthority !== null ? "*" : requiredText(node, "type");
    if (sourceName === "void" && !allowVoid) {
        fail("HARDENED_VOID_TYPE", "void is not valid in this type position", node);
    }
    let semanticSourceName = sourceName;
    let emittedName = sourceName === "*" && context.sourceMemberAuthority !== null ? "unknown" : PRIMITIVE_TYPES[sourceName];
    let runtimeName: string | null = emittedName ? sourceName : null;
    if (!emittedName) {
        if (sourceName === context.className && !context.packageFunction) {
            emittedName = sourceName;
            runtimeName = context.classQualifiedName;
        } else {
            const localName = sourceName.slice(sourceName.lastIndexOf(".") + 1);
            const imported = context.importsByLocal[localName]
                || context.resolveImportedType(sourceName, null, node);
            if (!imported || imported.localValueType !== null || imported.compileTimeNamespace
                || (sourceName.indexOf(".") >= 0 && imported.sourceQualifiedName !== sourceName)) {
                fail("HARDENED_TYPE_UNMAPPED", "source type " + sourceName
                    + " is not a proven primitive or authenticated import", node);
            }
            semanticSourceName = imported.sourceLocalName;
            emittedName = imported.sourceLocalName;
            runtimeName = imported.sourceQualifiedName;
        }
    }
    return semanticType(node, semanticSourceName, emittedName, [], undefined, runtimeName);
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
                && init.children[0]!.kind !== "IDENTIFIER" && init.children[0]!.kind !== "MINUS")) {
                fail("HARDENED_PARAMETER_DEFAULT", "default parameter must be one admitted scalar literal", init);
            }
            const rawDefault = init.children[0]!;
            if (rawDefault.kind === "MINUS") {
                if (rawDefault.children.length !== 1 || rawDefault.children[0]!.kind !== "LITERAL") {
                    fail("HARDENED_PARAMETER_DEFAULT", "negative default requires exactly one numeric literal", rawDefault);
                }
                defaultValue = parseExpression(rawDefault, context, true);
                if (defaultValue.kind !== "unary" || defaultValue.operator !== "-"
                    || defaultValue.operand.kind !== "literal" || typeof defaultValue.operand.value !== "number") {
                    fail("HARDENED_PARAMETER_DEFAULT", "negative default requires exactly one finite numeric literal", rawDefault);
                }
            } else {
                defaultValue = parseLiteral(rawDefault.kind === "IDENTIFIER"
                    ? Object.assign({}, rawDefault, { kind: "LITERAL" }) : rawDefault);
            }
            if (defaultValue.kind !== "literal" && defaultValue.kind !== "unary") {
                fail("HARDENED_PARAMETER_DEFAULT", "default parameter must normalize to one scalar literal", init);
            }
            defaultValue = adaptAssignmentValue(parameterType, defaultValue, context, init.children[0]!);
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
    } else if (/^-?(?:(?:0|[1-9][0-9]*)(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/.test(text)
        || /^0[xX][0-9a-fA-F]{1,8}$/.test(text)) {
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

interface LocalInheritedMemberLookup {
    member: LocalDeclarationMember | null;
    ownerQName: string | null;
    terminalBaseQName: string | null;
}

function authoritySemanticType(typeName: string, context: AdapterContext, node: TreeNode,
    signature?: SignatureTypeProof): SemanticType {
    if (typeName.startsWith("Vector.<") && typeName.endsWith(">")) {
        const element = authoritySemanticType(typeName.slice("Vector.<".length, -1), context, node, signature);
        return semanticType(node, `Vector.<${element.sourceName}>`, "AS3Vector", [element]);
    }
    const primitive = PRIMITIVE_TYPES[typeName];
    if (primitive) return semanticType(node, typeName, primitive, [], undefined, typeName);
    if (typeName === "*") return semanticType(node, "*", "unknown");
    if (typeName === context.classQualifiedName) {
        return semanticType(node, context.className, context.className, [], undefined, context.classQualifiedName);
    }
    const importedName = Object.keys(context.importsByLocal).find(localName =>
        context.importsByLocal[localName]!.sourceQualifiedName === typeName);
    if (importedName) {
        return semanticType(node, importedName, importedName, [], undefined,
            context.importsByLocal[importedName]!.sourceQualifiedName);
    }
    const implicit = context.resolveImportedType(typeName, null, node, signature);
    if (implicit) return semanticType(node, implicit.sourceLocalName, implicit.sourceLocalName, [], undefined, implicit.sourceQualifiedName);
    return semanticType(node, typeName, typeName.slice(typeName.lastIndexOf(".") + 1));
}

function localInheritedNamedMembers(context: AdapterContext, name: string,
    node: TreeNode): { members: LocalDeclarationMember[]; ownerQName: string | null } {
    if (context.baseLocalQName === null) return { members: [], ownerQName: null };
    if (context.localMemberAuthority === null || context.resolveCurrentLocal === null) {
        fail("HARDENED_LOCAL_MEMBER_AUTHORITY", "local inheritance requires the loaded member authority", node);
    }
    assertLoadedLocalMemberAuthority(context.localMemberAuthority);
    const moduleName = context.resolveCurrentLocal().entry.module;
    const visited = new Set<string>();
    let qname: string | null = context.baseLocalQName;
    while (qname !== null) {
        if (qname === "Array" && nativeArrayBase(context)) break;
        if (visited.has(qname) || visited.size >= 1024) {
            fail("HARDENED_LOCAL_MEMBER_CYCLE", "local base-member lineage is cyclic or exceeds its bound", node);
        }
        visited.add(qname);
        const entry: LocalMemberAuthorityEntry | undefined =
            contextLocalMember(context, moduleName, qname);
        if (!entry) return { members: [], ownerQName: null };
        if (entry.status !== "complete" || entry.declaration === null) {
            fail("HARDENED_LOCAL_MEMBER_HELD",
                `local member authority for ${qname} is held by ${entry.holdCode || "unknown"}`, node);
        }
        const members = entry.declaration.members.filter(member => member.name === name
            && member.modifiers.indexOf("static") < 0 && member.modifiers.indexOf("private") < 0
            && member.kind !== "constructor");
        if (members.length > 0) return { members, ownerQName: qname };
        if (entry.declaration.baseQNames.length > 1) {
            fail("HARDENED_LOCAL_MEMBER_BASE", `class ${qname} has an ambiguous base lineage`, node);
        }
        qname = entry.declaration.baseQNames.length === 1 ? entry.declaration.baseQNames[0]! : null;
    }
    return { members: [], ownerQName: null };
}

function assertNoInheritedLocalValueShadow(context: AdapterContext, name: string, node: TreeNode): void {
    if (context.baseLocalQName === null) return;
    if (context.localTypeAuthority === null || context.localMemberAuthority === null
        || context.resolveCurrentLocal === null) {
        fail("HARDENED_INTRINSIC_IDENTITY_AUTHORITY",
            `${name} intrinsic lookup requires the complete local base declaration authority`, node);
    }
    const moduleName = context.resolveCurrentLocal().entry.module;
    const visited = new Set<string>();
    let qname: string | null = context.baseLocalQName;
    while (qname !== null) {
        if (qname === "Array" && nativeArrayBase(context)) break;
        if (visited.has(qname) || visited.size >= 1024) {
            fail("HARDENED_INTRINSIC_IDENTITY_AUTHORITY",
                `${name} intrinsic lookup encountered a cyclic or over-bound local base lineage`, node);
        }
        visited.add(qname);
        if (!contextLocalType(context, moduleName, qname)) {
            if (context.runtimeReferenceParentsByQName.has(qname)) return;
            fail("HARDENED_INTRINSIC_IDENTITY_AUTHORITY",
                `${name} intrinsic lookup encountered an unauthenticated nonlocal base terminal`, node);
        }
        const entry: LocalMemberAuthorityEntry | undefined =
            contextLocalMember(context, moduleName, qname);
        if (!entry || entry.status !== "complete" || entry.declaration === null) {
            fail("HARDENED_INTRINSIC_IDENTITY_AUTHORITY",
                `${name} intrinsic lookup encountered a missing or held local base declaration`, node);
        }
        if (entry.declaration.members.some(member => member.name === name
            && member.modifiers.indexOf("private") < 0
            && (member.kind === "field" || member.kind === "getter"
                || member.kind === "setter" || member.kind === "method"))) {
            fail("HARDENED_INTRINSIC_IDENTITY_SHADOW",
                `${name} intrinsic is shadowed by an inherited local value declaration`, node);
        }
        if (entry.declaration.baseQNames.length > 1) {
            fail("HARDENED_INTRINSIC_IDENTITY_AUTHORITY",
                `${name} intrinsic lookup encountered an ambiguous local base lineage`, node);
        }
        qname = entry.declaration.baseQNames.length === 1 ? entry.declaration.baseQNames[0]! : null;
    }
}

function assertNoInheritedNativeFunctionShadow(context: AdapterContext, name: string, node: TreeNode,
    diagnosticPrefix = "HARDENED_NATIVE_TIMER", label = "native timer"): void {
    if (context.baseLocalQName === null && context.baseSourceQName === null) return;
    const moduleName = context.resolveCurrentLocal === null ? null : context.resolveCurrentLocal().entry.module;
    const visited = new Set<string>();
    let qname: string | null = context.baseLocalQName || context.baseSourceQName;
    while (qname !== null) {
        if (qname === "Array" && nativeArrayBase(context)) break;
        if (visited.has(qname) || visited.size >= 1024) {
            fail("HARDENED_LOCAL_MEMBER_CYCLE", `${label} base-member lineage is cyclic or exceeds its bound`, node);
        }
        visited.add(qname);
        const localType = moduleName === null || context.localTypeAuthority === null ? undefined
            : contextLocalType(context, moduleName, qname);
        if (!localType) {
            if (context.sourceMemberAuthority !== null) {
                assertLoadedSourceMemberAuthority(context.sourceMemberAuthority);
                const sourceEntry = context.sourceMemberAuthority.entriesByQName[qname];
                if (!sourceEntry) {
                    fail(`${diagnosticPrefix}_MAPPED_BASE_HELD`,
                        `source member authority is missing inherited base ${qname}`, node);
                }
                const mappedMembers = Object.keys(context.memberMappingsByKey)
                    .map(key => context.memberMappingsByKey[key])
                    .filter((mapping): mapping is CapabilityMapping => mapping !== undefined
                        && mapping.sourceQName === qname && mapping.sourceMember !== null
                        && mapping.sourceMember.name === name);
                if (!sourceEntry.ownInstanceMemberNames.includes(name)) {
                    if (mappedMembers.length !== 0) {
                        fail(`${diagnosticPrefix}_MAPPED_BASE_HELD`,
                            `mapped member authority disagrees with the source census for ${qname}.${name}`, node);
                    }
                    qname = sourceEntry.baseQName;
                    continue;
                }
                const inherited = mappedMembers.filter(mapping => mapping.sourceRoles.length === 1
                    && mapping.sourceRoles[0] === "instance-member" && mapping.targetMember !== null
                    && mapping.targetMember.scope === "instance");
                if (inherited.length === 0 || inherited.length !== mappedMembers.length) {
                    fail(`${diagnosticPrefix}_MAPPED_BASE_HELD`,
                        `source member ${qname}.${name} lacks complete mapped member authority`, node);
                }
                const visibilities = new Set(inherited.map(mapping => {
                    const match = /^(public|protected|private|internal)\s+/.exec(mapping.sourceMember!.signature.trim());
                    if (match) return match[1]!;
                    if (/^(?:native\s+)?(?:function|var|const)\s+/.test(mapping.sourceMember!.signature.trim())) {
                        return "internal";
                    }
                    fail(`${diagnosticPrefix}_MAPPED_BASE_HELD`,
                        `mapped member visibility for ${qname}.${name} is unauthenticated`, node);
                }));
                if (visibilities.size > 1) {
                    fail(`${diagnosticPrefix}_MAPPED_BASE_AMBIGUOUS`,
                        `mapped member visibility for ${qname}.${name} is ambiguous`, node);
                }
                const visibility = visibilities.values().next().value as string | undefined;
                if (visibility === "internal") {
                    fail(`${diagnosticPrefix}_MAPPED_BASE_VISIBILITY`,
                        `mapped internal member ${qname}.${name} is not provably visible`, node);
                }
                if (visibility === "public" || visibility === "protected") {
                    fail(`${diagnosticPrefix}_INHERITED_SHADOW`,
                        `${label} import is shadowed by inherited mapped member ${qname}.${name}`, node);
                }
                qname = sourceEntry.baseQName;
                continue;
            }
            const parents = context.runtimeReferenceParentsByQName.get(qname);
            const mappedType = context.mappingsBySource[qname];
            if (parents === undefined || !mappedType || mappedType.sourceMember !== null
                || mappedType.targetKind !== "class") {
                fail(`${diagnosticPrefix}_MAPPED_BASE_HELD`,
                    `${label} lookup encountered unauthenticated mapped base ${qname}`, node);
            }
            const mappedMembers = Object.keys(context.memberMappingsByKey)
                .map(key => context.memberMappingsByKey[key])
                .filter((mapping): mapping is CapabilityMapping => mapping !== undefined
                    && mapping.sourceQName === qname && mapping.sourceMember !== null
                    && mapping.sourceMember.name === name);
            const inherited = mappedMembers.filter(mapping => mapping.sourceRoles.length === 1
                && mapping.sourceRoles[0] === "instance-member" && mapping.targetMember !== null
                && mapping.targetMember.scope === "instance");
            if (inherited.length !== mappedMembers.length) {
                fail(`${diagnosticPrefix}_MAPPED_BASE_HELD`,
                    `mapped member authority for ${qname}.${name} is incomplete`, node);
            }
            const visibilities = new Set(inherited.map(mapping => {
                const match = /^(public|protected|private|internal)\s+/.exec(mapping.sourceMember!.signature.trim());
                if (match) return match[1]!;
                if (/^(?:native\s+)?(?:function|var|const)\s+/.test(mapping.sourceMember!.signature.trim())) {
                    return "internal";
                }
                fail(`${diagnosticPrefix}_MAPPED_BASE_HELD`,
                    `mapped member visibility for ${qname}.${name} is unauthenticated`, node);
            }));
            if (visibilities.size > 1) {
                fail(`${diagnosticPrefix}_MAPPED_BASE_AMBIGUOUS`,
                    `mapped member visibility for ${qname}.${name} is ambiguous`, node);
            }
            const visibility = visibilities.values().next().value as string | undefined;
            if (visibility === "internal") {
                fail(`${diagnosticPrefix}_MAPPED_BASE_VISIBILITY`,
                    `mapped internal member ${qname}.${name} is not provably visible`, node);
            }
            if (visibility === "public" || visibility === "protected") {
                fail(`${diagnosticPrefix}_INHERITED_SHADOW`,
                    `${label} import is shadowed by inherited mapped member ${qname}.${name}`, node);
            }
            if (parents.length > 1 || new Set(parents).size !== parents.length) {
                fail(`${diagnosticPrefix}_MAPPED_BASE_AMBIGUOUS`,
                    `mapped base ${qname} has an ambiguous parent lineage`, node);
            }
            fail(`${diagnosticPrefix}_MAPPED_BASE_HELD`,
                `mapped base ${qname} lacks exhaustive negative source-member authority for ${name}`, node);
        }
        if (context.localMemberAuthority === null || context.localTypeAuthority === null || moduleName === null) {
            fail("HARDENED_LOCAL_MEMBER_AUTHORITY",
                `${name} ${label} lookup requires the complete local base declaration authority`, node);
        }
        assertLoadedLocalMemberAuthority(context.localMemberAuthority);
        const entry: LocalMemberAuthorityEntry | undefined =
            contextLocalMember(context, moduleName, qname);
        if (!entry || entry.status !== "complete" || entry.declaration === null) {
            fail("HARDENED_LOCAL_MEMBER_HELD",
                `local member authority for ${qname} is held by ${entry?.holdCode || "unknown"}`, node);
        }
        const members = entry.declaration.members.filter(member => member.name === name
            && member.modifiers.indexOf("static") < 0 && member.modifiers.indexOf("private") < 0
            && (member.kind === "field" || member.kind === "getter"
                || member.kind === "setter" || member.kind === "method"));
        if (members.length > 0) {
            members.forEach(member => assertInheritedVisibility(member, qname!, context, node));
            fail(`${diagnosticPrefix}_INHERITED_SHADOW`,
                `${label} import is shadowed by inherited local member ${qname}.${name}`, node);
        }
        if (entry.declaration.baseQNames.length > 1) {
            fail("HARDENED_LOCAL_MEMBER_BASE", `class ${qname} has an ambiguous base lineage`, node);
        }
        qname = entry.declaration.baseQNames.length === 1 ? entry.declaration.baseQNames[0]! : null;
    }
}

function authorityTypeName(type: SemanticType, context: AdapterContext, node: TreeNode): string {
    const element = vectorElement(type);
    if (element !== null) return `Vector.<${authorityTypeName(element, context, node)}>`;
    if (Object.prototype.hasOwnProperty.call(PRIMITIVE_TYPES, type.sourceName) || type.sourceName === "*") {
        return type.sourceName;
    }
    if (type.sourceName === context.className) return context.classQualifiedName;
    const imported = context.importsByLocal[type.sourceName];
    if (imported) return imported.sourceQualifiedName;
    fail("HARDENED_LOCAL_MEMBER_TYPE", "semantic type lacks an authenticated local-member identity", node);
}

function localInheritedMember(context: AdapterContext, name: string,
    kind: "method" | "getter" | "setter" | "field", namespaceName: string | null,
    node: TreeNode): LocalInheritedMemberLookup {
    if (context.baseLocalQName === null || context.localMemberAuthority === null
        || context.resolveCurrentLocal === null) {
        fail("HARDENED_LOCAL_MEMBER_AUTHORITY", "local inheritance requires the loaded member authority", node);
    }
    assertLoadedLocalMemberAuthority(context.localMemberAuthority);
    const moduleName = context.resolveCurrentLocal().entry.module;
    const visited = new Set<string>();
    let qname: string | null = context.baseLocalQName;
    while (qname !== null) {
        if (qname === "Array" && nativeArrayBase(context)) break;
        if (visited.has(qname) || visited.size >= 1024) {
            fail("HARDENED_LOCAL_MEMBER_CYCLE", "local base-member lineage is cyclic or exceeds its bound", node);
        }
        visited.add(qname);
        const entry: LocalMemberAuthorityEntry | undefined =
            contextLocalMember(context, moduleName, qname);
        if (!entry) return { member: null, ownerQName: null, terminalBaseQName: qname };
        if (entry.status !== "complete" || entry.declaration === null) {
            fail("HARDENED_LOCAL_MEMBER_HELD",
                `local member authority for ${qname} is held by ${entry.holdCode || "unknown"}`, node);
        }
        const matches = entry.declaration.members.filter((member: LocalDeclarationMember) => member.kind === kind && member.name === name
            && member.namespaceName === namespaceName
            && member.modifiers.indexOf("static") < 0 && member.modifiers.indexOf("private") < 0);
        if (matches.length > 1) {
            fail("HARDENED_LOCAL_MEMBER_AMBIGUOUS", `local member ${qname}.${name} is duplicated`, node);
        }
        if (matches.length === 1) {
            return { member: matches[0]!, ownerQName: qname, terminalBaseQName: null };
        }
        if (entry.declaration.baseQNames.length > 1) {
            fail("HARDENED_LOCAL_MEMBER_BASE", `class ${qname} has an ambiguous base lineage`, node);
        }
        qname = entry.declaration.baseQNames.length === 1 ? entry.declaration.baseQNames[0]! : null;
    }
    return { member: null, ownerQName: null, terminalBaseQName: null };
}

function assertLocalMemberParameters(expected: LocalDeclarationMember, actual: SemanticParameter[],
    context: AdapterContext, node: TreeNode): void {
    if (expected.parameters.length !== actual.length) {
        fail("HARDENED_LOCAL_MEMBER_SIGNATURE", "local member parameter count differs from its authenticated declaration", node);
    }
    expected.parameters.forEach((parameter, index) => {
        const candidate = actual[index]!;
        if (parameter.type !== authorityTypeName(candidate.type, context, node)
            || parameter.optional !== (candidate.defaultValue !== null) || parameter.rest !== candidate.rest) {
            fail("HARDENED_LOCAL_MEMBER_SIGNATURE",
                `local member parameter ${index} differs from its authenticated declaration`, node);
        }
    });
}

function memberVisibility(modifiers: string[]): "public" | "protected" | "internal" | "private" {
    if (modifiers.indexOf("public") >= 0) return "public";
    if (modifiers.indexOf("protected") >= 0) return "protected";
    if (modifiers.indexOf("private") >= 0) return "private";
    return "internal";
}

function memberVisibilityForOwner(member:LocalDeclarationMember, ownerQName:string,
    context:AdapterContext):"public" | "protected" | "internal" | "private" {
    const moduleName=context.resolveCurrentLocal?.().entry.module;
    const owner=moduleName ? contextLocalMember(context,moduleName,ownerQName) : null;
    if (owner?.typeKind === "interface" && owner.status === "complete"
        && owner.declaration?.members.includes(member) && member.modifiers.length === 0
        && member.namespaceName === null && ["method","getter","setter"].includes(member.kind)) return "public";
    return memberVisibility(member.modifiers);
}

function assertInheritedVisibility(member: LocalDeclarationMember, ownerQName: string,
    context: AdapterContext, node: TreeNode): void {
    const visibility = memberVisibilityForOwner(member,ownerQName,context);
    const ownerPackage = ownerQName.slice(0, Math.max(0, ownerQName.lastIndexOf(".")));
    const currentPackage = context.classQualifiedName.slice(0, Math.max(0, context.classQualifiedName.lastIndexOf(".")));
    if (visibility === "private" || (visibility === "internal" && ownerPackage !== currentPackage)) {
        fail("HARDENED_LOCAL_MEMBER_VISIBILITY", "inherited local member is not visible to the current class", node);
    }
}

function assertLocalOverride(expected: LocalDeclarationMember, parameters: SemanticParameter[],
    returnType: SemanticType | null, modifiers: SemanticModifier[], context: AdapterContext, node: TreeNode): void {
    assertLocalMemberParameters(expected, parameters, context, node);
    const actualReturn = returnType === null ? null : authorityTypeName(returnType, context, node);
    if (expected.returnType !== actualReturn) {
        fail("HARDENED_LOCAL_MEMBER_SIGNATURE", "local override return type differs from its authenticated declaration", node);
    }
    const baseVisibility = memberVisibility(expected.modifiers);
    const actualVisibility = memberVisibility(modifiers);
    if ((baseVisibility === "public" && actualVisibility !== "public")
        || (baseVisibility === "protected" && actualVisibility !== "protected" && actualVisibility !== "public")
        || baseVisibility === "private" || (baseVisibility === "internal" && actualVisibility === "private")) {
        fail("HARDENED_LOCAL_MEMBER_VISIBILITY", "local override narrows or cannot inherit the base visibility", node);
    }
}

function localDeclaration(context: AdapterContext, qname: string, node: TreeNode): LocalMemberAuthorityEntry {
    if (context.localMemberAuthority === null || context.resolveCurrentLocal === null) {
        fail("HARDENED_LOCAL_MEMBER_AUTHORITY", "local declaration requires the loaded member authority", node);
    }
    assertLoadedLocalMemberAuthority(context.localMemberAuthority);
    const moduleName = context.resolveCurrentLocal().entry.module;
    const entry = contextLocalMember(context, moduleName, qname);
    if (!entry || entry.status !== "complete" || entry.declaration === null) {
        fail("HARDENED_LOCAL_MEMBER_HELD", `local declaration authority for ${qname} is absent or held`, node);
    }
    return entry;
}

function assertNoLocalAncestryFieldCollision(context: AdapterContext, members: readonly SemanticMember[],
    node: TreeNode): void {
    if (isArrayType(semanticType(node,context.className,context.className,[],false,context.classQualifiedName),context)) {
        const nativeNames = context.sourceMemberAuthority!.entriesByQName.Array!.ownInstanceMemberNames;
        for (const member of members) if (member.kind !== "constructor" && !member.modifiers.includes("static")
            && nativeNames.includes(member.name))
            fail("HARDENED_ARRAY_OVERRIDE","Native Array member overrides require retained dispatch evidence",node);
    }

    if (context.baseLocalQName === null) return;
    if (context.localMemberAuthority === null || context.resolveCurrentLocal === null) {
        fail("HARDENED_LOCAL_FIELD_ANCESTRY", "local field ancestry requires the loaded member authority", node);
    }
    assertLoadedLocalMemberAuthority(context.localMemberAuthority);
    const seen = new Map<string, { owner: string; name: string; field: boolean }>();
    const record = (owner: string, name: string, field: boolean): void => {
        const identity = name.toLowerCase();
        const existing = seen.get(identity);
        if (existing !== undefined && existing.owner !== owner && (existing.field || field)) {
            fail("HARDENED_LOCAL_FIELD_ANCESTRY",
                `local instance field ${name} aliases inherited member ${existing.name} between ${existing.owner} and ${owner}`, node);
        }
        if (existing === undefined || field) {
            seen.set(identity, { owner, name, field: existing?.field === true || field });
        }
    };
    members.forEach(member => {
        if (member.kind !== "constructor" && !member.modifiers.includes("static")) {
            record(context.classQualifiedName, member.name, member.kind === "field");
        }
    });
    const moduleName = context.resolveCurrentLocal().entry.module;
    const visited = new Set<string>();
    let current: string | null = context.baseLocalQName;
    while (current !== null && !current.startsWith("flash.")) {
        if (current === "Array" && nativeArrayBase(context)) {
            context.sourceMemberAuthority!.entriesByQName.Array!.ownInstanceMemberNames.forEach(name=>record("Array",name,false));
            break;
        }
        if (visited.has(current) || visited.size >= 1024) {
            fail("HARDENED_LOCAL_FIELD_ANCESTRY", "local field ancestry is cyclic or exceeds its bound", node);
        }
        visited.add(current);
        const entry: LocalMemberAuthorityEntry | undefined =
            contextLocalMember(context, moduleName, current);
        if (!entry || entry.status !== "complete" || entry.declaration === null) {
            fail("HARDENED_LOCAL_FIELD_ANCESTRY", `local field ancestor ${current} is absent or held`, node);
        }
        entry.declaration.members.filter(member => member.kind !== "constructor"
            && member.modifiers.indexOf("static") < 0)
            .forEach(member => record(current!, member.name, member.kind === "field"));
        if (entry.declaration.baseQNames.length > 1) {
            fail("HARDENED_LOCAL_FIELD_ANCESTRY", `local field ancestor ${current} has ambiguous bases`, node);
        }
        current = entry.declaration.baseQNames.length === 1 ? entry.declaration.baseQNames[0]! : null;
    }
}

function localStaticNamedMembers(context: AdapterContext, qname: string, name: string,
    node: TreeNode): LocalDeclarationMember[] {
    const entry = localDeclaration(context, qname, node);
    const currentPackage = context.classQualifiedName.slice(0,
        Math.max(0, context.classQualifiedName.lastIndexOf(".")));
    const ownerPackage = qname.slice(0, Math.max(0, qname.lastIndexOf(".")));
    const matches = entry.declaration!.members.filter(member => member.name === name
        && member.kind !== "constructor" && member.modifiers.indexOf("static") >= 0);
    matches.forEach(member => {
        const visibility = memberVisibility(member.modifiers);
        if (visibility !== "public" && !(visibility === "internal" && currentPackage === ownerPackage)) {
            fail("HARDENED_LOCAL_STATIC_VISIBILITY",
                `local static member ${qname}.${name} is not visible to the current source package`, node);
        }
    });
    return matches;
}

function localQNameForType(type: SemanticType, context: AdapterContext): string | null {
    if (type.sourceName === context.className) return context.classQualifiedName;
    const imported = context.importsByLocal[type.sourceName];
    return imported?.authorityKind === "local" && imported.localValueType === null
        ? imported.sourceQualifiedName : null;
}

function localQNameForExpression(expression: SemanticExpression, context: AdapterContext,
    node: TreeNode): string | null {
    try {
        return localQNameForType(assignmentType(expression, context, node), context);
    } catch (error) {
        if (error instanceof HardenedSemanticError && error.code === "HARDENED_ASSIGNMENT_TYPE") return null;
        throw error;
    }
}

function localInstanceNamedMembers(context: AdapterContext, qname: string, name: string,
    node: TreeNode, access?: "read" | "write"): { members: LocalDeclarationMember[]; ownerQName: string | null; terminalFlashQNames: string[] } {
    if (context.localMemberAuthority === null || context.resolveCurrentLocal === null) {
        fail("HARDENED_LOCAL_MEMBER_AUTHORITY", "local receiver requires the loaded member authority", node);
    }
    assertLoadedLocalMemberAuthority(context.localMemberAuthority);
    const moduleName = context.resolveCurrentLocal().entry.module;
    const entries = new Map<string, LocalMemberAuthorityEntry>();
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const terminalFlash = new Set<string>();
    const authenticateLineage = (current: string): void => {
        if (current.startsWith("flash.") || current === "Array" && nativeArrayBase(context)) {
            terminalFlash.add(current);
            return;
        }
        if (visiting.has(current)) {
            fail("HARDENED_LOCAL_MEMBER_CYCLE", "local instance-member lineage is cyclic", node);
        }
        if (visited.has(current)) return;
        if (visited.size >= 1024) {
            fail("HARDENED_LOCAL_MEMBER_CYCLE", "local instance-member lineage exceeds its bound", node);
        }
        const entry = contextLocalMember(context, moduleName, current);
        if (!entry || entry.status !== "complete" || entry.declaration === null) {
            fail("HARDENED_LOCAL_MEMBER_HELD", `local declaration authority for ${current} is absent or held`, node);
        }
        visiting.add(current);
        entry.declaration.baseQNames.forEach(authenticateLineage);
        visiting.delete(current);
        visited.add(current);
        entries.set(current, entry);
    };
    authenticateLineage(qname);

    const searched = new Set<string>();
    let frontier = [qname];
    while (frontier.length > 0) {
        const matches: Array<{ members: LocalDeclarationMember[]; ownerQName: string }> = [];
        const next: string[] = [];
        for (const current of [...new Set(frontier)].sort()) {
            if (searched.has(current)) continue;
            searched.add(current);
            if (current.startsWith("flash.") || current === "Array" && nativeArrayBase(context)) {
                continue;
            }
            const declaration = entries.get(current)!.declaration!;
            const members = declaration.members.filter(member => member.name === name
                && member.kind !== "constructor" && member.modifiers.indexOf("static") < 0
                && (member.namespaceName === null
                    || Object.prototype.hasOwnProperty.call(context.namespaceNames, member.namespaceName)));
            const oppositeOnly = access !== undefined && members.length > 0
                && members.every(member => member.kind === (access === "read" ? "setter" : "getter")
                    && !member.modifiers.includes("private"));
            if (members.length > 0 && !oppositeOnly) matches.push({ members, ownerQName: current });
            next.push(...declaration.baseQNames);
        }
        if (matches.length > 1) {
            fail("HARDENED_LOCAL_MEMBER_AMBIGUOUS",
                "local receiver member is inherited from multiple declarations at the same depth", node);
        }
        if (matches.length === 1) {
            return { ...matches[0]!, terminalFlashQNames: [] };
        }
        frontier = next;
    }
    return { members: [], ownerQName: null, terminalFlashQNames: [...terminalFlash].sort() };
}

function terminalFlashMemberMapping(context: AdapterContext, qnames: readonly string[], access: string,
    name: string, node: TreeNode): CapabilityMapping | null {
    const matches = qnames.map(qname => memberMapping(context, qname, access, name, node))
        .filter((mapping): mapping is CapabilityMapping => mapping !== null);
    if (matches.length > 1) {
        fail("HARDENED_LOCAL_MEMBER_AMBIGUOUS",
            "local receiver member is mapped by multiple terminal Flash base authorities", node);
    }
    return matches.length === 1 ? matches[0]! : null;
}

function localLineageContains(context: AdapterContext, startQName: string, ownerQName: string,
    node: TreeNode): boolean {
    const visited = new Set<string>();
    let current: string | null = startQName;
    while (current !== null) {
        if (current === ownerQName) return true;
        if (current === "Array" && nativeArrayBase(context)) return false;
        if (visited.has(current) || visited.size >= 1024) {
            fail("HARDENED_LOCAL_MEMBER_CYCLE", "local visibility lineage is cyclic or exceeds its bound", node);
        }
        visited.add(current);
        const entry = localDeclaration(context, current, node);
        if (entry.declaration!.baseQNames.length > 1) {
            fail("HARDENED_LOCAL_MEMBER_BASE", `class ${current} has an ambiguous base lineage`, node);
        }
        current = entry.declaration!.baseQNames.length === 1 ? entry.declaration!.baseQNames[0]! : null;
    }
    return false;
}

function assertLocalReceiverVisibility(member: LocalDeclarationMember, ownerQName: string,
    receiverQName: string, context: AdapterContext, node: TreeNode): void {
    if (member.namespaceName !== null
        && Object.prototype.hasOwnProperty.call(context.namespaceNames, member.namespaceName)) return;
    const visibility = memberVisibilityForOwner(member,ownerQName,context);
    const ownerPackage = ownerQName.slice(0, Math.max(0, ownerQName.lastIndexOf(".")));
    const currentPackage = context.classQualifiedName.slice(0,
        Math.max(0, context.classQualifiedName.lastIndexOf(".")));
    if (visibility === "public" || (visibility === "internal" && ownerPackage === currentPackage)
        || (visibility === "private" && ownerQName === context.classQualifiedName)
        || (visibility === "protected" && receiverQName === context.classQualifiedName
            && localLineageContains(context, context.classQualifiedName, ownerQName, node))) return;
    fail("HARDENED_LOCAL_MEMBER_VISIBILITY",
        "local receiver member is not visible through the authenticated source type", node);
}

function localConstructor(context: AdapterContext, qname: string, node: TreeNode): LocalDeclarationMember | null {
    const entry = localDeclaration(context, qname, node);
    const constructors = entry.declaration!.members.filter(member => member.kind === "constructor");
    if (constructors.length > 1) {
        fail("HARDENED_LOCAL_CONSTRUCTOR_AMBIGUOUS", `local class ${qname} has multiple constructors`, node);
    }
    return constructors.length === 1 ? constructors[0]! : null;
}

function assertLocalCallArguments(member: LocalDeclarationMember | null, argumentsList: SemanticExpression[],
    argumentNodes: TreeNode[], context: AdapterContext, node: TreeNode): void {
    if (member === null) {
        if (argumentsList.length !== 0) {
            fail("HARDENED_LOCAL_CONSTRUCTOR_ARITY", "implicit local constructor accepts no arguments", node);
        }
        return;
    }
    const minimum = member.parameters.filter(parameter => !parameter.optional && !parameter.rest).length;
    if (argumentsList.length < minimum
        || (!member.parameters.some(parameter => parameter.rest) && argumentsList.length > member.parameters.length)) {
        fail("HARDENED_LOCAL_CONSTRUCTOR_ARITY", "local constructor call does not match its authenticated arity", node);
    }
    argumentsList.forEach((argument, index) => {
        const parameter = member.parameters[Math.min(index, member.parameters.length - 1)];
        if (!parameter || (!parameter.rest && index >= member.parameters.length)) {
            fail("HARDENED_LOCAL_CONSTRUCTOR_TYPE",
                `local constructor argument ${index} does not match its authenticated type`, argumentNodes[index] || node);
        }
        const expected = authoritySemanticType(parameter.type, context, argumentNodes[index]!);
        try {
            argumentsList[index] = adaptAssignmentValue(expected, argument, context, argumentNodes[index]!);
        } catch (error) {
            if (error instanceof HardenedSemanticError) {
                fail("HARDENED_LOCAL_CONSTRUCTOR_TYPE",
                    `local constructor argument ${index} does not match its authenticated type`, argumentNodes[index] || node);
            }
            throw error;
        }
    });
}

function assertLocalMethodCall(member: LocalDeclarationMember, argumentsList: SemanticExpression[],
    argumentNodes: TreeNode[], context: AdapterContext, node: TreeNode, ownerQName?: string): void {
    const minimum = member.parameters.filter(parameter => !parameter.optional && !parameter.rest).length;
    if (argumentsList.length < minimum
        || (!member.parameters.some(parameter => parameter.rest) && argumentsList.length > member.parameters.length)) {
        fail("HARDENED_LOCAL_CALL_ARITY", "inherited local method call does not match its authenticated arity", node);
    }
    argumentsList.forEach((argument, index) => {
        const parameter = member.parameters[Math.min(index, member.parameters.length - 1)];
        if (!parameter || (!parameter.rest && index >= member.parameters.length)) {
            fail("HARDENED_LOCAL_CALL_TYPE",
                `inherited local method argument ${index} does not match its authenticated type`, argumentNodes[index] || node);
        }
        const expected = authoritySemanticType(parameter.type, context, argumentNodes[index]!, ownerQName ? {ownerQName,member} : undefined);
        try {
            argumentsList[index] = adaptAssignmentValue(expected, argument, context, argumentNodes[index]!);
        } catch (error) {
            if (error instanceof HardenedSemanticError) {
                fail("HARDENED_LOCAL_CALL_TYPE",
                    `inherited local method argument ${index} does not match its authenticated type`, argumentNodes[index] || node);
            }
            throw error;
        }
    });
}

function implicitThisMember(node: TreeNode, name: string, capabilitySource: string | null = null): SemanticExpression {
    const target = Object.assign(identity(node), { kind: "this" as "this" });
    return Object.assign(identity(node), {
        kind: "member" as "member", target, targetNullable: false, name, capabilitySource,
    });
}

function currentClassIdentifier(node: TreeNode, context: AdapterContext): SemanticExpression {
    return Object.assign(identity(node), {
        kind: "identifier" as "identifier", name: context.className,
        bindingKind: "current-class" as "current-class",
        bindingSourceQualifiedName: context.classQualifiedName,
    });
}

function currentClassMember(node: TreeNode, context: AdapterContext, name: string): SemanticExpression {
    return Object.assign(identity(node), {
        kind: "member" as "member", target: currentClassIdentifier(node, context),
        targetNullable: false, name, capabilitySource: context.classQualifiedName,
    });
}

function staticMethodValue(node:TreeNode, context:AdapterContext, target:SemanticExpression, name:string):SemanticExpression {
    if (context.sourceMemberAuthority === null)
        fail("HARDENED_LOCAL_STATIC_METHOD_CLOSURE", "static method values require authenticated source member authority", node);
    return Object.assign(identity(node), {kind:"methodClosure" as const, staticTarget:target, methodName:name});
}

function inheritedMethodValue(node:TreeNode, context:AdapterContext, name:string,
    allowMethodClosure:boolean):SemanticExpression {
    if (!allowMethodClosure || context.sourceMemberAuthority === null || context.currentCallable === null
        || context.currentCallable.modifiers.includes("static") || context.lambdaDepth > 0)
        fail("HARDENED_LOCAL_METHOD_CLOSURE", "inherited method values require an authenticated instance callable after binding setup", node);
    return Object.assign(identity(node), {kind:"methodClosure" as const, methodName:name, inherited:true as const});
}

function dynamicObjectType(type:SemanticType, context:AdapterContext):boolean {
    if (context.packageFunction) return false; // Package lexical namespace dispatch needs its own retained authority.
    return context.sourceMemberAuthority !== null && type.emittedName === "unknown"
        && (type.sourceName === "Object" || type.sourceName === "*");
}
function assertObjectKey(type:SemanticType,node:TreeNode):void {
    if (!["String","int","uint","Number","Boolean","null","undefined","*","Object","Array","Function"].includes(type.sourceName))
        fail("HARDENED_OBJECT_KEY", "dynamic Object key type requires native String-conversion authority", node);
}

function assignmentType(expression: SemanticExpression, context: AdapterContext, node: TreeNode): SemanticType {
    if (expression.kind === "member" && expression.target.kind === "super" && context.baseLocalQName !== null
        && expression.capabilitySource !== null && !context.mappingsBySource[expression.capabilitySource]) {
        const inherited = localInheritedMember(context, expression.name, expression.superField ? "field" : "getter", null, node);
        if (inherited.member && inherited.ownerQName === expression.capabilitySource) {
            assertInheritedVisibility(inherited.member, inherited.ownerQName, context, node);
            return authoritySemanticType(expression.superField ? inherited.member.fieldType! : inherited.member.returnType!, context, node);
        }
    }
    if (expression.kind === "member" && expression.target.kind === "this") {
        const forward = context.inheritedAccessors?.find(item => item.name === expression.name && item.kind === "getter");
        if (forward) return forward.type;
    }

    if (expression.kind === "globalFunction" || expression.kind === "identifier" && expression.bindingKind === "package-function")
        return semanticType(node,"Function","Function",[],false);
    if (expression.kind === "functionApply") return expression.resultType;

    if (expression.kind === "member" && (expression.target.kind === "super" || expression.target.kind === "this")
        && expression.capabilitySource !== null && context.mappingsBySource[expression.capabilitySource]) {
        const mapping = memberMapping(context, expression.capabilitySource, "read", expression.name, node);
        if (mapping !== null) return mappedMemberType(mapping, "read", context, node);
    }
    if (expression.kind === "undefined") return semanticType(node, "*", "unknown");
    if (expression.kind === "numericPredicate") return semanticType(node,"Boolean","boolean",[],false);
    if (expression.kind === "math" || expression.kind === "parseInteger") return semanticType(node, "Number", "number", [], false, "Number");
    if (expression.kind === "globalCall") return semanticType(node, "void", "void", [], false);
    if (expression.kind === "intrinsicConstant") return semanticType(node, "uint", "number");
    if (expression.kind === "this") return semanticType(node, context.className, context.className, [], false, context.classQualifiedName);
    if (expression.kind === "identifier" && (expression.bindingKind === "builtin-class" || expression.bindingKind === "interface-class"))
        return semanticType(node, "Class", "__as3ClassValue", [], false);
    if (expression.kind === "identifier" && context.locals[expression.name]) {
        return context.locals[expression.name]!.type;
    }
    if (expression.kind === "identifier" && context.parameters[expression.name]) {
        return context.parameters[expression.name]!.rest ? semanticType(node,"Array","Array",[],false) : context.parameters[expression.name]!.type;
    }
    if (expression.kind === "identifier" && context.importsByLocal[expression.name]?.localValueType !== null
        && context.importsByLocal[expression.name]?.localValueType !== undefined) {
        return authoritySemanticType(context.importsByLocal[expression.name]!.localValueType!, context, node);
    }
    if (expression.kind === "identifier" && context.sourceMemberAuthority !== null) {
        const imported=context.importsByLocal[expression.name];
        if (expression.bindingKind === "current-class" && expression.bindingSourceQualifiedName === context.classQualifiedName
            || imported && ["local","flash"].includes(imported.authorityKind) && imported.localValueType === null
                && !imported.runtimeInterface && !imported.compileTimeNamespace)
            return semanticType(node,"Class","__as3ClassValue",[],false);
    }
    if (expression.kind === "member" && expression.target.kind === "this" && context.fields[expression.name]) {
        return context.fields[expression.name]!.type;
    }
    if (expression.kind === "member" && expression.target.kind === "this"
        && context.accessors[expression.name]?.getter) {
        return context.accessors[expression.name]!.getter!.returnType!;
    }
    if (expression.kind === "member" && expression.target.kind === "this"
        && context.baseLocalQName !== null && expression.capabilitySource !== null) {
        const inherited = localInheritedNamedMembers(context, expression.name, node);
        const readable = inherited.members.find(member => member.kind === "getter" || member.kind === "field");
        if (readable && inherited.ownerQName === expression.capabilitySource) {
            assertInheritedVisibility(readable, inherited.ownerQName, context, node);
            return authoritySemanticType(readable.kind === "field" ? readable.fieldType! : readable.returnType!, context, node);
        }
    }
    if (expression.kind === "member") {
        if (expression.capabilitySource === "Function" && expression.name === "length")
            return semanticType(node,"int","number");
        if (expression.capabilitySource === "Array" && expression.name === "length")
            return semanticType(node,"uint","number");
        if (BIG_TURN_TABLE_INNER_CONSUMERS[expression.capabilitySource || ""] !== undefined) {
            const innerMember = innerMemberType(context,
                assignmentType(expression.target, context, node), expression.name, node);
            if (innerMember !== null) return innerMember;
            fail("HARDENED_BIG_TURN_TABLE_DTO_MEMBER",
                "Big Turntable DTO member is outside the authenticated projection", node);
        }
        if (expression.target.kind === "identifier") {
            if (expression.target.bindingKind === "current-class"
                && expression.target.bindingSourceQualifiedName === context.classQualifiedName
                && expression.capabilitySource === context.classQualifiedName) {
                const field = context.fields[expression.name];
                const getter = context.accessors[expression.name]?.getter;
                if (field && field.modifiers.indexOf("static") >= 0) return field.type;
                if (getter && getter.modifiers.indexOf("static") >= 0) return getter.returnType!;
                fail("HARDENED_CURRENT_STATIC_READ",
                    "current-class static read lacks one exact field or getter declaration", node);
            }
            const imported = context.importsByLocal[expression.target.name];
            if (imported?.authorityKind === "flash" && imported.localValueType === null) {
                const mapping = memberMapping(context, imported.sourceQualifiedName, "read", expression.name, node);
                if (mapping === null || mapping.targetMember === null || mapping.targetMember.scope !== "static"
                    || expression.capabilitySource !== imported.sourceQualifiedName) {
                    fail("HARDENED_STATIC_MEMBER", "Flash static read requires one exact authenticated member", node);
                }
                return mappedMemberType(mapping, "read", context, node);
            }
            if (imported?.authorityKind === "local" && imported.localValueType === null) {
                const members = localStaticNamedMembers(context, imported.sourceQualifiedName,
                    expression.name, node);
                const readable = members.filter(member => member.kind === "getter" || member.kind === "field");
                if (readable.length !== 1) {
                    fail("HARDENED_LOCAL_STATIC_READ",
                        "local static read requires one exact authenticated field or getter", node);
                }
                const member = readable[0]!;
                return authoritySemanticType(member.kind === "field" ? member.fieldType! : member.returnType!,
                    context, node, {ownerQName: imported.sourceQualifiedName, member});
            }
            if (imported?.authorityKind === "intrinsic" && expression.capabilitySource === imported.sourceQualifiedName) {
                const member = intrinsicMember(context, imported.sourceQualifiedName, "read", expression.name);
                if (member !== null) return authoritySemanticType(member.returnType, context, node);
            }
        }
        const targetType = assignmentType(expression.target, context, node);
        const flashQName = mappedFlashQNameForType(targetType, context);
        if (flashQName !== null && expression.capabilitySource === flashQName) {
            const mapping = memberMapping(context, flashQName, "read", expression.name, node);
            if (mapping === null) {
                fail("HARDENED_MEMBER_UNMAPPED", "Flash property read lacks an exact double-pinned mapping", node);
            }
            return mappedMemberType(mapping!, "read", context, node);
        }
        const receiverQName = localQNameForType(targetType, context);
        if (receiverQName !== null && expression.capabilitySource !== null) {
            const lookup = localInstanceNamedMembers(context, receiverQName, expression.name, node, "read");
            if (lookup.members.length === 0 && lookup.ownerQName === null) {
                const mapping = terminalFlashMemberMapping(context,lookup.terminalFlashQNames,"read",expression.name,node);
                const bound = localInstanceNamedMembers(context, receiverQName, expression.name, node);
                const inheritedGetter = bound.ownerQName === expression.capabilitySource && bound.members.length > 0
                    && bound.members.every(member => member.kind === "setter" && !member.modifiers.includes("private"))
                    && mapping?.targetMember?.name === (expression.targetName ?? expression.name);
                if (mapping && (mapping.sourceQName === expression.capabilitySource || inheritedGetter))
                    return mappedMemberType(mapping,"read",context,node);
            }
            const readable = lookup.members.filter(member => member.kind === "getter" || member.kind === "field");
            if ((lookup.ownerQName !== expression.capabilitySource
                && localInstanceNamedMembers(context, receiverQName, expression.name, node).ownerQName !== expression.capabilitySource) || readable.length !== 1) {
                fail("HARDENED_LOCAL_INSTANCE_READ",
                    `local instance read ${receiverQName}.${expression.name} (bound to ${expression.capabilitySource}) requires one exact authenticated field or getter; read owner ${lookup.ownerQName}, members ${readable.length}`, node);
            }
            assertLocalReceiverVisibility(readable[0]!, lookup.ownerQName!, receiverQName, context, node);
            return authoritySemanticType(readable[0]!.kind === "field"
                ? readable[0]!.fieldType! : readable[0]!.returnType!, context, node);
        }
        if (expression.capabilitySource !== null) {
            const member = intrinsicMember(context, expression.capabilitySource, "read", expression.name);
            if (member !== null) return authoritySemanticType(member.returnType, context, node);
        }
        const ownerType = targetType;
        if (vectorElement(ownerType) !== null) {
            if (expression.name === "length") return semanticType(node, "uint", "number");
            if (expression.name === "fixed") return semanticType(node, "Boolean", "boolean");
        }
        if (ownerType.sourceName === "Error" && ownerType.emittedName === "Error"
            && (ownerType.runtimeName === null || ownerType.runtimeName === "Error")
            && ["message","name","errorID"].includes(expression.name)) return expression.name === "errorID"
                ? semanticType(node,"int","number") : semanticType(node,"*","unknown");
        if (ownerType.sourceName === "String" && expression.name === "length") return semanticType(node,"int","number");
        if (isArrayType(ownerType,context) && expression.name === "length") {
            return semanticType(node, "uint", "number");
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
    if (expression.kind === "array" && context.sourceMemberAuthority !== null) {
        return semanticType(node, "Array", "Array", [], false);
    }
    if (expression.kind === "object") return semanticType(node, "Object", "unknown", [], false);
    if (expression.kind === "ownRecord") {
        return semanticType(node, "Object", "AS3OwnRecord", [expression.valueType], false);
    }
    if (expression.kind === "new") {
        return withNullability(expression.sourceType, false);
    }
    if (expression.kind === "binary") {
        return expression.resultType;
    }
    if (expression.kind === "unary") {
        return expression.resultType;
    }
    if (expression.kind === "parenthesized" || expression.kind === "nonNull") {
        return expression.resultType;
    }
    if (expression.kind === "conditional" || expression.kind === "update" || expression.kind === "index" || expression.kind === "objectOperation" || expression.kind === "dictionaryHas") {
        return expression.resultType;
    }
    if (expression.kind === "delete") return expression.resultType;
    if (expression.kind === "vectorConversion") return expression.vectorType;
    if (expression.kind === "runtimeType") return expression.resultType;
    if (expression.kind === "coercion") return expression.targetType;
    if (expression.kind === "assignment") {
        return expression.resultType || assignmentTargetType(expression.target, context, node);
    }
    if (expression.kind === "call" && expression.resultType !== null) return expression.resultType;
    fail("HARDENED_ASSIGNMENT_TYPE", "assignment value type is not statically proven in the admitted subset", node);
}

function assignmentTargetType(expression: SemanticExpression, context: AdapterContext, node: TreeNode): SemanticType {
    if (expression.kind === "member" && expression.target.kind === "super" && context.baseLocalQName !== null
        && expression.capabilitySource !== null && !context.mappingsBySource[expression.capabilitySource]) {
        const inherited = localInheritedMember(context, expression.name, expression.superField ? "field" : "setter", null, node);
        if (inherited.member && inherited.ownerQName === expression.capabilitySource) {
            assertInheritedVisibility(inherited.member, inherited.ownerQName, context, node);
            if (expression.superField && inherited.member.readonly)
                fail("HARDENED_ASSIGNMENT_READONLY", "AS3 const fields are not writable", node);
            return authoritySemanticType(expression.superField ? inherited.member.fieldType! : inherited.member.parameters[0]!.type, context, node);
        }
    }
    if (expression.kind === "member" && expression.target.kind === "this") {
        const forward = context.inheritedAccessors?.find(item => item.name === expression.name && item.kind === "setter");
        if (forward) return forward.type;
    }

    if (expression.kind === "member" && (expression.target.kind === "super" || expression.target.kind === "this")
        && expression.capabilitySource !== null && context.mappingsBySource[expression.capabilitySource]) {
        const mapping = memberMapping(context, expression.capabilitySource, "write", expression.name, node);
        if (mapping !== null) return mappedMemberType(mapping, "write", context, node);
        fail("HARDENED_MEMBER_UNMAPPED", "Flash property write lacks an exact double-pinned mapping", node);
    }
    if (expression.kind === "identifier" && context.locals[expression.name]) {
        const local = context.locals[expression.name]!;
        if (local.readonly) fail("HARDENED_ASSIGNMENT_READONLY", "local const is not writable", node);
        return local.type;
    }
    if (expression.kind === "identifier" && context.parameters[expression.name]) {
        return context.parameters[expression.name]!.rest ? semanticType(node,"Array","Array",[],false) : context.parameters[expression.name]!.type;
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
    if (expression.kind === "member" && expression.target.kind === "this"
        && context.baseLocalQName !== null && expression.capabilitySource !== null) {
        const inherited = localInheritedNamedMembers(context, expression.name, node);
        const writable = inherited.members.find(member => member.kind === "setter"
            || (member.kind === "field" && !member.readonly));
        if (writable && inherited.ownerQName === expression.capabilitySource) {
            assertInheritedVisibility(writable, inherited.ownerQName, context, node);
            return authoritySemanticType(writable.kind === "field" ? writable.fieldType!
                : writable.parameters[0]!.type, context, node);
        }
    }
    if (expression.kind === "member") {
        if (expression.target.kind === "identifier") {
            if (expression.target.bindingKind === "current-class"
                && expression.target.bindingSourceQualifiedName === context.classQualifiedName
                && expression.capabilitySource === context.classQualifiedName) {
                const field = context.fields[expression.name];
                const setter = context.accessors[expression.name]?.setter;
                if (field && field.modifiers.indexOf("static") >= 0) {
                    if (field.readonly) fail("HARDENED_ASSIGNMENT_READONLY", "AS3 const fields are not writable", node);
                    return field.type;
                }
                if (setter && setter.modifiers.indexOf("static") >= 0) return setter.parameters[0]!.type;
                fail("HARDENED_CURRENT_STATIC_WRITE",
                    "current-class static write lacks one exact writable field or setter declaration", node);
            }
            const imported = context.importsByLocal[expression.target.name];
            if (imported?.authorityKind === "local" && imported.localValueType === null) {
                const members = localStaticNamedMembers(context, imported.sourceQualifiedName,
                    expression.name, node);
                const writable = members.filter(member => member.kind === "setter"
                    || (member.kind === "field" && !member.readonly));
                if (writable.length !== 1) {
                    fail("HARDENED_LOCAL_STATIC_WRITE",
                        "local static write requires one exact authenticated field or setter", node);
                }
                const member = writable[0]!;
                return authoritySemanticType(member.kind === "field" ? member.fieldType!
                    : member.parameters[0]!.type, context, node);
            }
        }
        const targetType = assignmentType(expression.target, context, node);
        const flashQName = mappedFlashQNameForType(targetType, context);
        if (flashQName !== null && expression.capabilitySource === flashQName) {
            const mapping = memberMapping(context, flashQName, "write", expression.name, node);
            if (mapping === null) {
                fail("HARDENED_MEMBER_UNMAPPED", "Flash property write lacks an exact double-pinned mapping", node);
            }
            return mappedMemberType(mapping!, "write", context, node);
        }
        const receiverQName = localQNameForType(targetType, context);
        if (receiverQName !== null && expression.capabilitySource !== null) {
            const lookup = localInstanceNamedMembers(context, receiverQName, expression.name, node, "write");
            if (lookup.members.length === 0 && lookup.ownerQName === null) {
                const mapping = terminalFlashMemberMapping(context,lookup.terminalFlashQNames,"write",expression.name,node);
                const bound = localInstanceNamedMembers(context, receiverQName, expression.name, node);
                const inheritedSetter = bound.ownerQName === expression.capabilitySource && bound.members.length > 0
                    && bound.members.every(member => member.kind === "getter" && !member.modifiers.includes("private"))
                    && mapping?.targetMember?.name === (expression.targetName ?? expression.name);
                if (mapping && (mapping.sourceQName === expression.capabilitySource || inheritedSetter))
                    return mappedMemberType(mapping,"write",context,node);
            }
            const writable = lookup.members.filter(member => member.kind === "setter"
                || (member.kind === "field" && !member.readonly));
            if ((lookup.ownerQName !== expression.capabilitySource
                && localInstanceNamedMembers(context, receiverQName, expression.name, node).ownerQName !== expression.capabilitySource) || writable.length !== 1) {
                fail("HARDENED_LOCAL_INSTANCE_WRITE",
                    "local instance write requires one exact authenticated field or setter", node);
            }
            assertLocalReceiverVisibility(writable[0]!, lookup.ownerQName!, receiverQName, context, node);
            return authoritySemanticType(writable[0]!.kind === "field"
                ? writable[0]!.fieldType! : writable[0]!.parameters[0]!.type, context, node);
        }
        if (expression.capabilitySource !== null) {
            const member = intrinsicMember(context, expression.capabilitySource, "write", expression.name);
            if (member !== null && member.parameterTypes.length === 1) {
                return authoritySemanticType(member.parameterTypes[0]!, context, node);
            }
        }
        const ownerType = targetType;
        if (vectorElement(ownerType) !== null) {
            if (expression.name === "length") return semanticType(node, "uint", "number");
            if (expression.name === "fixed") return semanticType(node, "Boolean", "boolean");
        }
    }
    if (expression.kind === "index") {
        if (expression.accessKind === "array" && context.sourceMemberAuthority === null) {
            fail("HARDENED_ARRAY_INDEX_WRITE", "Array indexed writes remain outside the proven read-only slice", node);
        }
        if (expression.accessKind === "bigTurnTableInnerRoot" || expression.accessKind === "bigTurnTableInnerCost") {
            fail("HARDENED_BIG_TURN_TABLE_DTO_WRITE",
                "authenticated Big Turntable DTO projections are read-only", node);
        }
        return expression.resultType;
    }
    const position=node.span === null ? "" : ` at source offsets ${node.span.start}:${node.span.end}`;
    const description=expression.kind === "member" ? `member ${expression.capabilitySource || expression.target.kind}.${expression.name}` : expression.kind;
    fail("HARDENED_ASSIGNMENT_TARGET", `assignment target ${description}${position} is not a writable parameter or instance field`, node);
}

function adaptCondition(expression: SemanticExpression, context: AdapterContext, node: TreeNode,
    code: string, message: string): SemanticExpression {
    const sourceType = assignmentType(expression, context, node);
    if (sourceType.sourceName === "Boolean" && sourceType.emittedName === "boolean") return expression;
    if (context.sourceMemberAuthority === null || sourceType.sourceName === "void") fail(code, message, node);
    return Object.assign(identity(node), {
        kind: "coercion" as "coercion",
        targetType: semanticType(node, "Boolean", "boolean", [], false),
        argument: expression,
    });
}

function assertAssignmentCompatible(target: SemanticType, value: SemanticType, node: TreeNode): void {
    if ((value.sourceName === "null" && target.nullable)
        || (sameUnderlyingType(target, value) && (target.nullable || !value.nullable))
        || target.sourceName === "Object" || target.sourceName === "*" || sameType(target, value)) {
        return;
    }
    fail("HARDENED_ASSIGNMENT_TYPE", `assignment from ${value.sourceName} (${value.emittedName}, nullable=${value.nullable}) to ${target.sourceName} (${target.emittedName}, nullable=${target.nullable}) requires proven AS3 coercion at node ${node.id}`, node);
}

function referenceCoercionForType(type: SemanticType, context: AdapterContext): ReferenceCoercion | null {
    if (type.sourceName === context.className)
        return {targetKind:"class", runtimeName:context.classQualifiedName};
    const imported = context.importsByLocal[type.sourceName];
    if (imported?.authorityKind === "intrinsic" && imported.sourceQualifiedName === "flash.utils.ByteArray"
        && context.sourceMemberAuthority?.entriesByQName[imported.sourceQualifiedName]?.baseQName === "Object")
        return {targetKind:"class",runtimeName:imported.sourceQualifiedName};
    if (imported?.authorityKind !== "local" && (imported?.authorityKind !== "flash"
        || !context.runtimeReferenceParentsByQName.has(imported.sourceQualifiedName))) return null;
    if (imported?.localValueType === null && (imported.runtimeInterface || imported.runtimeConstructible))
        return {targetKind:imported.runtimeInterface ? "interface" : "class", runtimeName:imported.sourceQualifiedName};
    return null;
}

function adaptAssignmentValue(target: SemanticType, expression: SemanticExpression,
    context: AdapterContext, node: TreeNode): SemanticExpression {
    const value = assignmentType(expression, context, node);
    const reference = context.sourceMemberAuthority !== null ? referenceCoercionForType(target, context) : null;
    if (reference && ["*", "Object", "undefined"].includes(value.sourceName))
        return Object.assign(identity(node), {kind:"coercion" as const, reference, targetType:target, argument:expression});
    if (nativeArrayBase(context) && target.sourceName === "Array" && target.emittedName === "Array"
        && (target.runtimeName === null || target.runtimeName === "Array") && !context.importsByLocal.Array
        && context.className !== "Array" && ["*", "undefined"].includes(value.sourceName))
        return Object.assign(identity(node), {kind:"coercion" as const,slot:true as const,targetType:target,argument:expression});
    const targetImport = context.importsByLocal[target.sourceName];
    if (context.sourceMemberAuthority !== null && isDictionaryType(target)
        && targetImport?.authorityKind === "intrinsic" && targetImport.sourceQualifiedName === "flash.utils.Dictionary"
        && ["*", "Object", "undefined"].includes(value.sourceName))
        return Object.assign(identity(node), {kind:"coercion" as const,slot:true as const,targetType:target,argument:expression});
    if (context.sourceMemberAuthority !== null && value.sourceName === "*"
        && ["String","Number","int","uint","Function"].includes(target.sourceName))
        return Object.assign(identity(node), {kind:"coercion" as const,slot:true as const,targetType:target,argument:expression});
    if (target.sourceName === "Object" && target.emittedName === "unknown" && value.sourceName === "*") {
        return Object.assign(identity(node), {kind: "coercion" as "coercion", targetType: target, argument: expression});
    }
    if (target.sourceName === "Boolean" && value.sourceName === "*" && context.sourceMemberAuthority !== null)
        return Object.assign(identity(node),{kind:"coercion" as const,targetType:target,argument:expression});
    const recordValue = ownRecordValue(target);
    if (recordValue !== null) {
        if (!isTreeNodeContext(context) || context.currentCallable?.constructor !== true
            || expression.kind !== "object" || expression.properties.length !== 0) {
            fail("HARDENED_OWN_RECORD_INITIALIZER",
                "TTreeNode.FData is initialized exactly once from the authenticated empty literal", node);
        }
        context.ownRecordInitializations += 1;
        if (context.ownRecordInitializations > 1) {
            fail("HARDENED_OWN_RECORD_INITIALIZER",
                "TTreeNode.FData requires exactly one authenticated constructor initialization", node);
        }
        return Object.assign(identity(node), { kind: "ownRecord" as "ownRecord", valueType: recordValue });
    }
    if (["Number", "int", "uint"].includes(target.sourceName)
        && ["Number", "int", "uint"].includes(value.sourceName)
        && target.sourceName !== value.sourceName) {
        return Object.assign(identity(node), {
            kind: "coercion" as "coercion",
            targetType: withNullability(target, false),
            argument: expression,
        });
    }
    if (["Boolean", "Number", "int", "uint"].includes(target.sourceName)
        && !target.nullable && value.nullable && sameUnderlyingType(target, value)) {
        return Object.assign(identity(node), {
            kind: "coercion" as "coercion",
            targetType: withNullability(target, false),
            argument: expression,
        });
    }
    if ((target.nullable || !value.nullable) && provenReferenceSubtype(value, target, context)) {
        // Native base identity may be implemented by composition in a shared
        // bridge, so TypeScript's structural/JS ancestry cannot encode this upcast.
        if (reference && targetImport?.authorityKind === "flash" && !sameUnderlyingType(target,value))
            return Object.assign(identity(node), {kind:"coercion" as const, reference, targetType:target, argument:expression});
        return expression;
    }
    assertAssignmentCompatible(target, value, node);
    return expression;
}

function builtinMathMember(node: TreeNode, context: AdapterContext): string | null {
    if (node.kind !== "DOT" || node.children.length !== 2 || node.children[0]!.kind !== "IDENTIFIER"
        || node.children[0]!.text !== "Math" || context.className === "Math"
        || context.locals.Math || context.parameters.Math || context.fields.Math || context.methods.Math
        || context.accessors.Math || context.importsByLocal.Math || context.resolveImportedType("Math", null, node)) return null;
    // Reuse the exhaustive base-member check: an inherited value can shadow a global too.
    assertNoInheritedNativeFunctionShadow(context, "Math", node);
    return requiredText(node.children[1]!, "Math member");
}

function parseExpression(node: TreeNode, context: AdapterContext, valuePosition: boolean,
    allowSuperCall: boolean = false, allowMethodClosure: boolean = true,
    allowAssignment: boolean = false): SemanticExpression {
    if (context.sourceMemberAuthority !== null && node.kind === "ARRAY_ACCESSOR" && node.children.length > 2) {
        // The original parser stores a[b][c] as [a,b,c]. Each suffix consumes
        // the previous access, including its read/error, before evaluating the next key.
        if (node.children.length > 65)
            fail("HARDENED_INDEX_SHAPE", "indexed access exceeds the bounded suffix count", node);
        let indexed = node.children[0]!;
        for (const key of node.children.slice(1))
            indexed = {...node, children:[indexed,key]};
        return parseExpression(indexed, context, valuePosition, allowSuperCall, allowMethodClosure, allowAssignment);
    }
    if (context.sourceMemberAuthority !== null && node.kind === "CALL" && node.children.length > 2
        && node.children[1]!.kind === "ARGUMENTS") {
        const suffixes = node.children.slice(2);
        if (suffixes.length > 64 || suffixes.some(child => child.kind !== "ARRAY" || child.children.length !== 1))
            fail("HARDENED_CALL_SHAPE", "call suffixes require bounded single-key indexed accesses", node);
        let indexed = {...node, children:node.children.slice(0, 2)};
        for (const suffix of suffixes)
            indexed = {...suffix, kind:"ARRAY_ACCESSOR", children:[indexed, suffix.children[0]!]};
        return parseExpression(indexed, context, valuePosition, allowSuperCall, allowMethodClosure, allowAssignment);
    }
    if (context.sourceMemberAuthority !== null && node.kind === "CALL" && node.children.length === 2
        && node.children[1]!.kind === "ARGUMENTS" && node.children[0]!.kind === "IDENTIFIER"
        && node.children[0]!.text === "isNaN" && context.className !== "isNaN"
        && !context.locals.isNaN && !context.parameters.isNaN && !context.fields.isNaN
        && !context.methods.isNaN && !context.accessors.isNaN && !context.importsByLocal.isNaN
        && !context.resolveImportedType("isNaN", null, node)) {
        assertNoInheritedNativeFunctionShadow(context,"isNaN",node);
        const argumentNodes=node.children[1]!.children;
        if (argumentNodes.length > 1) fail("HARDENED_NUMERIC_PREDICATE_ARITY", "isNaN accepts zero or one argument",node);
        const args=argumentNodes.map(child=>parseExpression(child,context,true));
        args.forEach((argument,index)=>adaptAssignmentValue(authoritySemanticType("Number",context,argumentNodes[index]!),
            argument,context,argumentNodes[index]!));
        return Object.assign(identity(node),{kind:"numericPredicate" as const,name:"isNaN" as const,arguments:args});
    }
    if (context.sourceMemberAuthority !== null && node.kind === "CALL" && node.children.length === 2
        && node.children[1]!.kind === "ARGUMENTS" && node.children[0]!.kind === "IDENTIFIER"
        && node.children[0]!.text === "parseInt" && context.className !== "parseInt"
        && !context.locals.parseInt && !context.parameters.parseInt && !context.fields.parseInt
        && !context.methods.parseInt && !context.accessors.parseInt && !context.importsByLocal.parseInt
        && !context.resolveImportedType("parseInt", null, node)) {
        assertNoInheritedNativeFunctionShadow(context, "parseInt", node);
        const argumentNodes = node.children[1]!.children;
        if (argumentNodes.length > 2)
            fail("HARDENED_PARSE_INTEGER_ARITY", "native parseInt accepts zero through two arguments", node);
        const args = argumentNodes.map(child => parseExpression(child, context, true));
        args.forEach((argument, index) => {
            // Check native String/int parameter assignment without moving conversion before
            // evaluation of the other argument. The runtime converts after both evaluate.
            adaptAssignmentValue(authoritySemanticType(index === 0 ? "String" : "int", context, argumentNodes[index]!),
                argument, context, argumentNodes[index]!);
        });
        return Object.assign(identity(node), {kind: "parseInteger" as "parseInteger", arguments: args});
    }
    if (node.kind === "CALL" && node.children.length === 2 && node.children[1]!.kind === "ARGUMENTS"
        && node.children[0]!.kind === "IDENTIFIER" && node.children[0]!.text === "trace"
        && context.className !== "trace" && !context.locals.trace && !context.parameters.trace
        && !context.fields.trace && !context.methods.trace && !context.accessors.trace && !context.importsByLocal.trace
        && !context.resolveImportedType("trace", null, node)) {
        assertNoInheritedNativeFunctionShadow(context, "trace", node);
        const mapping = context.mappingsBySource.trace;
        if (!mapping || mapping.sourceRoles.indexOf("global-function") < 0)
            fail("HARDENED_GLOBAL_FUNCTION_AUTHORITY", "global trace lacks authenticated native and shared target authority", node);
        const args = node.children[1]!.children.map(child => parseExpression(child, context, true));
        args.forEach((argument, index) => {
            const type = assignmentType(argument, context, node.children[1]!.children[index]!);
            if (!["String","Number","int","uint","Boolean","null","undefined","Object","*","Array","Function","Class","Error","ArgumentError"].includes(type.sourceName)
                && localQNameForType(type,context) === null)
                fail("HARDENED_GLOBAL_STRING_CONVERSION", "trace value domain requires native String conversion support", node.children[1]!.children[index]!);
        });
        return Object.assign(identity(node), {kind: "globalCall" as "globalCall", name: "trace" as "trace",
            targetModule: targetModuleSpecifier(mapping.targetModule), targetExport: mapping.targetExport,
            arguments: args});
    }
    if (["ADD", "MINUS", "MULTIPLICATION", "RELATION", "EQUALITY", "AND", "OR", "B_AND", "B_OR", "B_XOR", "SHIFT"].includes(node.kind)
        && node.children.length > 3) {
        if (node.children.length % 2 !== 1 || node.children.length > 257
            || node.children.some((child, index) => index % 2 === 1 && child.kind !== "OP"))
            fail("HARDENED_BINARY_SHAPE", "Binary chain must contain bounded alternating operands and operators", node);
        let left = node.children[0]!;
        for (let index = 1; index < node.children.length; index += 2)
            left = Object.assign({}, node, {children: [left, node.children[index]!, node.children[index + 1]!]});
        return parseExpression(left, context, valuePosition, allowSuperCall, allowMethodClosure, allowAssignment);
    }
    const mathName = builtinMathMember(node, context);
    if (mathName !== null) {
        if (mathName !== "PI" || !valuePosition)
            fail("HARDENED_MATH_MEMBER", "Only numeric Math calls and the read-only PI constant are admitted", node);
        return Object.assign(identity(node), {kind: "math" as "math", member: "PI" as "PI", arguments: null});
    }
    if (node.kind === "CALL" && node.children.length === 2 && node.children[1]!.kind === "ARGUMENTS") {
        const member = builtinMathMember(node.children[0]!, context);
        if (member !== null) {
            if (member !== "min" && member !== "max") fail("HARDENED_MATH_MEMBER", "Math method is outside the proven numeric subset", node);
            const args = node.children[1]!.children.map(child => parseExpression(child, context, true));
            args.forEach((argument, index) => {
                if (!["Number", "int", "uint"].includes(assignmentType(argument, context, node.children[1]!.children[index]!).sourceName))
                    fail("HARDENED_MATH_ARGUMENT", "Math arguments require proven numeric values", node.children[1]!.children[index]!);
            });
            return Object.assign(identity(node), {kind: "math" as "math", member: member as "min" | "max", arguments: args});
        }
    }
    if (node.kind === "LITERAL") {
        return parseLiteral(node);
    }
    if (node.kind === "ARRAY") {
        return Object.assign(identity(node), {
            kind: "array" as "array",
            elements: node.children.map(child => parseExpression(child, context, true)),
        });
    }
    if (node.kind === "SHORT_VECTOR") {
        if (node.children.length !== 2 || node.children[0]!.kind !== "VECTOR" || node.children[1]!.kind !== "ARRAY") {
            fail("HARDENED_SHORT_VECTOR_SHAPE", "short Vector literal requires one type and one array payload", node);
        }
        const vectorType = parseType(node.children[0]!, context, false);
        const source = parseExpression(node.children[1]!, context, true);
        return Object.assign(identity(node), {
            kind: "vectorConversion" as "vectorConversion", vectorType, source,
        });
    }
    if (node.kind === "OBJECT") {
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
            return Object.assign(identity(property), {
                name, value: parseExpression(valueNode.children[0]!, context, true),
            });
        });
        return Object.assign(identity(node), { kind: "object" as "object", properties });
    }
    if (node.kind === "NEW") {
        if (node.children.length === 1 && node.children[0]!.kind === "SHORT_VECTOR") {
            const literal = node.children[0]!;
            if (literal.children.length !== 2 || literal.children[0]!.kind !== "VECTOR"
                || literal.children[1]!.kind !== "ARRAY") {
                fail("HARDENED_SHORT_VECTOR_SHAPE", "short Vector literal requires one type and one array payload", literal);
            }
            const vectorType = parseType(literal.children[0]!, context, false);
            const source = parseExpression(literal.children[1]!, context, true);
            return Object.assign(identity(node), {
                kind: "vectorConversion" as "vectorConversion", vectorType, source,
            });
        }
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
                args[0] = adaptAssignmentValue(semanticType(call, "uint", "number"), args[0], context,
                    call.children[1]!.children[0]!);
            }
            if (args[1] && assignmentType(args[1], context, call.children[1]!.children[1]!).sourceName !== "Boolean") {
                fail("HARDENED_VECTOR_FIXED", "Vector fixed argument must be a proven Boolean", call.children[1]!.children[1]!);
            }
            return Object.assign(identity(node), { kind: "new" as "new", sourceType, arguments: args });
        }
        const name = validateIdentifier(requiredText(nameNode, "constructor target"), nameNode);
        const args = call.children[1]!.children.map((child) => parseExpression(child, context, true));
        if (context.sourceMemberAuthority !== null
            && (context.locals[name]?.type.sourceName === "Class" || context.parameters[name]?.type.sourceName === "Class")) {
            const constructorValue=parseExpression(nameNode,context,true);
            if (assignmentType(constructorValue,context,nameNode).sourceName !== "Class")
                fail("HARDENED_NEW_DYNAMIC_TYPE", "dynamic construction requires a proven Class value", nameNode);
            for (const argument of args) if (assignmentType(argument,context,call).sourceName === "void")
                fail("HARDENED_NEW_DYNAMIC_ARGUMENT", "constructor arguments must produce values", call);
            return Object.assign(identity(node), {kind:"new" as const,dynamicClass:true as const,
                sourceType:semanticType(node,"*","unknown"),constructorValue,arguments:args});
        }
        if (name === "Array" && context.sourceMemberAuthority !== null && context.className !== name
            && !context.locals[name] && !context.parameters[name] && !context.fields[name] && !context.methods[name]
            && !context.accessors[name] && !context.importsByLocal[name] && !context.resolveImportedType(name,null,nameNode)) {
            assertNoInheritedNativeFunctionShadow(context,name,nameNode);
            const native=context.sourceMemberAuthority.entriesByQName.Array;
            if (!native || native.baseQName !== "Object" || !native.dynamic || !native.ownInstanceMemberNames.includes("length"))
                fail("HARDENED_ARRAY_CONSTRUCTOR_AUTHORITY", "Array construction requires the authenticated native SDK type",call);
            for (const argument of args) if (assignmentType(argument,context,call).sourceName === "void")
                fail("HARDENED_ARRAY_CONSTRUCTOR_ARGUMENT", "Array constructor arguments must produce values",call);
            return Object.assign(identity(node),{kind:"new" as const,nativeArray:true as const,sourceType:semanticType(node,"Array","Array",[],false,"Array"),arguments:args});
        }
        if (name === "Error" && context.sourceMemberAuthority !== null && context.className !== "Error"
            && !context.locals.Error && !context.parameters.Error && !context.fields.Error && !context.methods.Error
            && !context.accessors.Error && !context.importsByLocal.Error && !context.resolveImportedType("Error",null,nameNode)) {
            assertNoInheritedNativeFunctionShadow(context,"Error",nameNode);
            if (args.length > 1 || args.some(argument => {
                const type=assignmentType(argument,context,call);
                return type.sourceName !== "String" || type.nullable;
            })) fail("HARDENED_ERROR_CONSTRUCTOR", "Error construction requires zero arguments or one proven non-null String",call);
            return Object.assign(identity(node),{kind:"new" as const,sourceType:semanticType(node,"Error","Error",[],false),arguments:args});
        }
        if (name === "ArgumentError" && context.sourceMemberAuthority !== null && context.className !== name
            && !context.locals[name] && !context.parameters[name] && !context.fields[name] && !context.methods[name]
            && !context.accessors[name] && !context.importsByLocal[name] && !context.resolveImportedType(name,null,nameNode)) {
            assertNoInheritedNativeFunctionShadow(context,name,nameNode);
            if (args.length > 2 || (args[1]
                && !["Number","int","uint"].includes(assignmentType(args[1],context,call).sourceName)))
                fail("HARDENED_ARGUMENT_ERROR_CONSTRUCTOR", "ArgumentError requires zero to two arguments and a proven numeric identifier",call);
            return Object.assign(identity(node), {kind:"new" as const,
                sourceType:semanticType(node,"ArgumentError","__AS3ArgumentError",[],false,"ArgumentError"),arguments:args});
        }
        const embedded = context.fields[name]?.embeddedBitmap;
        if (embedded && !context.locals[name] && !context.parameters[name]) {
            if (args.length !== 0) fail("HARDENED_EMBED_CONSTRUCTOR_ARITY", "Embedded bitmap construction currently admits zero arguments", call);
            const bitmapImport = Object.values(context.importsByLocal).find(item => item.sourceQualifiedName === "flash.display.Bitmap");
            if (!bitmapImport) fail("HARDENED_EMBED_BITMAP_AUTHORITY", "Embedded bitmap requires its authenticated Bitmap type", node);
            const constructorValue = parseExpression(nameNode, context, true);
            return Object.assign(identity(node), {kind: "new" as "new", arguments: args,
                sourceType: semanticType(nameNode, bitmapImport.sourceLocalName, bitmapImport.sourceLocalName, [], undefined, bitmapImport.sourceQualifiedName), constructorValue});
        }
        let sourceType: SemanticType;
        if (name === context.className) {
            const local = context.methods[name];
            // Match imported local classes: an omitted constructor has zero
            // source arguments, and the emitter owns its implicit super().
            const implicitConstructor = !local && context.sourceMemberAuthority !== null && args.length === 0;
            if (!implicitConstructor && (!local || !local.constructor || !admittedArity(local.parameters, args.length))) {
                fail("HARDENED_NEW_LOCAL_ARITY", "local constructor call does not match its exact declaration", call);
            }
            if (local) args.forEach((argument, index) => {
                args[index] = adaptAssignmentValue(local.parameters[index]!.type, argument, context,
                    call.children[1]!.children[index]!);
            });
            sourceType = semanticType(nameNode, name, name, [], undefined, context.classQualifiedName);
        } else {
            if (!context.importsByLocal[name] && context.fileCompilation?.byName[name])
                assertNoInheritedNativeFunctionShadow(context, name, nameNode);
            const imported = context.importsByLocal[name] ?? (context.fileCompilation?.byName[name]
                ? context.resolveImportedType(name, "class", nameNode) : null);
            if (imported?.authorityKind === "intrinsic"
                && imported.sourceQualifiedName === "flash.utils.Dictionary") {
                if (args.length > 1 || (args[0]
                    && assignmentType(args[0], context, call.children[1]!.children[0]!).sourceName !== "Boolean")) {
                    fail("HARDENED_DICTIONARY_CONSTRUCTOR",
                        "Dictionary constructor accepts only one optional proven Boolean weakKeys flag", call);
                }
                sourceType = semanticType(nameNode, name, name);
                return Object.assign(identity(node), { kind: "new" as "new", sourceType, arguments: args });
            }
            if (imported?.authorityKind === "intrinsic"
                && imported.sourceQualifiedName === "flash.utils.ByteArray") {
                if (args.length !== 0) {
                    fail("HARDENED_BYTEARRAY_CONSTRUCTOR", "ByteArray constructor accepts no arguments", call);
                }
                sourceType = semanticType(nameNode, name, name);
                return Object.assign(identity(node), { kind: "new" as "new", sourceType, arguments: args });
            }
            if (imported?.authorityKind === "intrinsic") {
                fail("HARDENED_INTRINSIC_CONSTRUCTOR", "intrinsic import is not an admitted constructor", call);
            }
            if (imported?.authorityKind === "local") {
                const constructorMember = localConstructor(context, imported.sourceQualifiedName, call);
                if (constructorMember !== null) {
                    const visibility = memberVisibility(constructorMember.modifiers);
                    const currentPackage = context.classQualifiedName.slice(0,
                        Math.max(0, context.classQualifiedName.lastIndexOf(".")));
                    const targetPackage = imported.sourceQualifiedName.slice(0,
                        Math.max(0, imported.sourceQualifiedName.lastIndexOf(".")));
                    if (visibility === "private" || visibility === "protected"
                        || (visibility === "internal" && currentPackage !== targetPackage)) {
                        fail("HARDENED_LOCAL_CONSTRUCTOR_VISIBILITY",
                            "local constructor is not visible from the current source package", call);
                    }
                }
                assertLocalCallArguments(constructorMember, args, call.children[1]!.children, context, call);
                sourceType = semanticType(nameNode, name, name, [], undefined, imported.sourceQualifiedName);
                return Object.assign(identity(node), { kind: "new" as "new", sourceType, arguments: args });
            }
            const typeMapping = imported ? context.mappingsBySource[imported.sourceQualifiedName] : undefined;
            if (!imported || !typeMapping || typeMapping.sourceRoles.indexOf("constructor") < 0) {
                fail("HARDENED_NEW_AUTHORITY", `constructor target ${name} lacks a double-pinned source and target constructor at node ${nameNode.id}`, nameNode);
            }
            const mapping = memberMapping(context, imported.sourceQualifiedName, "call", name, call);
            if (mapping === null || mapping.sourceRoles.indexOf("constructor") < 0
                || mapping.targetMember === null || mapping.targetMember.kind !== "constructor"
                || args.length < mapping.sourceMember!.minArgs || args.length > mapping.sourceMember!.maxArgs) {
                fail("HARDENED_NEW_ARITY", "constructor arity lacks one exact double-pinned signature", call);
            }
            adaptMappedCall(mapping!, args, call.children[1]!.children, context, call);
            sourceType = semanticType(nameNode, name, name, [], undefined, imported.sourceQualifiedName);
        }
        return Object.assign(identity(node), { kind: "new" as "new", sourceType, arguments: args, initializationSelf: name === context.className });
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
        const runtimeImport = context.importsByLocal[targetType.sourceName];
        if (runtimeImport?.authorityKind === "intrinsic" && runtimeImport.sourceQualifiedName === "flash.utils.ByteArray"
            && !referenceCoercionForType(targetType,context))
            fail("HARDENED_BYTEARRAY_TYPE_AUTHORITY", "ByteArray runtime type queries require native SDK authority", rawTarget);
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
        const resultType = operator === "is" ? semanticType(node, "Boolean", "boolean")
            : withNullability(targetType, true);
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
        if (operator === "in") {
            const index = parseExpression(node.children[0]!,context,true);
            const target = parseExpression(node.children[2]!,context,true);
            const targetType = assignmentType(target,context,node);
            if (intrinsicSourceForType(targetType,context) === "flash.utils.Dictionary") {
                if (assignmentType(index,context,node).sourceName === "void")
                    fail("HARDENED_DICTIONARY_KEY", "Dictionary key must be a proven value", node);
                return Object.assign(identity(node), {kind:"dictionaryHas" as const,target,index,
                    resultType:semanticType(node,"Boolean","boolean")});
            }
            if (!dynamicObjectType(targetType,context))
                fail("HARDENED_OBJECT_IN", "in requires an authenticated Object or intrinsic Dictionary target", node);
            assertObjectKey(assignmentType(index,context,node),node);
            return Object.assign(identity(node), {kind:"objectOperation" as const,operation:"has" as const,
                target,index,arguments:[],callerQName:context.classQualifiedName,resultType:semanticType(node,"Boolean","boolean")});
        }
        const admitted = new Set(["<", "<=", ">", ">=", "==", "!=", "===", "!==", "&&", "||", "+", "-", "*", "/", "%"]);
        if (!admitted.has(operator)) {
            fail("HARDENED_BINARY_OPERATOR", "coercive or runtime-dependent binary operator remains held", node.children[1]!);
        }
        const left = parseExpression(node.children[0]!, context, true);
        const right = parseExpression(node.children[2]!, context, true);
        const leftType = assignmentType(left, context, node.children[0]!);
        const rightType = assignmentType(right, context, node.children[2]!);
        if ((operator === "&&" || operator === "||") && context.sourceMemberAuthority !== null) {
            if ([leftType,rightType].some(type => (valuePosition ? ["void","XML","XMLList"] : ["XML","XMLList"]).includes(type.sourceName)))
                fail("HARDENED_LOGICAL_TYPE", "logical operands require supported AS3 value domains", node);
            // Native logical operators select an operand, retaining its value and
            // skipping the other expression. Boolean coercion belongs to the consumer.
            const resultType = sameUnderlyingType(leftType,rightType)
                ? withNullability(leftType,leftType.nullable || rightType.nullable)
                : [leftType,rightType].every(type => ["Number","int","uint"].includes(type.sourceName))
                    ? semanticType(node,"Number","number") : semanticType(node,"*","unknown");
            return Object.assign(identity(node),{kind:"binary" as const,
                operator:operator as "&&" | "||",left,right,resultType});
        }
        if (["===","!=="].includes(operator) && context.sourceMemberAuthority !== null
            && ([leftType,rightType].some(type => dynamicObjectType(type,context))
                || [leftType,rightType].every(type => isArrayType(type,context))
                || [leftType,rightType].every(type => type.runtimeName !== null
                    && (localQNameForType(type,context) !== null || mappedFlashQNameForType(type,context) !== null)))
            && [leftType,rightType].every(type => !["void","XML","XMLList"].includes(type.sourceName))) {
            return Object.assign(identity(node),{kind:"binary" as const,
                operator:operator as "===" | "!==",left,right,referenceIdentity:true as const,resultType:semanticType(node,"Boolean","boolean")});
        }
        if (operator === "+" && context.sourceMemberAuthority !== null
            && [leftType,rightType].every(type => !["void","XML","XMLList"].includes(type.sourceName))
            && [leftType,rightType].some(type => ["*","Object","Array","Function"].includes(type.sourceName))) {
            return Object.assign(identity(node), {kind:"binary" as const,operator:"+" as const,
                left,right,additionCoercion:true as const,resultType:semanticType(node,"*","unknown")});
        }
        if (["-","*","/","%"].includes(operator) && context.sourceMemberAuthority !== null
            && [leftType,rightType].some(type => type.sourceName === "*")
            && [leftType,rightType].every(type => ["*","Number","int","uint"].includes(type.sourceName))) {
            return Object.assign(identity(node), {kind:"binary" as const,
                operator:operator as "-" | "*" | "/" | "%", left, right, numericCoercion:true as const,
                resultType:semanticType(node,"Number","number")});
        }
        if (["<","<=",">",">="].includes(operator) && context.sourceMemberAuthority !== null) {
            if ([leftType,rightType].some(type => ["void","XML","XMLList","Namespace","QName"].includes(type.sourceName)))
                fail("HARDENED_BINARY_RELATION", "Ordered relations require supported native value domains", node);
            return Object.assign(identity(node), {kind:"binary" as const,
                operator:operator as "<" | "<=" | ">" | ">=", left,right,relationCoercion:true as const,
                resultType:semanticType(node,"Boolean","boolean")});
        }
        const nullComparison = (leftType.sourceName === "null" && rightType.nullable)
            || (rightType.sourceName === "null" && leftType.nullable);
        const looseEquality = operator === "==" || operator === "!=";
        if (looseEquality && context.sourceMemberAuthority !== null) {
            if ([leftType,rightType].some(type => ["void","XML","XMLList","Namespace","QName"].includes(type.sourceName)))
                fail("HARDENED_BINARY_COERCION", "Loose equality requires supported native value domains", node);
            return Object.assign(identity(node), {kind:"binary" as const,
                operator:operator as "==" | "!=", left,right,equalityCoercion:true as const,
                resultType:semanticType(node,"Boolean","boolean")});
        }
        const numericPair = context.sourceMemberAuthority !== null
            && [leftType, rightType].every(type => ["Number", "int", "uint"].includes(type.sourceName) && type.emittedName === "number");
        const sameValueDomain = context.sourceMemberAuthority !== null
            && sameUnderlyingType(leftType, rightType)
            && !["Object", "*", "XML", "XMLList", "void"].includes(leftType.sourceName);
        if (looseEquality && !nullComparison && !numericPair && !sameValueDomain)
            fail("HARDENED_BINARY_COERCION", "Loose equality requires null or a proven common primitive/reference domain", node);
        const strictEquality = operator === "===" || operator === "!==" || looseEquality;
        const stringConcatenation = operator === "+"
            && [leftType, rightType].some(type => type.sourceName === "String" && !type.nullable)
            && [leftType, rightType].every(type => ["String", "Number", "int", "uint", "Boolean", "null"].includes(type.sourceName));
        if (!numericPair && !stringConcatenation && !sameType(leftType, rightType)
            && !(strictEquality && (nullComparison || sameUnderlyingType(leftType, rightType)))) {
            fail("HARDENED_BINARY_TYPE", `binary ${operator} operands ${leftType.sourceName} and ${rightType.sourceName} require compatible proven source types`, node);
        }
        if ((operator === "&&" || operator === "||") && leftType.sourceName !== "Boolean") {
            fail("HARDENED_BINARY_BOOLEAN", "logical operators require exact Boolean operands", node);
        }
        if (["<", "<=", ">", ">="].indexOf(operator) >= 0
            && !numericPair && leftType.sourceName !== "Number" && leftType.sourceName !== "String") {
            fail("HARDENED_BINARY_RELATION", "ordered relations require exact Number or String operands", node);
        }
        if (["-", "*", "/", "%"].indexOf(operator) >= 0 && !numericPair && leftType.sourceName !== "Number") {
            fail("HARDENED_BINARY_NUMBER", "numeric operators require exact Number operands", node);
        }
        if (operator === "+" && !numericPair && !stringConcatenation && leftType.sourceName !== "Number" && leftType.sourceName !== "String") {
            fail("HARDENED_BINARY_ADD", "addition requires exact Number or exact String operands", node);
        }
        const booleanResult = ["<", "<=", ">", ">=", "==", "!=", "===", "!==", "&&", "||"].indexOf(operator) >= 0;
        const resultType = booleanResult
            ? semanticType(node, "Boolean", "boolean")
            : stringConcatenation ? semanticType(node, "String", "string", [], false)
                : numericPair ? semanticType(node, "Number", "number") : leftType;
        return Object.assign(identity(node), {
            kind: "binary" as "binary",
            operator: operator as "<" | "<=" | ">" | ">=" | "==" | "!=" | "===" | "!==" | "&&" | "||" |
                "+" | "-" | "*" | "/" | "%",
            left, right, resultType,
        });
    }
    if (node.kind === "TYPEOF") {
        if (node.children.length !== 1) {
            fail("HARDENED_TYPEOF_SHAPE", "typeof expression requires exactly one operand", node);
        }
        if (context.sourceMemberAuthority === null) {
            fail("HARDENED_TYPEOF_PROFILE", "typeof remains outside the legacy admitted subset", node);
        }
        const rawOperand = node.children[0]!;
        const typeofExpression = (operandNode: TreeNode): SemanticExpression => {
            const operand = parseExpression(operandNode, context, true);
            assignmentType(operand, context, operandNode);
            return Object.assign(identity(node), {
                kind: "unary" as "unary", operator: "typeof" as "typeof", operand,
                resultType: semanticType(node, "String", "string", [], false),
            });
        };
        // The parser nests an unparenthesized equality beneath TYPEOF. Restore
        // unary precedence for both loose and strict comparisons; an explicit
        // parenthesized operand remains ENCAPSULATED and must not be rotated.
        if (rawOperand.kind === "EQUALITY" && rawOperand.children.length === 3
            && rawOperand.children[1]!.kind === "OP"
            && ["==", "!=", "===", "!=="].includes(requiredText(rawOperand.children[1]!, "typeof comparison operator"))) {
            const left = typeofExpression(rawOperand.children[0]!);
            const right = parseExpression(rawOperand.children[2]!, context, true);
            const rightType = assignmentType(right, context, rawOperand.children[2]!);
            if (rightType.sourceName !== "String" || rightType.emittedName !== "string") {
                fail("HARDENED_TYPEOF_COMPARISON", "typeof comparison requires an exact String value", rawOperand);
            }
            return Object.assign(identity(node), {
                kind: "binary" as "binary",
                operator: requiredText(rawOperand.children[1]!, "typeof comparison operator") as "==" | "!=" | "===" | "!==",
                left, right, resultType: semanticType(node, "Boolean", "boolean", [], false),
            });
        }
        return typeofExpression(rawOperand);
    }
    if (node.kind === "PLUS" || node.kind === "MINUS" || node.kind === "NOT" || node.kind === "B_NOT") {
        if (node.children.length !== 1) {
            fail("HARDENED_UNARY_SHAPE", "unary expression requires exactly one operand", node);
        }
        let operand = parseExpression(node.children[0]!, context, true);
        const operandType = assignmentType(operand, context, node.children[0]!);
        const operator = node.kind === "PLUS" ? "+" : node.kind === "MINUS" ? "-" : node.kind === "NOT" ? "!" : "~";
        if (operator === "!") operand = adaptCondition(operand, context, node.children[0]!,
            "HARDENED_UNARY_BOOLEAN", "logical negation requires a proven value and application-profile AS3 coercion");
        if (operator === "~" && (!["Number", "int", "uint"].includes(operandType.sourceName)
            || operandType.emittedName !== "number")) {
            fail("HARDENED_UNARY_BITWISE", "bitwise complement requires a proven numeric input", node);
        }
        if (operator !== "!" && operator !== "~" && operandType.sourceName !== "Number") {
            fail("HARDENED_UNARY_NUMBER", "numeric unary operators require exact Number input", node);
        }
        return Object.assign(identity(node), {
            kind: "unary" as "unary", operator: operator as "+" | "-" | "!" | "~", operand,
            resultType: operator === "!" ? semanticType(node, "Boolean", "boolean", [], false)
                : operator === "~" ? semanticType(node, "int", "number") : operandType,
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
        const condition = adaptCondition(parseExpression(node.children[0]!, context, true), context,
            node.children[0]!, "HARDENED_CONDITIONAL_BOOLEAN",
            "conditional expression requires an exact Boolean expression or application-profile AS3 coercion");
        const whenTrue = parseExpression(node.children[1]!, context, true);
        const whenFalse = parseExpression(node.children[2]!, context, true);
        const trueType = assignmentType(whenTrue, context, node.children[1]!);
        const falseType = assignmentType(whenFalse, context, node.children[2]!);
        const admitsNull = (type: SemanticType): boolean => type.nullable
            || (context.sourceMemberAuthority !== null && (type.sourceName === "String" && type.emittedName === "string"
                || type.runtimeName !== null && !["Boolean", "Number", "int", "uint", "void"].includes(type.sourceName)));
        const trueNull = trueType.sourceName === "null" && admitsNull(falseType);
        const falseNull = falseType.sourceName === "null" && admitsNull(trueType);
        const dynamicBranch = context.sourceMemberAuthority !== null
            && [trueType,falseType].some(type=>type.sourceName === "*")
            && [trueType,falseType].every(type=>!["void","XML","XMLList","Namespace","QName"].includes(type.sourceName));
        const numericBranches = [trueType, falseType].every(type => ["Number", "int", "uint"].includes(type.sourceName));
        const referenceBranch = context.sourceMemberAuthority !== null && !numericBranches && !trueNull && !falseNull
            && !sameUnderlyingType(trueType,falseType)
            ? provenReferenceSubtype(trueType,falseType,context) ? falseType
                : provenReferenceSubtype(falseType,trueType,context) ? trueType : null
            : null;
        if (!sameUnderlyingType(trueType, falseType) && !numericBranches && !trueNull && !falseNull && referenceBranch === null && !dynamicBranch) {
            fail("HARDENED_CONDITIONAL_TYPE", "conditional branches require the exact same proven source type", node);
        }
        const resultType = dynamicBranch ? semanticType(node,"*","unknown")
            : numericBranches ? semanticType(node, "Number", "number")
            : referenceBranch ? withNullability(referenceBranch,trueType.nullable || falseType.nullable)
            : trueNull ? falseType : withNullability(trueType, trueType.nullable || falseType.nullable);
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
        let resultType = assignmentTargetType(parsedTarget, context, node.children[0]!);
        const dynamicLocalUpdate = context.sourceMemberAuthority !== null && resultType.sourceName === "*"
            && parsedTarget.kind === "identifier" && ["local","parameter"].includes(parsedTarget.bindingKind);
        if (dynamicLocalUpdate) resultType = semanticType(node,"Number","number");
        if (context.sourceMemberAuthority !== null && parsedTarget.kind === "index" && parsedTarget.accessKind === "object")
            resultType = semanticType(node,"Number","number");
        if (!["Number", "int", "uint"].includes(resultType.sourceName) || resultType.emittedName !== "number") {
            fail("HARDENED_UPDATE_NUMBER", "increment and decrement require an exact writable Number", node);
        }
        return Object.assign(identity(node), {
            kind: "update" as "update",
            operator: (node.kind === "PRE_INC" || node.kind === "POST_INC" ? "++" : "--") as "++" | "--",
            prefix: node.kind === "PRE_INC" || node.kind === "PRE_DEC",
            target: parsedTarget,
            ...(dynamicLocalUpdate ? {numericLocal:true as const} : {}),
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
        const priorLexicalThisUses = context.lexicalThisUses;
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
            statements = initializeNumberLocals(statements, context, priorLocals);
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
            ...(context.lexicalThisUses > priorLexicalThisUses ? { lexicalReceiver: {
                name: "__as3LexicalReceiver" + (context.lambdaDepth + 1),
                outerName: context.lambdaDepth ? "__as3LexicalReceiver" + context.lambdaDepth : null,
                className: context.className,
            }} : {}),
        });
    }
    if (node.kind === "DELETE") {
        if (node.children.length !== 1) {
            fail("HARDENED_DELETE_SHAPE", "delete requires exactly one indexed target", node);
        }
        context.ownRecordTargetDepth += 1;
        let target: SemanticExpression;
        try {
            target = parseExpression(node.children[0]!, context, false);
        } finally {
            context.ownRecordTargetDepth -= 1;
        }
        if (target.kind !== "index" || target.accessKind !== "dictionary" && target.accessKind !== "object") {
            fail("HARDENED_DELETE_TARGET", "delete requires an authenticated Dictionary or Object index", node.children[0]!);
        }
        return Object.assign(identity(node), {
            kind: "delete" as "delete", target, resultType: semanticType(node, "Boolean", "boolean"),
        });
    }
    if (node.kind === "IDENTIFIER") {
        const name = requiredText(node, "identifier");
        if (name === "true" || name === "false" || name === "null") {
            return parseLiteral(Object.assign({}, node, { kind: "LITERAL", text: name }));
        }
        if (name === "this") {
            if (context.packageFunction) fail("HARDENED_PACKAGE_FUNCTION_THIS", "package function global receiver requires native host authority", node);
            if (context.lambdaDepth > 0) {
                fail("HARDENED_LAMBDA_THIS", "anonymous functions using dynamic AS3 this remain held", node);
            }
            return Object.assign(identity(node), { kind: "this" as "this" });
        }
        if (name === "super") {
            fail("HARDENED_SUPER_CONTEXT", "super is admitted only as the first zero-argument statement of a derived constructor", node);
        }
        if (context.importsByLocal[name]?.compileTimeNamespace) {
            fail("HARDENED_NAMESPACE_VALUE", "compile-time namespace cannot be used as a runtime value", node);
        }
        const imported = context.importsByLocal[name];
        if ((imported?.sourceQualifiedName === "flash.utils.getQualifiedClassName"
            || imported?.sourceQualifiedName === "flash.utils.getDefinitionByName")
            && (context.fields[name] || context.accessors[name] || context.methods[name]))
            fail("HARDENED_REFLECTION_SHADOW", "native reflection import has an unresolved class-member shadow", node);
        if (imported?.authorityKind === "native-timer-function"
            && (context.locals[name] || context.parameters[name] || context.fields[name]
                || context.accessors[name] || context.methods[name])) {
            fail("HARDENED_NATIVE_TIMER_SHADOW",
                "native timer import is shadowed by a lexical or class binding", node);
        }
        if (imported?.authorityKind === "native-timer-function") {
            assertNoInheritedNativeFunctionShadow(context, name, node);
        }
        if (context.locals[name]) {
            return Object.assign(identity(node), { kind: "identifier" as "identifier", name,
                bindingKind: "local" as "local", bindingSourceQualifiedName: null });
        }
        if (context.parameters[name]) {
            return Object.assign(identity(node), { kind: "identifier" as "identifier", name,
                bindingKind: "parameter" as "parameter", bindingSourceQualifiedName: null });
        }
        if (name === context.className) return context.packageFunction
            ? Object.assign(identity(node), {kind:"identifier" as const,name,bindingKind:"package-function" as const,bindingSourceQualifiedName:context.classQualifiedName})
            : currentClassIdentifier(node, context);
        if (imported) {
            if (imported.sourceQualifiedName === "flash.utils.getDefinitionByName")
                assertNoInheritedNativeFunctionShadow(context, name, node, "HARDENED_REFLECTION", "native reflection");
            if (valuePosition && imported.runtimeInterface && context.sourceMemberAuthority !== null)
                return Object.assign(identity(node), {kind:"identifier" as const,name,bindingKind:"interface-class" as const,
                    bindingSourceQualifiedName:imported.sourceQualifiedName});
            if (["flash.utils.getQualifiedClassName", "flash.utils.getDefinitionByName"].includes(imported.sourceQualifiedName) && valuePosition)
                fail("HARDENED_REFLECTION_FUNCTION_VALUE", "native reflection function values require retained closure behavior", node);
            return Object.assign(identity(node), { kind: "identifier" as "identifier", name,
                bindingKind: "import" as "import", bindingSourceQualifiedName: imported.sourceQualifiedName });
        }
        if (context.fields[name]) {
            if (context.fields[name]!.modifiers.indexOf("static") >= 0) {
                return currentClassMember(node, context, name);
            }
            if (isTreeNodeContext(context) && name === "FData" && context.ownRecordTargetDepth === 0) {
                fail("HARDENED_OWN_RECORD_ESCAPE", "TTreeNode.FData is confined to authenticated own-record indexing", node);
            }
            if (context.lambdaDepth > 0) {
                if (context.sourceMemberAuthority === null || !context.currentCallable
                    || context.currentCallable.modifiers.includes("static"))
                    fail("HARDENED_LAMBDA_THIS", "implicit field capture requires an authenticated instance scope", node);
                context.lexicalThisUses++;
                return Object.assign(identity(node), { kind: "member" as const,
                    target: Object.assign(identity(node), { kind: "this" as const,
                        lexicalName: "__as3LexicalReceiver" + context.lambdaDepth }),
                    targetNullable: false, name, capabilitySource: null });
            }
            return implicitThisMember(node, name);
        }
        if (context.accessors[name]) {
            const accessor = context.accessors[name]!;
            if (valuePosition && !accessor.getter
                && !context.inheritedAccessors?.some(item => item.name === name && item.kind === "getter")) {
                fail("HARDENED_ACCESSOR_WRITE_ONLY", "write-only accessor cannot be read", node);
            }
            const staticGetter = (accessor.getter?.modifiers.indexOf("static") ?? -1) >= 0;
            const staticSetter = (accessor.setter?.modifiers.indexOf("static") ?? -1) >= 0;
            if (staticGetter || staticSetter) {
                if (staticGetter !== staticSetter && accessor.getter && accessor.setter) {
                    fail("HARDENED_ACCESSOR_STATIC", "accessor pair has inconsistent static ownership", node);
                }
                return currentClassMember(node, context, name);
            }
            if (context.lambdaDepth > 0) fail("HARDENED_LAMBDA_THIS", "implicit this in anonymous functions remains held", node);
            return implicitThisMember(node, name);
        }
        if (context.methods[name]) {
            const method = context.methods[name]!;
            if (method.modifiers.indexOf("static") >= 0) {
                if (valuePosition) return staticMethodValue(node, context, currentClassIdentifier(node, context), name);
                return currentClassMember(node, context, name);
            }
            if (context.lambdaDepth > 0) {
                if (valuePosition || method.constructor || context.sourceMemberAuthority === null
                    || !context.currentCallable || context.currentCallable.modifiers.includes("static"))
                    fail("HARDENED_LAMBDA_THIS", "implicit method calls require an authenticated instance scope; captured method values remain held", node);
                context.lexicalThisUses++;
                return Object.assign(identity(node), { kind: "member" as const,
                    target: Object.assign(identity(node), { kind: "this" as const,
                        lexicalName: "__as3LexicalReceiver" + context.lambdaDepth }),
                    targetNullable: false, name, capabilitySource: null });
            }
            if (valuePosition) {
                if (!allowMethodClosure) {
                    fail("HARDENED_METHOD_CLOSURE_INITIALIZER", "method closures in field initializers are not admitted before per-instance binding", node);
                }
                if (method.constructor) {
                    fail("HARDENED_METHOD_CLOSURE_SCOPE", "only non-static instance methods have admitted AS3 closure identity", node);
                }
                return Object.assign(identity(node), { kind: "methodClosure" as "methodClosure", methodName: name });
            }
            if (method.constructor) {
                fail("HARDENED_METHOD_INSTANCE_SCOPE", "constructor or static method cannot be resolved through implicit this", node);
            }
            return implicitThisMember(node, name);
        }
        if (context.baseLocalQName !== null) {
            if (context.lambdaDepth > 0) {
                fail("HARDENED_LAMBDA_THIS", "implicit inherited this in anonymous functions remains held", node);
            }
            const inherited = localInheritedNamedMembers(context, name, node);
            if (inherited.members.length > 0 && inherited.ownerQName !== null) {
                inherited.members.forEach(member => assertInheritedVisibility(member, inherited.ownerQName!, context, node));
                const methods = inherited.members.filter(member => member.kind === "method");
                const readable = inherited.members.some(member => member.kind === "field" || member.kind === "getter");
                const writable = inherited.members.some(member => member.kind === "setter"
                    || (member.kind === "field" && !member.readonly));
                if (methods.length > 1 || (methods.length > 0 && (readable || writable))) {
                    fail("HARDENED_LOCAL_MEMBER_AMBIGUOUS", "inherited local member kind is ambiguous", node);
                }
                if (methods.length === 1) {
                    if (valuePosition) return inheritedMethodValue(node,context,name,allowMethodClosure);
                    return implicitThisMember(node, name, inherited.ownerQName);
                }
                if ((valuePosition && !readable) || (!valuePosition && !readable && !writable)) {
                    fail("HARDENED_ACCESSOR_WRITE_ONLY", "inherited accessor cannot be used in this value position", node);
                }
                return implicitThisMember(node, name, inherited.ownerQName);
            }
        }
        if (context.baseSourceQName !== null || context.baseLocalQName !== null) {
            const mapping = flashBaseMemberMapping(context, "read", name, node)
                || (!valuePosition ? flashBaseMemberMapping(context, "write", name, node)
                    || flashBaseMemberMapping(context, "call", name, node) : null);
            if (mapping !== null) {
                if (context.lambdaDepth > 0 || context.currentCallable?.modifiers.includes("static"))
                    fail("HARDENED_LAMBDA_THIS", "implicit inherited member requires an instance scope", node);
                return implicitThisMember(node, name, mapping.sourceQName);
            }
        }
        const implicit = context.resolveImportedType(name,null,node);
        if (implicit) return Object.assign(identity(node), {kind:"identifier" as const,name,
            bindingKind:"import" as const,bindingSourceQualifiedName:implicit.sourceQualifiedName});
        if (name === "trace" && context.mappingsBySource.trace?.sourceRoles.includes("global-function")) {
            assertNoInheritedNativeFunctionShadow(context,name,node);
            const mapping=context.mappingsBySource.trace!;
            return Object.assign(identity(node), {kind:"globalFunction" as const,name:"trace" as const,
                targetModule:targetModuleSpecifier(mapping.targetModule),targetExport:mapping.targetExport});
        }
        if (context.sourceMemberAuthority !== null && ["undefined","NaN","Infinity"].includes(name)
            && !context.resolveImportedType(name,null,node)) {
            assertNoInheritedNativeFunctionShadow(context,name,node);
            if (name === "undefined") return Object.assign(identity(node),{kind:"undefined" as const});
            return Object.assign(identity(node),{kind:"binary" as const,operator:"/" as const,
                left:Object.assign(identity(node),{kind:"literal" as const,value:name === "NaN" ? 0 : 1}),
                right:Object.assign(identity(node),{kind:"literal" as const,value:0}),resultType:semanticType(node,"Number","number")});
        }
        if (context.sourceMemberAuthority !== null && ["Object","Array","String","Number","Boolean","Function"].includes(name)
            && !context.resolveImportedType(name, null, node)) {
            assertNoInheritedNativeFunctionShadow(context, name, node);
            return Object.assign(identity(node), {kind: "identifier" as const, name,
                bindingKind: "builtin-class" as const, bindingSourceQualifiedName: name});
        }
        fail("HARDENED_IDENTIFIER_SCOPE", `identifier ${name} is not a parameter or proven import/member`, node);
    }
    if (node.kind === "ASSIGN") {
        const consumed = valuePosition && context.sourceMemberAuthority !== null && context.currentCallable !== null;
        if ((!consumed && (!allowAssignment || valuePosition)) || node.children.length !== 3 || node.children[1]!.kind !== "OP") {
            fail("HARDENED_ASSIGNMENT_CONTEXT", "assignment values require an authenticated callable context", node);
        }
        const operator = requiredText(node.children[1]!, "assignment operator");
        context.ownRecordTargetDepth += 1;
        let target: SemanticExpression;
        try {
            target = parseExpression(node.children[0]!, context, false);
        } finally {
            context.ownRecordTargetDepth -= 1;
        }
        if (target.kind !== "identifier" && target.kind !== "member" && target.kind !== "index") {
            fail("HARDENED_ASSIGNMENT_TARGET", "assignment target is not a writable lvalue", node.children[0]!);
        }
        if (context.sourceMemberAuthority !== null && operator === "=" && target.kind === "member"
            && target.capabilitySource === "Array" && target.name === "length"
            && isArrayType(assignmentType(target.target,context,node.children[0]!),context)) {
            const value=parseExpression(node.children[2]!,context,true);
            // Validate the uint storage conversion without moving it before the native null check.
            adaptAssignmentValue(semanticType(node,"uint","number"),value,context,node.children[2]!);
            return Object.assign(identity(node),{kind:"assignment" as const,operator:"=" as const,
                arrayLengthStorage:true as const,target,value,
                ...(consumed ? {resultType:assignmentType(value,context,node.children[2]!)} : {})});
        }
        const targetType = assignmentTargetType(target, context, node.children[0]!);
        let value = parseExpression(node.children[2]!, context, true);
        const valueType = assignmentType(value, context, node.children[2]!);
        let input = value;
        let shortCircuit: "&&" | "||" | undefined;
        let deferCompoundStore: true | undefined;
        if (operator === "=") {
            value = adaptAssignmentValue(targetType, value, context, node.children[2]!);
        } else {
            const binaryOperator = operator.slice(0, -1);
            if (!["+", "-", "*", "/", "%", "&", "|", "^", "<<", ">>", ">>>", "&&", "||"].includes(binaryOperator)) {
                fail("HARDENED_ASSIGNMENT_OPERATOR", "compound assignment operator is unsupported", node.children[1]!);
            }
            const ownStaticField = target.kind === "member" && target.target.kind === "identifier"
                && target.target.bindingKind === "current-class"
                && target.target.bindingSourceQualifiedName === context.classQualifiedName
                && context.fields[target.name]?.modifiers.includes("static");
            if (target.kind === "index" && (!["array","object"].includes(target.accessKind) || context.sourceMemberAuthority === null) || (target.kind === "member" && target.target.kind !== "this" && !ownStaticField
                && context.sourceMemberAuthority === null)) {
                fail("HARDENED_COMPOUND_TARGET", "compound assignment requires a once-evaluated local, parameter, or direct this field", node.children[0]!);
            }
            if (target.kind === "index" && ["array","object"].includes(target.accessKind)
                || target.kind === "member" && target.target.kind !== "this" && !ownStaticField) deferCompoundStore = true;
            const numeric = (type: SemanticType): boolean => ["Number", "int", "uint"].includes(type.sourceName)
                && type.emittedName === "number";
            const nativeAdd = binaryOperator === "+" && context.sourceMemberAuthority !== null
                && [targetType,valueType].every(type => !["void","XML","XMLList"].includes(type.sourceName))
                && [targetType,valueType].some(type => ["*","Object","Array","Function"].includes(type.sourceName));
            const stringAdd = binaryOperator === "+" && targetType.sourceName === "String"
                && valueType.sourceName === "String";
            const logical = (binaryOperator === "&&" || binaryOperator === "||")
                && targetType.sourceName === "Boolean" && valueType.sourceName === "Boolean";
            if (logical && deferCompoundStore)
                fail("HARDENED_COMPOUND_TARGET","logical compound receivers require native conditional-store evidence",node);
            if (logical) shortCircuit = binaryOperator as "&&" | "||";
            if (!nativeAdd && !stringAdd && !logical && (!numeric(targetType) || !numeric(valueType))) {
                fail("HARDENED_COMPOUND_TYPE", "compound assignment requires exact String addition or proven numeric operands", node);
            }
            const bitwise = ["&", "|", "^", "<<", ">>", ">>>"].includes(binaryOperator);
            const resultType = nativeAdd ? semanticType(node,"*","unknown") : stringAdd ? semanticType(node, "String", "string")
                : logical ? semanticType(node, "Boolean", "boolean")
                : bitwise ? semanticType(node, binaryOperator === ">>>" ? "uint" : "int", "number")
                    : semanticType(node, "Number", "number");
            const binary: SemanticExpression = Object.assign(identity(node), {
                kind: "binary" as "binary",
                operator: binaryOperator as "+" | "-" | "*" | "/" | "%" | "&" | "|" | "^" | "<<" | ">>" | ">>>" | "&&" | "||",
                left: target, right: value, resultType, ...(nativeAdd ? {additionCoercion:true as const} : {}),
            });
            input = binary;
            value = nativeAdd ? adaptAssignmentValue(targetType,binary,context,node)
                : (targetType.sourceName === "int" || targetType.sourceName === "uint")
                ? Object.assign(identity(node), { kind: "coercion" as "coercion", targetType, argument: binary })
                : binary;
        }
        let storageCoercion: { kind: "assignmentStorageCoercion"; targetType: SemanticType; slot?: true; reference?: ReferenceCoercion } | undefined;
        if (consumed && value !== input) {
            if (value.kind !== "coercion" || value.argument !== input)
                fail("HARDENED_ASSIGNMENT_VALUE", "assignment result requires a proven storage conversion", node);
            storageCoercion = {kind:"assignmentStorageCoercion", targetType: value.targetType,
                ...(value.slot ? {slot:true as const} : {}), ...(value.reference ? {reference:value.reference} : {})};
        }
        // A Function local's callback proof belongs to its exact initializer.
        // Once mutable source code assigns the local, conservatively revoke that
        // proof: otherwise a later method closure can inherit a stale lambda
        // signature and bypass Vector's method-closure thisObject rule.
        if (target.kind === "identifier" && context.locals[target.name]) {
            context.locals[target.name]!.lambdaSignature = null;
        }
        return Object.assign(identity(node), {
            kind: "assignment" as "assignment", operator: "=" as "=", target, value: consumed ? input : value,
            ...(shortCircuit ? {shortCircuit} : {}),
            ...(deferCompoundStore ? {deferCompoundStore} : {}),
            ...(consumed ? {resultType: assignmentType(input, context, node), ...(storageCoercion ? {storageCoercion} : {})} : {}),
        });
    }
    if (node.kind === "ARRAY_ACCESSOR") {
        if (node.children.length !== 2) {
            fail("HARDENED_INDEX_SHAPE", "indexed access requires one target and one index", node);
        }
        context.ownRecordTargetDepth += 1;
        let target: SemanticExpression;
        try {
            target = parseExpression(node.children[0]!, context, true);
        } finally {
            context.ownRecordTargetDepth -= 1;
        }
        const ownerType = assignmentType(target, context, node.children[0]!);
        if (dynamicObjectType(ownerType,context)) {
            const index = parseExpression(node.children[1]!,context,true);
            assertObjectKey(assignmentType(index,context,node.children[1]!),node.children[1]!);
            return Object.assign(identity(node),{kind:"index" as const,accessKind:"object" as const,target,
                targetNullable:ownerType.nullable,index,callerQName:context.classQualifiedName,resultType:semanticType(node,"*","unknown")});
        }
        const innerRoot = innerRootTarget(target, context);
        const innerCost = ownerType.sourceName === BIG_TURN_TABLE_INNER_COST_TUPLE;
        const element = vectorElement(ownerType);
        const dictionary = isDictionaryType(ownerType);
        const byteArray = intrinsicSourceForType(ownerType, context) === "flash.utils.ByteArray";
        const array = isArrayType(ownerType,context);
        const ownRecord = ownRecordValue(ownerType);
        if (!innerRoot && !innerCost && !element && !dictionary && !byteArray && !array && !ownRecord) {
            fail("HARDENED_INDEX_TARGET", "indexed access requires a proven Array, Vector, ByteArray, intrinsic Dictionary, or authenticated local record", node);
        }
        if (ownRecord && !isTreeNodeRecordMember(target, context)) {
            fail("HARDENED_OWN_RECORD_TARGET", "local record access is confined to TTreeNode.FData", node.children[0]!);
        }
        let index = parseExpression(node.children[1]!, context, true);
        const indexType = assignmentType(index, context, node.children[1]!);
        if (innerRoot || innerCost) {
            if (index.kind !== "literal" || index.value !== 0) {
                fail("HARDENED_BIG_TURN_TABLE_DTO_INDEX",
                    "authenticated Big Turntable DTO projection admits only literal slot 0", node.children[1]!);
            }
            return Object.assign(identity(node), {
                kind: "index" as "index",
                accessKind: innerRoot ? "bigTurnTableInnerRoot" as "bigTurnTableInnerRoot"
                    : "bigTurnTableInnerCost" as "bigTurnTableInnerCost",
                target, targetNullable: ownerType.nullable, index,
                resultType: innerRoot ? bigTurnTableInnerType(node, BIG_TURN_TABLE_INNER_ENTRY)
                    : bigTurnTableInnerType(node, BIG_TURN_TABLE_INNER_COST_ENTRY),
            });
        }
        if ((element || byteArray) && !["Number", "int", "uint"].includes(indexType.sourceName)) {
            fail("HARDENED_INDEX_TYPE", "Vector or ByteArray index must be a proven numeric value", node.children[1]!);
        }
        if (element || byteArray) {
            index = adaptAssignmentValue(semanticType(node, "uint", "number"), index, context, node.children[1]!);
        }
        if (dictionary && indexType.sourceName === "void") {
            fail("HARDENED_DICTIONARY_KEY", "Dictionary key must be a proven value", node.children[1]!);
        }
        if (array && !["Number", "int", "uint"].includes(indexType.sourceName)) {
            fail("HARDENED_ARRAY_INDEX_TYPE",
                "Array index requires a proven numeric source value", node.children[1]!);
        }
        if (ownRecord && (indexType.sourceName !== "String" || indexType.emittedName !== "string")) {
            fail("HARDENED_OWN_RECORD_KEY", "TTreeNode.FData requires one exact String key", node.children[1]!);
        }
        return Object.assign(identity(node), {
            kind: "index" as "index", accessKind: dictionary ? "dictionary" as "dictionary"
                : byteArray ? "byteArray" as "byteArray" : array ? "array" as "array"
                    : ownRecord ? "ownRecord" as "ownRecord" : "vector" as "vector",
            target, targetNullable: ownerType.nullable, index,
            resultType: element || (ownRecord ? withNullability(ownRecord, true) : null)
                || (byteArray ? semanticType(node, "uint", "number") : semanticType(node, "*", "unknown")),
        });
    }
    if (node.kind === "DOT") {
        if (node.children.length !== 2 || node.children[1]!.kind !== "LITERAL") {
            fail("HARDENED_MEMBER_SHAPE", "member expression has the wrong normalized shape", node);
        }
        const name = validateIdentifier(requiredText(node.children[1]!, "member name"), node.children[1]!);
        if (node.children[0]!.kind === "IDENTIFIER" && node.children[0]!.text === "Array" && (name === "NUMERIC" || name === "DESCENDING")
            && context.className !== "Array" && context.locals.Array === undefined && context.parameters.Array === undefined
            && context.fields.Array === undefined && context.methods.Array === undefined && context.accessors.Array === undefined
            && context.importsByLocal.Array === undefined) {
            if (context.resolveCurrentLocal === null) {
                fail("HARDENED_INTRINSIC_IDENTITY_AUTHORITY",
                    "Array.NUMERIC requires an authenticated current-local authority proving no lexical type shadow",
                    node.children[0]!);
            }
            if (context.localTypeAuthority === null) {
                fail("HARDENED_INTRINSIC_IDENTITY_AUTHORITY",
                    "Array.NUMERIC requires the authenticated local type map proving no package type shadow",
                    node.children[0]!);
            }
            assertNoInheritedLocalValueShadow(context, "Array", node.children[0]!);
            const current = context.resolveCurrentLocal();
            const packageSeparator = context.classQualifiedName.lastIndexOf(".");
            const arrayQName = packageSeparator < 0 ? "Array"
                : `${context.classQualifiedName.slice(0, packageSeparator)}.Array`;
            if (contextLocalType(context, current.entry.module, arrayQName)) {
                fail("HARDENED_INTRINSIC_IDENTITY_SHADOW",
                    "Array.NUMERIC is shadowed by an authenticated same-package declaration", node.children[0]!);
            }
            if (context.resolveImportedType("Array", null, node.children[0]!) === null) {
                return Object.assign(identity(node), {
                    kind: "intrinsicConstant" as "intrinsicConstant", identity: (name === "NUMERIC" ? "Array.NUMERIC" : "Array.DESCENDING") as "Array.NUMERIC" | "Array.DESCENDING", value: (name === "NUMERIC" ? 16 : 2) as 16 | 2,
                });
            }
        }
        let target: SemanticExpression;
        let superOwnerQName: string | null = null;
        let superField = false;
        if (node.children[0]!.kind === "IDENTIFIER" && node.children[0]!.text === "super") {
            const callable = context.currentCallable;
            if (callable === null || callable.modifiers.indexOf("static") >= 0 || context.lambdaDepth > 0
                || (context.baseLocalQName === null && context.baseSourceQName === null)) {
                fail("HARDENED_SUPER_CONTEXT",
                    "super member access requires a non-static callable with one authenticated local base", node.children[0]!);
            }
            const inherited = context.baseLocalQName === null ? null
                : localInheritedMember(context, name, "method", null, node);
            if (inherited?.member && inherited.ownerQName) {
                assertInheritedVisibility(inherited.member, inherited.ownerQName, context, node);
                if (valuePosition) fail("HARDENED_LOCAL_METHOD_CLOSURE", "super method closures remain held", node);
                superOwnerQName = inherited.ownerQName;
            } else {
                const accessor = context.baseLocalQName === null ? null
                    : localInheritedMember(context, name, valuePosition ? "getter" : "setter", null, node);
                if (accessor?.member && accessor.ownerQName) {
                    assertInheritedVisibility(accessor.member, accessor.ownerQName, context, node);
                    superOwnerQName = accessor.ownerQName;
                }
                if (superOwnerQName === null && context.sourceMemberAuthority !== null && context.baseLocalQName !== null) {
                    const field = localInheritedMember(context, name, "field", null, node);
                    if (field.member && field.ownerQName) {
                        assertInheritedVisibility(field.member, field.ownerQName, context, node);
                        superOwnerQName = field.ownerQName;
                        superField = true;
                    }
                }
                const mapping = superOwnerQName !== null ? null : flashBaseMemberMapping(context, "read", name, node)
                    || (!valuePosition ? flashBaseMemberMapping(context, "write", name, node)
                        || flashBaseMemberMapping(context, "call", name, node) : null);
                if (superOwnerQName === null && (mapping === null || mapping.targetMember?.scope !== "instance"))
                    fail("HARDENED_SUPER_MEMBER", `super member ${name} lacks an exact inherited Flash mapping`, node);
                if (mapping !== null) superOwnerQName = mapping.sourceQName;
            }
            target = Object.assign(identity(node.children[0]!), { kind: "super" as "super" });
        } else {
            // The receiver is evaluated as a value even when the outer member
            // is a call or assignment target (for example error.message.substr).
            target = parseExpression(node.children[0]!, context, true);
        }
        if (target.kind !== "super" && target.kind !== "this"
            && (target.kind !== "identifier" || !!context.locals[target.name] || !!context.parameters[target.name]
                || context.importsByLocal[target.name]?.localValueType != null)
            && dynamicObjectType(assignmentType(target,context,node.children[0]!),context)) {
            const index = Object.assign(identity(node.children[1]!),{kind:"literal" as const,value:name});
            return Object.assign(identity(node),{kind:"index" as const,accessKind:"object" as const,target,
                targetNullable:true,index,callerQName:context.classQualifiedName,resultType:semanticType(node,"*","unknown")});
        }
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
        if (target.kind !== "super" && ["length","push","pop","shift","unshift","concat","join","sortOn","sort","splice","hasOwnProperty"].includes(name)) {
            const arrayType = assignmentType(target,context,node);
            if (isArrayType(arrayType,context) && arrayType.sourceName !== "Array") {
                const qname = arrayType.runtimeName!;
                const lookup = localInstanceNamedMembers(context,qname,name,node);
                if (lookup.members.length === 0) {
                    if (valuePosition && name !== "length") fail("HARDENED_ARRAY_METHOD_CLOSURE","Array method closures need native evidence",node);
                    return Object.assign(identity(node),{kind:"member" as const,target,targetNullable:arrayType.nullable,name,capabilitySource:"Array"});
                }
            }
        }
        let targetName: string | undefined;
        let capabilitySource: string | null = superOwnerQName;
        let targetNullable = false;
        if (target.kind === "super") {
            // The exact local inherited method was resolved above before the
            // otherwise-context-free SuperExpression entered semantic IR.
        } else if (target.kind === "this") {
            if (context.methods[name] && (context.methods[name].constructor
                || context.methods[name].modifiers.indexOf("static") >= 0)) {
                fail("HARDENED_METHOD_INSTANCE_SCOPE", "constructor or static method cannot be resolved through this", node);
            }
            if (!context.methods[name] && !context.fields[name] && !context.accessors[name]) {
                if (context.baseLocalQName !== null) {
                    const inherited = localInheritedNamedMembers(context, name, node);
                    if (inherited.members.length > 0 && inherited.ownerQName !== null) {
                        inherited.members.forEach(member =>
                            assertInheritedVisibility(member, inherited.ownerQName!, context, node));
                        if (valuePosition && inherited.members.some(member => member.kind === "method"))
                            return inheritedMethodValue(node,context,name,allowMethodClosure);
                        capabilitySource = inherited.ownerQName;
                    }
                }
                if (capabilitySource === null) {
                    const mapping = flashBaseMemberMapping(context, "read", name, node)
                        || (!valuePosition ? flashBaseMemberMapping(context, "write", name, node)
                            || flashBaseMemberMapping(context, "call", name, node) : null);
                    if (mapping === null) {
                        fail("HARDENED_MEMBER_UNMAPPED", `instance member ${context.classQualifiedName}.${name} is neither local nor double-pinned in the minimal subset`, node);
                    }
                    capabilitySource = mapping.sourceQName;
                }
            }
        } else if (target.kind === "identifier" && context.importsByLocal[target.name]
            && (context.importsByLocal[target.name]!.authorityKind === "flash"
                || context.importsByLocal[target.name]!.authorityKind === "intrinsic"
                || (context.importsByLocal[target.name]!.authorityKind === "local"
                    && context.importsByLocal[target.name]!.localValueType === null))) {
            const imported = context.importsByLocal[target.name]!;
            if (imported.authorityKind === "local" && imported.localValueType === null) {
                const members = localStaticNamedMembers(context, imported.sourceQualifiedName, name, node);
                const methods = members.filter(member => member.kind === "method");
                const readable = members.filter(member => member.kind === "field" || member.kind === "getter");
                const writable = members.filter(member => member.kind === "setter"
                    || (member.kind === "field" && !member.readonly));
                if (members.length === 0 || methods.length > 1 || readable.length > 1 || writable.length > 1
                    || (methods.length > 0 && (readable.length > 0 || writable.length > 0))) {
                    fail("HARDENED_LOCAL_STATIC_MEMBER",
                        "local static member identity is absent or ambiguous", node);
                }
                if (valuePosition && methods.length > 0)
                    return staticMethodValue(node, context, target, name);
                capabilitySource = imported.sourceQualifiedName;
            } else if (imported.authorityKind === "intrinsic") {
                const member = intrinsicMember(context, imported.sourceQualifiedName, "read", name);
                if (member === null) {
                    fail("HARDENED_STATIC_MEMBER", "static members require an explicit authenticated member", node);
                }
                capabilitySource = imported.sourceQualifiedName;
            } else {
                const mapping = memberMapping(context, imported.sourceQualifiedName, "read", name, node)
                    || (!valuePosition ? memberMapping(context, imported.sourceQualifiedName, "call", name, node) : null);
                if (mapping === null || mapping.targetMember === null || mapping.targetMember.scope !== "static") {
                    fail("HARDENED_STATIC_MEMBER", "Flash static access requires an exact authenticated member", node);
                }
                capabilitySource = imported.sourceQualifiedName;
            }
        } else if (target.kind === "identifier" && target.bindingKind === "current-class"
            && target.bindingSourceQualifiedName === context.classQualifiedName) {
            const field = context.fields[name];
            const getter = context.accessors[name]?.getter;
            const setter = context.accessors[name]?.setter;
            const method = context.methods[name];
            const declared = [field, getter, setter, method].filter(item => item !== undefined);
            if (declared.length === 0 || declared.some(item => item!.modifiers.indexOf("static") < 0)) {
                fail("HARDENED_CURRENT_STATIC_MEMBER",
                    "current-class member lacks an exact static declaration", node);
            }
            if (valuePosition && method) return staticMethodValue(node, context, target, name);
            capabilitySource = context.classQualifiedName;
        } else {
            const targetType = assignmentType(target, context, node.children[0]!);
            targetNullable = targetType.nullable;
            const innerMember = innerMemberType(context, targetType, name, node);
            if (innerMember !== null) {
                return Object.assign(identity(node), {
                    kind: "member" as "member", target, targetNullable, name,
                    capabilitySource: context.classQualifiedName,
                });
            }
            const intrinsicSource = intrinsicSourceForType(targetType, context);
            const flashSource = mappedFlashQNameForType(targetType, context);
            if (flashSource !== null) {
                const accesses = valuePosition ? ["read"] : ["call", "write", "read"];
                const mappings = accesses.map(access => memberMapping(context, flashSource, access, name, node))
                    .filter((mapping): mapping is CapabilityMapping => mapping !== null);
                if (mappings.length === 0) {
                    fail("HARDENED_MEMBER_TARGET", `Flash receiver ${flashSource}.${name} lacks an exact bridge mapping`, node);
                }
                const names = new Set(mappings.map(mapping => mapping.targetMember!.name));
                if (names.size !== 1) fail("HARDENED_MEMBER_TARGET", "Flash accessor mappings disagree on their bridge target", node);
                targetName = mappings[0]!.targetMember!.name;
                capabilitySource = flashSource;
            } else if (intrinsicSource !== null) {
                if (intrinsicMember(context, intrinsicSource, "read", name) === null
                    && intrinsicMember(context, intrinsicSource, "write", name) === null
                    && intrinsicMember(context, intrinsicSource, "call", name) === null) {
                    fail("HARDENED_INTRINSIC_MEMBER", "intrinsic member is not source-census authenticated or remains held", node);
                }
                capabilitySource = intrinsicSource;
            } else {
                const receiverQName = localQNameForType(targetType, context);
                if (receiverQName !== null) {
                    const lookup = localInstanceNamedMembers(context, receiverQName, name, node);
                    if (lookup.members.length === 0 || lookup.ownerQName === null) {
                        if (lookup.terminalFlashQNames.length === 0) {
                            fail("HARDENED_LOCAL_INSTANCE_MEMBER",
                                "local receiver member lacks an authenticated declaration", node);
                        }
                        const accesses = valuePosition ? ["read"] : ["call","write","read"];
                        const mappings = accesses.map(access => terminalFlashMemberMapping(context,
                            lookup.terminalFlashQNames,access,name,node)).filter((mapping): mapping is CapabilityMapping => mapping !== null);
                        if (mappings.length === 0) {
                            fail("HARDENED_MEMBER_UNMAPPED",
                                `terminal Flash receiver ${lookup.terminalFlashQNames.join("|")}.${name} on ${receiverQName} lacks an exact bridge mapping`, node);
                        }
                        if (new Set(mappings.map(mapping => mapping.targetMember!.name)).size !== 1
                            || new Set(mappings.map(mapping => mapping.sourceQName)).size !== 1)
                            fail("HARDENED_MEMBER_TARGET","Inherited Flash accessor mappings disagree on their bridge target",node);
                        targetName = mappings[0]!.targetMember!.name;
                        capabilitySource = mappings[0]!.sourceQName;
                    } else {
                        lookup.members.forEach(member =>
                            assertLocalReceiverVisibility(member, lookup.ownerQName!, receiverQName, context, node));
                        if (valuePosition && lookup.members.some(member => member.kind === "method")) {
                            fail("HARDENED_LOCAL_METHOD_CLOSURE",
                                "local receiver method closures remain held until stable identity is proven", node);
                        }
                        capabilitySource = lookup.ownerQName;
                    }
                } else {
                    const errorRead = valuePosition && targetType.sourceName === "Error" && targetType.emittedName === "Error"
                        && (targetType.runtimeName === null || targetType.runtimeName === "Error") && ["message","name","errorID"].includes(name);
                    const errorMethod = !valuePosition && targetType.sourceName === "Error" && targetType.emittedName === "Error"
                        && (targetType.runtimeName === null || targetType.runtimeName === "Error") && name === "toString";
                    const numberMethod = !valuePosition && ["Number","int","uint"].includes(targetType.sourceName) && name === "toFixed";
                    const functionLength = context.sourceMemberAuthority !== null && valuePosition
                        && targetType.sourceName === "Function" && name === "length";
                    const stringLength = valuePosition && targetType.sourceName === "String" && name === "length";
                    const arrayLength = isArrayType(targetType,context) && name === "length";
                    const arrayMethod = context.sourceMemberAuthority !== null && isArrayType(targetType,context)
                        && !valuePosition && (["push","pop","shift","unshift","concat","join","sortOn","sort","splice","hasOwnProperty"].includes(name)
                            || name === "indexOf" && targetType.sourceName === "Array");
                    const stringMethod = targetType.sourceName === "String" && !valuePosition && (["indexOf", "substr", "toLowerCase", "charAt"].includes(name)
                        || context.sourceMemberAuthority !== null && name === "split");
                    if (!numberMethod && !errorRead && !errorMethod && !stringLength && !functionLength && !arrayLength && !arrayMethod && !stringMethod && (vectorElement(targetType) === null
                        || (name !== "length" && name !== "fixed" && !VECTOR_METHODS.has(name)))) {
                        fail("HARDENED_MEMBER_TARGET", `member ${targetType.sourceName}.${name} on ${target.kind} is outside the admitted subset`, node);
                    }
                    capabilitySource = targetType.sourceName;
                }
            }
        }
        if (target.kind === "this" && isTreeNodeContext(context) && name === "FData"
            && context.ownRecordTargetDepth === 0) {
            fail("HARDENED_OWN_RECORD_ESCAPE", "TTreeNode.FData is confined to authenticated own-record indexing", node);
        }
        return Object.assign(identity(node), {
            kind: "member" as "member", target, targetNullable, name, ...(targetName ? {targetName} : {}),
            ...(superField ? {superField:true as const} : {}), capabilitySource,
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
            const sourceType = source.kind === "array" ? null
                : assignmentType(source, context, node.children[1]!.children[0]!);
            const exactInnerFlags = sourceType !== null && isBigTurnTableInnerContext(context)
                && sourceType.sourceName === BIG_TURN_TABLE_INNER_FLAGS
                && vectorType.typeArguments[0]?.sourceName === "int";
            if (!exactInnerFlags && source.kind !== "array" && vectorElement(sourceType!) === null) {
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
        if (rawCallee.kind === "DOT" && rawCallee.children.length === 2 && rawCallee.children[1]!.text === "call") {
            const target=parseExpression(rawCallee.children[0]!,context,true);
            if (assignmentType(target,context,rawCallee).sourceName === "Function") {
                const args=node.children[1]!.children;
                const receiver=args.length ? parseExpression(args[0]!,context,true)
                    : Object.assign(identity(node),{kind:"literal" as const,value:null});
                const argumentsArray=Object.assign(identity(node),{kind:"array" as const,
                    elements:args.slice(1).map(arg=>parseExpression(arg,context,true))});
                return Object.assign(identity(node), {kind:"functionApply" as const,invocation:"call" as const,target,receiver,argumentsArray,
                    resultType:target.kind === "globalFunction" ? semanticType(node,"void","void") : semanticType(node,"*","unknown")});
            }
        }
        if (rawCallee.kind === "DOT" && rawCallee.children.length === 2 && rawCallee.children[1]!.text === "apply") {
            const target=parseExpression(rawCallee.children[0]!,context,true);
            if (assignmentType(target,context,rawCallee).sourceName === "Function") {
                const args=node.children[1]!.children;
                if (args.length !== 2) fail("HARDENED_FUNCTION_APPLY_ARITY", "Function.apply requires retained receiver and argument-array inputs", node);
                const receiver=parseExpression(args[0]!,context,true), argumentsArray=parseExpression(args[1]!,context,true);
                const arrayType=assignmentType(argumentsArray,context,args[1]!);
                if (!["Array","null","undefined"].includes(arrayType.sourceName))
                    fail("HARDENED_FUNCTION_APPLY_ARGUMENTS", "Function.apply requires an Array or null argument list", node);
                return Object.assign(identity(node), {kind:"functionApply" as const,target,receiver,argumentsArray,
                    resultType:target.kind === "globalFunction" ? semanticType(node,"void","void") : semanticType(node,"*","unknown")});
            }
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
        let immediateLambda=callee;
        while (immediateLambda.kind === "parenthesized") immediateLambda=immediateLambda.expression;
        if (context.sourceMemberAuthority !== null && immediateLambda.kind === "lambda") {
            if (!admittedArity(immediateLambda.parameters,args.length))
                fail("HARDENED_LAMBDA_CALL_ARITY", "immediate lambda call does not match its source declaration", node);
            if (args.some(argument=>assignmentType(argument,context,node).sourceName === "void"))
                fail("HARDENED_FUNCTION_ARGUMENT", "immediate lambda arguments must produce values", node);
            // The function body owns parameter coercion, after every argument expression.
            return Object.assign(identity(node),{kind:"call" as const,callee,calleeNullable:false,arguments:args,immediateLambdaCall:true as const,
                capabilitySource:null,capabilityMember:null,resultType:immediateLambda.returnType});
        }

        if (context.sourceMemberAuthority !== null && callee.kind === "member" && callee.target.kind === "this"
            && context.lambdaDepth === 0 && context.currentCallable !== null
            && !context.currentCallable.modifiers.includes("static")
            && context.fields[callee.name]?.type.sourceName === "Function"
            && !context.fields[callee.name]!.modifiers.includes("static")
            && context.fields[callee.name]!.namespaceName === null) {
            for (const argument of args) if (assignmentType(argument,context,node).sourceName === "void")
                fail("HARDENED_FUNCTION_ARGUMENT", "Function field arguments must produce values", node);
            // AS3 callproperty reads an explicit field after its arguments. An
            // implicit field call instead reads the value first and uses null this.
            return Object.assign(identity(node), {kind:"functionApply" as const,
                invocation:rawCallee.kind === "IDENTIFIER" ? "direct" as const : "field" as const,
                target:callee,receiver:callee.target,
                argumentsArray:Object.assign(identity(node),{kind:"array" as const,elements:args}),
                resultType:semanticType(node,"*","unknown")});
        }
        if (context.sourceMemberAuthority !== null && callee.kind === "identifier"
            && (callee.bindingKind === "parameter" || callee.bindingKind === "local")
            && !context.locals[callee.name]?.lambdaSignature
            && assignmentType(callee,context,rawCallee).sourceName === "Function") {
            for (const argument of args) if (assignmentType(argument,context,node).sourceName === "void")
                fail("HARDENED_FUNCTION_ARGUMENT", "direct Function arguments must produce values", node);
            return Object.assign(identity(node), {kind:"functionApply" as const,invocation:"direct" as const,target:callee,
                receiver:Object.assign(identity(node),{kind:"literal" as const,value:null}),
                argumentsArray:Object.assign(identity(node),{kind:"array" as const,elements:args}),
                resultType:semanticType(node,"*","unknown")});
        }
        if (context.sourceMemberAuthority !== null && callee.kind === "identifier"
            && callee.bindingKind === "builtin-class" && callee.name === "Object") {
            if (args.length !== 1) fail("HARDENED_OBJECT_CONVERSION_ARITY", "Object conversion requires exactly one value", node);
            return Object.assign(identity(node), {kind:"coercion" as const, objectCall:true as const,
                targetType:semanticType(node,"Object","unknown"), argument:args[0]!});
        }
        if (context.sourceMemberAuthority !== null && rawCallee.kind === "IDENTIFIER" && callee.kind === "identifier"
            && (callee.bindingKind === "import" || callee.bindingKind === "current-class")) {
            const imported = context.importsByLocal[callee.name];
            if (callee.bindingKind === "current-class" || imported?.runtimeInterface || imported?.runtimeConstructible) {
                const targetType = parseType({...rawCallee, kind:"TYPE"}, context, false);
                const reference = referenceCoercionForType(targetType, context);
                if (reference && reference.runtimeName === callee.bindingSourceQualifiedName) {
                    if (args.length !== 1) fail("HARDENED_REFERENCE_CAST_ARITY", "reference cast requires exactly one value", node);
                    return Object.assign(identity(node), {kind:"coercion" as const, reference,
                        targetType:withNullability(targetType,true), argument:args[0]!});
                }
            }
        }
        if (callee.kind === "index" && callee.accessKind === "object") {
            const builtin = callee.index.kind === "literal" && ["hasOwnProperty","toString"].includes(String(callee.index.value));
            if (builtin) {
                const expected = (callee.index as Extract<SemanticExpression,{kind:"literal"}>).value === "hasOwnProperty" ? 1 : 0;
                if (args.length !== expected) fail("HARDENED_OBJECT_CALL_ARITY", "Object builtin call has an unproved arity", node);
                if (args.length) assertObjectKey(assignmentType(args[0]!,context,node),node);
            } else if (callee.index.kind === "literal" && callee.index.value === "split" && context.sourceMemberAuthority !== null) {
                if (args.length > 2 || args.some(argument=>assignmentType(argument,context,node).sourceName === "void"))
                    fail("HARDENED_OBJECT_CALL_ARGUMENT", "Dynamic split requires zero, one or two value arguments", node);
            } else if (callee.index.kind === "literal" && callee.index.value === "push" && nativeArrayBase(context)) {
                // The runtime selects the actual receiver's method. A wildcard
                // receiver is not statically rewritten into an Array cast.
                if (args.some(argument=>assignmentType(argument,context,node).sourceName === "void"))
                    fail("HARDENED_OBJECT_CALL_ARGUMENT", "Dynamic push arguments must produce values", node);
            } else if (callee.index.kind !== "literal" || typeof callee.index.value !== "string") {
                fail("HARDENED_OBJECT_CALL_TARGET", "computed dynamic calls require retained native evaluation evidence", node);
            }
            if (args.some(argument=>assignmentType(argument,context,node).sourceName === "void"))
                fail("HARDENED_OBJECT_CALL_ARGUMENT", "Dynamic call arguments must produce values", node);
            return Object.assign(identity(node),{kind:"objectOperation" as const,operation:"call" as const,
                target:callee.target,index:callee.index,arguments:args,callerQName:context.classQualifiedName,
                resultType:semanticType(node,"*","unknown")});
        }
        let capabilitySource: string | null = null;
        let capabilityMember: string | null = null;
        let resultType: SemanticType | null = null;
        let calleeNullable = false;
        let packageFunctionCall: true | undefined;
        if (callee.kind === "super") {
            if (context.baseLocalQName !== null) {
                const constructorMember = localConstructor(context, context.baseLocalQName, node);
                if (constructorMember !== null) {
                    const visibility = memberVisibility(constructorMember.modifiers);
                    const currentPackage = context.classQualifiedName.slice(0,
                        Math.max(0, context.classQualifiedName.lastIndexOf(".")));
                    const targetPackage = context.baseLocalQName.slice(0,
                        Math.max(0, context.baseLocalQName.lastIndexOf(".")));
                    if (visibility === "private" || (visibility === "internal" && currentPackage !== targetPackage)) {
                        fail("HARDENED_LOCAL_CONSTRUCTOR_VISIBILITY",
                            "local base constructor is not visible to the derived class", node);
                    }
                }
                assertLocalCallArguments(constructorMember, args, node.children[1]!.children, context, node);
            } else if (context.baseSourceQName === "Array" && nativeArrayBase(context)) {
                if (args.some(argument=>assignmentType(argument,context,node).sourceName === "void"))
                    fail("HARDENED_ARRAY_ARGUMENT","Array constructor arguments must produce values",node);
            } else if (context.sourceMemberAuthority !== null && context.baseSourceQName === "flash.display.Bitmap") {
                const mapping=memberMapping(context,context.baseSourceQName,"call","Bitmap",node);
                if (!mapping || mapping.sourceRoles.length !== 1 || mapping.sourceRoles[0] !== "constructor")
                    fail("HARDENED_SUPER_CONSTRUCTOR_AUTHORITY", "Bitmap super requires its authenticated native constructor",node);
                adaptMappedCall(mapping,args,node.children[1]!.children,context,node);
            } else if (args.length !== 0) {
                fail("HARDENED_SUPER_ARITY", "Flash base constructor arguments remain outside the typed bridge subset", node);
            }
        } else if (callee.kind === "member" && callee.target.kind === "super") {
            if (callee.capabilitySource === null) {
                fail("HARDENED_SUPER_MEMBER", "super method call lacks authenticated owner identity", node);
            }
            const inherited = context.baseLocalQName === null ? null
                : localInheritedMember(context, callee.name, "method", null, node);
            if (inherited?.member && inherited.ownerQName === callee.capabilitySource) {
                assertInheritedVisibility(inherited.member, inherited.ownerQName!, context, node);
                assertLocalMethodCall(inherited.member, args, node.children[1]!.children, context, node);
                resultType = authoritySemanticType(inherited.member.returnType!, context, node);
            } else {
                const mapping = flashBaseMemberMapping(context, "call", callee.name, node);
                if (!mapping || inherited?.member || mapping.sourceQName !== callee.capabilitySource
                    || mapping.targetMember?.scope !== "instance" || mapping.targetMember.name !== callee.name)
                    fail("HARDENED_SUPER_MEMBER", "super method call differs from its authenticated base declaration", node);
                resultType = adaptMappedCall(mapping, args, node.children[1]!.children, context, node);
                capabilitySource = mapping.sourceQName;
                capabilityMember = mapping.sourceMember!.name;
            }
        } else if (callee.kind === "member" && ["Number","int","uint"].includes(callee.capabilitySource || "")
            && callee.name === "toFixed") {
            if (args.length > 1) fail("HARDENED_NUMBER_ARITY", "Number.toFixed requires zero or one precision argument", node);
            capabilitySource="Number"; capabilityMember="toFixed"; resultType=semanticType(node,"String","string");
        } else if (callee.kind === "member" && callee.capabilitySource === "Error" && callee.name === "toString") {
            if (args.length !== 0) fail("HARDENED_ERROR_CALL_ARITY", "Error.toString requires its retained zero-argument call", node);
            capabilitySource="Error";capabilityMember="toString";resultType=semanticType(node,"String","string");
        } else if (callee.kind === "member" && callee.capabilitySource === "String"
            && assignmentType(callee.target, context, rawCallee).sourceName === "String") {
            if (callee.name === "split") {
                if (args.length > 2) fail("HARDENED_STRING_ARITY", "String.split requires zero, one or two arguments", node);
                capabilitySource="String";capabilityMember="split";
            } else if (callee.name === "toLowerCase") {
                if (args.length !== 0) fail("HARDENED_STRING_ARITY", "String.toLowerCase requires its native zero-argument call", node);
                capabilitySource="String"; capabilityMember="toLowerCase";
            } else if (callee.name === "charAt") {
                if (args.length > 1) fail("HARDENED_STRING_ARITY", "String.charAt requires zero or one index argument", node);
                capabilitySource="String"; capabilityMember="charAt";
            } else if (!["indexOf", "substr"].includes(callee.name) || args.length < 1 || args.length > 2)
                fail("HARDENED_STRING_ARITY", "String method requires its native one or two arguments", node);
            args.forEach((argument, index) => {
                const type = assignmentType(argument, context, node.children[1]!.children[index]!);
                if (callee.name === "split") {
                    if (type.sourceName === "void") fail("HARDENED_STRING_ARGUMENT", "String.split requires value arguments", node);
                    return;
                }
                if (callee.name === "indexOf" && index === 0 ? type.sourceName !== "String"
                    : !["Number", "int", "uint"].includes(type.sourceName))
                    fail("HARDENED_STRING_ARGUMENT", "String argument lacks a proven native primitive type", node.children[1]!.children[index]!);
            });
            resultType = callee.name === "split" ? semanticType(node,"Array","Array",[],false)
                : callee.name === "indexOf" ? semanticType(node, "int", "number")
                : semanticType(node, "String", "string", [], false);
        } else if (callee.kind === "identifier" && (callee.bindingKind === "package-function"
            || context.importsByLocal[callee.name]?.localFunction)) {
            const qname=callee.bindingSourceQualifiedName!;
            const current=context.resolveCurrentLocal!();
            const declaration=contextLocalMember(context, current.entry.module, qname)?.declaration;
            const member=declaration?.members[0];
            if (!member || member.kind !== "method" || declaration!.members.length !== 1)
                fail("HARDENED_PACKAGE_FUNCTION_CALL", "package function lacks its authenticated signature", node);
            // Validate the signature without moving native slot coercion ahead of later argument expressions.
            assertLocalMethodCall(member,args.slice(),node.children[1]!.children,context,node);
            packageFunctionCall = true;
            resultType=authoritySemanticType(member.returnType!,context,node);
        } else if (callee.kind === "identifier" && context.locals[callee.name]?.lambdaSignature) {
            const signature = context.locals[callee.name]!.lambdaSignature!;
            calleeNullable = context.locals[callee.name]!.type.nullable;
            if (!admittedArity(signature.parameters, args.length)) {
                fail("HARDENED_LAMBDA_CALL_ARITY", "lambda call does not match its exact local declaration", node);
            }
            const restIndex = signature.parameters.findIndex(parameter => parameter.rest);
            args.slice(0, restIndex < 0 ? signature.parameters.length : restIndex)
                .forEach((argument, index) => {
                    args[index] = adaptAssignmentValue(signature.parameters[index]!.type, argument, context,
                        node.children[1]!.children[index]!);
            });
            resultType = signature.returnType;
        } else if (callee.kind === "identifier" && callee.bindingKind === "import"
            && callee.bindingSourceQualifiedName === "flash.utils.getDefinitionByName") {
            const mapping = context.mappingsBySource[callee.bindingSourceQualifiedName];
            if (!context.sourceMemberAuthority || !mapping || mapping.targetKind !== "function"
                || mapping.targetExport !== "getDefinitionByName"
                || mapping.targetModule !== "src/layaAir/flash/utils/DefinitionRegistry.ts"
                || mapping.targetSignature !== "(name: string) => NativeDefinition")
                fail("HARDENED_REFLECTION_AUTHORITY", "native definition lookup lacks its shared target and source authority", node);
            if (args.length !== 1)
                fail("HARDENED_REFLECTION_ARITY", "getDefinitionByName requires exactly one original name", node);
            if (!["String","*","null","undefined"].includes(assignmentType(args[0]!,context,node).sourceName))
                fail("HARDENED_REFLECTION_ARGUMENT", "definition name requires a String or native wildcard conversion", node);
            args[0] = adaptAssignmentValue(semanticType(node,"String","string"),args[0]!,context,node.children[1]!.children[0]!);
            capabilitySource = mapping.sourceQName; capabilityMember = "<call>";
            resultType = semanticType(node,"Object","unknown");
        } else if (callee.kind === "identifier" && callee.bindingKind === "import"
            && callee.bindingSourceQualifiedName === "flash.utils.getQualifiedClassName") {
            const mapping = context.mappingsBySource[callee.bindingSourceQualifiedName];
            if (!context.sourceMemberAuthority || !mapping || mapping.targetKind !== "function"
                || mapping.targetExport !== "getQualifiedClassName"
                || mapping.targetModule !== "src/layaAir/flash/utils/getQualifiedClassName.ts"
                || mapping.targetSignature !== "(value: unknown) => string")
                fail("HARDENED_REFLECTION_AUTHORITY", "native class-name query lacks its shared target and source authority", node);
            if (args.length !== 1)
                fail("HARDENED_REFLECTION_ARITY", "getQualifiedClassName requires exactly one original value", node);
            capabilitySource = mapping.sourceQName; capabilityMember = "<call>";
            resultType = semanticType(node, "String", "string");
        } else if (callee.kind === "identifier" && callee.bindingKind === "import"
            && context.importsByLocal[callee.name]?.authorityKind === "native-timer-function"
            && callee.bindingSourceQualifiedName === context.importsByLocal[callee.name]!.sourceQualifiedName) {
            const imported = context.importsByLocal[callee.name]!;
            const mapping = context.nativeTimerFunctionsBySource[imported.sourceQualifiedName];
            if (!mapping || args.length < mapping.minArgs
                || (mapping.maxArgs !== null && args.length > mapping.maxArgs)) {
                fail("HARDENED_NATIVE_TIMER_ARITY",
                    "native timer call does not match its exact source signature", node);
            }
            mapping.parameterTypes.forEach((parameterType, index) => {
                if (parameterType === "*") return;
                args[index] = adaptAssignmentValue(authoritySemanticType(parameterType, context, node),
                    args[index]!, context, node.children[1]!.children[index]!);
            });
            capabilitySource = mapping.sourceQName;
            capabilityMember = "<call>";
            resultType = authoritySemanticType(mapping.returnType, context, node);
        } else if (callee.kind === "member" && context.sourceMemberAuthority !== null
            && callee.capabilitySource === "Array" && isArrayType(assignmentType(callee.target,context,rawCallee),context)) {
            const name = callee.name;
            if (!["push","pop","shift","unshift","concat","join","sortOn","sort","splice","hasOwnProperty","indexOf"].includes(name)
                || (["pop","shift"].includes(name) && args.length !== 0) || (name === "join" && args.length > 1)
                || (name === "indexOf" && (args.length < 1 || args.length > 2)))
                fail("HARDENED_ARRAY_CALL", "Array mutation call has an unsupported method or arity", node);
            for (const argument of args) if (assignmentType(argument,context,node).sourceName === "void")
                fail("HARDENED_ARRAY_ARGUMENT", "Array mutation arguments must produce values", node);
            if (name === "hasOwnProperty" && (args.length !== 1
                || assignmentType(args[0]!,context,node).sourceName !== "String" || assignmentType(args[0]!,context,node).nullable))
                fail("HARDENED_ARRAY_OWNERSHIP", "Array ownership requires one non-null String key", node);
            if (name === "indexOf" && assignmentType(callee.target,context,rawCallee).sourceName !== "Array")
                fail("HARDENED_ARRAY_INDEX_OF", "Array subclass indexOf requires native dispatch evidence", node);
            if (name === "splice" && assignmentType(callee.target,context,rawCallee).sourceName !== "Array")
                fail("HARDENED_ARRAY_SPLICE", "Array subclass splice requires native dispatch evidence", node);
            if (name === "sortOn" || name === "sort") {
                if (assignmentType(callee.target,context,rawCallee).runtimeName !== null
                    && assignmentType(callee.target,context,rawCallee).runtimeName !== "Array")
                    fail("HARDENED_ARRAY_SORT_ON", "Array subclass sorting requires retained native dispatch evidence", node);
                const flags = (expression:SemanticExpression):number | null => {
                    if (expression.kind === "intrinsicConstant") return expression.value;
                    if (expression.kind === "literal" && typeof expression.value === "number") return expression.value;
                    if (expression.kind === "binary" && expression.operator === "|") {
                        const left=flags(expression.left),right=flags(expression.right);
                        return left===null || right===null ? null : left | right;
                    }
                    return null;
                };
                if (name === "sortOn" && (args.length !== 2 || assignmentType(args[0]!,context,node).sourceName !== "String"
                    || ![16,18].includes(flags(args[1]!)!)))
                    fail("HARDENED_ARRAY_SORT_ON", "Array.sortOn requires one String field and proven NUMERIC with optional DESCENDING", node);
                if (name === "sort" && (args.length !== 1 || ![16,18].includes(flags(args[0]!)!)))
                    fail("HARDENED_ARRAY_SORT", "Array.sort requires proven NUMERIC with optional DESCENDING", node);
            }
            capabilitySource = "Array";
            capabilityMember = name;
            resultType = name === "indexOf" ? semanticType(node,"int","number") : name === "hasOwnProperty" ? semanticType(node,"Boolean","boolean") : name === "join" ? semanticType(node,"String","string",[],false) : name === "concat" || name === "sortOn" || name === "sort" || name === "splice" ? semanticType(node,"Array","Array",[],name === "splice")
                : name === "push" || name === "unshift"
                ? semanticType(node,"uint","number") : semanticType(node,"*","unknown");
        } else if (callee.kind === "member" && callee.target.kind === "this" && context.methods[callee.name]) {
            const parameters = context.methods[callee.name]!.parameters;
            if (!admittedArity(parameters, args.length)) {
                fail("HARDENED_LOCAL_CALL_ARITY", "local method call does not match its declared arity", node);
            }
            args.slice(0, parameters.findIndex(parameter => parameter.rest) < 0
                ? parameters.length : parameters.findIndex(parameter => parameter.rest))
                .forEach((argument, index) => {
                    args[index] = adaptAssignmentValue(parameters[index]!.type, argument, context,
                        node.children[1]!.children[index]!);
                });
            resultType = context.methods[callee.name]!.returnType;
        } else if (callee.kind === "member" && callee.target.kind === "this" && callee.capabilitySource !== null) {
            const inherited = context.baseLocalQName === null ? { members: [], ownerQName: null }
                : localInheritedNamedMembers(context, callee.name, node);
            if (inherited.ownerQName === callee.capabilitySource) {
                const methods = inherited.members.filter(member => member.kind === "method");
                if (methods.length !== 1) {
                    fail("HARDENED_LOCAL_MEMBER_AMBIGUOUS", "inherited local call lacks one exact method", node);
                }
                const method = methods[0]!;
                assertInheritedVisibility(method, inherited.ownerQName!, context, node);
                assertLocalMethodCall(method, args, node.children[1]!.children, context, node);
                resultType = authoritySemanticType(method.returnType!, context, node);
            } else {
                const mapping = memberMapping(context, callee.capabilitySource, "call", callee.name, node);
                if (mapping === null) fail("HARDENED_CAPABILITY_CALL_ARITY",
                    "Flash bridge call does not match the double-pinned source signature", node);
                resultType = adaptMappedCall(mapping!, args, node.children[1]!.children, context, node);
                capabilitySource = mapping.sourceQName;
                capabilityMember = mapping.sourceMember!.name;
            }
        } else if (callee.kind === "member" && callee.target.kind === "identifier"
            && callee.target.bindingKind === "current-class"
            && callee.target.bindingSourceQualifiedName === context.classQualifiedName) {
            if (callee.capabilitySource !== context.classQualifiedName) {
                fail("HARDENED_CURRENT_STATIC_CALL", "static call authority does not match the current class", node);
            }
            const method = context.methods[callee.name];
            if (!method || method.modifiers.indexOf("static") < 0) {
                fail("HARDENED_CURRENT_STATIC_CALL", "current-class static call lacks one exact method declaration", node);
            }
            if (!admittedArity(method.parameters, args.length)) {
                fail("HARDENED_LOCAL_CALL_ARITY", "current-class static call does not match its declared arity", node);
            }
            const restIndex = method.parameters.findIndex(parameter => parameter.rest);
            args.slice(0, restIndex < 0 ? method.parameters.length : restIndex)
                .forEach((argument, index) => {
                    args[index] = adaptAssignmentValue(method.parameters[index]!.type, argument, context,
                        node.children[1]!.children[index]!);
                });
            resultType = method.returnType;
        } else if (callee.kind === "member" && callee.target.kind === "identifier"
            && context.importsByLocal[callee.target.name]?.authorityKind === "local"
            && context.importsByLocal[callee.target.name]?.localValueType === null) {
            const imported = context.importsByLocal[callee.target.name]!;
            if (callee.capabilitySource !== imported.sourceQualifiedName) {
                fail("HARDENED_LOCAL_STATIC_CALL", "static call authority does not match its local class", node);
            }
            const methods = localStaticNamedMembers(context, imported.sourceQualifiedName, callee.name, node)
                .filter(member => member.kind === "method");
            if (methods.length !== 1) {
                fail("HARDENED_LOCAL_STATIC_CALL", "local static call lacks one exact method declaration", node);
            }
            assertLocalMethodCall(methods[0]!, args, node.children[1]!.children, context, node, imported.sourceQualifiedName);
            resultType = authoritySemanticType(methods[0]!.returnType!, context, node, {ownerQName:imported.sourceQualifiedName,member:methods[0]!});
        } else if (callee.kind === "member" && callee.target.kind === "identifier"
            && callee.target.bindingKind === "import"
            && context.importsByLocal[callee.target.name]?.authorityKind === "flash") {
            const imported = context.importsByLocal[callee.target.name]!;
            const mapping = memberMapping(context, imported.sourceQualifiedName, "call", callee.name, node);
            if (callee.capabilitySource !== imported.sourceQualifiedName || mapping === null
                || mapping.targetMember?.scope !== "static") {
                fail("HARDENED_STATIC_CALL", "Flash static call lacks its exact authenticated static method", node);
            }
            resultType = adaptMappedCall(mapping!, args, node.children[1]!.children, context, node);
            capabilitySource = mapping!.sourceQName;
            capabilityMember = mapping!.sourceMember!.name;
        } else if (callee.kind === "member" && callee.capabilitySource !== null
            && localQNameForExpression(callee.target, context, rawCallee) !== null) {
            const receiverQName = localQNameForExpression(callee.target, context, rawCallee)!;
            const lookup = localInstanceNamedMembers(context, receiverQName, callee.name, node);
            const methods = lookup.members.filter(member => member.kind === "method");
            if (lookup.ownerQName === callee.capabilitySource && methods.length === 1) {
                assertLocalReceiverVisibility(methods[0]!, lookup.ownerQName!, receiverQName, context, node);
                assertLocalMethodCall(methods[0]!, args, node.children[1]!.children, context, node, lookup.ownerQName!);
                resultType = authoritySemanticType(methods[0]!.returnType!, context, node, {ownerQName:lookup.ownerQName!,member:methods[0]!});
            } else if (methods.length === 0) {
                const mapping = terminalFlashMemberMapping(context, lookup.terminalFlashQNames,
                    "call", callee.name, node);
                if (mapping === null || mapping.sourceQName !== callee.capabilitySource) {
                    fail("HARDENED_CAPABILITY_CALL_ARITY",
                        "terminal Flash receiver call does not match its exact bridge signature", node);
                }
                resultType = adaptMappedCall(mapping!, args, node.children[1]!.children, context, node);
                capabilitySource = mapping.sourceQName;
                capabilityMember = mapping.sourceMember!.name;
            } else {
                fail("HARDENED_LOCAL_INSTANCE_CALL",
                    "local receiver call requires one exact authenticated method", node);
            }
        } else if (callee.kind === "member" && callee.capabilitySource !== null
            && mappedFlashQNameForType(assignmentType(callee.target, context, rawCallee), context)
                === callee.capabilitySource) {
            const mapping = memberMapping(context, callee.capabilitySource, "call", callee.name, node);
            if (mapping === null) {
                fail("HARDENED_CAPABILITY_CALL_ARITY", "Flash receiver call lacks an exact bridge mapping", node);
            }
            resultType = adaptMappedCall(mapping!, args, node.children[1]!.children, context, node);
            capabilitySource = mapping.sourceQName;
            capabilityMember = mapping.sourceMember!.name;
        } else if (callee.kind === "member" && callee.capabilitySource !== null
            && intrinsicMember(context, callee.capabilitySource, "call", callee.name) !== null) {
            const member = intrinsicMember(context, callee.capabilitySource, "call", callee.name)!;
            if (args.length < member.minArgs || args.length > member.maxArgs) {
                fail("HARDENED_INTRINSIC_CALL_ARITY", "intrinsic call does not match its authenticated source arity", node);
            }
            args.forEach((argument, index) => {
                const expected = authoritySemanticType(member.parameterTypes[index]!, context, node);
                args[index] = adaptAssignmentValue(expected, argument, context,
                    node.children[1]!.children[index]!);
            });
            resultType = authoritySemanticType(member.returnType, context, node);
            capabilitySource = member.sourceQName;
            capabilityMember = member.name;
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
                args.forEach((argument, index) => {
                    args[index] = adaptAssignmentValue(element, argument, context,
                        node.children[1]!.children[index]!);
                });
            } else if (name === "slice" || name === "indexOf" || name === "lastIndexOf") {
                if (name !== "slice") {
                    args[0] = adaptAssignmentValue(element, args[0]!, context, node.children[1]!.children[0]!);
                }
                const start = name === "slice" ? 0 : 1;
                for (let index = start; index < args.length; index += 1) {
                    args[index] = adaptAssignmentValue(semanticType(node, "int", "number"), args[index]!, context,
                        node.children[1]!.children[index]!);
                }
            } else if (name === "splice") {
                args[0] = adaptAssignmentValue(semanticType(node, "int", "number"), args[0]!, context,
                    node.children[1]!.children[0]!);
                if (args[1]) {
                    args[1] = adaptAssignmentValue(semanticType(node, "uint", "number"), args[1], context,
                        node.children[1]!.children[1]!);
                }
                for (let index = 2; index < args.length; index += 1) {
                    args[index] = adaptAssignmentValue(element, args[index]!, context,
                        node.children[1]!.children[index]!);
                }
            } else if (name === "join" && args.length === 1) {
                args[0] = adaptAssignmentValue(semanticType(node, "String", "string", [], false), args[0]!, context,
                    node.children[1]!.children[0]!);
            } else if (name === "concat") {
                args.forEach((argument, index) => {
                    const argumentType = assignmentType(argument, context, node.children[1]!.children[index]!);
                    const argumentElement = vectorElement(argumentType);
                    if (argumentElement === null || (!sameUnderlyingType(argumentType, ownerType)
                        && element.sourceName !== "Object"
                        && !provenReferenceSubtype(argumentElement, element, context))) {
                        fail("HARDENED_VECTOR_CONCAT_TYPE",
                            "Vector.concat arguments must preserve the element specialization or prove a reference subtype",
                            node.children[1]!.children[index]!);
                    }
                });
            } else if (["every", "filter", "forEach", "map", "some"].includes(name)
                || (name === "sort" && args.length === 1)) {
                const numericSort = name === "sort" && args[0]!.kind === "intrinsicConstant"
                    && args[0]!.identity === "Array.NUMERIC" && args[0]!.value === 16
                    && ["int", "uint", "Number"].includes(element.sourceName) && element.emittedName === "number";
                if (!numericSort) {
                    assertVectorCallback(name, args[0]!, element, ownerType, context, node.children[1]!.children[0]!);
                }
                if (name !== "sort" && args[0]!.kind === "methodClosure" && args[1]
                    && !(args[1]!.kind === "literal" && args[1]!.value === null)) {
                    fail("HARDENED_VECTOR_METHOD_CLOSURE_THIS",
                        `Vector.${name} method closure requires a null thisObject`, node.children[1]!.children[1]!);
                }
            }
            resultType = name === "pop" || name === "shift" ? element
                : ["concat", "filter", "map", "reverse", "slice", "sort", "splice"].includes(name) ? ownerType
                    : ["every", "some"].includes(name) ? semanticType(node, "Boolean", "boolean")
                        : name === "join" || name === "toString" ? semanticType(node, "String", "string", [], false)
                            : name === "forEach" ? semanticType(node, "void", "void")
                                : name === "push" || name === "unshift" ? semanticType(node, "uint", "number")
                                    : semanticType(node, "int", "number");
        } else {
            const binding = callee.kind === "identifier"
                ? `${callee.bindingKind} ${callee.bindingSourceQualifiedName || callee.name}`
                : callee.kind === "member" ? `member ${callee.capabilitySource || callee.target.kind}.${callee.name}`
                    : callee.kind;
            const position = rawCallee.span === null ? "" : ` at source offsets ${rawCallee.span.start}:${rawCallee.span.end}`;
            fail("HARDENED_CALL_TARGET", `call target ${binding}${position} lacks an admitted callable implementation`, rawCallee);
        }
        const result: CallExpression = Object.assign(identity(node), {
            kind: "call" as "call", callee, calleeNullable, arguments: args,
            ...(packageFunctionCall ? {packageFunctionCall} : {}),
            capabilitySource, capabilityMember, resultType,
        });
        return result;
    }
    fail("HARDENED_EXPRESSION_UNSUPPORTED", "normalized expression kind is unsupported: " + node.kind, node);
}

function parseStatementNode(node: TreeNode, context: AdapterContext, constructor: boolean,
    derived: boolean, expectedReturn: SemanticType | null, allowSuperCall: boolean): SemanticStatement {
        if (node.kind === "STMT_EMPTY") {
            if (node.children.length !== 0) fail("HARDENED_EMPTY_STATEMENT", "Empty statement cannot contain executable children", node);
            return Object.assign(identity(node), {kind: "empty" as "empty"});
        }
        if (node.kind === "CALL" || node.kind === "ASSIGN" || node.kind === "DELETE" || node.kind === "AND" || node.kind === "OR" || node.kind === "PRE_INC"
            || node.kind === "PRE_DEC" || node.kind === "POST_INC" || node.kind === "POST_DEC") {
            return Object.assign(identity(node), {
                kind: "expression" as "expression",
                expression: parseExpression(node, context, false,
                    allowSuperCall, true, node.kind === "ASSIGN"),
            });
        }
        if (node.kind === "DOT" && context.sourceMemberAuthority !== null) {
            // A discarded property value still performs its read and any getter effects.
            const expression = parseExpression(node, context, true);
            assignmentType(expression, context, node);
            return Object.assign(identity(node), {kind:"expression" as const, expression});
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
            const expression = adaptAssignmentValue(expectedReturn,
                parseExpression(node.children[0]!, context, true), context, node.children[0]!);
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
            const condition = adaptCondition(parseExpression(conditionOwner.children[0]!, context, true), context,
                conditionOwner.children[0]!, "HARDENED_IF_BOOLEAN",
                "if condition requires an exact Boolean expression or application-profile AS3 coercion");
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
            const condition = adaptCondition(parseExpression(conditionOwner.children[0]!, context, true), context,
                conditionOwner.children[0]!, "HARDENED_WHILE_BOOLEAN",
                "while condition requires an exact Boolean expression or application-profile AS3 coercion");
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
            const condition = adaptCondition(parseExpression(conditionOwner.children[0]!, context, true), context,
                conditionOwner.children[0]!, "HARDENED_DO_BOOLEAN",
                "do-while condition requires an exact Boolean expression or application-profile AS3 coercion");
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
                        const testType = assignmentType(test, context, rawTest);
                        // Flash switch compares numeric values across int/uint/Number.
                        // Assignment coercion would truncate fractional labels or wrap uint bounds.
                        const numericCase = ["Number", "int", "uint"].includes(expressionType.sourceName)
                            && ["Number", "int", "uint"].includes(testType.sourceName);
                        if (!numericCase) assertAssignmentCompatible(expressionType, testType, rawTest);
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
                condition = adaptCondition(parseExpression(conditionOwner.children[0]!, context, true), context,
                    conditionOwner.children[0]!, "HARDENED_FOR_BOOLEAN",
                    "for condition requires a proven value and application-profile AS3 coercion");
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
            if (node.children.length !== 3 || !["VAR", "NAME"].includes(node.children[0]!.kind)
                || node.children[1]!.kind !== "IN" || node.children[1]!.children.length !== 1) {
                fail("HARDENED_FOREACH_SHAPE", "for each requires one declared or existing local binding and one iterable", node);
            }
            const declaresBinding = node.children[0]!.kind === "VAR";
            let declaration: TreeNode;
            let header: LocalHeader | undefined;
            if (declaresBinding) {
                if (node.children[0]!.children.length !== 1) {
                    fail("HARDENED_FOREACH_BINDING", "for each declares exactly one local identity", node.children[0]!);
                }
                declaration = node.children[0]!.children[0]!;
                header = Object.values(context.locals).find(local => local.node === declaration);
            } else {
                declaration = node.children[0]!;
                const name = validateIdentifier(requiredText(declaration, "for each binding"), declaration);
                header = context.locals[name];
                if (header?.readonly) {
                    fail("HARDENED_FOREACH_BINDING", "for each cannot assign a readonly local identity", declaration);
                }
            }
            if (!header) fail("HARDENED_FOREACH_BINDING", "for each binding lacks its predeclared local identity", declaration);
            const iterable = parseExpression(node.children[1]!.children[0]!, context, true);
            const actualIterableType = assignmentType(iterable, context, node.children[1]!.children[0]!);
            if (context.sourceMemberAuthority !== null && isDictionaryType(actualIterableType)
                && intrinsicSourceForType(actualIterableType,context) !== "flash.utils.Dictionary")
                fail("HARDENED_FOREACH_DICTIONARY_AUTHORITY", "Dictionary value enumeration requires the selected native compiler intrinsic", node.children[1]!);
            const iterableType = isArrayType(actualIterableType,context)
                ? semanticType(node,"Array","Array",[],actualIterableType.nullable,"Array") : actualIterableType;
            const elementType = vectorElement(iterableType);
            const dynamicIterable = ["*","Object"].includes(iterableType.sourceName);
            const bindingReference = context.sourceMemberAuthority !== null && (isArrayType(iterableType,context) || isDictionaryType(iterableType) || dynamicIterable)
                ? referenceCoercionForType(header.type,context) : null;
            if (context.sourceMemberAuthority !== null && (isArrayType(iterableType,context) || isDictionaryType(iterableType) || dynamicIterable)) {
                if (!bindingReference && !["*","Object","String","Number","int","uint","Boolean","Array","Function"].includes(header.type.sourceName))
                    fail("HARDENED_FOREACH_ARRAY_BINDING", "Array/Dictionary enumeration requires a retained slot type and authenticated binding", declaration);
            } else {
                if (elementType === null) fail("HARDENED_FOREACH_ITERABLE", "for each requires an authenticated Array, Dictionary or typed Vector", node.children[1]!);
                assertAssignmentCompatible(header.type, elementType, declaration);
            }
            if (declaresBinding && context.sourceMemberAuthority !== null
                && (isArrayType(iterableType,context) || isDictionaryType(iterableType) || dynamicIterable))
                header.enumerationBinding = true;
            const body = node.children[2]!;
            context.loopDepth += 1;
            context.breakableDepth += 1;
            try {
                return Object.assign(identity(node), {
                    kind: "forEach" as "forEach", binding: Object.assign(identity(declaration), {
                        name: header.name, type: header.type,
                    }), ...(bindingReference ? {bindingReference} : {}), declaresBinding, iterable, iterableType,
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
                target = Object.assign(identity(nameNode), { kind: "identifier" as "identifier", name,
                    bindingKind: "local" as "local", bindingSourceQualifiedName: null });
                declaresTarget = true;
            } else {
                target = parseExpression(targetOwner, context, false, false, true);
                if (target.kind !== "identifier") {
                    fail("HARDENED_FORIN_TARGET", "for-in currently admits one existing local or parameter identity", targetOwner);
                }
                targetType = assignmentType(target, context, targetOwner);
            }
            const iterableOwner = node.children[1]!.children[0]!;
            const iterable = parseExpression(iterableOwner, context, true);
            const iterableType = assignmentType(iterable, context, iterableOwner);
            if (["Boolean", "Number", "int", "uint", "String", "void"].includes(iterableType.sourceName)) {
                fail("HARDENED_FORIN_ITERABLE", "for-in requires a proven object/reference enumerable", iterableOwner);
            }
            if (!isDictionaryType(iterableType) && targetType.sourceName !== "String" && targetType.sourceName !== "*") {
                fail("HARDENED_FORIN_KEY", "ordinary for-in property keys require a String or dynamic binding", targetOwner);
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
                if (init !== null && init.children.length !== 1) {
                    fail("HARDENED_LOCAL_INITIALIZER", "locals require exactly one explicit admitted initializer", declaration);
                }
                let initializer: SemanticExpression;
                if (init === null) {
                    if (header.readonly || context.sourceMemberAuthority === null) {
                        fail("HARDENED_LOCAL_INITIALIZER", "locals require exactly one explicit admitted initializer", declaration);
                    }
                    if (header.type.sourceName === "Number") {
                        // The function-entry prelude initializes this slot once,
                        // even when its declaration occurs in a loop or branch.
                        return Object.assign(identity(declaration), { name, readonly: false, type: header.type,
                            initializer: Object.assign(identity(declaration), {kind: "undefined" as const}) });
                    }
                    const value = header.type.sourceName === "int" || header.type.sourceName === "uint" ? 0
                        : header.type.sourceName === "Boolean" ? false : null;
                    const implicit: SemanticExpression = header.type.sourceName === "*"
                        ? Object.assign(identity(declaration), { kind: "undefined" as "undefined" })
                        : Object.assign(identity(declaration), { kind: "literal" as "literal", value });
                    initializer = adaptAssignmentValue(header.type, implicit, context, declaration);
                } else {
                    initializer = adaptAssignmentValue(header.type,
                        parseExpression(init.children[0]!, context, true), context, init.children[0]!);
                }
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

function initializeNumberLocals(body: SemanticStatement[], context: AdapterContext,
    outer: { [name: string]: LocalHeader } = {}): SemanticStatement[] {
    // Native ASC leaves declared enumeration registers undefined until their
    // first assignment. Creating a nested function instead gives this owning
    // function an activation object whose typed slots have native defaults.
    // Stop at each lambda: its body gets its own initialization pass.
    const createsFunction = (value: unknown): boolean => {
        if (value === null || typeof value !== "object") return false;
        if ((value as {kind?: string}).kind === "lambda") return true;
        return Object.values(value).some(createsFunction);
    };
    const activation = createsFunction(body);
    const declarations: SemanticLocal[] = Object.values(context.locals)
        .filter(local => local !== outer[local.name] && !local.readonly
            && one(local.node, "INIT", true) === null
            && (local.enumerationBinding ? activation && local.type.sourceName !== "*"
                : local.type.sourceName === "Number"))
        .map(local => {
            const initializer: SemanticExpression = local.type.sourceName === "Number"
                ? Object.assign(identity(local.node), {kind: "binary" as const, operator: "/" as const,
                    left: Object.assign(identity(local.node), {kind: "literal" as const, value: 0}),
                    right: Object.assign(identity(local.node), {kind: "literal" as const, value: 0}),
                    resultType: local.type})
                : Object.assign(identity(local.node), {kind: "literal" as const,
                    value: ["int","uint"].includes(local.type.sourceName) ? 0
                        : local.type.sourceName === "Boolean" ? false : null});
            return Object.assign(identity(local.node), {
                name: local.name, readonly: false, type: local.type, initializer,
            });
        });
    if (!declarations.length) return body;
    const initial: SemanticStatement = Object.assign(identity(context.locals[declarations[0]!.name]!.node),
        {kind: "local" as const, declarations});
    return body.length && superCall(body[0]!) ? [body[0]!, initial, ...body.slice(1)] : [initial, ...body];
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
                allowLeadingSuper && constructor && statements.every(statement => statement.kind === "local" || statement.kind === "empty"
                    || context.sourceMemberAuthority !== null && context.baseSourceQName === "flash.display.Bitmap"
                    && statement.kind === "expression" && !superCall(statement))));
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
            const wildcardCatch = context.sourceMemberAuthority !== null
                && type.sourceName === "*" && type.emittedName === "unknown";
            if (!wildcardCatch && (type.sourceName !== "Error" || type.emittedName !== "Error")) {
                fail("HARDENED_CATCH_TYPE", "catch requires canonical Error or an authenticated wildcard type", typeNode);
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
    return last.kind === "return" || last.kind === "throw" || (last.kind === "label" && statementsAlwaysReturn([last.statement]))
        || (last.kind === "if" && last.elseStatements !== null
        && statementsAlwaysReturn(last.thenStatements) && statementsAlwaysReturn(last.elseStatements));
}

function parseField(list: TreeNode, context: AdapterContext, readonly: boolean, headersOnly: boolean = false): SemanticField[] {
    onlyKinds(list, ["META_LIST", "MOD_LIST", "NAME_TYPE_INIT"]);
    const memberModifiers = parseMemberModifiers(list, context);
    const modifiers = memberModifiers.modifiers;
    if (modifiers.indexOf("override") >= 0) {
        fail("HARDENED_OVERRIDE_TARGET", "AS3 override is admitted only on instance methods and accessors", list);
    }
    const declarations = list.children.filter((child) => child.kind === "NAME_TYPE_INIT");
    if (declarations.length === 0) {
        fail("HARDENED_FIELD_EMPTY", "field declaration must contain at least one source declarator", list);
    }
    const metadata = one(list, "META_LIST", true);
    let embeddedSource: string | null = null;
    if (metadata !== null) {
        if (metadata.children.length !== 1 || metadata.children[0]!.kind !== "META"
            || metadata.children[0]!.children.length !== 1 || declarations.length !== 1) {
            fail("HARDENED_EMBED_METADATA", "Embedded field requires one metadata declaration and one field", metadata);
        }
        const call = metadata.children[0]!.children[0]!;
        if (call.kind !== "CALL" || call.children.length !== 2 || call.children[0]!.kind !== "IDENTIFIER"
            || call.children[0]!.text !== "Embed" || call.children[1]!.kind !== "ARGUMENTS"
            || call.children[1]!.children.length !== 1) {
            fail("HARDENED_EMBED_METADATA", "Only a source-only Embed declaration is currently admitted", metadata);
        }
        const option = call.children[1]!.children[0]!;
        if (option.kind !== "ASSIGN" || option.children.length !== 3
            || option.children[0]!.kind !== "IDENTIFIER" || option.children[0]!.text !== "source"
            || option.children[1]!.text !== "=" || option.children[2]!.kind !== "LITERAL") {
            fail("HARDENED_EMBED_METADATA", "Embed source must be one literal path", metadata);
        }
        const path = parseExpression(option.children[2]!, context, true);
        if (path.kind !== "literal" || typeof path.value !== "string"
            || !/^(?:\.\.\/)*[A-Za-z0-9_$.-]+(?:\/[A-Za-z0-9_$.-]+)*\.png$/i.test(path.value)) {
            fail("HARDENED_EMBED_FORMAT", "Only relative PNG bitmap Embed resources are currently admitted", metadata);
        }
        embeddedSource = path.value;
        if (!readonly || !modifiers.includes("static")) {
            fail("HARDENED_EMBED_FIELD", "Embedded bitmap requires the original static const Class declaration", list);
        }
    }
    return declarations.map((declaration) => {
        onlyKinds(declaration, ["INIT", "NAME", "TYPE", "VECTOR"]);
        const nameNode = one(declaration, "NAME")!;
        const name = validateIdentifier(requiredText(nameNode, "field name"), nameNode);
        if (context.fields[name] && (headersOnly || context.fields[name]!.sourceNodeId !== declaration.id)
            || context.methods[name] || context.accessors[name]) {
            fail("HARDENED_MEMBER_DUPLICATE", "class member identity is duplicated", nameNode);
        }
        const init = one(declaration, "INIT", true);
        let initializer: SemanticExpression | null = null;
        if (init !== null) {
            if (init.children.length !== 1) {
                fail("HARDENED_INITIALIZER_SHAPE", "field initializer has the wrong normalized shape", init);
            }
            if (!headersOnly) initializer = parseExpression(init.children[0]!, context, true, false, false);
        } else if (readonly && embeddedSource === null) {
            fail("HARDENED_CONST_INITIALIZER", "AS3 const fields require an explicit admitted initializer", declaration);
        }
        let fieldType = parseType(oneType(declaration), context, false);
        if (embeddedSource !== null && (fieldType.sourceName !== "Class" || init !== null)) {
            fail("HARDENED_EMBED_FIELD", "Embed supplies the initializer of an otherwise uninitialized Class field", declaration);
        }
        const treeNodeRecord = isTreeNodeContext(context) && name === "FData";
        if (treeNodeRecord) {
            if (readonly || modifiers.join("\u0000") !== "protected" || fieldType.sourceName !== "Object"
                || initializer !== null) {
                fail("HARDENED_OWN_RECORD_DECLARATION",
                    "TTreeNode.FData requires the authenticated protected uninitialized Object field", declaration);
            }
            const valueType = semanticType(declaration, context.className, context.className, [], false);
            fieldType = semanticType(declaration, "Object", "AS3OwnRecord", [valueType], false);
        } else if (initializer !== null) {
            initializer = adaptAssignmentValue(fieldType, initializer, context, init!.children[0]!);
        }
        const implicitDefault: SemanticField["implicitDefault"] = treeNodeRecord ? "constructor-owned"
            : fieldType.sourceName === "int" || fieldType.sourceName === "uint" ? "zero"
            : fieldType.sourceName === "Number" ? "nan"
            : fieldType.sourceName === "Boolean" ? "false"
            : fieldType.sourceName === "*" ? "undefined" : "null";
        const field: SemanticField = Object.assign(identity(declaration), {
            kind: "field" as "field",
            sharedDeclarationNodeId: list.id,
            name,
            modifiers: modifiers.slice(),
            namespaceName: memberModifiers.namespaceName,
            readonly,
            type: fieldType,
            initializer,
            implicitDefault,
        });
        if (embeddedSource !== null) {
            const mapping = context.mappingsBySource["flash.display.Bitmap"];
            if (!mapping || mapping.targetKind !== "class") {
                fail("HARDENED_EMBED_BITMAP_AUTHORITY", "Embedded bitmap requires an authenticated Bitmap capability", declaration);
            }
            field.embeddedBitmap = {source: embeddedSource, resourceId: context.classQualifiedName + "." + name,
                className: "__as3Embedded_" + name, bitmapModule: targetModuleSpecifier(mapping.targetModule), bitmapExport: mapping.targetExport};
        }
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
    const parameters = authenticateBigTurnTableInnerConstructorParameters(
        parseParameters(one(node, "PARAMETER_LIST")!, context), constructor, context, node);
    const memberModifiers = parseMemberModifiers(node, context);
    const modifiers = memberModifiers.modifiers;
    if (constructor && (modifiers.indexOf("static") >= 0 || modifiers.indexOf("override") >= 0
        || memberModifiers.namespaceName !== null)) {
        fail("HARDENED_CONSTRUCTOR_STATIC", "constructor cannot be static", node);
    }
    if (modifiers.indexOf("override") >= 0
        && (context.extendsType === null || modifiers.indexOf("static") >= 0
        )) {
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
        const localKind = accessor === "getter" ? "getter" : accessor === "setter" ? "setter" : "method";
        let flashBaseQName = context.baseSourceQName;
        if (context.baseLocalQName !== null) {
            const inherited = localInheritedMember(context, name, localKind, memberModifiers.namespaceName, node);
            if (inherited.member !== null) {
                assertLocalOverride(inherited.member, parameters, returnType, modifiers, context, node);
                flashBaseQName = null;
            } else {
                flashBaseQName = inherited.terminalBaseQName;
                if (flashBaseQName === null) {
                    fail("HARDENED_OVERRIDE_AUTHORITY", "override has no inherited local or Flash declaration", node);
                }
            }
        }
        if (flashBaseQName !== null) {
            const access = accessor === "getter" ? "read" : accessor === "setter" ? "write" : "call";
            const mapping = memberMapping(context, flashBaseQName, access, name, node);
            const required = parameters.filter(parameter => parameter.defaultValue === null && !parameter.rest).length;
            if (!mapping || !mapping.sourceMember || mapping.targetMember === null
                || mapping.targetMember.scope !== "instance" || parameters.some(parameter => parameter.rest)
                || mapping.sourceMember.minArgs !== required || mapping.sourceMember.maxArgs !== parameters.length) {
                fail("HARDENED_OVERRIDE_AUTHORITY", "override lacks one exact base member signature and instance bridge mapping", node);
            }
            const signature = authenticatedSourceMemberSignature(mapping, node);
            if (parameters.some((parameter, index) => !sameUnderlyingType(parameter.type,
                authoritySemanticType(signature.parameterTypes[index]!, context, node)))
                || !sameUnderlyingType(returnType!, authoritySemanticType(signature.returnType, context, node))) {
                fail("HARDENED_OVERRIDE_SIGNATURE", "override parameter or return type differs from the native member contract", node);
            }
        }
    }
    return { node, name, modifiers, namespaceName: memberModifiers.namespaceName,
        parameters, returnType, block: one(node, "BLOCK")!, constructor, accessor };
}

/** Semantic IR is acyclic; reject receiver references in pre-super local initializers. */
function usesConstructionReceiver(value: unknown): boolean {
    if (value === null || typeof value !== "object") return false;
    if (Array.isArray(value)) return value.some(usesConstructionReceiver);
    const item = value as { [key: string]: unknown };
    return item.kind === "this" || item.kind === "super"
        || item.kind === "lambda" && item.lexicalReceiver !== undefined
        || Object.values(item).some(usesConstructionReceiver);
}

/** A staged slot must never expose the not-yet-allocated receiver or execute an accessor. */
function onlyOwnPreSuperFields(value: unknown, context: AdapterContext): boolean {
    if (value === null || typeof value !== "object") return true;
    if (Array.isArray(value)) return value.every(item=>onlyOwnPreSuperFields(item,context));
    const item=value as {[key:string]:any};
    if (item.kind === "member" && item.target.kind === "this") {
        const field=context.fields[item.name];
        return Boolean(field && !field.modifiers.includes("static") && field.namespaceName === null && !field.embeddedBitmap);
    }
    if (item.kind === "this" || item.kind === "super" || item.kind === "methodClosure"
        || item.kind === "lambda" && item.lexicalReceiver !== undefined) return false;
    return Object.values(item).every(child=>onlyOwnPreSuperFields(child,context));
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

function adaptPackageFieldProgram(root: TreeNode, ast: NormalizedParserAst,
    authority: LoadedCapabilityAuthority, sourceText: string, sha256: Sha256Function,
    packageName: string, packageNameNode: TreeNode, content: TreeNode, fieldList: TreeNode,
    localAuthority: LoadedLocalTypeAuthority | undefined, sourceLogicalPath: string | undefined,
    localMemberAuthority: LoadedLocalMemberAuthority | undefined,
    sourceMemberAuthority?: LoadedSourceMemberAuthority): SemanticProgram {
    if (!localAuthority || !localMemberAuthority || typeof sourceLogicalPath !== "string" || sourceLogicalPath.length === 0) {
        fail("HARDENED_LOCAL_SOURCE_AUTHORITY",
            "package const output requires local type, declaration, and source-path authorities", fieldList);
    }
    assertLoadedLocalTypeAuthority(localAuthority);
    assertLoadedLocalMemberAuthority(localMemberAuthority);
    const functionDeclaration=fieldList.kind === "FUNCTION";
    onlyKinds(fieldList, functionDeclaration ? ["BLOCK","MOD_LIST","NAME","PARAMETER_LIST","TYPE","VECTOR"] : ["MOD_LIST", "NAME_TYPE_INIT"]);
    const declarators=functionDeclaration ? [fieldList] : fieldList.children.filter(child => child.kind === "NAME_TYPE_INIT");
    if (declarators.length !== 1) fail("HARDENED_LOCAL_PACKAGE_OUTPUT", "package output requires exactly one declaration", fieldList);
    const modifiers = parseModifiers(fieldList, true);
    if (modifiers.length !== 1 || modifiers[0] !== "public")
        fail("HARDENED_LOCAL_PACKAGE_OUTPUT", "package output requires the exact public modifier", fieldList);
    const declarator=declarators[0]!;
    if (!functionDeclaration) onlyKinds(declarator,["INIT","NAME","TYPE","VECTOR"]);
    const nameNode = one(declarator, "NAME")!;
    const name = validateIdentifier(requiredText(nameNode, "package const name"), nameNode);
    const outputModulePath = modulePath(packageName, name, packageNameNode);
    const qname = packageName === "" ? name : `${packageName}.${name}`;
    const currentSourceSha256 = sha256(sourceText.replace(/\r\n?/g, "\n"));
    const candidates = (["application", "bootstrap"] as const).map(module =>
        localAuthority.entriesByIdentity[`${module}\u0000${qname}`]).filter((entry): entry is LocalTypeMapping => !!entry)
        .filter(entry => entry.sourcePath === (entry.module === "application"
            ? `${localAuthority.sourceRoots.application}${sourceLogicalPath}`
            : `${localAuthority.sourceRoots.bootstrap}${sourceLogicalPath}`)
            && entry.sourceContentSha256 === currentSourceSha256 && entry.typeKind === "package");
    if (candidates.length !== 1) {
        fail("HARDENED_LOCAL_SOURCE_AUTHORITY",
            `package const ${qname} lacks one exact authenticated graph source identity`, fieldList);
    }
    const current: CurrentLocalType = { entry: candidates[0]!, outputModulePath };
    const declarationEntry = localMemberAuthority.entriesByIdentity[`${current.entry.module}\u0000${qname}`];
    if (!declarationEntry || declarationEntry.status !== "complete" || declarationEntry.declaration === null
        || declarationEntry.declaration.members.length !== 1) {
        fail("HARDENED_LOCAL_MEMBER_HELD", "package const lacks one complete declaration authority", fieldList);
    }
    const declared = declarationEntry.declaration.members[0]!;
    if (declared.name !== name || declared.modifiers.length !== 1 || declared.modifiers[0] !== "public"
        || (functionDeclaration ? declared.kind !== "method" || declared.namespaceName !== null
            : declared.kind !== "field" || !declared.readonly || declared.fieldType === null))
        fail("HARDENED_LOCAL_PACKAGE_OUTPUT", "package declaration does not match its authenticated kind", fieldList);
    if (!functionDeclaration) assertPackageRuntimeValue(localMemberAuthority,current.entry.module,declarationEntry,fieldList);
    const resolveCurrentLocal = (): CurrentLocalType => current;
    const parsedImports = parseImports(content, authority, localAuthority, resolveCurrentLocal, localMemberAuthority);
    const resolveImplicitLocalType = (sourceName: string, expectedKind: "class" | "interface" | null,
        node: TreeNode, signature?: SignatureTypeProof): SemanticImport | null => {
        const derived=signatureTypeImport(sourceName,signature,current,localAuthority,localMemberAuthority,
            parsedImports.imports,parsedImports.importsByLocal,node);
        if(derived) return derived;
        const localName = sourceName.slice(sourceName.lastIndexOf(".") + 1);
        const existing = parsedImports.importsByLocal[localName];
        if (existing) return existing;
        const targetQName = sourceName.indexOf(".") >= 0 ? sourceName
            : packageName === "" ? sourceName : `${packageName}.${sourceName}`;
        const target = localAuthority.entriesByIdentity[`${current.entry.module}\u0000${targetQName}`];
        if (!target || !target.importable
            || (expectedKind !== null && target.typeKind !== expectedKind)) return null;
        if (current.entry.prerequisites.indexOf(target.nodeId) < 0) {
            fail("HARDENED_LOCAL_IMPORT_EDGE", "package const dependency lacks an authenticated graph edge", node);
        }
        const item = localSemanticImport(target, current, node, localAuthority, localMemberAuthority);
        parsedImports.imports.push(item);
        parsedImports.importsByLocal[localName] = item;
        return item;
    };
    const context: AdapterContext = {
        className: name, classQualifiedName: qname, extendsType: null,
        importsByLocal: parsedImports.importsByLocal, resolveImportedType: resolveImplicitLocalType,
        mappingsBySource: authority.typeMappingsBySource, memberMappingsByKey: authority.memberMappingsByKey,
        intrinsicMembersByKey: authority.intrinsicMembersByKey,
        nativeTimerFunctionsBySource: authority.nativeTimerFunctionsBySource,
        baseSourceQName: null, baseLocalQName: null,
        localTypeAuthority: localAuthority, localMemberAuthority, resolveCurrentLocal,
        fields: Object.create(null), methods: Object.create(null),
        runtimeReferenceParentsByQName: new Map(), sourceMemberAuthority: sourceMemberAuthority || null, currentInterfaceQNames: [],
        ...(functionDeclaration ? {packageFunction:true as const} : {}),
        accessors: Object.create(null), parameters: Object.create(null), locals: Object.create(null),
        loopDepth: 0, breakableDepth: 0, labels: [], namespaceNames: Object.create(null), lambdaDepth: 0, lexicalThisUses: 0,
        currentCallable: null, ownRecordTargetDepth: 0, ownRecordInitializations: 0,
    };
    let declaration:SemanticPackageField | SemanticPackageFunction;
    if (functionDeclaration) {
        const header=parseMethodHeader(fieldList,"",context);
        if (header.parameters.some(parameter => !parameter.rest && !["*","Object","String","Number","int","uint","Boolean","Array","Function"].includes(parameter.type.sourceName)))
            fail("HARDENED_PACKAGE_FUNCTION_PARAMETER", "package function reference parameter needs native coercion authority", fieldList);
        context.methods[name]=header;
        context.currentCallable=header;
        header.parameters.forEach(parameter => context.parameters[parameter.name]=parameter);
        predeclareLocals(header.block,context);
        const body=initializeNumberLocals(parseBlock(header.block,context,false,false,header.returnType), context);
        if (header.returnType!.sourceName !== "void" && !statementsAlwaysReturn(body))
            fail("HARDENED_RETURN_PATH", "package function must return or throw on every path", fieldList);
        declaration=Object.assign(identity(fieldList),{declarationKind:"packageFunction" as const,name,modifiers,
            parameters:header.parameters,returnType:header.returnType!,body});
    } else {
        const type = parseType(oneType(declarator), context, false);
        const init = one(declarator, "INIT")!;
        if (init.children.length !== 1) fail("HARDENED_LOCAL_PACKAGE_OUTPUT", "package const requires one explicit initializer", init);
        const initializer=adaptAssignmentValue(type,parseExpression(init.children[0]!,context,true,false,false),context,init.children[0]!);
        declaration=Object.assign(identity(fieldList),{declarationKind:"packageField" as const,name,modifiers,
            readonly:true as const,type,initializer});
    }
    const program: SemanticProgram = Object.assign(identity(root), {
        schema: "as3-semantic-ir@1" as "as3-semantic-ir@1", sourceSha256: ast.sourceSha256,
        fingerprintSha256: ast.fingerprintSha256, packageName, outputModulePath,
        imports: parsedImports.imports, declaration,
        sourceCapabilitySha256: authority.sourceCensusSha256,
        targetCapabilitySha256: authority.targetCapabilitiesSha256,
        capabilityMappingSha256: authority.mappingSha256,
        nativeTimerAuthoritySha256: authority.nativeTimerAuthoritySha256,
    });
    deepFreeze(program);
    ADAPTED_PROGRAMS.add(program);
    return program;
}

interface FileLocalClass {
    header: FileLocalClassDeclaration;
    scope: AS3FileLocalClassScope;
    type: LocalTypeMapping;
    outputModulePath: string;
}
interface FileLocalCompilation {
    owner: LocalTypeMapping;
    classes: FileLocalClass[];
    byName: { [name: string]: FileLocalClass };
    byQName: { [qname: string]: FileLocalClass };
    members: { [qname: string]: LocalMemberAuthorityEntry };
}
function contextLocalMember(context: AdapterContext, module: string, qname: string): LocalMemberAuthorityEntry | undefined {
    return (context.fileCompilation?.owner.module === module ? context.fileCompilation.members[qname] : undefined)
        ?? context.localMemberAuthority?.entriesByIdentity[`${module}\u0000${qname}`];
}
function contextLocalType(context: AdapterContext, module: string, qname: string): LocalTypeMapping | undefined {
    return (context.fileCompilation?.owner.module === module ? context.fileCompilation.byQName[qname]?.type : undefined)
        ?? context.localTypeAuthority?.entriesByIdentity[`${module}\u0000${qname}`];
}

/** Derive lexical declarations from the original bytes; never widen the global maps. */
function prepareFileLocalCompilation(ast: NormalizedParserAst, root: TreeNode, authority: LoadedCapabilityAuthority,
    sourceText: string, sha256: Sha256Function, localTypes: LoadedLocalTypeAuthority | undefined,
    sourcePath: string | undefined, localMembers: LoadedLocalMemberAuthority | undefined): FileLocalCompilation {
    if (!localTypes || !localMembers || !sourcePath)
        fail("HARDENED_FILE_LOCAL_AUTHORITY", "file-local compilation requires authenticated source and declaration maps", root);
    assertLoadedLocalTypeAuthority(localTypes);
    assertLoadedLocalMemberAuthority(localMembers);
    const extract = extractLocalDeclaration(ast, sourceText, sha256, sourcePath);
    const owners = localTypes.entries.filter(entry => entry.qname === extract.qualifiedName
        && entry.sourcePath === localTypes.sourceRoots[entry.module] + sourcePath
        && entry.sourceContentSha256 === sha256(sourceText.replace(/\r\n?/g, "\n")) && entry.typeKind === "class");
    if (owners.length !== 1 || !extract.fileLocalClasses?.length)
        fail("HARDENED_FILE_LOCAL_AUTHORITY", "file scope lacks one authenticated class owner and helper declarations", root);
    const owner = owners[0]!;
    const signed = localMembers.entriesByIdentity[`${owner.module}\u0000${owner.qname}`];
    if (signed?.status !== "complete" || !signed.declaration
        || JSON.stringify(signed.declaration.fileLocalClasses) !== JSON.stringify(extract.fileLocalClasses))
        fail("HARDENED_FILE_LOCAL_AUTHORITY", "file-local headers differ from the authenticated original declaration", root);
    const publicOutput = owner.targetPath.slice(localTypes.targetRoots[owner.module].length);
    const result: FileLocalCompilation = { owner, classes: [], byName: Object.create(null), byQName: Object.create(null), members: Object.create(null) };
    for (const header of extract.fileLocalClasses) {
        if (PRIMITIVE_TYPES[header.name] || header.name === "Vector")
            fail("HARDENED_FILE_LOCAL_SHADOW", "file-local builtin type shadowing requires native binding evidence", root);
        const scope: AS3FileLocalClassScope = {module: owner.module, sourcePath: owner.sourcePath,
            ownerQualifiedName: owner.qname, name: header.name};
        const qname = fileLocalClassIdentity(scope).key;
        const outputModulePath = `${publicOutput.slice(0, -3)}.file-local/${header.name}.ts`;
        const type: LocalTypeMapping = {...owner, qname, importable: false,
            nodeId: sha256(`${owner.nodeId}\u0000${header.sourceNodeId}`).slice(0, 16),
            prerequisites: [...new Set([...owner.prerequisites, owner.nodeId])].sort(),
            targetPath: localTypes.targetRoots[owner.module] + outputModulePath};
        const item = {header, scope, type, outputModulePath};
        result.classes.push(item); result.byName[header.name] = item; result.byQName[qname] = item;
    }
    const resolveType = (name: string, header: FileLocalClassDeclaration): string => {
        if (name.startsWith("Vector.<") && name.endsWith(">")) return `Vector.<${resolveType(name.slice(8, -1), header)}>`;
        if (name === "*" || name === "void" || PRIMITIVE_TYPES[name]) return name;
        if (result.byName[name]) return result.byName[name]!.type.qname;
        const exists = (qname: string): boolean => !!authority.typeMappingsBySource[qname]
            || !!authority.intrinsicTypesBySource[qname]
            || !!localTypes.entriesByIdentity[`${owner.module}\u0000${qname}`];
        const matches = name.includes(".") ? [name].filter(exists) : [
            ...header.imports.filter(value => !value.endsWith(".*") && value.endsWith("." + name)),
            ...header.imports.filter(value => value.endsWith(".*")).map(value => value.slice(0, -1) + name), name,
        ].filter(exists);
        const distinct = [...new Set(matches)];
        if (distinct.length !== 1) fail("HARDENED_FILE_LOCAL_TYPE", `file-local signature type ${name} lacks one lexical binding`, root);
        return distinct[0]!;
    };
    for (const item of result.classes) {
        const header = item.header;
        result.members[item.type.qname] = {module: owner.module, qname: item.type.qname, nodeId: item.type.nodeId,
            sourceContentSha256: owner.sourceContentSha256, typeKind: "class", status: "complete", holdCode: null, holdSha256: null,
            declaration: {baseQNames: header.extendsNames.map(name => resolveType(name, header)),
                ...(header.modifiers.includes("final") ? {finalClass:true as const} : {}),
                interfaceQNames: header.implementsNames.map(name => resolveType(name, header)), packageInitializer: null,
                members: header.members.map(member => ({...member,
                    fieldType: member.fieldType === null ? null : resolveType(member.fieldType, header),
                    returnType: member.returnType === null ? null : resolveType(member.returnType, header),
                    parameters: member.parameters.map(parameter => ({...parameter, type: resolveType(parameter.type, header)}))}))}};
    }
    return result;
}

export function adaptNormalizedParserAst(ast: NormalizedParserAst, authority: LoadedCapabilityAuthority,
    sourceText: string, sha256: Sha256Function, localAuthority?: LoadedLocalTypeAuthority,
    sourceLogicalPath?: string, localMemberAuthority?: LoadedLocalMemberAuthority,
    runtimeReferenceAuthority?: readonly RuntimeAuthoritySource[],
    sourceMemberAuthority?: LoadedSourceMemberAuthority): SemanticProgram {
    assertLoadedCapabilityAuthority(authority);
    const root = buildTree(ast, sourceText, sha256);
    const hasFileScope = root.children.some(child => child.kind === "CONTENT" && child.children.length > 0);
    const compilation = hasFileScope ? prepareFileLocalCompilation(ast, root, authority, sourceText, sha256,
        localAuthority, sourceLogicalPath, localMemberAuthority) : undefined;
    const program = adaptSourceClass(ast, authority, sourceText, sha256, localAuthority, sourceLogicalPath,
        localMemberAuthority, runtimeReferenceAuthority, sourceMemberAuthority, compilation);
    if (!compilation) return program;
    const fileLocalPrograms = compilation.classes.map(item => adaptSourceClass(ast, authority, sourceText, sha256,
        localAuthority, sourceLogicalPath, localMemberAuthority, runtimeReferenceAuthority, sourceMemberAuthority, compilation, item));
    const complete = {...program, fileLocalPrograms};
    deepFreeze(complete); ADAPTED_PROGRAMS.add(complete);
    return complete;
}

function adaptSourceClass(ast: NormalizedParserAst, authority: LoadedCapabilityAuthority,
    sourceText: string, sha256: Sha256Function, localAuthority?: LoadedLocalTypeAuthority,
    sourceLogicalPath?: string, localMemberAuthority?: LoadedLocalMemberAuthority,
    runtimeReferenceAuthority?: readonly RuntimeAuthoritySource[],
    sourceMemberAuthority?: LoadedSourceMemberAuthority, fileCompilation?: FileLocalCompilation,
    selectedFileClass?: FileLocalClass): SemanticProgram {
    assertLoadedCapabilityAuthority(authority);
    const root = buildTree(ast, sourceText, sha256);
    if (root.kind !== "COMPILATION_UNIT") {
        fail("HARDENED_ROOT_KIND", "normalized AST root must be COMPILATION_UNIT", root);
    }
    const packageNode = one(root, "PACKAGE")!;
    const trailing = root.children.filter((child) => child.kind === "CONTENT" && child !== packageNode);
    if (root.children.some((child) => child !== packageNode && child.kind !== "CONTENT")
        || (!fileCompilation && trailing.some((content) => content.children.length !== 0))) {
        fail("HARDENED_OUTSIDE_PACKAGE", "declarations outside the package are not admitted", root);
    }
    const packageNameNode = one(packageNode, "NAME")!;
    onlyKinds(packageNode, ["CONTENT", "NAME"]);
    const packageName = selectedFileClass ? "" : packageNameNode.text === null ? "" : packageNameNode.text;
    const packageContent = one(packageNode, "CONTENT")!;
    const selectedNode = selectedFileClass ? trailing.flatMap(content => content.children)
        .find(node => node.id === selectedFileClass.header.sourceNodeId && node.kind === "CLASS") : undefined;
    if (selectedFileClass && !selectedNode) fail("HARDENED_FILE_LOCAL_NODE", "file-local class is absent from original AST", root);
    // A lexical view of the original nodes, not a rewritten source or normalized AST.
    const content = selectedFileClass ? {...packageContent, children: trailing.flatMap(content => content.children)
        .filter(node => node.kind === "IMPORT" || node === selectedNode)} : packageContent;
    const declarationPosition = content.children.findIndex((child) => child.kind === "CLASS" || child.kind === "INTERFACE");
    if (declarationPosition >= 0 && content.children.slice(declarationPosition + 1)
        .some((child) => child.kind === "IMPORT" || child.kind === "USE")) {
        fail("HARDENED_IMPORT_ORDER", "source imports and namespace directives must precede the declaration", content);
    }
    const declarations = content.children.filter((child) => child.kind === "CLASS" || child.kind === "INTERFACE");
    const packageConstLists = content.children.filter(child => child.kind === "CONST_LIST" || child.kind === "FUNCTION");
    if (declarations.length === 0 && packageConstLists.length === 1
        && content.children.every(child => child.kind === "IMPORT" || child.kind === "CONST_LIST" || child.kind === "FUNCTION")) {
        return adaptPackageFieldProgram(root, ast, authority, sourceText, sha256, packageName,
            packageNameNode, content, packageConstLists[0]!, localAuthority, sourceLogicalPath, localMemberAuthority,sourceMemberAuthority);
    }
    if (declarations.length !== 1 || content.children.some((child) => child.kind !== "IMPORT" && child.kind !== "USE"
        && child.kind !== "CLASS" && child.kind !== "INTERFACE")) {
        fail("HARDENED_PACKAGE_CONTENT", "semantic adapter requires imports followed by exactly one class or interface", content);
    }
    const classNode = declarations[0]!;
    onlyKinds(classNode, ["CONTENT", "EXTENDS", "IMPLEMENTS_LIST", "MOD_LIST", "NAME"]);
    const classNameNode = one(classNode, "NAME")!;
    const className = validateIdentifier(requiredText(classNameNode, "class name"), classNameNode);
    const outputModulePath = selectedFileClass?.outputModulePath ?? modulePath(packageName, className, packageNameNode);
    const classContentForNamespaces = one(classNode, "CONTENT")!;
    const firstClassMember = classContentForNamespaces.children.findIndex(child => child.kind !== "USE");
    if (firstClassMember >= 0 && classContentForNamespaces.children.slice(firstClassMember + 1)
        .some(child => child.kind === "USE")) {
        fail("HARDENED_NAMESPACE_ORDER", "class namespace directives must precede every member", classContentForNamespaces);
    }
    const namespaceNames: { [name: string]: true } = Object.create(null);
    const namespaceUseNodes = content.children.filter(child => child.kind === "USE")
        .concat(classContentForNamespaces.children.filter(child => child.kind === "USE"));
    let currentLocal: CurrentLocalType | null = selectedFileClass ? {entry: selectedFileClass.type, outputModulePath} : null;
    let resolveCurrentLocal: (() => CurrentLocalType) | null = null;
    if (localAuthority !== undefined || sourceLogicalPath !== undefined) {
        if (!localAuthority || typeof sourceLogicalPath !== "string" || sourceLogicalPath.length === 0) {
            fail("HARDENED_LOCAL_SOURCE_AUTHORITY", "local source authentication requires authority and logical path together", classNode);
        }
        assertLoadedLocalTypeAuthority(localAuthority);
        if (localMemberAuthority !== undefined) assertLoadedLocalMemberAuthority(localMemberAuthority);
        resolveCurrentLocal = () => {
            if (currentLocal) return currentLocal;
            const qname = packageName === "" ? className : `${packageName}.${className}`;
            const currentSourceSha256 = sha256(sourceText.replace(/\r\n?/g, "\n"));
            const candidates = (["application", "bootstrap"] as const).map(module =>
                localAuthority.entriesByIdentity[`${module}\u0000${qname}`]).filter((entry): entry is LocalTypeMapping => !!entry)
                .filter(entry => entry.sourcePath === (entry.module === "application"
                    ? `${localAuthority.sourceRoots.application}${sourceLogicalPath}`
                    : `${localAuthority.sourceRoots.bootstrap}${sourceLogicalPath}`)
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
    if (localMemberAuthority !== undefined && localAuthority === undefined) {
        fail("HARDENED_LOCAL_MEMBER_AUTHORITY_INSTANCE", "local member authority requires its local type authority", classNode);
    }
    const parsedImports = parseImports(content, authority, localAuthority, resolveCurrentLocal,
        localMemberAuthority || null);
    namespaceUseNodes.forEach((node) => {
        onlyKinds(node, []);
        const name = validateNamespaceIdentifier(requiredText(node, "namespace directive"), node);
        const imported = parsedImports.importsByLocal[name];
        if (!imported || !imported.compileTimeNamespace) {
            fail("HARDENED_NAMESPACE_AUTHORITY",
                "use namespace requires one authenticated imported package namespace declaration", node);
        }
        namespaceNames[name] = true;
    });
    const resolveImplicitLocalType = (sourceName: string, expectedKind: "class" | "interface" | null,
        node: TreeNode, signature?: SignatureTypeProof): SemanticImport | null => {
        if (signature && localAuthority && resolveCurrentLocal) {
            const derived=signatureTypeImport(sourceName,signature,resolveCurrentLocal(),localAuthority,localMemberAuthority || null,
                parsedImports.imports,parsedImports.importsByLocal,node);
            if(derived) return derived;
        }
        const scoped = fileCompilation?.byName[sourceName] ?? fileCompilation?.byQName[sourceName];
        const localName = scoped?.header.name ?? sourceName.slice(sourceName.lastIndexOf(".") + 1);
        const existing = parsedImports.importsByLocal[localName];
        if (scoped) {
            if (expectedKind === "interface") return null;
            if (existing && existing.sourceQualifiedName !== scoped.type.qname)
                fail("HARDENED_FILE_LOCAL_SHADOW", "file-local type conflicts with an explicit import", node);
            if (existing) return existing;
            const item = localSemanticImport(scoped.type, resolveCurrentLocal!(), node, localAuthority!,
                localMemberAuthority || null, scoped.header.name);
            parsedImports.imports.push(item); parsedImports.importsByLocal[localName] = item;
            return item;
        }
        if (existing) {
            if (sourceName.includes('.') && existing.sourceQualifiedName !== sourceName)
                fail("HARDENED_IMPORT_COLLISION", "implicit signature type conflicts with an existing import", node);
            return existing;
        }
        if (authority.typeMappingsBySource[sourceName] && authority.typeMappingsBySource[sourceName]!.targetKind !== "function") {
            const item = flashSemanticImport(authority, sourceName, node);
            if (expectedKind !== null && authority.typeMappingsBySource[sourceName]!.targetKind !== expectedKind) return null;
            parsedImports.imports.push(item);
            parsedImports.importsByLocal[localName] = item;
            return item;
        }
        if (!localAuthority || !resolveCurrentLocal) return null;
        const qname = sourceName.indexOf(".") >= 0 ? sourceName
            : packageName === "" ? sourceName : `${packageName}.${sourceName}`;
        const candidates = (["application", "bootstrap"] as const).map(module =>
            localAuthority.entriesByIdentity[`${module}\u0000${qname}`]).filter((entry): entry is LocalTypeMapping => !!entry);
        if (candidates.length === 0) return null;
        const current = resolveCurrentLocal();
        const target = localAuthority.entriesByIdentity[`${current.entry.module}\u0000${qname}`];
        if (!target || !target.importable
            || (expectedKind !== null && target.typeKind !== expectedKind)) return null;
        if (current.entry.prerequisites.indexOf(target.nodeId) < 0) {
            fail("HARDENED_LOCAL_IMPORT_EDGE",
                "same-package type lacks an authenticated dependency edge: " + qname, node);
        }
        const item = localSemanticImport(target, current, node, localAuthority, localMemberAuthority || null);
        parsedImports.imports.push(item);
        parsedImports.importsByLocal[localName] = item;
        return item;
    };
    const placeholder: AdapterContext = {
        className,
        classQualifiedName: selectedFileClass?.type.qname ?? (packageName === "" ? className : `${packageName}.${className}`),
        ...(fileCompilation ? {fileCompilation} : {}),
        extendsType: null,
        importsByLocal: parsedImports.importsByLocal,
        resolveImportedType: resolveImplicitLocalType,
        mappingsBySource: authority.typeMappingsBySource,
        memberMappingsByKey: authority.memberMappingsByKey,
        intrinsicMembersByKey: authority.intrinsicMembersByKey,
        nativeTimerFunctionsBySource: authority.nativeTimerFunctionsBySource,
        baseSourceQName: null,
        baseLocalQName: null,
        localTypeAuthority: localAuthority || null,
        localMemberAuthority: localMemberAuthority || null,
        resolveCurrentLocal,
        runtimeReferenceParentsByQName: runtimeReferenceParents(runtimeReferenceAuthority),
        sourceMemberAuthority: sourceMemberAuthority || null,
        currentInterfaceQNames: [],
        fields: Object.create(null),
        methods: Object.create(null),
        accessors: Object.create(null),
        parameters: Object.create(null),
        locals: Object.create(null),
        loopDepth: 0,
        breakableDepth: 0,
        labels: [],
        namespaceNames,
        lambdaDepth: 0, lexicalThisUses: 0,
        currentCallable: null, ownRecordTargetDepth: 0, ownRecordInitializations: 0,
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
            const imported = parsedImports.importsByLocal[localName]
                || resolveImplicitLocalType(sourceName, "interface", extendsNode);
            if (!imported || !imported.runtimeInterface
                || (sourceName.indexOf(".") >= 0 && imported.sourceQualifiedName !== sourceName)) {
                fail("HARDENED_INTERFACE_EXTENDS", "extended interface must be one authenticated imported interface", extendsNode);
            }
            if (seenExtends.has(imported.sourceQualifiedName)) {
                fail("HARDENED_INTERFACE_EXTENDS", "extended interface is duplicated", extendsNode);
            }
            seenExtends.add(imported.sourceQualifiedName);
            interfaceExtendsTypes.push(semanticType(extendsNode, localName, localName, [], undefined,
                imported.sourceQualifiedName));
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
            nativeTimerAuthoritySha256: authority.nativeTimerAuthoritySha256,
        });
        deepFreeze(program);
        ADAPTED_PROGRAMS.add(program);
        return program;
    }
    const extendsNode = one(classNode, "EXTENDS", true);
    let extendsType: SemanticType | null = null;
    if (extendsNode !== null) {
        const sourceName = requiredText(extendsNode, "base type");
        const localName = sourceName.slice(sourceName.lastIndexOf(".") + 1);
        const imported = parsedImports.importsByLocal[localName]
            || resolveImplicitLocalType(sourceName, "class", extendsNode);
        if (!imported && sourceName === "Array" && nativeArrayBase(placeholder)) {
            extendsType = semanticType(extendsNode,"Array","__AS3ArrayBase",[],false,"Array");
            placeholder.extendsType = extendsType;
            placeholder.baseSourceQName = "Array";
        } else {
            if (!imported || (sourceName.indexOf(".") >= 0 && imported.sourceQualifiedName !== sourceName)) {
                fail("HARDENED_BASE_TYPE", "base type " + extendsNode.text
                    + " must be a double-pinned Flash class or authenticated local class", extendsNode);
            }
            if (imported.authorityKind === "flash") {
                mappingForRole(authority, imported.sourceQualifiedName, "base-type", extendsNode);
            } else {
                const localBase = contextLocalType(placeholder, resolveCurrentLocal!().entry.module, imported.sourceQualifiedName);
                if (!localBase || localBase.typeKind !== "class") {
                    fail("HARDENED_BASE_TYPE", "local base type must resolve to an authenticated class", extendsNode);
                }
                if (localDeclaration(placeholder,imported.sourceQualifiedName,extendsNode).declaration!.finalClass)
                    fail("HARDENED_FINAL_BASE", "a final source class cannot be extended", extendsNode);
            }
            extendsType = semanticType(extendsNode, imported.sourceLocalName, imported.sourceLocalName, [], undefined,
                imported.sourceQualifiedName);
            placeholder.extendsType = extendsType;
            placeholder.baseSourceQName = imported.authorityKind === "flash" ? imported.sourceQualifiedName : null;
            placeholder.baseLocalQName = imported.authorityKind === "local" ? imported.sourceQualifiedName : null;
        }
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
            const imported = parsedImports.importsByLocal[localName]
                || resolveImplicitLocalType(sourceName, "interface", item);
            if (!imported || (sourceName.indexOf(".") >= 0 && imported.sourceQualifiedName !== sourceName)
                || !imported.runtimeInterface) {
                fail("HARDENED_IMPLEMENTS_TYPE", "implemented type must be one authenticated imported interface", item);
            }
            if (seen.has(imported.sourceQualifiedName)) fail("HARDENED_IMPLEMENTS_DUPLICATE", "implemented interface is duplicated", item);
            seen.add(imported.sourceQualifiedName);
            implementsTypes.push({ type: semanticType(item, localName, localName, [], undefined,
                imported.sourceQualifiedName), runtimeName: imported.sourceQualifiedName });
        });
    }
    placeholder.currentInterfaceQNames = Object.freeze(implementsTypes.map(item => item.runtimeName));
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
    placeholder.inheritedAccessors = [];
    if (placeholder.sourceMemberAuthority !== null && extendsType !== null) {
        for (const [name, pair] of Object.entries(placeholder.accessors)) {
            if (pair.getter && pair.setter) continue;
            const own = (pair.getter || pair.setter)!;
            if (own.modifiers.includes("static") || own.modifiers.includes("private") || own.namespaceName !== null) continue;
            const kind = pair.getter ? "setter" : "getter";
            const inherited = placeholder.baseLocalQName === null ? null
                : localInheritedMember(placeholder, name, kind, null, own.node);
            let type: SemanticType | null = null, ownerQName: string | null = null;
            if (inherited?.member && inherited.ownerQName) {
                assertInheritedVisibility(inherited.member, inherited.ownerQName, placeholder, own.node);
                if (memberVisibility(inherited.member.modifiers) !== memberVisibility(own.modifiers))
                    fail("HARDENED_ACCESSOR_VISIBILITY", "inherited accessor halves require the same source visibility", own.node);
                type = authoritySemanticType(kind === "getter" ? inherited.member.returnType!
                    : inherited.member.parameters[0]!.type, placeholder, own.node);
                ownerQName = inherited.ownerQName;
            } else {
                const mapping = flashBaseMemberMapping(placeholder, kind === "getter" ? "read" : "write", name, own.node);
                if (mapping && mapping.targetMember?.scope === "instance") {
                    if (memberVisibility(own.modifiers) !== "public")
                        fail("HARDENED_ACCESSOR_VISIBILITY", "native public accessor cannot supply a non-public accessor half", own.node);
                    type = mappedMemberType(mapping, kind === "getter" ? "read" : "write", placeholder, own.node);
                    ownerQName = mapping.sourceQName;
                }
            }
            if (type !== null && ownerQName !== null) {
                if (!sameType(type, pair.getter ? own.returnType! : own.parameters[0]!.type))
                    fail("HARDENED_ACCESSOR_PAIR", "inherited accessor half has a different source type", own.node);
                placeholder.inheritedAccessors.push({kind, name, ownerQName, type,
                    modifiers: own.modifiers.filter(modifier => modifier !== "override")});
            }
        }
    }
    // Bind every original field before any initializer or method body is resolved.
    classContent.children.filter(node => node.kind === "VAR_LIST" || node.kind === "CONST_LIST")
        .forEach(node => parseField(node, placeholder, node.kind === "CONST_LIST", true));
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
            const oldCallable = placeholder.currentCallable;
            placeholder.parameters = Object.create(null);
            placeholder.locals = Object.create(null);
            placeholder.currentCallable = header;
            header.parameters.forEach((parameter) => { placeholder.parameters[parameter.name] = parameter; });
            predeclareLocals(header.block, placeholder);
            let body: SemanticStatement[];
            try {
                body = parseBlock(header.block, placeholder, header.constructor, extendsType !== null, header.returnType);
                body = initializeNumberLocals(body, placeholder);
            } finally {
                placeholder.parameters = oldParameters;
                placeholder.locals = oldLocals;
                placeholder.currentCallable = oldCallable;
            }
            if (header.constructor) {
                const count = body.filter(superCall).length;
                const superIndex = body.findIndex(superCall);
                const leading = body.slice(0, Math.max(0, superIndex));
                const stagedBitmap=placeholder.sourceMemberAuthority !== null
                    && placeholder.baseSourceQName === "flash.display.Bitmap";
                if (count > 1 || extendsType !== null && count !== 1
                    || leading.some(statement => statement.kind !== "local" && statement.kind !== "empty"
                        && !(stagedBitmap && statement.kind === "expression"))) {
                    fail("HARDENED_SUPER_ORDER", "constructor requires one top-level super call and an admitted leading sequence", node);
                }
                if (stagedBitmap) {
                    const call=(body[superIndex] as any).expression;
                    const fields=Object.values(placeholder.fields).filter(field=>!field.modifiers.includes("static"));
                    if (!onlyOwnPreSuperFields(leading,placeholder) || !onlyOwnPreSuperFields(call.arguments,placeholder)
                        || fields.some(field=>field.embeddedBitmap || !onlyOwnPreSuperFields(field.initializer,placeholder)))
                        fail("HARDENED_SUPER_FIELD_RECEIVER", "Bitmap pre-super code may use own field slots but cannot expose this or call receiver methods/accessors",node);
                } else if (leading.some(usesConstructionReceiver)) {
                    fail("HARDENED_SUPER_LOCAL_RECEIVER", "local initialization before super cannot access the construction receiver", node);
                }
                if (extendsType === null && count === 1) body = body.filter(statement => !superCall(statement));
                const constructor: SemanticConstructor = Object.assign(identity(node), {
                    kind: "constructor" as "constructor", modifiers: header.modifiers,
                    parameters: header.parameters, body, ...(stagedBitmap ? {preSuperFieldState:true as const} : {}),
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
                    if (placeholder.sourceMemberAuthority !== null && header.returnType!.sourceName === "*"
                        && header.returnType!.emittedName === "unknown") {
                        body.push(Object.assign(identity(node), {kind:"return" as const,
                            expression:Object.assign(identity(node), {kind:"undefined" as const})}));
                    } else fail("HARDENED_RETURN_PATH", "non-void method must return a proven value on every admitted path", node);
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
    if (isTreeNodeContext(placeholder) && placeholder.ownRecordInitializations !== 1) {
        fail("HARDENED_OWN_RECORD_INITIALIZER",
            "TTreeNode.FData requires exactly one authenticated constructor initialization", classNode);
    }
    // Fields declared after the constructor still initialize before its body.
    // Validate their final initializers after all member declarations are parsed.
    if (members.some(member=>member.kind === "constructor" && member.preSuperFieldState)) {
        for (const field of members) {
            if (field.kind === "field" && !field.modifiers.includes("static")
                && (field.embeddedBitmap || !onlyOwnPreSuperFields(field.initializer,placeholder)))
                fail("HARDENED_SUPER_FIELD_RECEIVER", "Bitmap field initializers cannot expose the construction receiver",classNode);
        }
    }
    assertNoLocalAncestryFieldCollision(placeholder, members, classNode);
    if (one(classNode,"MOD_LIST",true)?.children.some(modifier=>modifier.text === "final")
        && localDeclaration(placeholder,placeholder.classQualifiedName,classNode).declaration!.finalClass !== true)
        fail("HARDENED_FINAL_CLASS_AUTHORITY", "final class requires its authenticated declaration flag", classNode);
    const declaration: SemanticClass = Object.assign(identity(classNode), {
        declarationKind: "class" as "class", name: className,
        modifiers: parseModifiers(classNode, true,
            isArrayType(semanticType(classNode,className,className,[],false,placeholder.classQualifiedName),placeholder)),
        extendsType,
        interfaceExtendsTypes: [],
        implementsTypes,
        members,
        ...(placeholder.inheritedAccessors?.length ? {inheritedAccessors: placeholder.inheritedAccessors} : {}),
    });
    const program: SemanticProgram = Object.assign(identity(root), {
        schema: "as3-semantic-ir@1" as "as3-semantic-ir@1",
        sourceSha256: ast.sourceSha256,
        fingerprintSha256: ast.fingerprintSha256,
        packageName,
        outputModulePath,
        imports: parsedImports.imports,
        declaration,
        ...(selectedFileClass ? {fileLocalScope: selectedFileClass.scope} : {}),
        sourceCapabilitySha256: authority.sourceCensusSha256,
        targetCapabilitySha256: authority.targetCapabilitiesSha256,
        capabilityMappingSha256: authority.mappingSha256,
        nativeTimerAuthoritySha256: authority.nativeTimerAuthoritySha256,
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
