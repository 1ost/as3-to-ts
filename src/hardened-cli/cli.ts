import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { join, posix, resolve } from "node:path";
import ts49 = require("typescript-4-9");
import { CliError, errorMessage } from "./errors";
import { discoverInputs, portableCollisionKey, readInput } from "./inputs";
import { assertParserWorkerSha256, captureParserWorkerSha256, parseIsolated } from "./isolated-parser";
import { HELP, parseArguments, TOOL_VERSION } from "./options";
import { loadTranspileAuthority } from "./authority";
import { adaptNormalizedParserAst } from "../hardened/adapter";
import type { NormalizedParserAst, SemanticProgram } from "../hardened/contracts";
import { emitSemanticProgram } from "../hardened/emitter";
import { assertLocalRuntimeDefinitionClosure, emitRuntimeApplicationEntry, emitRuntimeTypeAuthority, localRuntimeInterfaceAuthoritySource,
    localRuntimeTypeAuthoritySource, type EmittedRuntimeApplicationEntry,
    type EmittedRuntimeAuthority, type RuntimeAuthoritySource } from "../hardened/type-authority";
import {
    abandon,
    preparePublication,
    publish,
    type Publication,
    writeArtifact,
} from "./publication";

interface Io {
    stdout: Pick<NodeJS.WriteStream, "write">;
    stderr: Pick<NodeJS.WriteStream, "write">;
}

interface ManifestFile {
    sourcePath: string;
    astPath: string;
    sourceBytes: number;
    sourceSha256: string;
    astBytes: number;
    astSha256: string;
}

interface TranspiledManifestFile {
    sourcePath: string;
    typescriptPath: string;
    sourceBytes: number;
    sourceSha256: string;
    normalizedAstSha256: string;
    normalizedFingerprintSha256: string;
    typescriptBytes: number;
    typescriptSha256: string;
}

interface QualificationFile {
    sourcePath: string;
    sourceBytes: number;
    sourceSha256: string;
    status: "admitted" | "held";
    stage: "parse" | "normalize" | "semantic" | "emit" | "output" | null;
    code: string | null;
    message: string | null;
    modulePath: string | null;
    normalizedFingerprintSha256: string | null;
    typescriptSha256: string | null;
}

function sha256(data: string | Buffer): string {
    return createHash("sha256").update(data).digest("hex");
}

const RUNTIME_SOURCE_SHA256: Readonly<Record<string, string>> = Object.freeze({
    "AS3Array.ts": "6ba7fdddada9093f14a2aa52d044834a366a3ca3a7c6db261949b74d0a6d52dc",
    "AS3BigTurnTableInnerDto.ts": "f7ba5db782eac244b8d4a626afc363081cd510855e818b17ec54a172772b6b91",
    "AS3ByteArray.ts": "f6e206784fcab50b8af57d0fb5acdf50696aeef8527ff2e58709c0f06f15bc30",
    "AS3Coerce.ts": "91549a34ee875997da35e837ad4213bb089a771c8ee67efcecf50670adbed99b",
    "AS3Dictionary.ts": "307af295f7cd3e7c6f32423b799ab8920fb1f84e254181256a5673dfffd45814",
    "AS3MethodClosure.ts": "05329f4fa2a7034f49ab70ed87311350e71e997dca7976f8f7a44b364ca3dd9a",
    "AS3OwnRecord.ts": "932476a585d576b385b1d402fa9fba851125c2796904aaf733da267b5bcf736e",
    "AS3Timer.ts": "639a0e3776611b3fd736305994d709b47af8465509bb9d2de440bc611a985851",
    "AS3Type.ts": "6389bd794913de410607f2bcdc91c485a309a8bdfdea7b9c783ea705734fdd73",
    "AS3Vector.ts": "5deedf01b46703ae7ae0d0f98ed6cfa680a39496ddd6ab747ee48c3bb5ec1101",
    "internal/AS3TypeRegistry.ts": "35a524b9a65fe9c83e6f530c58e33b898090500b7af68046dd765b96d5f2276e",
    "internal/AS3TimerRuntime.ts": "3204d4ee73defe74f71fd43f1e146f4ef21ee80784ba585ff52698c97f90285e",
});

function runtimeCommonJs(code: string, fileName: string): string {
    const result = ts49.transpileModule(code, { fileName, reportDiagnostics: true, compilerOptions: {
        target: ts49.ScriptTarget.ES2020, module: ts49.ModuleKind.CommonJS,
        importsNotUsedAsValues: ts49.ImportsNotUsedAsValues.Remove,
    } });
    if ((result.diagnostics || []).some(item => item.category === ts49.DiagnosticCategory.Error)) {
        throw new CliError(`runtime package transpilation failed for ${fileName}`, 70);
    }
    return result.outputText.replace(/\r\n?/g, "\n");
}

function runtimeEmbeddedCommonJs(code: string, fileName: string): string {
    return runtimeCommonJs(code, fileName).replace(
        /^Object\.defineProperty\(exports, "__esModule", \{ value: true \}\);\n/m, "");
}

function runtimeBundleJavaScript(authorityCode: string): string {
    const modules = new Map<string, string>();
    runtimeSourceTemplates().forEach(template => {
        const moduleId = template.path.slice(0, -3) + ".js";
        modules.set(moduleId, runtimeEmbeddedCommonJs(template.code, template.path));
    });
    modules.set("AS3Authority.generated.js",
        runtimeEmbeddedCommonJs(authorityCode, "AS3Authority.generated.ts"));
    const resolveEmbedded = (from: string, specifier: string): string | null => {
        if (!specifier.startsWith(".")) return modules.has(specifier) ? specifier : null;
        const candidate = posix.normalize(posix.join(posix.dirname(from), specifier));
        for (const value of [candidate, `${candidate}.js`, posix.join(candidate, "index.js")]) {
            if (modules.has(value)) return value;
        }
        return null;
    };
    const externalByRequest = new Map<string, { variable: string; specifier: string }>();
    const requirePattern = /\brequire\((['"])([^'"\r\n]+)\1\)/g;
    modules.forEach((code, from) => {
        let match: RegExpExecArray | null;
        while ((match = requirePattern.exec(code)) !== null) {
            const requested = match[2]!;
            if (resolveEmbedded(from, requested) !== null) continue;
            const key = `${from}\u0000${requested}`;
            if (externalByRequest.has(key)) continue;
            const target = requested.startsWith(".")
                ? `./${posix.normalize(posix.join(posix.dirname(from), requested))}` : requested;
            externalByRequest.set(key, { variable: `__as3External${externalByRequest.size}`, specifier: target });
        }
    });
    const lines = ["\"use strict\";"];
    externalByRequest.forEach(item => {
        lines.push(`function ${item.variable}() { return require(${JSON.stringify(item.specifier)}); }`);
    });
    lines.push("const __as3Modules = { __proto__: null,");
    [...modules.entries()].sort(([left], [right]) => left.localeCompare(right)).forEach(([id, code]) => {
        lines.push(`${JSON.stringify(id)}: function(module, exports, require) {\n${code}\n},`);
    });
    lines.push("};", "const __as3Cache = { __proto__: null };");
    lines.push("function __as3Resolve(from, requested) {",
        "  if (requested.charAt(0) !== '.') return __as3Modules[requested] === undefined ? null : requested;",
        "  const base = from.split('/'); base.pop();",
        "  for (const part of requested.split('/')) { if (part === '.' || part === '') continue; if (part === '..') base.pop(); else base.push(part); }",
        "  const candidate = base.join('/');",
        "  for (const value of [candidate, candidate + '.js', candidate + '/index.js']) if (__as3Modules[value] !== undefined) return value;",
        "  return null;",
        "}");
    lines.push("function __as3Load(id) {",
        "  if (__as3Cache[id] !== undefined) return __as3Cache[id].exports;",
        "  const factory = __as3Modules[id]; if (!factory) throw new Error('missing embedded AS3 runtime module: ' + id);",
        "  const module = { exports: { __proto__: null } }; __as3Cache[id] = module;",
        "  factory(module, module.exports, function(requested) {",
        "    const embedded = __as3Resolve(id, requested); if (embedded !== null) return __as3Load(embedded);",
        "    const key = id + '\\u0000' + requested;",
        "    switch (key) {");
    externalByRequest.forEach((item, key) => {
        lines.push(`      case ${JSON.stringify(key)}: return ${item.variable}();`);
    });
    lines.push("      default: throw new Error('unauthorized AS3 runtime dependency: ' + requested);",
        "    }",
        "  });",
        "  return module.exports;",
        "}");
    lines.push("const __as3Public = module.exports;", "Object.setPrototypeOf(__as3Public, null);",
        "function __as3Expose(source) { for (const key in source) {",
        "  if (Object.prototype.hasOwnProperty.call(__as3Public, key)) throw new Error('duplicate AS3 runtime public export: ' + key);",
        "  Object.defineProperty(__as3Public, key, { value: source[key], enumerable: true, writable: false, configurable: false });",
        "} }");
    Object.keys(RUNTIME_SOURCE_SHA256).filter(path => !path.startsWith("internal/")).sort().forEach(path => {
        lines.push(`__as3Expose(__as3Load(${JSON.stringify(path.slice(0, -3) + ".js")}));`);
    });
    lines.push("__as3Expose(__as3Load('AS3Authority.generated.js'));", "Object.freeze(__as3Public);", "");
    return lines.join("\n");
}

function runtimeSourceTemplates(): ReadonlyArray<{ path: string; code: string }> {
    const root = resolve(join(__dirname, "..", "src", "hardened-runtime"));
    return Object.keys(RUNTIME_SOURCE_SHA256).sort().map(path => {
        const code = readFileSync(join(root, ...path.split("/")), "utf8").replace(/\r\n?/g, "\n");
        if (sha256(code) !== RUNTIME_SOURCE_SHA256[path]) {
            throw new CliError(`runtime package source drifted: ${path}`, 6);
        }
        return Object.freeze({ path, code });
    });
}

function runtimePackageJson(): string {
    const entries = ["AS3Array", "AS3BigTurnTableInnerDto", "AS3ByteArray", "AS3Coerce", "AS3Dictionary",
        "AS3MethodClosure", "AS3OwnRecord", "AS3Timer", "AS3Type", "AS3Vector"];
    const exports: Record<string, string> = Object.create(null) as Record<string, string>;
    entries.forEach(name => { exports[`./${name}`] = name === "AS3Timer"
        ? "./AS3Timer.js" : "./AS3Authority.generated.js"; });
    exports["./AS3Authority"] = "./AS3Authority.generated.js";
    exports["./ApplicationEntry"] = "./ApplicationEntry.generated.js";
    return `${JSON.stringify({ name: "@bleach/as3-runtime", version: "0.1.0", private: true,
        type: "commonjs", exports, files: ["AS3Authority.generated.js", "AS3Timer.js", "ApplicationEntry.generated.js",
            "application/**/*.js"] }, null, 2)}\n`;
}

function runtimeTimerFacadeJavaScript(): string {
    return [
        '"use strict";',
        'const runtime = require("./AS3Authority.generated.js");',
        "Object.setPrototypeOf(module.exports, null);",
        "for (const key of [\"clearInterval\", \"clearTimeout\", \"getTimer\", \"setInterval\", \"setTimeout\"]) {",
        "  Object.defineProperty(module.exports, key, { value: runtime[key], enumerable: true, writable: false, configurable: false });",
        "}",
        "Object.freeze(module.exports);",
        "",
    ].join("\n");
}

function astPathFor(sourcePath: string): string {
    return `ast/${sourcePath.replace(/\.as$/i, ".ast.json")}`;
}

function holdDetails(error: unknown): Pick<QualificationFile, "stage" | "code" | "message"> {
    const message = errorMessage(error).replace(/\r?\n/g, " ");
    const match = /\b(AS3_PARSE_[A-Z0-9_]+|PARSER_NORMALIZER_[A-Z0-9_]+|HARDENED_[A-Z0-9_]+)/.exec(message);
    const code = match ? match[1]! : error instanceof CliError && error.exitCode === 5
        ? "FRONTEND_RESOURCE_LIMIT" : "FRONTEND_HOLD";
    const stage = code.startsWith("AS3_PARSE_") || code === "FRONTEND_RESOURCE_LIMIT" ? "parse"
        : code.startsWith("PARSER_NORMALIZER_") ? "normalize"
        : code.startsWith("HARDENED_EMIT_") || code === "HARDENED_TYPESCRIPT_VERSION" ? "emit"
        : code.startsWith("HARDENED_") ? "semantic" : "output";
    return { stage, code, message };
}

async function execute(argv: readonly string[], io: Io): Promise<number> {
    const parsed = parseArguments(argv);
    if (parsed.mode === "help") {
        io.stdout.write(HELP);
        return 0;
    }
    if (parsed.mode === "version") {
        io.stdout.write(`${TOOL_VERSION}\n`);
        return 0;
    }

    const { options } = parsed;
    const inputs = discoverInputs(options.sourceDirectory, options.limits);
    const parserWorkerSha256 = captureParserWorkerSha256();
    const transpileAuthority = options.operation !== "parse"
        ? loadTranspileAuthority(options.sourceCensusPath, options.targetCapabilitiesPath)
        : null;
    let publication: Publication | undefined;
    try {
        publication = preparePublication(options.outputDirectory, inputs.root);
        const manifestFiles: ManifestFile[] = [];
        const transpiledFiles: TranspiledManifestFile[] = [];
        const qualificationFiles: QualificationFile[] = [];
        const outputKeys = new Set<string>();
        const qualificationOwners = new Map<string, QualificationFile>();
        const localOutputDependencies = new Map<QualificationFile | TranspiledManifestFile, string[]>();
        let applicationEntry: EmittedRuntimeApplicationEntry | null = null;
        let runtimeAuthority: EmittedRuntimeAuthority | null = null;
        const runtimeAuthoritySources: RuntimeAuthoritySource[] = transpileAuthority === null
            ? [] : [...transpileAuthority.runtimeTypeSources];
        const localRuntimePrograms: SemanticProgram[] = [];
        let totalOutputBytes = 0;

        for (const file of inputs.files) {
            const source = readInput(file);
            let parsedFile;
            try {
                parsedFile = await parseIsolated(file.portablePath, source.content, options.limits,
                    options.operation === "parse" ? "legacy" : "normalized", parserWorkerSha256);
            } catch (error) {
                if (options.operation !== "qualify") throw error;
                qualificationFiles.push({
                    sourcePath: file.portablePath,
                    sourceBytes: source.bytes.byteLength,
                    sourceSha256: sha256(source.bytes),
                    status: "held",
                    ...holdDetails(error),
                    modulePath: null,
                    normalizedFingerprintSha256: null,
                    typescriptSha256: null,
                });
                continue;
            }
            if (options.operation === "parse") {
                totalOutputBytes += parsedFile.byteLength;
                if (totalOutputBytes > options.limits.maxTotalOutputBytes) {
                    throw new CliError("serialized AST set exceeds --max-total-output-bytes", 5);
                }
                const astPath = astPathFor(file.portablePath);
                writeArtifact(publication, astPath, parsedFile.json);
                manifestFiles.push({
                    sourcePath: file.portablePath,
                    astPath,
                    sourceBytes: source.bytes.byteLength,
                    sourceSha256: sha256(source.bytes),
                    astBytes: parsedFile.byteLength,
                    astSha256: sha256(parsedFile.json),
                });
                continue;
            }
            try {
                const normalized = JSON.parse(parsedFile.json) as NormalizedParserAst;
                const semantic = adaptNormalizedParserAst(normalized, transpileAuthority!.authority,
                    source.content, value => sha256(value), transpileAuthority!.localTypes, file.portablePath,
                    transpileAuthority!.localMembers, transpileAuthority!.runtimeTypeSources);
                const emitted = emitSemanticProgram(semantic, {
                    compiler: ts49,
                    expectedTypeScriptVersion: transpileAuthority!.typeScriptVersion,
                });
                const requiredLocalModules = semantic.imports.filter(item => item.authorityKind === "local"
                    && !item.compileTimeNamespace).map(item => {
                    const resolved = posix.normalize(posix.join(posix.dirname(emitted.modulePath), item.targetModule));
                    return resolved.endsWith(".ts") ? resolved : `${resolved}.ts`;
                });
                const packageModulePath = `__as3_runtime/application/${emitted.modulePath}`;
                const collisionKey = portableCollisionKey(options.operation === "qualify"
                    ? emitted.modulePath : packageModulePath);
                if (options.operation === "qualify") {
                    const current: QualificationFile = {
                        sourcePath: file.portablePath,
                        sourceBytes: source.bytes.byteLength,
                        sourceSha256: sha256(source.bytes),
                        status: "admitted",
                        stage: null,
                        code: null,
                        message: null,
                        modulePath: emitted.modulePath,
                        normalizedFingerprintSha256: normalized.fingerprintSha256,
                        typescriptSha256: sha256(emitted.code),
                    };
                    const prior = qualificationOwners.get(collisionKey);
                    if (prior) {
                        prior.status = "held";
                        prior.stage = "output";
                        prior.code = "HARDENED_OUTPUT_COLLISION";
                        prior.message = `portable module path collides with ${file.portablePath}`;
                        prior.typescriptSha256 = null;
                        current.status = "held";
                        current.stage = "output";
                        current.code = "HARDENED_OUTPUT_COLLISION";
                        current.message = `portable module path collides with ${prior.sourcePath}`;
                        current.typescriptSha256 = null;
                    } else {
                        qualificationOwners.set(collisionKey, current);
                    }
                    qualificationFiles.push(current);
                    localOutputDependencies.set(current, requiredLocalModules);
                    continue;
                }
                if (outputKeys.has(collisionKey)) {
                    throw new CliError(`two sources emit the same portable module path: ${emitted.modulePath}`, 4);
                }
                outputKeys.add(collisionKey);
                localRuntimePrograms.push(semantic);
                const bytes = Buffer.byteLength(emitted.code, "utf8");
                totalOutputBytes += bytes;
                if (totalOutputBytes > options.limits.maxTotalOutputBytes) {
                    throw new CliError("TypeScript output set exceeds --max-total-output-bytes", 5);
                }
                writeArtifact(publication, packageModulePath, emitted.code);
                const javascriptPath = packageModulePath.slice(0, -3) + ".js";
                const javascript = runtimeCommonJs(emitted.code, packageModulePath);
                writeArtifact(publication, javascriptPath, javascript);
                totalOutputBytes += Buffer.byteLength(javascript, "utf8");
                const transpiled: TranspiledManifestFile = {
                    sourcePath: file.portablePath,
                    typescriptPath: packageModulePath,
                    sourceBytes: source.bytes.byteLength,
                    sourceSha256: sha256(source.bytes),
                    normalizedAstSha256: sha256(parsedFile.json),
                    normalizedFingerprintSha256: normalized.fingerprintSha256,
                    typescriptBytes: bytes,
                    typescriptSha256: sha256(emitted.code),
                };
                transpiledFiles.push(transpiled);
                localOutputDependencies.set(transpiled, requiredLocalModules.map(path => `__as3_runtime/application/${path}`));
            } catch (error) {
                if (options.operation === "qualify") {
                    const normalized = (() => {
                        try { return JSON.parse(parsedFile.json) as NormalizedParserAst; } catch { return null; }
                    })();
                    qualificationFiles.push({
                        sourcePath: file.portablePath,
                        sourceBytes: source.bytes.byteLength,
                        sourceSha256: sha256(source.bytes),
                        status: "held",
                        ...holdDetails(error),
                        modulePath: null,
                        normalizedFingerprintSha256: normalized?.fingerprintSha256 || null,
                        typescriptSha256: null,
                    });
                    continue;
                }
                if (error instanceof CliError) throw error;
                throw new CliError(`transpile rejected ${file.portablePath}: ${errorMessage(error)}`, 4);
            }
        }

        if (options.operation === "qualify") {
            let changed = true;
            while (changed) {
                changed = false;
                const admittedModules = new Set(qualificationFiles.filter(item => item.status === "admitted"
                    && item.modulePath !== null).map(item => portableCollisionKey(item.modulePath!)));
                qualificationFiles.filter(item => item.status === "admitted").forEach(item => {
                    const missing = (localOutputDependencies.get(item) || [])
                        .find(modulePath => !admittedModules.has(portableCollisionKey(modulePath)));
                    if (missing !== undefined) {
                        item.status = "held";
                        item.stage = "output";
                        item.code = "HARDENED_LOCAL_OUTPUT_CLOSURE";
                        item.message = `local dependency has no admitted output in this source set: ${missing}`;
                        item.typescriptSha256 = null;
                        changed = true;
                    }
                });
            }
        } else if (options.operation === "transpile") {
            const emittedModules = new Set(transpiledFiles.map(item => portableCollisionKey(item.typescriptPath)));
            for (const item of transpiledFiles) {
                const missing = (localOutputDependencies.get(item) || [])
                    .find(modulePath => !emittedModules.has(portableCollisionKey(modulePath)));
                if (missing !== undefined) {
                    throw new CliError(`local dependency has no emitted output in this source set: ${missing}`, 4);
                }
            }
            try {
                assertLocalRuntimeDefinitionClosure(localRuntimePrograms, ts49);
                localRuntimePrograms.forEach(semantic => {
                    if (semantic.declaration.declarationKind === "class") {
                        runtimeAuthoritySources.push(localRuntimeTypeAuthoritySource(semantic,
                            `./application/${semantic.outputModulePath.slice(0, -3)}`));
                    } else if (semantic.declaration.declarationKind === "interface") {
                        runtimeAuthoritySources.push(localRuntimeInterfaceAuthoritySource(semantic));
                    }
                });
            } catch (error) {
                throw new CliError(`transpile rejected runtime authority source set: ${errorMessage(error)}`, 4);
            }
            const packageJson = runtimePackageJson();
            writeArtifact(publication, "__as3_runtime/package.json", packageJson);
            totalOutputBytes += Buffer.byteLength(packageJson, "utf8");
            runtimeAuthority = emitRuntimeTypeAuthority(runtimeAuthoritySources, value => sha256(value));
            const runtimeAuthorityPath = "__as3_runtime/AS3Authority.generated.js";
            const authorityJavaScript = runtimeBundleJavaScript(runtimeAuthority.code);
            totalOutputBytes += Buffer.byteLength(authorityJavaScript, "utf8");
            if (totalOutputBytes > options.limits.maxTotalOutputBytes) {
                throw new CliError("TypeScript output set exceeds --max-total-output-bytes", 5);
            }
            writeArtifact(publication, runtimeAuthorityPath, authorityJavaScript);
            const timerFacadeJavaScript = runtimeTimerFacadeJavaScript();
            totalOutputBytes += Buffer.byteLength(timerFacadeJavaScript, "utf8");
            if (totalOutputBytes > options.limits.maxTotalOutputBytes) {
                throw new CliError("TypeScript output set exceeds --max-total-output-bytes", 5);
            }
            writeArtifact(publication, "__as3_runtime/AS3Timer.js", timerFacadeJavaScript);
            applicationEntry = emitRuntimeApplicationEntry(transpiledFiles.map(item =>
                item.typescriptPath.slice("__as3_runtime/".length)),
                value => sha256(value));
            const applicationEntryPath = `__as3_runtime/${applicationEntry.path}`;
            const entryCollisionKey = portableCollisionKey(applicationEntryPath);
            if (outputKeys.has(entryCollisionKey)) {
                throw new CliError(`application entry path collides with emitted output: ${applicationEntryPath}`, 4);
            }
            const entryBytes = Buffer.byteLength(applicationEntry.code, "utf8");
            const entryJavaScript = runtimeCommonJs(applicationEntry.code, applicationEntryPath);
            totalOutputBytes += entryBytes + Buffer.byteLength(entryJavaScript, "utf8");
            if (totalOutputBytes > options.limits.maxTotalOutputBytes) {
                throw new CliError("TypeScript output set exceeds --max-total-output-bytes", 5);
            }
            writeArtifact(publication, applicationEntryPath, applicationEntry.code);
            writeArtifact(publication, "__as3_runtime/ApplicationEntry.generated.js", entryJavaScript);
        }

        assertParserWorkerSha256(parserWorkerSha256);
        const qualificationCounts = options.operation === "qualify" ? qualificationFiles.reduce((result, item) => {
            const key = item.status === "admitted" ? "admitted" : item.code!;
            result[key] = (result[key] || 0) + 1;
            return result;
        }, Object.create(null) as Record<string, number>) : null;
        const manifest = options.operation === "parse" ? {
            schema: "bleach.as3.frontend-manifest.v1",
            toolVersion: TOOL_VERSION,
            upstreamParserRevision: "fa0b5151ab82758511ddd4b464f0c05b80e06da7",
            parserWorkerSha256,
            astFormat: "legacy-as3-to-ts-node-v1",
            files: manifestFiles,
        } : options.operation === "transpile" ? {
            schema: "bleach.as3.transpile-manifest.v1",
            toolVersion: TOOL_VERSION,
            upstreamParserRevision: "fa0b5151ab82758511ddd4b464f0c05b80e06da7",
            parserWorkerSha256,
            normalizedAstFormat: "authored-ui-as3-flat-ast@1",
            semanticFormat: "as3-semantic-ir@1",
            typeScriptVersion: transpileAuthority!.typeScriptVersion,
            sourceCapabilitySha256: transpileAuthority!.sourceCensusSha256,
            targetCapabilitySha256: transpileAuthority!.targetCapabilitiesSha256,
            capabilityMappingSha256: transpileAuthority!.capabilityMappingSha256,
            runtimeAuthorityPath: "__as3_runtime/AS3Authority.generated.js",
            runtimeAuthoritySha256: runtimeAuthority!.sha256,
            runtimeAuthorityQNames: runtimeAuthority!.qnames,
            applicationEntryPath: `__as3_runtime/${applicationEntry!.path}`,
            applicationEntrySha256: applicationEntry!.sha256,
            nativeTimerAuthoritySha256: transpileAuthority!.nativeTimerAuthoritySha256,
            classification: "capability-authenticated-typescript-proposal",
            files: transpiledFiles,
        } : {
            schema: "bleach.as3.qualification-report.v1",
            toolVersion: TOOL_VERSION,
            upstreamParserRevision: "fa0b5151ab82758511ddd4b464f0c05b80e06da7",
            parserWorkerSha256,
            normalizedAstFormat: "authored-ui-as3-flat-ast@1",
            semanticFormat: "as3-semantic-ir@1",
            typeScriptVersion: transpileAuthority!.typeScriptVersion,
            sourceCapabilitySha256: transpileAuthority!.sourceCensusSha256,
            targetCapabilitySha256: transpileAuthority!.targetCapabilitiesSha256,
            capabilityMappingSha256: transpileAuthority!.capabilityMappingSha256,
            nativeTimerAuthoritySha256: transpileAuthority!.nativeTimerAuthoritySha256,
            generatedTypeScriptMaterialized: false,
            counts: qualificationCounts,
            files: qualificationFiles,
        };
        const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
        totalOutputBytes += Buffer.byteLength(manifestJson, "utf8");
        if (totalOutputBytes > options.limits.maxTotalOutputBytes) {
            throw new CliError("complete output exceeds --max-total-output-bytes", 5);
        }
        writeArtifact(publication, "manifest.json", manifestJson);
        publish(publication);
        const count = options.operation === "parse" ? manifestFiles.length
            : options.operation === "transpile" ? transpiledFiles.length : qualificationFiles.length;
        const verb = options.operation === "parse" ? "Parsed" : options.operation === "transpile" ? "Transpiled" : "Qualified";
        io.stdout.write(`${verb} ${count} ActionScript file${count === 1 ? "" : "s"}.\n`);
        return 0;
    } catch (error) {
        abandon(publication);
        throw error;
    }
}

export async function run(
    argv: readonly string[] = process.argv.slice(2),
    io: Io = process,
): Promise<number> {
    try {
        return await execute(argv, io);
    } catch (error) {
        if (error instanceof CliError) {
            io.stderr.write(`as3-frontend: ${error.message}\n`);
            return error.exitCode;
        }
        io.stderr.write(`as3-frontend: internal error: ${errorMessage(error)}\n`);
        return 70;
    }
}
