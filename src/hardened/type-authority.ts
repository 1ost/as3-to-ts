import { staticConstant } from "./static-constants";
import { LoadedSourceMemberAuthority, assertLoadedSourceMemberAuthority } from "./source-member-authority";
import { HardenedSemanticError, SemanticExpression, SemanticField, SemanticMember, SemanticProgram } from "./contracts";
import { assertAdaptedSemanticProgram } from "./adapter";
import { emitSemanticProgram } from "./emitter";

type RuntimeTypeScriptCompiler = typeof import("typescript-4-9");

export interface RuntimeAuthorityInterfaceSource {
    readonly kind: "interface";
    readonly qname: string;
    readonly bases: readonly string[];
}

export interface RuntimeAuthorityClassSource {
    readonly kind: "class";
    readonly qname: string;
    readonly base: string | null;
    readonly interfaces: readonly string[];
    readonly sourceSha256: string;
    readonly definitionSafe: true;
    readonly module: string;
    readonly constructorExport: string;
    readonly predicateExport: string;
    readonly constructionTargetExport: string | null;
    readonly constructionProofExport: string | null;
    readonly nativeObjectTraits?: { readonly dynamic: boolean | null; readonly names: readonly string[]; readonly sourceArtifactSha256: string };
    readonly objectTraits?: { readonly dynamic: boolean; readonly members: readonly {
        readonly name: string; readonly kind: "field" | "const" | "method" | "getter" | "setter"; readonly type: string;
        readonly visibility: "public" | "private" | "protected" | "internal" | "namespace"; readonly namespaceName: string | null;
    }[] };
    readonly fields: readonly { readonly name: string; readonly policy: "zero" | "nan" | "false" | "null" | "undefined" }[];
    readonly evaluationOrder: number | null;
}

export type RuntimeAuthoritySource = RuntimeAuthorityInterfaceSource | RuntimeAuthorityClassSource;

const authenticatedRuntimeAuthoritySources = new WeakSet<object>();
const localRuntimeProofs = new WeakMap<object, { readonly transaction: symbol; readonly evaluationOrder: number }>();
const localAuthoritySourceProofs = new WeakMap<object, symbol>();
const compilerEmbeddedSources = new WeakSet<object>();
let activeLocalRuntimeProof: symbol | null = null;

function authenticatedSource<T extends RuntimeAuthoritySource>(source: T): T {
    const frozen = Object.freeze(source);
    authenticatedRuntimeAuthoritySources.add(frozen);
    return frozen;
}

/** Read-only authenticity check; this cannot mint or widen an authority source. */
export function assertAuthenticatedRuntimeAuthoritySources(
    sources: readonly RuntimeAuthoritySource[],
): asserts sources is readonly RuntimeAuthoritySource[] {
    if (!Array.isArray(sources) || sources.some(source => !source || typeof source !== "object"
        || !authenticatedRuntimeAuthoritySources.has(source))) {
        throw new HardenedSemanticError("HARDENED_TYPE_AUTHORITY_SOURCE",
            "runtime type authority source was not derived from an authenticated declaration or mapped capability");
    }
}

export interface EmittedRuntimeAuthority {
    readonly schema: "as3-runtime-type-authority-source@1";
    readonly sha256: string;
    readonly qnames: readonly string[];
    readonly code: string;
}

interface PredicateAuthorityRow {
    kind?: "class";
    interfaces?: string[];
    sourceQName: string;
    targetCapabilityId: string;
    targetModule: string;
    constructorExport: string;
    constructorSignature: string;
    constructSignatures: string[];
    predicateExport: string;
    predicateSignature: string;
    heritageClosure: string[];
    moduleSha256: string;
}

interface InterfaceAuthorityRow {
    kind: "interface";
    sourceQName: string;
    targetCapabilityId: string;
    targetModule: string;
    interfaceExport: string;
    heritageClosure: string[];
    moduleSha256: string;
}

function plainRecord(value: unknown): value is { [key: string]: unknown } {
    return typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;
}

/** Validates the exact Laya bridge predicate artifact against its pinned lock and capability QName set. */
export function loadMappedRuntimeTypeAuthority(lockJson: string, authorityJson: string,
    capabilityClassQNames: readonly string[], sha256: (canonicalUtf8: string) => string): readonly RuntimeAuthoritySource[] {
    let lock: unknown; let document: unknown;
    try { lock = JSON.parse(lockJson); document = JSON.parse(authorityJson); } catch {
        throw new HardenedSemanticError("HARDENED_TYPE_AUTHORITY_JSON", "runtime predicate authority JSON is malformed");
    }
    if (!plainRecord(lock) || (lock.schema !== "bleach-as3-runtime-type-authority-lock@1"
        && lock.schema !== "as3-application-runtime-type-authority-lock@1")
        || typeof lock.predicateAuthorityCanonicalLfSha256 !== "string"
        || typeof lock.predicateAuthorityEntryCount !== "number" || !plainRecord(document)
        || !(["laya-flash-runtime-type-predicates@1", "laya-flash-runtime-type-predicates@2"].includes(document.schema as string)) || document.hashMode !== "canonical-lf-utf8"
        || !Array.isArray(document.types) || sha256(authorityJson.replace(/\r\n?/g, "\n")) !== lock.predicateAuthorityCanonicalLfSha256
        || document.types.length !== lock.predicateAuthorityEntryCount) {
        throw new HardenedSemanticError("HARDENED_TYPE_AUTHORITY_PIN", "mapped Laya runtime predicate authority does not match its exact lock");
    }
    if (!Array.isArray(capabilityClassQNames) || capabilityClassQNames.some(name => typeof name !== "string")
        || new Set(capabilityClassQNames).size !== capabilityClassQNames.length) {
        throw new HardenedSemanticError("HARDENED_TYPE_AUTHORITY_CAPABILITIES", "mapped runtime capability QName set is invalid");
    }
    const applicationProfile = lock.schema === "as3-application-runtime-type-authority-lock@1";
    const version2 = document.schema === "laya-flash-runtime-type-predicates@2";
    const rows = document.types as unknown[];
    const byName = new Map<string, PredicateAuthorityRow | InterfaceAuthorityRow>();
    rows.forEach(value => {
        const isInterface = version2 && plainRecord(value) && value.kind === "interface";
        const expectedKeys = isInterface
            ? ["kind", "sourceQName", "targetCapabilityId", "targetModule", "interfaceExport", "heritageClosure", "moduleSha256"]
            : ["sourceQName", "targetCapabilityId", "targetModule", "constructorExport",
            "constructorSignature", "constructSignatures", "predicateExport", "predicateSignature",
            "heritageClosure", "moduleSha256", ...(version2 ? ["kind", "interfaces"] : [])];
        const actualKeys = plainRecord(value) ? Object.keys(value) : [];
        const exactShape = applicationProfile || version2
            ? actualKeys.slice().sort().join("\0") === expectedKeys.slice().sort().join("\0")
            : actualKeys.join("\0") === expectedKeys.join("\0");
        if (!plainRecord(value) || !exactShape) {
            throw new HardenedSemanticError("HARDENED_TYPE_AUTHORITY_PREDICATE", "mapped runtime predicate row has drifted shape");
        }
        const row = value as unknown as PredicateAuthorityRow | InterfaceAuthorityRow;
        const names = (items: unknown): items is string[] => Array.isArray(items)
            && items.every(item => typeof item === "string" && stableName(item))
            && new Set(items).size === items.length;
        if (typeof row.sourceQName !== "string" || !stableName(row.sourceQName) || byName.has(row.sourceQName)
            || typeof row.targetCapabilityId !== "string" || !stableName(row.targetCapabilityId)
            || typeof row.targetModule !== "string" || !mappedLayaModule(row.targetModule)
            || !names(row.heritageClosure) || typeof row.moduleSha256 !== "string"
            || !/^[0-9a-f]{64}$/.test(row.moduleSha256)) {
            throw new HardenedSemanticError("HARDENED_TYPE_AUTHORITY_PREDICATE", "mapped runtime type identity is invalid");
        }
        if (row.kind === "interface") {
            if (typeof row.interfaceExport !== "string" || !identifier(row.interfaceExport))
                throw new HardenedSemanticError("HARDENED_TYPE_AUTHORITY_PREDICATE", "mapped runtime interface export is invalid");
        } else if ((version2 && row.kind !== "class") || typeof row.constructorExport !== "string"
            || !identifier(row.constructorExport) || typeof row.predicateExport !== "string" || !identifier(row.predicateExport)
            || row.constructorSignature !== `typeof ${row.constructorExport}`
            || row.predicateSignature !== `(value: unknown) => value is ${row.constructorExport}`
            || !Array.isArray(row.constructSignatures) || row.constructSignatures.length === 0
            || row.constructSignatures.some(item => typeof item !== "string" || !stableName(item))
            || (version2 && !names(row.interfaces))) {
            throw new HardenedSemanticError("HARDENED_TYPE_AUTHORITY_PREDICATE", `mapped runtime predicate ${row.sourceQName} is invalid`);
        }
        byName.set(row.sourceQName, row);
    });
    const expected = [...capabilityClassQNames].sort();
    const actual = Array.from(byName.keys()).sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new HardenedSemanticError("HARDENED_TYPE_AUTHORITY_CAPABILITIES", "mapped predicate QName set differs from authenticated capabilities");
    }
    byName.forEach(row => {
        const interfaceNames = row.kind === "interface" ? row.heritageClosure : row.interfaces ?? [];
        for (const name of interfaceNames) {
            if (byName.get(name)?.kind !== "interface" || name === row.sourceQName)
                throw new HardenedSemanticError("HARDENED_TYPE_AUTHORITY_HERITAGE", `mapped type ${row.sourceQName} has invalid interface ${name}`);
        }
        if (row.kind !== "interface") {
            const base = row.heritageClosure[0];
            if (base !== undefined) {
                const baseRow = byName.get(base);
                if (!baseRow || baseRow.kind === "interface" || row.heritageClosure.includes(row.sourceQName)
                    || JSON.stringify(row.heritageClosure.slice(1)) !== JSON.stringify(baseRow.heritageClosure))
                    throw new HardenedSemanticError("HARDENED_TYPE_AUTHORITY_HERITAGE", `mapped predicate ${row.sourceQName} has inconsistent heritage closure`);
            }
        }
    });
    const visited = new Set<string>(), active = new Set<string>();
    const visit = (name: string): void => {
        if (active.has(name)) throw new HardenedSemanticError("HARDENED_TYPE_AUTHORITY_HERITAGE", `cyclic mapped interface ${name}`);
        if (visited.has(name)) return;
        active.add(name);
        const row = byName.get(name)!;
        if (row.kind === "interface") row.heritageClosure.forEach(visit);
        active.delete(name); visited.add(name);
    };
    byName.forEach(row => visit(row.sourceQName));
    return Object.freeze(Array.from(byName.values()).map(row => row.kind === "interface"
        ? authenticatedSource({kind: "interface" as const, qname: row.sourceQName, bases: Object.freeze([...row.heritageClosure])})
        : authenticatedSource({ kind: "class" as const,
        qname: row.sourceQName, base: row.heritageClosure[0] ?? null, interfaces: Object.freeze([...(row.interfaces ?? [])]),
        sourceSha256: row.moduleSha256, definitionSafe: true as const,
        module: mappedLayaRuntimeModule(row.targetModule), constructorExport: row.constructorExport,
        predicateExport: row.predicateExport, constructionTargetExport: null, constructionProofExport: null,
        fields: Object.freeze([]), evaluationOrder: null })));

}

/** Native member names prove absence only; they never supply callable implementations. */
export function withNativeObjectMemberCensus(sources: readonly RuntimeAuthoritySource[],
    census: LoadedSourceMemberAuthority): readonly RuntimeAuthoritySource[] {
    assertAuthenticatedRuntimeAuthoritySources(sources);
    assertLoadedSourceMemberAuthority(census);
    return Object.freeze(sources.map(source => {
        if (source.kind !== "class" || source.objectTraits || source.evaluationOrder !== null) return source;
        const row=census.entriesByQName[source.qname];
        const names=new Set<string>(), visited=new Set<string>();
        let current:string | null=source.qname;
        // A shared bridge may compose a native base (DisplayObject/EventDispatcher)
        // instead of extending its JS constructor. Retain that omitted base's
        // names as unresolved, rather than pretending those members do not exist.
        while (current !== source.base && current !== "Object" && current !== null) {
            const owner:LoadedSourceMemberAuthority["entriesByQName"][string] | undefined=census.entriesByQName[current];
            if (!owner || visited.has(current))
                throw new HardenedSemanticError("HARDENED_NATIVE_OBJECT_CENSUS", `native hierarchy is incomplete or cyclic: ${source.qname}`);
            visited.add(current); owner.ownInstanceMemberNames.forEach(name=>names.add(name)); current=owner.baseQName;
        }
        if (!row || source.base !== null && current !== source.base)
            throw new HardenedSemanticError("HARDENED_NATIVE_OBJECT_CENSUS", `native hierarchy differs from the SDK census: ${source.qname}`);
        return authenticatedSource({...source, nativeObjectTraits:Object.freeze({dynamic:row.dynamic ?? null,
            names:Object.freeze([...names].sort()), sourceArtifactSha256:census.sourceArtifactSha256})});
    }));
}

/** Derives a local class row only when importing the emitted module is definition-safe. */
export function localRuntimeTypeAuthoritySource(program: SemanticProgram, moduleSpecifier: string): RuntimeAuthorityClassSource {
    assertAdaptedSemanticProgram(program);
    if (!program || program.schema !== "as3-semantic-ir@1" || program.declaration.declarationKind !== "class"
        || !program.declaration.modifiers.includes("public") || !generatedLocalModule(moduleSpecifier)) {
        throw new HardenedSemanticError("HARDENED_TYPE_AUTHORITY_LOCAL", "local runtime identity must be one public authenticated class module");
    }
    const proof = localRuntimeProofs.get(program as unknown as object);
    if (activeLocalRuntimeProof === null || proof?.transaction !== activeLocalRuntimeProof) {
        throw new HardenedSemanticError("HARDENED_TYPE_AUTHORITY_DEFINITION_CLOSURE",
            `local runtime identity ${program.declaration.name} lacks a complete definition-only import proof`);
    }
    const qname = program.packageName.length === 0 ? program.declaration.name
        : `${program.packageName}.${program.declaration.name}`;
    const fields: RuntimeAuthorityClassSource["fields"] = Object.freeze(program.declaration.members
        .filter((member): member is SemanticField => member.kind === "field"
            && !member.modifiers.includes("static") && member.implicitDefault !== "constructor-owned")
        .map(member => Object.freeze({ name: member.name,
            policy: member.implicitDefault as Exclude<SemanticField["implicitDefault"], "constructor-owned" | null> })));
    const source: RuntimeAuthorityClassSource = authenticatedSource({ kind: "class", qname,
        base: program.declaration.extendsType?.runtimeName ?? null,
        interfaces: Object.freeze(program.declaration.implementsTypes.map(item => item.runtimeName)),
        sourceSha256: program.sourceSha256, definitionSafe: true,
        module: moduleSpecifier, constructorExport: program.declaration.name, predicateExport: "isAS3ClassInstance",
        constructionTargetExport: "as3ConstructionTarget", constructionProofExport: "isAS3ConstructionProof",
        fields,
        // Dynamic class declarations remain held by the adapter. Namespace names
        // retain source identity; a name alone is not a resolved namespace URI.
        objectTraits: Object.freeze({ dynamic: false,
            members: Object.freeze(program.declaration.members.filter((member): member is Exclude<SemanticMember, {kind:"constructor"}> => member.kind !== "constructor"
                && !member.modifiers.includes("static"))
                .map(member => {
                    const type = member.kind === "field" ? member.type
                        : member.kind === "getter" ? member.returnType
                        : member.kind === "setter" ? member.parameter.type : null;
                    return Object.freeze({name: member.name,
                        kind: member.kind === "field" && member.readonly ? "const" as const : member.kind as "field" | "method" | "getter" | "setter",
                        type: type === null ? "Function" : type.runtimeName || type.sourceName,
                        visibility: member.namespaceName !== null ? "namespace" as const
                            : member.modifiers.includes("private") ? "private" as const
                            : member.modifiers.includes("protected") ? "protected" as const
                            : member.modifiers.includes("public") ? "public" as const : "internal" as const,
                        namespaceName: member.namespaceName});
                })) }),
        evaluationOrder: proof.evaluationOrder });
    localAuthoritySourceProofs.set(source as unknown as object, proof.transaction);
    return source;
}

/** Independently inspect emitted definitions before admitting deferred cinit to the authority closure. */
function assertDeferredStaticInitialization(program: SemanticProgram, ts49: RuntimeTypeScriptCompiler): void {
    if (program.declaration.declarationKind !== "class") return;
    const emitted = emitSemanticProgram(program, {compiler:ts49, expectedTypeScriptVersion:"4.9.5"});
    const source = ts49.createSourceFile(emitted.modulePath, emitted.code, ts49.ScriptTarget.Latest, true, ts49.ScriptKind.TS);
    const fields = program.declaration.members.filter((member):member is SemanticField => member.kind === "field" && member.modifiers.includes("static"));
    const embedded = new Set(fields.filter(field => field.embeddedBitmap).map(field => field.embeddedBitmap!.className));
    const scalar = (node:import("typescript-4-9").Expression):boolean => {
        if (ts49.isAsExpression(node) || ts49.isParenthesizedExpression(node)) return scalar(node.expression);
        return ts49.isNumericLiteral(node) || ts49.isStringLiteral(node) || [ts49.SyntaxKind.NullKeyword,ts49.SyntaxKind.TrueKeyword,ts49.SyntaxKind.FalseKeyword].includes(node.kind)
            || ts49.isVoidExpression(node) && ts49.isNumericLiteral(node.expression) && node.expression.text === "0"
            || ts49.isBinaryExpression(node) && node.operatorToken.kind === ts49.SyntaxKind.SlashToken
                && scalar(node.left) && ts49.isNumericLiteral(node.right) && node.right.text === "0"
            || ts49.isPrefixUnaryExpression(node) && node.operator === ts49.SyntaxKind.MinusToken && ts49.isNumericLiteral(node.operand)
            || ts49.isIdentifier(node) && embedded.has(node.text);
    };
    const declaration = source.statements.find((node):node is import("typescript-4-9").ClassDeclaration => ts49.isClassDeclaration(node)
        && node.name?.text === program.declaration.name);
    const properties = declaration?.members.filter(ts49.isPropertyDeclaration).filter(member => member.modifiers?.some(modifier=>modifier.kind===ts49.SyntaxKind.StaticKeyword)) ?? [];
    const calls = source.statements.filter(ts49.isExpressionStatement).map(statement=>statement.expression)
        .filter((node):node is import("typescript-4-9").CallExpression => ts49.isCallExpression(node)
            && ts49.isIdentifier(node.expression) && node.expression.text === "__as3DefineClassInitialization");
    const call=calls[0], callback=call?.arguments[3], slots=call?.arguments[2];
    const expected=fields.filter(field=>field.initializer!==null && !field.embeddedBitmap && !staticConstant(field.initializer,fields));
    const statements=callback && ts49.isArrowFunction(callback) && ts49.isBlock(callback.body) ? callback.body.statements : null;
    const valid = declaration && properties.length===fields.length && properties.every(property=>property.initializer && scalar(property.initializer))
        && calls.length===1 && call && call.arguments.length===4 && ts49.isIdentifier(call.arguments[0]!) && call.arguments[0]!.text===program.declaration.name
        && ts49.isIdentifier(call.arguments[1]!) && call.arguments[1]!.text==="__as3ConstructionProof"
        && slots && ts49.isArrayLiteralExpression(slots) && slots.elements.length===fields.length
        && slots.elements.every((slot,index)=>ts49.isObjectLiteralExpression(slot) && slot.properties.length===3
            && slot.properties.every(ts49.isPropertyAssignment)
            && ts49.isStringLiteral(slot.properties[0]!.initializer) && slot.properties[0]!.initializer.text===fields[index]!.name
            && scalar(slot.properties[1]!.initializer))
        && statements && statements.length===expected.length && statements.every((statement,index)=>{
            if (!ts49.isExpressionStatement(statement) || !ts49.isCallExpression(statement.expression)) return false;
            const assignment=statement.expression;
            return ts49.isIdentifier(assignment.expression) && assignment.expression.text==="__as3InitializeStaticField"
                && assignment.arguments.length===4 && ts49.isIdentifier(assignment.arguments[0]!) && assignment.arguments[0]!.text===program.declaration.name
                && ts49.isIdentifier(assignment.arguments[1]!) && assignment.arguments[1]!.text==="__as3ConstructionProof"
                && ts49.isStringLiteral(assignment.arguments[2]!) && assignment.arguments[2]!.text===expected[index]!.name;
        });
    if (!valid) throw new HardenedSemanticError("HARDENED_TYPE_AUTHORITY_STATIC_INIT",
        `local runtime identity ${program.declaration.name} lacks a definition-only static initializer proof`);
}

/** Generated Embed classes derive solely from admitted metadata and the mapped Bitmap authority. */
export function localRuntimeEmbeddedAuthoritySources(program: SemanticProgram, moduleSpecifier: string): readonly RuntimeAuthorityClassSource[] {
    localRuntimeTypeAuthoritySource(program, moduleSpecifier);
    if (program.declaration.declarationKind !== "class") return [];
    const proof = localRuntimeProofs.get(program as unknown as object)!;
    return program.declaration.members.filter((member): member is SemanticField => member.kind === "field" && !!member.embeddedBitmap)
        .map(field => {
            const asset = field.embeddedBitmap!;
            const source = authenticatedSource<RuntimeAuthorityClassSource>({kind: "class",
                qname: (program.packageName ? program.packageName + "." : "") + program.declaration.name + "_" + field.name,
                base: "flash.display.Bitmap", interfaces: [], sourceSha256: program.sourceSha256, definitionSafe: true,
                module: moduleSpecifier, constructorExport: asset.className, predicateExport: asset.className + "Predicate",
                constructionTargetExport: null, constructionProofExport: null, fields: [], evaluationOrder: proof.evaluationOrder});
            localAuthoritySourceProofs.set(source as unknown as object, proof.transaction);
            compilerEmbeddedSources.add(source);
            return source;
        });
}

function localImportPath(program: SemanticProgram, targetModule: string): string {
    if (targetModule.length === 0 || targetModule.startsWith("/") || targetModule.includes("\\")
        || /[\u0000-\u001f\u007f]/.test(targetModule)) {
        throw new HardenedSemanticError("HARDENED_TYPE_AUTHORITY_DEFINITION_CLOSURE",
            `local runtime identity ${program.declaration.name} has an invalid import path`);
    }
    const segments = program.outputModulePath.split("/");
    segments.pop();
    for (const segment of targetModule.split("/")) {
        if (segment.length === 0 || segment === ".") continue;
        if (segment === "..") {
            if (segments.length === 0) {
                throw new HardenedSemanticError("HARDENED_TYPE_AUTHORITY_DEFINITION_CLOSURE",
                    `local runtime identity ${program.declaration.name} imports outside the application root`);
            }
            segments.pop();
        } else {
            segments.push(segment);
        }
    }
    const resolved = segments.join("/");
    return resolved.endsWith(".ts") ? resolved : `${resolved}.ts`;
}

/**
 * Proves, as one immutable transaction, that eagerly importing every local class
 * needed by the central authority cannot evaluate an application singleton or
 * execute an application constructor before the authority seals.
 */
function emittedRuntimeLocalModules(program: SemanticProgram, ts49: RuntimeTypeScriptCompiler): readonly string[] {
    const emitted = emitSemanticProgram(program, { compiler: ts49, expectedTypeScriptVersion: "4.9.5" });
    const result = ts49.transpileModule(emitted.code, { fileName: emitted.modulePath, reportDiagnostics: true,
        compilerOptions: { target: ts49.ScriptTarget.ES2020, module: ts49.ModuleKind.CommonJS,
            importsNotUsedAsValues: ts49.ImportsNotUsedAsValues.Remove } });
    if ((result.diagnostics || []).some(item => item.category === ts49.DiagnosticCategory.Error)) {
        throw new HardenedSemanticError("HARDENED_TYPE_AUTHORITY_DEFINITION_CLOSURE",
            `runtime dependency proof failed to compile ${program.outputModulePath}`);
    }
    const targets = new Map(program.imports.filter(item => item.authorityKind === "local"
        && !item.compileTimeNamespace).map(item => [item.targetModule, localImportPath(program, item.targetModule)]));
    const source = ts49.createSourceFile(emitted.modulePath.slice(0, -3) + ".js", result.outputText,
        ts49.ScriptTarget.ES2020, false, ts49.ScriptKind.JS);
    const recognized = new Set<import("typescript-4-9").CallExpression>();
    const modules: string[] = [];
    const seen = new Set<string>();
    source.statements.forEach(statement => {
        if (!ts49.isVariableStatement(statement)) return;
        statement.declarationList.declarations.forEach(declaration => {
            const initializer = declaration.initializer;
            if (!initializer || !ts49.isCallExpression(initializer) || !ts49.isIdentifier(initializer.expression)
                || initializer.expression.text !== "require" || initializer.arguments.length !== 1
                || !ts49.isStringLiteral(initializer.arguments[0]!)) return;
            recognized.add(initializer);
            const specifier = initializer.arguments[0]!.text;
            const target = targets.get(specifier);
            if (target === undefined && specifier.startsWith(".")) {
                throw new HardenedSemanticError("HARDENED_TYPE_AUTHORITY_DEFINITION_CLOSURE",
                    `emitted runtime dependency is not an authenticated local import: ${specifier}`);
            }
            if (target !== undefined && !seen.has(target)) { seen.add(target); modules.push(target); }
        });
    });
    const inspect = (node: import("typescript-4-9").Node): void => {
        if (ts49.isCallExpression(node) && ts49.isIdentifier(node.expression) && node.expression.text === "require"
            && node.arguments.length === 1 && ts49.isStringLiteral(node.arguments[0]!)
            && node.arguments[0]!.text.startsWith(".") && !recognized.has(node)) {
            throw new HardenedSemanticError("HARDENED_TYPE_AUTHORITY_DEFINITION_CLOSURE",
                `relative require is outside the compiler-authenticated top-level import shape in ${program.outputModulePath}`);
        }
        ts49.forEachChild(node, inspect);
    };
    inspect(source);
    return Object.freeze(modules);
}

export function assertLocalRuntimeDefinitionClosure(programs: readonly SemanticProgram[],
    ts49: RuntimeTypeScriptCompiler): void {
    activeLocalRuntimeProof = null;
    if (!Array.isArray(programs) || !ts49 || ts49.version !== "4.9.5") {
        throw new HardenedSemanticError("HARDENED_TYPE_AUTHORITY_DEFINITION_CLOSURE",
            "local runtime definition closure requires the complete emitted program set and exact TypeScript 4.9.5 compiler");
    }
    const byModule = new Map<string, SemanticProgram>();
    programs.forEach(program => {
        assertAdaptedSemanticProgram(program);
        if (!emittedApplicationModule(program.outputModulePath) || byModule.has(program.outputModulePath)) {
            throw new HardenedSemanticError("HARDENED_TYPE_AUTHORITY_DEFINITION_CLOSURE",
                "local runtime definition closure has an invalid or duplicate emitted module identity");
        }
        byModule.set(program.outputModulePath, program);
    });
    const definitions = programs.filter(program => program.declaration.declarationKind !== "packageField");
    const authorities = definitions.filter(program => program.declaration.declarationKind === "class" || program.declaration.declarationKind === "packageFunction")
        .sort((left, right) => left.outputModulePath.localeCompare(right.outputModulePath, "en"));
    authorities.forEach(program => {
        assertDeferredStaticInitialization(program, ts49);
    });
    const runtimeModules = new Map<SemanticProgram, readonly string[]>();
    definitions.forEach(program => runtimeModules.set(program, emittedRuntimeLocalModules(program, ts49)));
    definitions.filter(program => program.declaration.declarationKind === "interface").forEach(program => {
        if ((runtimeModules.get(program) ?? []).length !== 0) {
            throw new HardenedSemanticError("HARDENED_TYPE_AUTHORITY_DEFINITION_CLOSURE",
                `local interface ${program.outputModulePath} emitted a forbidden runtime dependency`);
        }
    });
    const byQName = new Map<string, SemanticProgram>();
    definitions.forEach(program => {
        const qname = program.packageName.length === 0 ? program.declaration.name
            : `${program.packageName}.${program.declaration.name}`;
        if (byQName.has(qname)) {
            throw new HardenedSemanticError("HARDENED_TYPE_AUTHORITY_DEFINITION_CLOSURE",
                `duplicate local runtime identity ${qname} prevents a deterministic evaluation proof`);
        }
        byQName.set(qname, program);
    });
    const edges = new Map<SemanticProgram, SemanticProgram[]>();
    authorities.forEach(program => {
        const authenticatedImports = new Set<string>();
        for (const imported of program.imports) {
            if (imported.authorityKind !== "local" || imported.compileTimeNamespace) continue;
            const targetPath = localImportPath(program, imported.targetModule);
            const target = byModule.get(targetPath);
            if (!target) {
                throw new HardenedSemanticError("HARDENED_TYPE_AUTHORITY_DEFINITION_CLOSURE",
                    `local runtime identity ${program.declaration.name} imports missing module ${targetPath}`);
            }
            if ((imported.localValueType !== null) !== (target.declaration.declarationKind === "packageField" || target.declaration.declarationKind === "packageFunction")
                || (imported.localFunction === true) !== (target.declaration.declarationKind === "packageFunction")) {
                throw new HardenedSemanticError("HARDENED_TYPE_AUTHORITY_DEFINITION_CLOSURE",
                    `local runtime import ${targetPath} disagrees with its authenticated declaration kind`);
            }
            authenticatedImports.add(targetPath);
        }
        const dependencies: SemanticProgram[] = [];
        const seenDependencies = new Set<string>();
        for (const targetPath of runtimeModules.get(program) ?? []) {
            if (!authenticatedImports.has(targetPath) || seenDependencies.has(targetPath)) {
                throw new HardenedSemanticError("HARDENED_TYPE_AUTHORITY_DEFINITION_CLOSURE",
                    `emitted runtime dependency ${targetPath} is missing, duplicate, or unauthenticated`);
            }
            seenDependencies.add(targetPath);
            const target = byModule.get(targetPath)!;
            if (target.declaration.declarationKind === "packageField") {
                throw new HardenedSemanticError("HARDENED_TYPE_AUTHORITY_DEFINITION_CLOSURE",
                    `local runtime identity ${program.declaration.name} imports package singleton ${targetPath} before authority seal`);
            }
            if (target.declaration.declarationKind !== "class" && target.declaration.declarationKind !== "packageFunction") {
                throw new HardenedSemanticError("HARDENED_TYPE_AUTHORITY_DEFINITION_CLOSURE",
                    `local runtime identity ${program.declaration.name} emitted a forbidden interface dependency ${targetPath}`);
            }
            dependencies.push(target);
        }
        edges.set(program, dependencies);
    });
    let nextIndex = 0;
    const indices = new Map<SemanticProgram, number>();
    const low = new Map<SemanticProgram, number>();
    const stack: SemanticProgram[] = [];
    const onStack = new Set<SemanticProgram>();
    const components: SemanticProgram[][] = [];
    const connect = (program: SemanticProgram): void => {
        indices.set(program, nextIndex); low.set(program, nextIndex); nextIndex += 1;
        stack.push(program); onStack.add(program);
        for (const target of edges.get(program) ?? []) {
            if (!indices.has(target)) { connect(target); low.set(program, Math.min(low.get(program)!, low.get(target)!)); }
            else if (onStack.has(target)) low.set(program, Math.min(low.get(program)!, indices.get(target)!));
        }
        if (low.get(program) === indices.get(program)) {
            const component: SemanticProgram[] = [];
            let item: SemanticProgram;
            do { item = stack.pop()!; onStack.delete(item); component.push(item); } while (item !== program);
            components.push(component);
        }
    };
    authorities.forEach(program => { if (!indices.has(program)) connect(program); });
    const componentByProgram = new Map<SemanticProgram, number>();
    components.forEach((component, index) => component.forEach(program => componentByProgram.set(program, index)));
    const componentDependencies = components.map(() => new Set<number>());
    edges.forEach((targets, program) => targets.forEach(target => {
        const from = componentByProgram.get(program)!; const to = componentByProgram.get(target)!;
        if (from !== to) componentDependencies[from]!.add(to);
    }));
    const orderedComponents: number[] = []; const componentState = new Set<number>();
    const orderComponent = (index: number): void => {
        if (componentState.has(index)) return;
        componentState.add(index);
        [...componentDependencies[index]!].sort((left, right) => left - right).forEach(orderComponent);
        orderedComponents.push(index);
    };
    components.forEach((_component, index) => orderComponent(index));
    const evaluation: SemanticProgram[] = [];
    orderedComponents.forEach(componentIndex => {
        const component = components[componentIndex]!;
        const members = new Set(component);
        const candidates = [...component].sort((left, right) => left.outputModulePath.localeCompare(right.outputModulePath, "en"));
        // The authority loader starts with classes. A function-only safe root
        // cannot prove the evaluation order of a mixed component it never loads first.
        const roots=candidates.some(program=>program.declaration.declarationKind === "class")
            ? candidates.filter(program=>program.declaration.declarationKind === "class") : candidates;
        const safeRoot = roots.find(root => {
            const state = new Map<SemanticProgram, "evaluating" | "complete">();
            let safe = true;
            const execute = (program: SemanticProgram): void => {
                if (!safe || state.get(program) === "complete" || state.get(program) === "evaluating") return;
                state.set(program, "evaluating");
                for (const target of edges.get(program) ?? []) if (members.has(target)) execute(target);
                if (program.declaration.declarationKind === "class" && program.declaration.extendsType?.runtimeName) {
                    const base = byQName.get(program.declaration.extendsType.runtimeName);
                    if (base && members.has(base) && state.get(base) !== "complete") safe = false;
                }
                if (safe) state.set(program, "complete");
            };
            execute(root);
            return safe && component.every(program => state.get(program) === "complete");
        });
        if (!safeRoot) {
            throw new HardenedSemanticError("HARDENED_TYPE_AUTHORITY_DEFINITION_CLOSURE",
                `local runtime import component has no safe CommonJS evaluation root: ${candidates.map(item => item.outputModulePath).join(",")}`);
        }
        evaluation.push(safeRoot, ...candidates.filter(program => program !== safeRoot));
    });
    const transaction = Symbol("local-runtime-definition-proof");
    evaluation.forEach((program, index) => localRuntimeProofs.set(program as unknown as object,
        Object.freeze({ transaction, evaluationOrder: index })));
    activeLocalRuntimeProof = transaction;
}

export interface EmittedRuntimeApplicationEntry {
    readonly path: "ApplicationEntry.generated.ts";
    readonly code: string;
    readonly sha256: string;
}

/** Derives one interface identity from an authenticated, side-effect-free semantic declaration. */
export function localRuntimeInterfaceAuthoritySource(program: SemanticProgram): RuntimeAuthorityInterfaceSource {
    assertAdaptedSemanticProgram(program);
    if (!program || program.schema !== "as3-semantic-ir@1" || program.declaration.declarationKind !== "interface"
        || !program.declaration.modifiers.includes("public")
        || program.declaration.members.some(member => member.kind === "field" || member.kind === "constructor")
        || program.declaration.interfaceExtendsTypes.some(item => item.runtimeName === null)) {
        throw new HardenedSemanticError("HARDENED_TYPE_AUTHORITY_LOCAL", "local runtime interface identity must be one public authenticated definition-only declaration");
    }
    const qname = program.packageName.length === 0 ? program.declaration.name
        : `${program.packageName}.${program.declaration.name}`;
    return authenticatedSource({ kind: "interface", qname,
        bases: Object.freeze(program.declaration.interfaceExtendsTypes.map(item => item.runtimeName as string)) });
}

function stableName(value: string): boolean {
    return value.length > 0 && value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value);
}

function generatedLocalModule(value: string): boolean {
    return /^(?:\.\.?\/)(?:[A-Za-z0-9_$.-]+\/)*[A-Za-z0-9_$.-]+$/.test(value)
        && value.split("/").every((segment, index) => index === 0 || (segment !== "." && segment !== ".."));
}

function mappedLayaModule(value: string): boolean {
    return /^src\/layaAir\/flash\/(?:[A-Za-z][A-Za-z0-9]*\/)*[A-Za-z_$][A-Za-z0-9_$]*\.ts$/.test(value);
}

function mappedLayaRuntimeModule(value: string): string {
    return `laya/flash/${value.slice("src/layaAir/flash/".length, -3)}`;
}

function runtimeAuthorityModule(value: string): boolean {
    return generatedLocalModule(value)
        || /^laya\/flash\/(?:[A-Za-z][A-Za-z0-9]*\/)*[A-Za-z_$][A-Za-z0-9_$]*$/.test(value);
}

function emittedApplicationModule(value: string): boolean {
    return /^(?:[A-Za-z0-9_$.-]+\/)*[A-Za-z0-9_$.-]+\.ts$/.test(value)
        && value.split("/").every(segment => segment !== "." && segment !== "..")
        && value !== "ApplicationEntry.generated.ts" && value !== "AS3Authority.generated.ts";
}

function identifier(value: string): boolean {
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value);
}

function quote(value: string): string {
    return JSON.stringify(value);
}

function sourceMetadata(entry: RuntimeAuthoritySource): object {
    return entry.kind === "interface"
        ? { kind: entry.kind, qname: entry.qname, bases: entry.bases }
        : { kind: entry.kind, qname: entry.qname, base: entry.base, interfaces: entry.interfaces,
            sourceSha256: entry.sourceSha256, fields: entry.fields, ...(entry.objectTraits ? {objectTraits:entry.objectTraits} : {}), ...(entry.nativeObjectTraits ? {nativeObjectTraits:entry.nativeObjectTraits} : {}) };
}

function canonicalMetadata(entries: readonly RuntimeAuthoritySource[]): string {
    return JSON.stringify({ schema: "as3-runtime-type-authority@1", qnames: entries.map(item => item.qname),
        entries: entries.map(sourceMetadata) });
}

/**
 * Emits the only module permitted to invoke the package-internal registrar.
 * Inputs must already be derived from pinned local declarations and mapped
 * bridge capabilities; this layer revalidates exact identity and dependency
 * closure and produces one immutable, hash-pinned installation transaction.
 */
export function emitRuntimeTypeAuthority(sources: readonly RuntimeAuthoritySource[],
    sha256: (canonicalUtf8: string) => string): EmittedRuntimeAuthority {
    if (!Array.isArray(sources) || typeof sha256 !== "function") {
        throw new HardenedSemanticError("HARDENED_TYPE_AUTHORITY_INPUT", "runtime type authority requires a source list and SHA-256 function");
    }
    assertAuthenticatedRuntimeAuthoritySources(sources);
    const byName = new Map<string, RuntimeAuthoritySource>();
    sources.forEach(source => {
        if (!stableName(source.qname) || byName.has(source.qname)) {
            throw new HardenedSemanticError("HARDENED_TYPE_AUTHORITY_IDENTITY", "runtime type authority has an invalid or duplicate QName");
        }
        const dependencies = source.kind === "interface" ? source.bases
            : (source.base === null ? source.interfaces : [source.base, ...source.interfaces]);
        if (!Array.isArray(dependencies) || dependencies.some(name => !stableName(name))
            || new Set(dependencies).size !== dependencies.length) {
            throw new HardenedSemanticError("HARDENED_TYPE_AUTHORITY_DEPENDENCY", `runtime identity ${source.qname} has invalid dependency identities`);
        }
        if (source.kind === "class" && (!runtimeAuthorityModule(source.module) || !identifier(source.constructorExport)
            || !identifier(source.predicateExport)
            || (source.evaluationOrder === null || compilerEmbeddedSources.has(source)
                ? source.constructionTargetExport !== null || source.constructionProofExport !== null
                : source.constructionTargetExport !== "as3ConstructionTarget"
                    || source.constructionProofExport !== "isAS3ConstructionProof")
            || !Array.isArray(source.fields) || source.fields.some((field: RuntimeAuthorityClassSource["fields"][number]) => !field || typeof field !== "object"
                || Object.keys(field).join("\0") !== "name\0policy" || !identifier(field.name)
                || !["zero", "nan", "false", "null", "undefined"].includes(field.policy))
            || new Set(source.fields.map((field: RuntimeAuthorityClassSource["fields"][number]) => field.name)).size !== source.fields.length
            || source.definitionSafe !== true
            || (source.evaluationOrder !== null && (!Number.isSafeInteger(source.evaluationOrder) || source.evaluationOrder < 0))
            || !/^[0-9a-f]{64}$/.test(source.sourceSha256))) {
            throw new HardenedSemanticError("HARDENED_TYPE_AUTHORITY_IMPORT", `runtime class ${source.qname} has an invalid pinned import`);
        }
        if (source.kind === "class" && source.evaluationOrder !== null
            && (activeLocalRuntimeProof === null || localAuthoritySourceProofs.get(source as unknown as object) !== activeLocalRuntimeProof)) {
            throw new HardenedSemanticError("HARDENED_TYPE_AUTHORITY_DEFINITION_CLOSURE",
                `runtime class ${source.qname} belongs to a stale definition-evaluation proof`);
        }
        byName.set(source.qname, source);
    });
    const remaining = new Map(byName);
    const ordered: RuntimeAuthoritySource[] = [];
    const admitted = new Set<string>();
    while (remaining.size > 0) {
        const ready = Array.from(remaining.values()).filter(source => {
            const dependencies = source.kind === "interface" ? source.bases
                : (source.base === null ? source.interfaces : [source.base, ...source.interfaces]);
            return dependencies.every(name => admitted.has(name));
        }).sort((left, right) => left.qname.localeCompare(right.qname, "en"));
        if (ready.length === 0) {
            const missing = Array.from(remaining.values()).flatMap(source => source.kind === "interface" ? source.bases
                : (source.base === null ? source.interfaces : [source.base, ...source.interfaces]))
                .find(name => !byName.has(name));
            throw new HardenedSemanticError("HARDENED_TYPE_AUTHORITY_CLOSURE", missing
                ? `runtime type authority is missing dependency ${missing}`
                : "runtime type authority contains a cyclic identity closure");
        }
        ready.forEach(source => { ordered.push(source); admitted.add(source.qname); remaining.delete(source.qname); });
    }
    const metadata = canonicalMetadata(ordered);
    const digest = sha256(metadata);
    if (!/^[0-9a-f]{64}$/.test(digest)) {
        throw new HardenedSemanticError("HARDENED_TYPE_AUTHORITY_HASH", "runtime type authority SHA-256 function returned a non-canonical digest");
    }
    const classes = ordered.filter((source): source is RuntimeAuthorityClassSource => source.kind === "class");
    const importOrder = [...classes].sort((left, right) => left.evaluationOrder === null && right.evaluationOrder === null
        ? left.qname.localeCompare(right.qname, "en") : left.evaluationOrder === null ? -1 : right.evaluationOrder === null ? 1
            : left.evaluationOrder - right.evaluationOrder);
    const importIndex = new Map(importOrder.map((source, index) => [source, index]));
    const imports = importOrder.map((source, index) => {
        const local = source.constructionTargetExport === null ? ""
            : `, ${source.constructionTargetExport} as __as3ConstructionTarget${index}, ${source.constructionProofExport!} as __as3ConstructionProof${index}`;
        return `import { ${source.constructorExport} as __as3Class${index}, ${source.predicateExport} as __as3Predicate${index}${local} } from ${quote(source.module)};`;
    });
    const entries = ordered.map(source => {
        if (source.kind === "interface") {
            return `    { kind: "interface", qname: ${quote(source.qname)}, bases: ${JSON.stringify(source.bases)} },`;
        }
        const index = importIndex.get(source)!;
        return `    { kind: "class", qname: ${quote(source.qname)}, base: ${source.base === null ? "null" : quote(source.base)}, interfaces: ${JSON.stringify(source.interfaces)}, sourceSha256: ${quote(source.sourceSha256)}, fields: ${JSON.stringify(source.fields)}, ${source.objectTraits ? `objectTraits: ${JSON.stringify(source.objectTraits)}, ` : ""}${source.nativeObjectTraits ? `nativeObjectTraits: ${JSON.stringify(source.nativeObjectTraits)}, ` : ""}constructor: __as3Class${index}, predicate: __as3Predicate${index}, constructionTarget: ${source.constructionTargetExport === null ? "null" : `__as3ConstructionTarget${index}`}, constructionProof: ${source.constructionProofExport === null ? "null" : `__as3ConstructionProof${index}`} },`;
    });
    const qnames = ordered.map(source => source.qname);
    const code = [
        "// Generated from authenticated local declarations and mapped Laya capabilities. Do not edit.",
        "import { installAS3TypeAuthority } from \"./internal/AS3TypeRegistry\";",
        ...imports,
        "",
        `export const AS3_TYPE_AUTHORITY_SHA256 = ${quote(digest)};`,
        `export const AS3_TYPE_AUTHORITY_QNAMES = Object.freeze(${JSON.stringify(qnames)} as const);`,
        "const entries = [",
        ...entries,
        "] as const;",
        "installAS3TypeAuthority({ schema: \"as3-runtime-type-authority@1\", sha256: AS3_TYPE_AUTHORITY_SHA256,",
        "    qnames: AS3_TYPE_AUTHORITY_QNAMES, entries });",
        "",
    ].join("\n");
    return Object.freeze({ schema: "as3-runtime-type-authority-source@1", sha256: digest,
        qnames: Object.freeze(qnames), code });
}


/** Emits the sole application entry; authority installation completes before any application module evaluates. */
export function emitRuntimeApplicationEntry(modulePaths: readonly string[],
    sha256: (canonicalUtf8: string) => string): EmittedRuntimeApplicationEntry {
    if (!Array.isArray(modulePaths) || typeof sha256 !== "function"
        || modulePaths.some(path => typeof path !== "string" || !emittedApplicationModule(path))
        || new Set(modulePaths).size !== modulePaths.length) {
        throw new HardenedSemanticError("HARDENED_TYPE_AUTHORITY_ENTRY", "runtime application entry requires unique portable emitted TypeScript modules");
    }
    const ordered = [...modulePaths].sort((left, right) => left.localeCompare(right, "en"));
    const imports = ordered.map((path, index) => `import * as __as3Application${index} from ${quote(`./${path.slice(0, -3)}`)};`);
    const code = [
        "// Generated authority-first application entry. Do not edit or bypass.",
        "import { AS3_TYPE_AUTHORITY_SHA256 as __as3TypeAuthoritySha256 } from \"./AS3Authority.generated\";",
        ...imports,
        "",
        "export const AS3_APPLICATION_TYPE_AUTHORITY_SHA256 = __as3TypeAuthoritySha256;",
        `export const AS3_APPLICATION_MODULES = Object.freeze([${ordered.map((_, index) => `__as3Application${index}`).join(", ")}]);`,
        "",
    ].join("\n");
    const digest = sha256(code);
    if (!/^[0-9a-f]{64}$/.test(digest)) {
        throw new HardenedSemanticError("HARDENED_TYPE_AUTHORITY_HASH", "runtime application entry SHA-256 function returned a non-canonical digest");
    }
    return Object.freeze({ path: "ApplicationEntry.generated.ts", code, sha256: digest });
}
