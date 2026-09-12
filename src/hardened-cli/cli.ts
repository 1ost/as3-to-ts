import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { readFileSync, realpathSync, lstatSync } from "node:fs";
import { dirname, join, posix, resolve, sep } from "node:path";
import ts49 = require("typescript-4-9");
import { CliError, errorMessage } from "./errors";
import { discoverInputs, portableCollisionKey, readInput } from "./inputs";
import { assertParserWorkerSha256, captureParserWorkerSha256, parseIsolated } from "./isolated-parser";
import { HELP, parseArguments, TOOL_VERSION } from "./options";
import { loadTranspileAuthority } from "./authority";
import { adaptNormalizedParserAst } from "../hardened/adapter";
import { HardenedSemanticError, type NormalizedParserAst, type SemanticProgram } from "../hardened/contracts";
import { emitSemanticProgram } from "../hardened/emitter";
import { assertLocalRuntimeDefinitionClosure, emitRuntimeApplicationEntry, emitRuntimeTypeAuthority, localRuntimeEmbeddedAuthoritySources, localRuntimeInterfaceAuthoritySource,
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
    "AS3Array.ts": "6109d529e6499302d1b489a195522608d6749dd4e2252eeb4738b10c6a1b62c3",
    "AS3BigTurnTableInnerDto.ts": "f7ba5db782eac244b8d4a626afc363081cd510855e818b17ec54a172772b6b91",
    "AS3ByteArray.ts": "f6e206784fcab50b8af57d0fb5acdf50696aeef8527ff2e58709c0f06f15bc30",
    "AS3Coerce.ts": "156b1b354e50b0105fc9bd63893242dbaae8bcee1d0ada8a7e056283c8d8df14",
    "AS3Embed.ts": "41628cd8db111c12c5f12c8a51f036d37c839f8ae609986d0d24796e425d2055",
    "AS3Dictionary.ts": "307af295f7cd3e7c6f32423b799ab8920fb1f84e254181256a5673dfffd45814",
    "AS3Function.ts": "f3e994a2b58cb67a78666f02848a5cfc8397352f83ed39e416da1aa4cfcd73d0",
    "AS3MethodClosure.ts": "05329f4fa2a7034f49ab70ed87311350e71e997dca7976f8f7a44b364ca3dd9a",
    "AS3ObjectDispatch.ts": "0fdad71aa5a2d4bf48147248a906507e52e752354a9cf9a6fcc74559e79d95af",
    "AS3Object.ts": "ddfc3a328138622ab836ee48452d37ff6c125fb5e2d655584f470d42472098f9",
    "AS3OwnRecord.ts": "932476a585d576b385b1d402fa9fba851125c2796904aaf733da267b5bcf736e",
    "AS3Timer.ts": "639a0e3776611b3fd736305994d709b47af8465509bb9d2de440bc611a985851",
    "AS3Type.ts": "6389bd794913de410607f2bcdc91c485a309a8bdfdea7b9c783ea705734fdd73",
    "AS3Vector.ts": "5deedf01b46703ae7ae0d0f98ed6cfa680a39496ddd6ab747ee48c3bb5ec1101",
    "internal/AS3TypeRegistry.ts": "ae85a3a443adb326dd51c296c1ad3a61b6f59b0ea8afbe15fb3a0ddbab474388",
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

function runtimeBundleJavaScript(authorityCode: string, includeBigTurnTableDto: boolean): string {
    const modules = new Map<string, string>();
    runtimeSourceTemplates(includeBigTurnTableDto).forEach(template => {
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
    Object.keys(RUNTIME_SOURCE_SHA256).filter(path => !path.startsWith("internal/")
        && (includeBigTurnTableDto || path !== "AS3BigTurnTableInnerDto.ts")).sort().forEach(path => {
        lines.push(`__as3Expose(__as3Load(${JSON.stringify(path.slice(0, -3) + ".js")}));`);
    });
    lines.push("__as3Expose(__as3Load('AS3Authority.generated.js'));", "Object.freeze(__as3Public);", "");
    return lines.join("\n");
}

function runtimeSourceTemplates(includeBigTurnTableDto: boolean): ReadonlyArray<{ path: string; code: string }> {
    const root = resolve(join(__dirname, "..", "src", "hardened-runtime"));
    return Object.keys(RUNTIME_SOURCE_SHA256).filter(path => includeBigTurnTableDto
        || path !== "AS3BigTurnTableInnerDto.ts").sort().map(path => {
        const code = readFileSync(join(root, ...path.split("/")), "utf8").replace(/\r\n?/g, "\n");
        if (sha256(code) !== RUNTIME_SOURCE_SHA256[path]) {
            throw new CliError(`runtime package source drifted: ${path}`, 6);
        }
        return Object.freeze({ path, code });
    });
}

function runtimePackageJson(name: string, includeBigTurnTableDto: boolean): string {
    const entries = ["AS3Array", ...(includeBigTurnTableDto ? ["AS3BigTurnTableInnerDto"] : []), "AS3ByteArray", "AS3Coerce", "AS3Dictionary", "AS3Embed", "AS3Function",
        "AS3MethodClosure", "AS3Object", "AS3ObjectDispatch", "AS3OwnRecord", "AS3Timer", "AS3Type", "AS3Vector"];
    const exports: Record<string, string> = Object.create(null) as Record<string, string>;
    entries.forEach(name => { exports[`./${name}`] = name === "AS3Timer"
        ? "./AS3Timer.js" : "./AS3Authority.generated.js"; });
    exports["./AS3Authority"] = "./AS3Authority.generated.js";
    exports["./ApplicationEntry"] = "./ApplicationEntry.generated.js";
    return `${JSON.stringify({ name, version: "0.1.0", private: true,
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
        ? loadTranspileAuthority(options.sourceCensusPath, options.targetCapabilitiesPath, options.profileLockPath)
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
        const embeddedResources: Array<{id: string; sourcePath: string; path: string; sha256: string; bytes: number}> = [];
        const resourceInputs = new Map<string, string>();
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
                if (transpileAuthority!.profileSha256 !== null) {
                    const local = transpileAuthority!.localTypes;
                    const canonicalSourceSha256 = sha256(source.content.replace(/\r\n?/g, "\n"));
                    const owners = local.entries.filter(entry =>
                        entry.sourcePath === `${local.sourceRoots[entry.module]}${file.portablePath}`
                        && entry.sourceContentSha256 === canonicalSourceSha256);
                    if (owners.length !== 1) {
                        throw new HardenedSemanticError("HARDENED_APPLICATION_SOURCE_IDENTITY",
                            `source ${file.portablePath} does not match one exact application-profile source hash`);
                    }
                }
                const normalized = JSON.parse(parsedFile.json) as NormalizedParserAst;
                const semantic = adaptNormalizedParserAst(normalized, transpileAuthority!.authority,
                    source.content, value => sha256(value), transpileAuthority!.localTypes, file.portablePath,
                    transpileAuthority!.localMembers, transpileAuthority!.runtimeTypeSources,
                    transpileAuthority!.sourceMembers || undefined);
                if (semantic.declaration.declarationKind === "class") for (const member of semantic.declaration.members) {
                    if (member.kind !== "field" || !member.embeddedBitmap) continue;
                    const asset = member.embeddedBitmap;
                    const resourcePath = resolve(dirname(file.absolutePath), asset.source);
                    if (!resourcePath.startsWith(inputs.root + sep) || realpathSync.native(resourcePath) !== resourcePath
                        || !lstatSync(resourcePath).isFile() || lstatSync(resourcePath).size > 16 * 1024 * 1024) {
                        throw new HardenedSemanticError("HARDENED_EMBED_RESOURCE", "Embedded resource must be a bounded regular file within the source root");
                    }
                    const bytes = readFileSync(resourcePath);
                    if (bytes.length < 24 || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a"
                        || bytes.toString("ascii", 12, 16) !== "IHDR") {
                        throw new HardenedSemanticError("HARDENED_EMBED_RESOURCE", "Embedded PNG resource has an invalid header");
                    }
                    const hash = sha256(bytes), target = `__as3_runtime/assets/${hash}.png`;
                    resourceInputs.set(resourcePath, hash);
                    if (embeddedResources.some(resource => resource.id === asset.resourceId)) {
                        throw new HardenedSemanticError("HARDENED_EMBED_RESOURCE", "Embedded resource identity collides");
                    }
                    if (options.operation === "transpile" && !embeddedResources.some(resource => resource.path === target)) {
                        totalOutputBytes += bytes.byteLength;
                        if (totalOutputBytes > options.limits.maxTotalOutputBytes) throw new CliError("Embedded resources exceed output byte limit", 5);
                        writeArtifact(publication, target, bytes);
                    }
                    embeddedResources.push({id: asset.resourceId, sourcePath: posix.join(posix.dirname(file.portablePath), asset.source),
                        path: target, sha256: hash, bytes: bytes.byteLength});
                }
                const emitted = emitSemanticProgram(semantic, {
                    compiler: ts49,
                    expectedTypeScriptVersion: transpileAuthority!.typeScriptVersion,
                });
                const emittedCode = transpileAuthority!.runtimePackage === "@bleach/as3-runtime" ? emitted.code
                    : emitted.code.replaceAll("@bleach/as3-runtime", transpileAuthority!.runtimePackage);
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
                        typescriptSha256: sha256(emittedCode),
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
                const bytes = Buffer.byteLength(emittedCode, "utf8");
                totalOutputBytes += bytes;
                if (totalOutputBytes > options.limits.maxTotalOutputBytes) {
                    throw new CliError("TypeScript output set exceeds --max-total-output-bytes", 5);
                }
                writeArtifact(publication, packageModulePath, emittedCode);
                const javascriptPath = packageModulePath.slice(0, -3) + ".js";
                const javascript = runtimeCommonJs(emittedCode, packageModulePath);
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
                    typescriptSha256: sha256(emittedCode),
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
                        runtimeAuthoritySources.push(...localRuntimeEmbeddedAuthoritySources(semantic,
                            `./application/${semantic.outputModulePath.slice(0, -3)}`));
                    } else if (semantic.declaration.declarationKind === "interface") {
                        runtimeAuthoritySources.push(localRuntimeInterfaceAuthoritySource(semantic));
                    }
                });
            } catch (error) {
                throw new CliError(`transpile rejected runtime authority source set: ${errorMessage(error)}`, 4);
            }
            const packageJson = runtimePackageJson(transpileAuthority!.runtimePackage,
                transpileAuthority!.includeBigTurnTableDto);
            writeArtifact(publication, "__as3_runtime/package.json", packageJson);
            totalOutputBytes += Buffer.byteLength(packageJson, "utf8");
            runtimeAuthority = emitRuntimeTypeAuthority(runtimeAuthoritySources, value => sha256(value));
            const runtimeAuthorityPath = "__as3_runtime/AS3Authority.generated.js";
            const authorityJavaScript = runtimeBundleJavaScript(runtimeAuthority.code,
                transpileAuthority!.includeBigTurnTableDto);
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
        for (const [path, hash] of resourceInputs) {
            if (realpathSync.native(path) !== path || sha256(readFileSync(path)) !== hash)
                throw new CliError("Embedded resource changed during generation", 6);
        }
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
            schema: transpileAuthority!.profileSha256 === null
                ? "bleach.as3.transpile-manifest.v1" : "as3.application.transpile-manifest.v1",
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
            applicationId: transpileAuthority!.applicationId,
            profileLockSha256: transpileAuthority!.profileSha256,
            runtimePackage: transpileAuthority!.runtimePackage,
            classification: "capability-authenticated-typescript-proposal",
            embeddedResources,
            files: transpiledFiles,
        } : {
            schema: transpileAuthority!.profileSha256 === null
                ? "bleach.as3.qualification-report.v1" : "as3.application.qualification-report.v1",
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
            applicationId: transpileAuthority!.applicationId,
            profileLockSha256: transpileAuthority!.profileSha256,
            runtimePackage: transpileAuthority!.runtimePackage,
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
