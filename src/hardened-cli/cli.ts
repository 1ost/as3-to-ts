import {includedSourceOrigins} from "../hardened/source-includes";
import {loadSourceIncludes} from "./source-includes-authority";
import { hasNativeDateAuthority } from "../hardened/native-date-authority";
import { dateRuntimeTypeAuthoritySource } from "../hardened/type-authority";
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
import { targetModuleSpecifier } from "../hardened/ledger";
import { adaptNormalizedParserAst } from "../hardened/adapter";
import { HardenedSemanticError, type NormalizedParserAst, type SemanticProgram } from "../hardened/contracts";
import { emitSemanticProgram } from "../hardened/emitter";
import { byteArrayRuntimeTypeAuthoritySource, arrayRuntimeTypeAuthoritySource, assertLocalRuntimeDefinitionClosure, emitRuntimeApplicationEntry, emitRuntimeTypeAuthority, localRuntimeEmbeddedAuthoritySources, localRuntimeInterfaceAuthoritySource,
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

interface FileLocalOutput {
    sourceNodeId: string;
    modulePath: string;
    typescriptBytes: number;
    typescriptSha256: string;
}

interface TranspiledManifestFile {
    sourceIncludes?: ReturnType<typeof includedProvenance>;
    fileLocalOutputs?: FileLocalOutput[];
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
    sourceIncludes?: ReturnType<typeof includedProvenance>;
    sourceOrigins?: ReturnType<typeof includedSourceOrigins>;
    fileLocalOutputs?: FileLocalOutput[];
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

function includedProvenance(ast: NormalizedParserAst) {
    const proof=ast.includeExpansion!;
    return {offsetUnit:proof.offsetUnit,sourceTextBasis:proof.sourceTextBasis,
        expandedSha256:proof.expandedSha256,segments:proof.segments,edges:proof.edges,
        fragments:proof.fragments.map(item=>({path:item.path,sha256:item.sha256}))};
}

function sha256(data: string | Buffer): string {
    return createHash("sha256").update(data).digest("hex");
}

const RUNTIME_SOURCE_SHA256: Readonly<Record<string, string>> = Object.freeze({
    "AS3Reflection.ts": "123dbfdc9fff41eed41f0ca3e6e8dc790cc6baed793fb506b9dd30c23210caae",
    "internal/AS3RegExpPattern.ts": "036bdd8077771be4ee518d9b84b25a7ffc80309240ebb45f7f85aeb84c4d3319",
    "AS3RegExp.ts": "5b254ea41376aafb0e3381bc7707381be9db9e241c8b514f4d372991fb95a574",
    "AS3Enumeration.ts": "183f10ec17e98fdf37158cc842fd608d449374082ccba5fb5aaa7230d7426bbd",
    "internal/AS3ArraySort.ts": "15a4cc94a7c485c2277343fea40695a80c8934cee925c86e8528ab42ae660fa4",
    "AS3Array.ts": "29836bf4136b9fb6321c712932091a425ed190d1ff4d160572eae52bfedc2be0",
    "AS3BigTurnTableInnerDto.ts": "f7ba5db782eac244b8d4a626afc363081cd510855e818b17ec54a172772b6b91",
    "AS3ByteArrayNative.ts": "f6188ecdba0cb5180172da9a5533640aec0dc1ac7c0433b8e41aec3e02e744e3",
    "AS3Date.ts": "2265a9bbda63966c86dc94eeec359c71fd32d64bae39265b4d6fa1cb1d618d99",
    "AS3ByteArray.ts": "1cf1a2f0f8abc200585b7b62a66724d0fee0ec03c397d96b769905d5a899e4b5",
    "internal/AS3ParseInteger.ts": "fbd902c2c77311d87f0052689743be280a38d2e919c827673cf0f7e55206db95",
    "AS3ClassInitialization.ts": "5b446cdfe43be974455866ca93648b5625edb777938093979e0437aaa8dd501f",
    "AS3Coerce.ts": "65a9b7f117472e183049fc7a22c51cfff2423e2b4607cf6d89460676f8ece39e",
    "AS3Error.ts": "84ef28906a1cf28f600bc36d554af3330b176c4fffa4f47e8f7384919256b134",
    "AS3Embed.ts": "41628cd8db111c12c5f12c8a51f036d37c839f8ae609986d0d24796e425d2055",
    "AS3Dictionary.ts": "6093e08ea252cc7926982934da92c1d7785d093880e196c798c67c5f8d7d8f84",
    "AS3Function.ts": "dcd4c0c60c72fad77cd6543fcda1c5e907e32741f4049779bc1096ef5dbd8812",
    "AS3MethodClosure.ts": "3021c90d64458b0aed10451eb36f87078c33386c43dcb741c3d34919cfdbfa60",
    "internal/AS3FunctionLength.ts": "61c6c06f2f8ebb09f297d11a35ccd53c1e9cb2c75265d050f750b0693ed31ef4",
    "AS3ObjectDispatch.ts": "382445069a78f797558959157dfd8d96f54777556d89dd79b535c605ceb3c8a4",
    "AS3Object.ts": "ddfc3a328138622ab836ee48452d37ff6c125fb5e2d655584f470d42472098f9",
    "AS3OwnRecord.ts": "932476a585d576b385b1d402fa9fba851125c2796904aaf733da267b5bcf736e",
    "AS3Timer.ts": "639a0e3776611b3fd736305994d709b47af8465509bb9d2de440bc611a985851",
    "AS3Type.ts": "02f2acb486155e4718075f749cd45056c39175cb58c6c8aaf001af30b7104f60",
    "AS3Vector.ts": "6839a53b9987f70cd975367640d6f0b1deaef1d529e7b85c1ffe2ed0f3dca6ad",
    "internal/AS3NumberFormat.ts": "c7a2b808bd4bafded492a65acce6041f67601f2e56308fb2724443f8baa58bc4",
    "internal/AS3CaseTable.ts": "ed85937df05d8ba9015e3cd35b8d75ce46e56348547085c0d218426ed0a44fc5",
    "internal/AS3FileLocalIdentity.ts": "9adbd4a9ab454a7d8351982d6da643d6510d2486658305eb0530170651232abb",
    "internal/AS3TypeRegistry.ts": "e6517554b4493b3c400dbaa3077fac91e44a78141c526e3d3fac90b76d3eaf35",
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

function runtimeBundleJavaScript(authorityCode: string, includeBigTurnTableDto: boolean,
    byteArrayNative?: {targetModule:string;targetExport:string}): string {
    const modules = new Map<string, string>();
    runtimeSourceTemplates(includeBigTurnTableDto).forEach(template => {
        const moduleId = template.path.slice(0, -3) + ".js";
        const code=template.path==="AS3ByteArrayNative.ts" && byteArrayNative
            ? `import { ${byteArrayNative.targetExport} as NativeByteArray } from "${targetModuleSpecifier(byteArrayNative.targetModule)}";
export function uncompressNativeByteArray(state: {bytes:Uint8Array;position:number;endian:string}) {
    const value=new NativeByteArray(state.bytes.slice());
    value.position=state.position;value.endian=state.endian;
    value.uncompress();
    return {bytes:new Uint8Array(value.buffer),position:value.position,endian:value.endian};
}
` : template.code;
        modules.set(moduleId, runtimeEmbeddedCommonJs(code, template.path));
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
    const entries = ["AS3Reflection", "AS3Date", "AS3Array", ...(includeBigTurnTableDto ? ["AS3BigTurnTableInnerDto"] : []), "AS3ByteArray", "AS3ClassInitialization", "AS3Coerce", "AS3Dictionary", "AS3Enumeration", "AS3Embed", "AS3Error", "AS3Function",
        "AS3MethodClosure", "AS3Object", "AS3ObjectDispatch", "AS3OwnRecord", "AS3RegExp", "AS3Timer", "AS3Type", "AS3Vector"];
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
        const includedFragments: Array<{sourcePath:string;sourceSha256:string;sourceBytes:number}> = [];
        let totalOutputBytes = 0;

        for (const file of inputs.files) {
            const source = readInput(file);
            const includeInventory=transpileAuthority?.sourceIncludes?.inventory;
            if(includeInventory && !includeInventory.roots.some(item=>item.path===file.portablePath)) {
                const fragment=includeInventory.fragments.find(item=>item.path===file.portablePath);
                if(fragment) {
                    if(fragment.sha256!==sha256(source.bytes) || fragment.bytes!==source.bytes.length) throw new CliError("Included fragment differs from authenticated source inventory",6);
                    includedFragments.push({sourcePath:file.portablePath,sourceSha256:fragment.sha256,sourceBytes:fragment.bytes});
                    continue;
                }
            }
            let parsedFile;
            try {
                parsedFile = await parseIsolated(file.portablePath, source.content, options.limits,
                    options.operation === "parse" ? "legacy" : "normalized", parserWorkerSha256,
                    transpileAuthority?.sourceIncludes ? (() => {
                        const includes=transpileAuthority!.sourceIncludes!;
                        const root=includes.inventory.roots.find(item=>item.path===file.portablePath);
                        if(!root) return undefined;
                        if (root.sha256!==sha256(source.bytes)) throw new Error("HARDENED_INCLUDE_ROOT_IDENTITY: selected source differs from include authority");
                        return {includeRootPath:root.path,includeFragments:includes.fragments,includeEdges:includes.inventory.edges};
                    })() : undefined);
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
                const programs = [semantic, ...(semantic.fileLocalPrograms || [])];
                for (const program of programs) if (program.declaration.declarationKind === "class") for (const member of program.declaration.members) {
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
                // Emit and validate the entire source unit before declaring any of it admitted.
                const outputs = programs.map(program => {
                    const emitted = emitSemanticProgram(program, {
                        compiler: ts49, expectedTypeScriptVersion: transpileAuthority!.typeScriptVersion,
                    });
                    const code = transpileAuthority!.runtimePackage === "@bleach/as3-runtime" ? emitted.code
                        : emitted.code.replaceAll("@bleach/as3-runtime", transpileAuthority!.runtimePackage);
                    const dependencies = program.imports.filter(item => item.authorityKind === "local"
                        && !item.compileTimeNamespace).map(item => {
                        const resolved = posix.normalize(posix.join(posix.dirname(emitted.modulePath), item.targetModule));
                        return resolved.endsWith(".ts") ? resolved : `${resolved}.ts`;
                    });
                    return {program, modulePath: emitted.modulePath, code, dependencies,
                        packagePath: `__as3_runtime/application/${emitted.modulePath}`,
                        bytes: Buffer.byteLength(code, "utf8"), hash: sha256(code)};
                });
                const primary = outputs[0]!;
                const fileLocalOutputs = outputs.slice(1).map(output => ({sourceNodeId: output.program.declaration.sourceNodeId,
                    modulePath: output.modulePath, typescriptBytes: output.bytes, typescriptSha256: output.hash}));
                const requiredLocalModules = [...new Set(outputs.flatMap(output => output.dependencies))];
                const collisionKeys = outputs.map(output => portableCollisionKey(options.operation === "qualify"
                    ? output.modulePath : output.packagePath));
                if (new Set(collisionKeys).size !== collisionKeys.length)
                    throw new CliError("source unit emits colliding portable module paths", 4);
                if (options.operation === "qualify") {
                    const current: QualificationFile = {
                        ...(normalized.includeExpansion ? {sourceIncludes:includedProvenance(normalized)} : {}),
                        sourcePath: file.portablePath, sourceBytes: source.bytes.byteLength,
                        sourceSha256: sha256(source.bytes), status: "admitted", stage: null, code: null, message: null,
                        modulePath: primary.modulePath, normalizedFingerprintSha256: normalized.fingerprintSha256,
                        typescriptSha256: primary.hash, ...(fileLocalOutputs.length ? {fileLocalOutputs} : {}),
                    };
                    for (const key of collisionKeys) {
                        const prior = qualificationOwners.get(key);
                        if (prior) {
                            prior.status = "held"; prior.stage = "output"; prior.code = "HARDENED_OUTPUT_COLLISION";
                            prior.message = `portable module path collides with ${file.portablePath}`; prior.typescriptSha256 = null;
                            current.status = "held"; current.stage = "output"; current.code = "HARDENED_OUTPUT_COLLISION";
                            current.message = `portable module path collides with ${prior.sourcePath}`; current.typescriptSha256 = null;
                        } else qualificationOwners.set(key, current);
                    }
                    qualificationFiles.push(current); localOutputDependencies.set(current, requiredLocalModules);
                    continue;
                }
                for (const key of collisionKeys) {
                    if (outputKeys.has(key)) throw new CliError("two sources emit the same portable module path", 4);
                    outputKeys.add(key);
                }
                for (const output of outputs) {
                    localRuntimePrograms.push(output.program);
                    const javascript = runtimeCommonJs(output.code, output.packagePath);
                    totalOutputBytes += output.bytes + Buffer.byteLength(javascript, "utf8");
                    if (totalOutputBytes > options.limits.maxTotalOutputBytes)
                        throw new CliError("TypeScript output set exceeds --max-total-output-bytes", 5);
                    writeArtifact(publication, output.packagePath, output.code);
                    writeArtifact(publication, output.packagePath.slice(0, -3) + ".js", javascript);
                }
                const transpiled: TranspiledManifestFile = {
                    ...(normalized.includeExpansion ? {sourceIncludes:includedProvenance(normalized)} : {}),
                    sourcePath: file.portablePath, typescriptPath: primary.packagePath,
                    sourceBytes: source.bytes.byteLength, sourceSha256: sha256(source.bytes),
                    normalizedAstSha256: sha256(parsedFile.json), normalizedFingerprintSha256: normalized.fingerprintSha256,
                    typescriptBytes: primary.bytes, typescriptSha256: primary.hash,
                    ...(fileLocalOutputs.length ? {fileLocalOutputs} : {}),
                };
                transpiledFiles.push(transpiled);
                localOutputDependencies.set(transpiled, requiredLocalModules.map(path => `__as3_runtime/application/${path}`));
            } catch (error) {
                if (options.operation === "qualify") {
                    const normalized = (() => {
                        try { return JSON.parse(parsedFile.json) as NormalizedParserAst; } catch { return null; }
                    })();
                    const originNode=error instanceof HardenedSemanticError && normalized?.includeExpansion
                        ? normalized.nodes.find(node=>node.id===error.sourceNodeId) : undefined;
                    qualificationFiles.push({
                        ...(normalized?.includeExpansion ? {sourceIncludes:includedProvenance(normalized)} : {}),
                        ...(normalized?.includeExpansion && originNode?.span ? {sourceOrigins:includedSourceOrigins(normalized.includeExpansion,originNode.span.start,originNode.span.end)} : {}),
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
                    && item.modulePath !== null).flatMap(item => [item.modulePath!, ...(item.fileLocalOutputs || []).map(output => output.modulePath)])
                    .map(path => portableCollisionKey(path)));
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
            const emittedModules = new Set(transpiledFiles.flatMap(item => [item.typescriptPath,
                ...(item.fileLocalOutputs || []).map(output => `__as3_runtime/application/${output.modulePath}`)]).map(path => portableCollisionKey(path)));
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
            if (localRuntimePrograms.some(program=>program.declaration.declarationKind === "class"
                && program.declaration.extendsType?.runtimeName === "Array")) {
                if (!transpileAuthority!.sourceMembers) throw new CliError("Array base lacks native source authority",4);
                runtimeAuthoritySources.push(arrayRuntimeTypeAuthoritySource(transpileAuthority!.sourceMembers,RUNTIME_SOURCE_SHA256["AS3Array.ts"]!));
            }
            if (transpileAuthority!.sourceMembers?.entriesByQName["flash.utils.ByteArray"]
                && localRuntimePrograms.some(program=>program.imports.some(item=>item.authorityKind === "intrinsic"
                    && item.sourceQualifiedName === "flash.utils.ByteArray"))) {
                runtimeAuthoritySources.push(byteArrayRuntimeTypeAuthoritySource(transpileAuthority!.sourceMembers,RUNTIME_SOURCE_SHA256["AS3ByteArray.ts"]!));
            }
            if(hasNativeDateAuthority(transpileAuthority!.sourceMembers))
                runtimeAuthoritySources.push(dateRuntimeTypeAuthoritySource(transpileAuthority!.sourceMembers!,RUNTIME_SOURCE_SHA256["AS3Date.ts"]!));
            runtimeAuthority = emitRuntimeTypeAuthority(runtimeAuthoritySources, value => sha256(value),
                transpileAuthority!.reflectionProvider ? {
                    target: transpileAuthority!.reflectionProvider,
                    targetCapabilitiesJson: readFileSync(options.targetCapabilitiesPath!, "utf8"),
                } : undefined);
            const runtimeAuthorityPath = "__as3_runtime/AS3Authority.generated.js";
            const authorityJavaScript = runtimeBundleJavaScript(runtimeAuthority.code,
                transpileAuthority!.includeBigTurnTableDto, transpileAuthority!.authority.byteArrayNative);
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
                value => sha256(value),localRuntimePrograms);
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

        if(transpileAuthority?.sourceIncludes) loadSourceIncludes(JSON.stringify(transpileAuthority.sourceIncludes.inventory));
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
            ...(includedFragments.length ? {includedFragments} : {}),
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
            ...(includedFragments.length ? {includedFragments} : {}),
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
