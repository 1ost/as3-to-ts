import { hasNativeRegExpAuthority } from "../hardened/native-regexp-authority";
import { regExpRuntimeTypeAuthoritySource } from "../hardened/type-authority";
import {includedSourceOrigins} from "../hardened/source-includes";
import {loadSourceIncludes} from "./source-includes-authority";
import { hasNativeDateAuthority } from "../hardened/native-date-authority";
import { dateRuntimeTypeAuthoritySource } from "../hardened/type-authority";
import { errorRuntimeTypeAuthoritySource } from "../hardened/type-authority";
import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { readFileSync, realpathSync, lstatSync } from "node:fs";
import { dirname, join, posix, resolve, sep } from "node:path";
import ts49 = require("typescript-4-9");
import { CliError, errorMessage } from "./errors";
import { deriveAuthenticatedSourceClosure, discoverAuthenticatedInputs, discoverAuthenticatedSourcePlan,
    discoverInputs, portableCollisionKey, readInput } from "./inputs";
import { compileDefinitionsHash } from "../hardened/compile-definitions";
import { assertParserWorkerSha256, captureParserWorkerSha256, parseIsolated } from "./isolated-parser";
import { HELP, parseArguments, TOOL_VERSION } from "./options";
import { assertCompilerProviderAuthorityUnchanged, assertSecondaryAuthorityRequestUnchanged, emitSecondaryAuthorityReceipt,
    canonicalJson, loadCompilerProviderAuthority, loadSecondaryAuthorityRequest, type CompilerProviderAuthority,
    type EmittedSecondaryAuthority, type SecondaryArtifactIdentity,
    type SecondaryModuleIdentity } from "./secondary-authority";
import {emitBrowserSecondaryLinkerPackage,type BrowserLinkerProgram,
    type EmittedBrowserLinkerPackage} from "./secondary-browser-linker";
import {emitPrimarySecondaryHostPackage,exposePrimarySecondaryHostAdapter,
    type EmittedPrimarySecondaryHostPackage} from "./primary-secondary-host";
import {emitPrimaryHostBundleCandidate,type EmittedPrimaryHostBundleCandidate} from "./primary-host-bundle";
import {emitBrowserEsmRuntime,type BrowserEsmSource,type EmittedBrowserEsmRuntime} from "./browser-esm-runtime";
import { loadTranspileAuthority } from "./authority";
import { targetModuleSpecifier } from "../hardened/ledger";
import { adaptNormalizedParserAst } from "../hardened/adapter";
import { HardenedSemanticError, type NormalizedParserAst, type SemanticProgram } from "../hardened/contracts";
import { emitSemanticProgram } from "../hardened/emitter";
import { byteArrayRuntimeTypeAuthoritySource, arrayRuntimeTypeAuthoritySource, assertLocalRuntimeDefinitionClosure, emitRuntimeApplicationEntry, emitRuntimeTypeAuthority, localRuntimeEmbeddedAuthoritySources, localRuntimeInterfaceAuthoritySource,
    localRuntimeTypeAuthoritySource, type EmittedRuntimeApplicationEntry,
    type EmittedRuntimeAuthority, type RuntimeAuthorityClassSource,type RuntimeAuthoritySource } from "../hardened/type-authority";
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

function sourceAuthorityPath(file: import("./inputs").InputFile): string {
    return file.sourceRelativePath;
}

function assertAuthenticatedSourceShape(file: import("./inputs").InputFile,
    programs: readonly SemanticProgram[]): readonly string[] | null {
    if (!file.expectedQNames || (!file.expectedLocalDependencies&&!file.allowedLocalDependencies)) return null;
    if (programs.length !== 1) {
        throw new HardenedSemanticError("HARDENED_SOURCE_CLOSURE_QNAME",
            "authenticated multi-root sources must contain exactly one importable declaration");
    }
    const program = programs[0]!, qname = program.packageName.length === 0
        ? program.declaration.name : `${program.packageName}.${program.declaration.name}`;
    if (file.expectedQNames.length !== 1 || file.expectedQNames[0] !== qname) {
        throw new HardenedSemanticError("HARDENED_SOURCE_CLOSURE_QNAME",
            `semantic QName ${qname} differs from the authenticated source closure`);
    }
    const dependencies = [...new Set(programs.flatMap(item => item.imports
        .filter(imported => imported.authorityKind === "local" && !imported.compileTimeNamespace)
        .map(imported => imported.sourceQualifiedName)))].sort((left, right) =>
            Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8")));
    if (JSON.stringify(dependencies) !== JSON.stringify(file.expectedLocalDependencies)) {
        if(file.expectedLocalDependencies) throw new HardenedSemanticError("HARDENED_SOURCE_CLOSURE_DEPENDENCIES",
            `semantic local dependencies differ from the authenticated source closure for ${file.portablePath}`);
        if(dependencies.some(dependency=>!file.allowedLocalDependencies!.includes(dependency)))
            throw new HardenedSemanticError("HARDENED_SOURCE_PLAN_DEPENDENCIES",
                `semantic local dependencies exceed the authenticated source plan for ${file.portablePath}`);
    }
    return Object.freeze(dependencies);
}

const RUNTIME_SOURCE_SHA256: Readonly<Record<string, string>> = Object.freeze({
    "AS3Reflection.ts": "123dbfdc9fff41eed41f0ca3e6e8dc790cc6baed793fb506b9dd30c23210caae",
    "internal/AS3RegExpPattern.ts": "c0136623a152442c46992c53d2485ab71a8ae7ac6a7e08a9f2193f4905f5f7c4",
    "AS3RegExp.ts": "5b254ea41376aafb0e3381bc7707381be9db9e241c8b514f4d372991fb95a574",
    "AS3Enumeration.ts": "183f10ec17e98fdf37158cc842fd608d449374082ccba5fb5aaa7230d7426bbd",
    "internal/AS3ArraySort.ts": "15a4cc94a7c485c2277343fea40695a80c8934cee925c86e8528ab42ae660fa4",
    "AS3Array.ts": "ab6ba4649b01d37d5607698214d1b41f5f25036a5e6127ba97ddf85f2d363017",
    "AS3BigTurnTableInnerDto.ts": "f7ba5db782eac244b8d4a626afc363081cd510855e818b17ec54a172772b6b91",
    "AS3JSONDefinition.ts": "96d5ab891e3fa946c2d6186fdced2b4f7e2444e7febb03879ff3f16db8cab646",
    "AS3ByteArrayAMF3.ts": "91b52d70bb96c43641820cfc4ae268f7cb4232a494c68b19ed3bf3afebb7d617",
    "AS3ByteArrayNative.ts": "121c5e3a0709c3084d01fb3b23fb781b4ebc83d31178928f5f70e67599309839",
    "AS3Date.ts": "297f63a3b075f82ca6a12efc553f15449490e00e942f0baec01a26fd78de4fc1",
    "AS3URI.ts": "2264c65a2c22fa66d4d14b97b299fe88ba0342f924cc948bf20df159c5cee8bf",
    "AS3ByteArray.ts": "05cbb36473e9e4da1ad4697f1537663d2a2be56c5526a76a3808a0b5110de081",
    "internal/AS3ParseInteger.ts": "fbd902c2c77311d87f0052689743be280a38d2e919c827673cf0f7e55206db95",
    "AS3ClassInitialization.ts": "5b446cdfe43be974455866ca93648b5625edb777938093979e0437aaa8dd501f",
    "AS3Coerce.ts": "e3700336bd177c05d87c7c6f36a0e789afa3c1c4422d995cc48d2868de92f190",
    "AS3Error.ts": "84ef28906a1cf28f600bc36d554af3330b176c4fffa4f47e8f7384919256b134",
    "AS3Embed.ts": "d757c027952372aed3ab06b20bd66de796005e2a32662f877c1913b8dabb5b49",
    "AS3Dictionary.ts": "6093e08ea252cc7926982934da92c1d7785d093880e196c798c67c5f8d7d8f84",
    "AS3Function.ts": "6c6fbac55887dafd777a3592873032b747fe84d87d4c7ce97f3547b07a29c3ba",
    "AS3MethodClosure.ts": "bcc8178b602cb9178fab0edad9e7ef53addf865ee759dfd32f6cb61b4769d890",
    "internal/AS3FunctionLength.ts": "61c6c06f2f8ebb09f297d11a35ccd53c1e9cb2c75265d050f750b0693ed31ef4",
    "AS3ObjectDispatch.ts": "2ccf4b8691a4668b23951ec78cb2c3c18efbbab3e3f727acb0bc55825a900a7a",
    "AS3Object.ts": "ddfc3a328138622ab836ee48452d37ff6c125fb5e2d655584f470d42472098f9",
    "AS3OwnRecord.ts": "932476a585d576b385b1d402fa9fba851125c2796904aaf733da267b5bcf736e",
    "AS3TimerExecution.ts": "0ab89bfad74309ab98472a750925a557f199bf4844094e009a0751ba5d1294fe",
    "AS3Timer.ts": "639a0e3776611b3fd736305994d709b47af8465509bb9d2de440bc611a985851",
    "AS3Type.ts": "f3f5c9d8a597d623611820565973fd6fd0a862358402048314c2ae40e048e508",
    "AS3Vector.ts": "885a8640ea5e26b5186d72dd7f29565723502b250fefeb7ca9877e1bee406078",
    "internal/AS3NumberFormat.ts": "c7a2b808bd4bafded492a65acce6041f67601f2e56308fb2724443f8baa58bc4",
    "internal/AS3CaseTable.ts": "ed85937df05d8ba9015e3cd35b8d75ce46e56348547085c0d218426ed0a44fc5",
    "internal/AS3FileLocalIdentity.ts": "9adbd4a9ab454a7d8351982d6da643d6510d2486658305eb0530170651232abb",
    "internal/AS3TypeRegistry.ts": "ccaccfa450b45b8615b5cb8fe31569a72f12dabe29a53119ac2acae54d80884a",
    "internal/AS3PrimarySecondaryHost.ts": "23cbb0a1777d4dfae93fd766886f1dee5fb943403ca7a76ae92afad32b8f59ab",
    "internal/AS3TimerRuntime.ts": "a72d45f5ba8351fd073fd284978c6b3c7c6dfbbc1adfba7d7ca3a4f058e13dea",
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

function jsonDefinitionFacade(target:{module:string}):string {
    return `export {isSourceJSONDefinition as isNativeJSONDefinition, callSourceJSONDefinition as callNativeJSONDefinition} from "${targetModuleSpecifier(target.module)}";\n`;
}

function byteArrayAMF3Facade(target:{module:string;writerModule:string}):string {
    return `export { readSourceAMF3 as readNativeByteArrayObject } from "${targetModuleSpecifier(target.module)}";\n`
        + `export { writeSourceAMF3 as writeNativeByteArrayObject } from "${targetModuleSpecifier(target.writerModule)}";\n`;
}

function runtimeBundleJavaScript(authorityCode: string, includeBigTurnTableDto: boolean,
    byteArrayNative?: {targetModule:string;targetExport:string},byteArrayAMF3?: {module:string;writerModule:string},jsonDefinitionProvider?: {module:string},includePrimarySecondaryHost=false): string {
    const modules = new Map<string, string>();
    runtimeSourceTemplates(includeBigTurnTableDto,includePrimarySecondaryHost).forEach(template => {
        const moduleId = template.path.slice(0, -3) + ".js";
        const code=template.path==="AS3JSONDefinition.ts" && jsonDefinitionProvider ? jsonDefinitionFacade(jsonDefinitionProvider)
            :template.path==="AS3ByteArrayAMF3.ts" && byteArrayAMF3 ? byteArrayAMF3Facade(byteArrayAMF3)
            : template.path==="AS3ByteArrayNative.ts" && byteArrayNative
            ? `import { ${byteArrayNative.targetExport} as NativeByteArray } from "${targetModuleSpecifier(byteArrayNative.targetModule)}";
export function uncompressNativeByteArray(state: {bytes:Uint8Array;position:number;endian:string}, algorithm?:unknown) {
    const value=new NativeByteArray(state.bytes.slice());
    value.position=state.position;value.endian=state.endian;
    if(arguments.length===1)value.uncompress();else value.uncompress(algorithm as string);
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
    [...modules.entries()].sort(([left], [right]) => Buffer.compare(Buffer.from(left,"utf8"),Buffer.from(right,"utf8")))
        .forEach(([id, code]) => {
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

function runtimeSourceTemplates(includeBigTurnTableDto: boolean,includePrimarySecondaryHost=false): ReadonlyArray<{ path: string; code: string }> {
    const root = resolve(join(__dirname, "..", "src", "hardened-runtime"));
    return Object.keys(RUNTIME_SOURCE_SHA256).filter(path => includeBigTurnTableDto
        || path !== "AS3BigTurnTableInnerDto.ts").filter(path=>includePrimarySecondaryHost
            ||path!=="internal/AS3PrimarySecondaryHost.ts").sort().map(path => {
        const code = readFileSync(join(root, ...path.split("/")), "utf8").replace(/\r\n?/g, "\n");
        if (sha256(code) !== RUNTIME_SOURCE_SHA256[path]) {
            throw new CliError(`runtime package source drifted: ${path}`, 6);
        }
        return Object.freeze({ path, code });
    });
}

function runtimePackageJson(name: string, includeBigTurnTableDto: boolean, includeSecondaryAuthority: boolean,
    includeBrowserAuthority:boolean): string {
    const entries = ["AS3Reflection", "AS3Date", "AS3URI", "AS3Array", ...(includeBigTurnTableDto ? ["AS3BigTurnTableInnerDto"] : []), "AS3ByteArray", "AS3ClassInitialization", "AS3Coerce", "AS3Dictionary", "AS3Enumeration", "AS3Embed", "AS3Error", "AS3Function",
        "AS3MethodClosure", "AS3Object", "AS3ObjectDispatch", "AS3OwnRecord", "AS3RegExp", "AS3Timer", "AS3TimerExecution", "AS3Type", "AS3Vector"];
    const exports: Record<string, string> = Object.create(null) as Record<string, string>;
    entries.forEach(name => { exports[`./${name}`] = name === "AS3Timer"
        ? "./AS3Timer.js" : "./AS3Authority.generated.js"; });
    exports["./AS3Authority"] = "./AS3Authority.generated.js";
    exports["./ApplicationEntry"] = "./ApplicationEntry.generated.js";
    if (includeSecondaryAuthority) exports["./SecondaryAuthorityReceipt"] = "./SecondaryAuthority.receipt.json";
    return `${JSON.stringify({ name, version: "0.1.0", private: true,
        type: "commonjs", exports, files: ["AS3Authority.generated.js", "AS3Timer.js", "ApplicationEntry.generated.js",
            ...(includeSecondaryAuthority ? ["AchievementModule.source-closure.json", "SecondaryAuthority.receipt.json"] : []),
            ...(includeBrowserAuthority?["achievement-secondary-linker/*","achievement-primary-host/*",
                "achievement-primary-host-bundle-candidate/*",
                "achievement-primary-runtime/**/*.mjs"]:[]),
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
    const inputs = options.operation !== "parse" && options.sourceClosurePath
        ? discoverAuthenticatedInputs(options.sourceDirectory, options.sourceClosurePath, options.limits)
        : options.operation !== "parse" && options.sourcePlanPath
        ? discoverAuthenticatedSourcePlan(options.sourceDirectory,options.sourcePlanPath,options.limits)
        : discoverInputs(options.sourceDirectory, options.limits);
    const parserWorkerSha256 = captureParserWorkerSha256();
    const transpileAuthority = options.operation !== "parse"
        ? loadTranspileAuthority(options.sourceCensusPath, options.targetCapabilitiesPath, options.profileLockPath)
        : null;
    if (inputs.sourceClosureSha256 !== undefined||inputs.sourcePlanSha256!==undefined) {
        if (transpileAuthority!.profileSha256 === null
            || inputs.sourceClosureProfileSha256 !== transpileAuthority!.profileSha256) {
            throw new CliError("source closure is not bound to the selected application profile", 6);
        }
        for (const module of ["application", "bootstrap"] as const) {
            if (inputs.sourcePrefixes![module] !== transpileAuthority!.localTypes.sourceRoots[module]) {
                throw new CliError(`source closure ${module} prefix differs from the selected application profile`, 6);
            }
        }
    }
    const authenticatedIncludeContexts=new Map<string,{includeRootPath:string;
        includeFragments:import("../hardened/source-includes").IncludeSource[];
        includeEdges:import("../hardened/source-includes").IncludeEdge[]}>();
    if(inputs.authenticatedSourceDocument) {
        const includedFiles=inputs.files.filter(file=>file.includeFragment);
        const closureEdges=inputs.sourceIncludeEdges!;
        if((includedFiles.length>0||closureEdges.application.length>0||closureEdges.bootstrap.length>0)
            && !transpileAuthority!.sourceIncludes) throw new CliError("multi-root source includes lack profile authority",6);
        if(transpileAuthority!.sourceIncludes) {
            const authority=transpileAuthority!.sourceIncludes,inventory=authority.inventory;
            const moduleIndex=inputs.roots.findIndex(root=>root===inventory.sourceRoot);
            if(moduleIndex<0) {
                if(includedFiles.length||closureEdges.application.length||closureEdges.bootstrap.length)
                    throw new CliError("multi-root include authority source root has no exact closure owner",6);
            } else {
                const module=(moduleIndex===0?"application":"bootstrap") as "application"|"bootstrap";
                const other=module==="application"?"bootstrap":"application";
                if(inputs.files.some(file=>file.authorityModule===other&&file.includeFragment)||closureEdges[other].length)
                    throw new CliError("multi-root include fragments and edges must remain within their authority root",6);
                const roots=inputs.files.filter(file=>file.authorityModule===module&&!file.includeFragment
                    && inventory.roots.some(row=>row.path===file.sourceRelativePath));
                for(const file of roots) {
                    const row=inventory.roots.find(item=>item.path===file.sourceRelativePath)!;
                    if(row.sha256!==sha256(readInput(file).bytes)) throw new CliError("profile include root differs from authenticated closure",6);
                }
                const reachableEdges:typeof inventory.edges=[];const reachable=new Set(roots.map(file=>file.sourceRelativePath));
                for(let changed=true;changed;) { changed=false; for(const edge of inventory.edges) if(reachable.has(edge.ownerPath)) {
                    if(!reachableEdges.some(item=>canonicalJson(item)===canonicalJson(edge))) reachableEdges.push(edge);
                    if(!reachable.has(edge.targetPath)){reachable.add(edge.targetPath);changed=true;}
                }}
                const expectedEdges=reachableEdges.sort((left,right)=>Buffer.compare(Buffer.from(canonicalJson(left),"utf8"),
                    Buffer.from(canonicalJson(right),"utf8")));
                if(canonicalJson(expectedEdges)!==canonicalJson(closureEdges[module]))
                    throw new CliError("multi-root include edges differ from the exact profile-authority projection",6);
                const expectedFragments=inventory.fragments.filter(item=>reachable.has(item.path))
                    .sort((left,right)=>Buffer.compare(Buffer.from(left.path,"utf8"),Buffer.from(right.path,"utf8")));
                const actualFragments=includedFiles.filter(file=>file.authorityModule===module)
                    .sort((left,right)=>Buffer.compare(Buffer.from(left.sourceRelativePath,"utf8"),Buffer.from(right.sourceRelativePath,"utf8")));
                if(expectedFragments.length!==actualFragments.length||expectedFragments.some((row,index)=>{
                    const file=actualFragments[index];return !file||file.sourceRelativePath!==row.path
                        ||file.byteLength!==row.bytes||sha256(readInput(file).bytes)!==row.sha256;
                })) throw new CliError("multi-root include fragments differ from the exact profile-authority projection",6);
                const fragments=authority.fragments.filter(item=>reachable.has(item.path));
                for(const file of roots) authenticatedIncludeContexts.set(file.portablePath,{includeRootPath:file.sourceRelativePath,
                    includeFragments:fragments,includeEdges:closureEdges[module] as import("../hardened/source-includes").IncludeEdge[]});
            }
        }
    }
    const secondaryRequest = options.operation === "transpile" && options.secondaryAuthorityPath
        ? loadSecondaryAuthorityRequest(options.secondaryAuthorityPath) : null;
    if (secondaryRequest && (secondaryRequest.applicationId !== transpileAuthority!.applicationId
        || secondaryRequest.profileSha256 !== transpileAuthority!.profileSha256
        || secondaryRequest.sourceClosureSha256 !== inputs.sourceClosureSha256)) {
        throw new CliError("secondary authority request is not bound to the selected profile and source closure", 6);
    }
    const compilerProvider:CompilerProviderAuthority|null=secondaryRequest&&options.operation==="transpile"
        ?loadCompilerProviderAuthority(options.compilerProviderPath!,secondaryRequest.compilerProviderSha256,{
            packageLockSha256:sha256(readFileSync(join(__dirname,"..","package-lock.json"))),
            commandSha256:sha256(readFileSync(join(__dirname,"command.js"))),parserWorkerSha256,
        }):null;
    let publication: Publication | undefined;
    try {
        publication = preparePublication(options.outputDirectory, inputs.roots);
        const manifestFiles: ManifestFile[] = [];
        const transpiledFiles: TranspiledManifestFile[] = [];
        const qualificationFiles: QualificationFile[] = [];
        const outputKeys = new Set<string>();
        const qualificationOwners = new Map<string, QualificationFile>();
        const localOutputDependencies = new Map<QualificationFile | TranspiledManifestFile, string[]>();
        let applicationEntry: EmittedRuntimeApplicationEntry | null = null;
        let applicationStartEvidence:Readonly<{schema:"as3-application-start-evidence@1";
            profileSha256:string;typeAuthoritySha256:string;
            contract:NonNullable<EmittedRuntimeApplicationEntry["applicationStart"]>;
            applicationEntry:Readonly<{path:string;bytes:number;sha256:string}>;
            constructorModule:Readonly<{path:string;bytes:number;sha256:string;exportName:string}>}>|null=null;
        let runtimeAuthority: EmittedRuntimeAuthority | null = null;
        let browserRuntimeAuthorityCode:string|null=null;
        let secondaryAuthority: EmittedSecondaryAuthority | null = null;
        let secondaryBrowserPackage:EmittedBrowserLinkerPackage|null=null;
        let primarySecondaryHostPackage:EmittedPrimarySecondaryHostPackage|null=null;
        let primaryHostBundleCandidate:EmittedPrimaryHostBundleCandidate|null=null;
        let primaryBrowserRuntime:EmittedBrowserEsmRuntime|null=null;
        let derivedSourceClosure:Readonly<{path:string;json:string;sha256:string}>|null=null;
        const runtimeAuthoritySources: RuntimeAuthoritySource[] = transpileAuthority === null
            ? [] : [...transpileAuthority.runtimeTypeSources];
        const localRuntimePrograms: SemanticProgram[] = [];
        const secondaryModules = new Map<string, SecondaryModuleIdentity>();
        const secondaryExecutableArtifacts: SecondaryArtifactIdentity[] = [];
        const browserLinkerPrograms:BrowserLinkerProgram[]=[];
        const browserAuthoritySources:RuntimeAuthorityClassSource[]=[];
        const browserApplicationSources:Array<BrowserEsmSource&{sourceModule:"application"|"bootstrap"}>=[];
        const derivedSemanticDependencies=new Map<string,readonly string[]>();
        const embeddedResources: Array<{id: string; sourcePath: string; path: string; sha256: string; bytes: number}> = [];
        const resourceInputs = new Map<string, string>();
        const includedFragments: Array<{sourcePath:string;sourceSha256:string;sourceBytes:number}> = [];
        let totalOutputBytes = 0;

        for (const file of inputs.files) {
            const source = readInput(file);
            if(file.includeFragment) {
                includedFragments.push({sourcePath:file.portablePath,sourceSha256:sha256(source.bytes),sourceBytes:source.bytes.length});
                continue;
            }
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
                    authenticatedIncludeContexts.get(file.portablePath) || (transpileAuthority?.sourceIncludes ? (() => {
                        const includes=transpileAuthority!.sourceIncludes!;
                        const root=includes.inventory.roots.find(item=>item.path===file.portablePath);
                        if(!root) return undefined;
                        if (root.sha256!==sha256(source.bytes)) throw new Error("HARDENED_INCLUDE_ROOT_IDENTITY: selected source differs from include authority");
                        if(!includes.inventory.edges.some(edge=>edge.ownerPath===root.path)) return undefined;
                        return {includeRootPath:root.path,includeFragments:includes.fragments,includeEdges:includes.inventory.edges};
                    })() : undefined), transpileAuthority?.compileDefinitions);
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
                    const relativeSourcePath = sourceAuthorityPath(file);
                    const owners = local.entries.filter(entry =>
                        (file.authorityModule === undefined || entry.module === file.authorityModule)
                        && entry.sourcePath === `${local.sourceRoots[entry.module]}${relativeSourcePath}`
                        && entry.sourceContentSha256 === canonicalSourceSha256);
                    if (owners.length !== 1) {
                        throw new HardenedSemanticError("HARDENED_APPLICATION_SOURCE_IDENTITY",
                            `source ${file.portablePath} does not match one exact application-profile source hash`);
                    }
                }
                const normalized = JSON.parse(parsedFile.json) as NormalizedParserAst;
                const definitions = transpileAuthority!.compileDefinitions;
                if (normalized.compileDefinitionsSha256 !== (definitions ? compileDefinitionsHash(definitions, sha256) : undefined))
                    throw new HardenedSemanticError("HARDENED_COMPILE_DEFINITIONS", "parser configuration differs from profile authority");
                const semantic = adaptNormalizedParserAst(normalized, transpileAuthority!.authority,
                    source.content, value => sha256(value), transpileAuthority!.localTypes, sourceAuthorityPath(file),
                    transpileAuthority!.localMembers, transpileAuthority!.runtimeTypeSources,
                    transpileAuthority!.sourceMembers || undefined);
                const programs = [semantic, ...(semantic.fileLocalPrograms || [])];
                const exactDependencies=assertAuthenticatedSourceShape(file, programs);
                if(exactDependencies) derivedSemanticDependencies.set(file.portablePath,exactDependencies);
                for (const program of programs) if (program.declaration.declarationKind === "class") for (const member of program.declaration.members) {
                    if (member.kind !== "field" || !member.embeddedBitmap) continue;
                    const asset = member.embeddedBitmap;
                    const resourcePath = resolve(dirname(file.absolutePath), asset.source);
                    if (!resourcePath.startsWith(file.sourceRoot + sep) || realpathSync.native(resourcePath) !== resourcePath
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
                if(secondaryRequest?.schema==="as3-secondary-browser-linker-request@2"&&file.authorityModule==="application") {
                    if(programs.length!==1)throw new CliError("browser secondary application source emits file-local declarations",4);
                    const qname=programs[0]!.packageName.length===0?programs[0]!.declaration.name
                        :`${programs[0]!.packageName}.${programs[0]!.declaration.name}`;
                    browserLinkerPrograms.push(Object.freeze({qname,program:programs[0]!,code:outputs[0]!.code,
                        sourcePath:file.sourceRelativePath,sourceBytes:source.bytes.length,sourceSha256:sha256(source.bytes)}));
                }
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
                    const qname = output.program.packageName.length === 0 ? output.program.declaration.name
                        : `${output.program.packageName}.${output.program.declaration.name}`;
                    if (secondaryModules.has(qname)) throw new CliError(`duplicate emitted QName: ${qname}`, 4);
                    secondaryModules.set(qname, {qname, exportName:output.program.declaration.name,
                        sourceModule:file.authorityModule!,
                        sourcePath:file.portablePath,sourceBytes:source.bytes.byteLength,sourceSha256:sha256(source.bytes),
                        typescriptPath:output.packagePath,typescriptBytes:output.bytes,typescriptSha256:output.hash,
                        javascriptPath:output.packagePath.slice(0,-3)+".js",javascriptBytes:Buffer.byteLength(javascript,"utf8"),
                        javascriptSha256:sha256(javascript)});
                    secondaryExecutableArtifacts.push({path:output.packagePath.slice("__as3_runtime/".length,-3)+".js",
                        bytes:Buffer.byteLength(javascript,"utf8"),sha256:sha256(javascript)});
                    if(file.authorityModule)browserApplicationSources.push(Object.freeze({
                        path:output.packagePath.slice("__as3_runtime/".length,-3)+".mjs",code:output.code,
                        sourceModule:file.authorityModule}));
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
            if(inputs.sourcePlanSha256&&qualificationFiles.every(item=>item.status==="admitted")) {
                const json=deriveAuthenticatedSourceClosure(inputs,derivedSemanticDependencies);
                derivedSourceClosure=Object.freeze({path:"derived-source-closure.json",json,sha256:sha256(json)});
                totalOutputBytes+=Buffer.byteLength(json,"utf8");
                if(totalOutputBytes>options.limits.maxTotalOutputBytes)
                    throw new CliError("derived source closure exceeds --max-total-output-bytes",5);
                writeArtifact(publication,derivedSourceClosure.path,json);
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
                        const source=localRuntimeTypeAuthoritySource(semantic,
                            `./application/${semantic.outputModulePath.slice(0, -3)}`);
                        const browserSecondary=secondaryRequest?.schema==="as3-secondary-browser-linker-request@2"
                            &&browserLinkerPrograms.some(program=>program.qname===source.qname);
                        if(browserSecondary)browserAuthoritySources.push(source);else runtimeAuthoritySources.push(source);
                        const embedded=localRuntimeEmbeddedAuthoritySources(semantic,
                            `./application/${semantic.outputModulePath.slice(0, -3)}`);
                        if(browserSecondary&&embedded.length)throw new CliError("browser secondary application class has embedded type authority",6);
                        runtimeAuthoritySources.push(...embedded);
                    } else if (semantic.declaration.declarationKind === "interface") {
                        runtimeAuthoritySources.push(localRuntimeInterfaceAuthoritySource(semantic));
                    }
                });
            } catch (error) {
                throw new CliError(`transpile rejected runtime authority source set: ${errorMessage(error)}`, 4);
            }
            const packageJson = runtimePackageJson(transpileAuthority!.runtimePackage,
                transpileAuthority!.includeBigTurnTableDto, secondaryRequest?.schema === "as3-secondary-authority-request@1",
                secondaryRequest?.schema === "as3-secondary-browser-linker-request@2");
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
            if(hasNativeRegExpAuthority(transpileAuthority!.sourceMembers) && transpileAuthority!.authority.stringPatternProvider?.regExpModule)
                runtimeAuthoritySources.push(regExpRuntimeTypeAuthoritySource(transpileAuthority!.sourceMembers!,transpileAuthority!.authority.stringPatternProvider!));
            if(hasNativeDateAuthority(transpileAuthority!.sourceMembers))
                runtimeAuthoritySources.push(dateRuntimeTypeAuthoritySource(transpileAuthority!.sourceMembers!,RUNTIME_SOURCE_SHA256["AS3Date.ts"]!,transpileAuthority!.authority.dateProvider));
            if(transpileAuthority!.sourceMembers && transpileAuthority!.authority.errorStackProvider)
                runtimeAuthoritySources.push(errorRuntimeTypeAuthoritySource(transpileAuthority!.sourceMembers,
                    transpileAuthority!.authority.errorStackProvider));
            runtimeAuthority = emitRuntimeTypeAuthority(runtimeAuthoritySources, value => sha256(value),
                transpileAuthority!.reflectionProvider ? {
                    target: transpileAuthority!.reflectionProvider,
                    targetCapabilitiesJson: readFileSync(options.targetCapabilitiesPath!, "utf8"),
                } : undefined);
            if(secondaryRequest?.schema==="as3-secondary-browser-linker-request@2") {
                if(runtimeAuthority.sha256!==secondaryRequest.primaryAuthority.typeAuthoritySha256)
                    throw new CliError(`browser secondary primary type authority differs from the emitted sealed registry: expected ${runtimeAuthority.sha256}`,6);
                browserRuntimeAuthorityCode=exposePrimarySecondaryHostAdapter(runtimeAuthority.code);
            }
            const runtimeAuthorityPath = "__as3_runtime/AS3Authority.generated.js";
            const authorityJavaScript = runtimeBundleJavaScript(runtimeAuthority.code,
                transpileAuthority!.includeBigTurnTableDto, transpileAuthority!.authority.byteArrayNative, transpileAuthority!.authority.byteArrayAMF3, transpileAuthority!.authority.jsonDefinitionProvider);
            const authorityJavaScriptIdentity = {path:"AS3Authority.generated.js",
                bytes:Buffer.byteLength(authorityJavaScript,"utf8"),sha256:sha256(authorityJavaScript)};
            secondaryExecutableArtifacts.push(authorityJavaScriptIdentity);
            totalOutputBytes += Buffer.byteLength(authorityJavaScript, "utf8");
            if (totalOutputBytes > options.limits.maxTotalOutputBytes) {
                throw new CliError("TypeScript output set exceeds --max-total-output-bytes", 5);
            }
            writeArtifact(publication, runtimeAuthorityPath, authorityJavaScript);
            const timerFacadeJavaScript = runtimeTimerFacadeJavaScript();
            const timerJavaScriptIdentity={path:"AS3Timer.js",bytes:Buffer.byteLength(timerFacadeJavaScript,"utf8"),
                sha256:sha256(timerFacadeJavaScript)};
            secondaryExecutableArtifacts.push(timerJavaScriptIdentity);
            totalOutputBytes += Buffer.byteLength(timerFacadeJavaScript, "utf8");
            if (totalOutputBytes > options.limits.maxTotalOutputBytes) {
                throw new CliError("TypeScript output set exceeds --max-total-output-bytes", 5);
            }
            writeArtifact(publication, "__as3_runtime/AS3Timer.js", timerFacadeJavaScript);
            try {
                applicationEntry = emitRuntimeApplicationEntry(transpiledFiles.map(item =>
                    item.typescriptPath.slice("__as3_runtime/".length)),
                    value => sha256(value),localRuntimePrograms,transpileAuthority!.applicationStart);
            } catch(error) {
                throw new CliError(`transpile rejected application entry: ${errorMessage(error)}`,4);
            }
            const applicationEntryPath = `__as3_runtime/${applicationEntry.path}`;
            const entryCollisionKey = portableCollisionKey(applicationEntryPath);
            if (outputKeys.has(entryCollisionKey)) {
                throw new CliError(`application entry path collides with emitted output: ${applicationEntryPath}`, 4);
            }
            const entryBytes = Buffer.byteLength(applicationEntry.code, "utf8");
            const entryJavaScript = runtimeCommonJs(applicationEntry.code, applicationEntryPath);
            secondaryExecutableArtifacts.push({path:"ApplicationEntry.generated.js",
                bytes:Buffer.byteLength(entryJavaScript,"utf8"),sha256:sha256(entryJavaScript)});
            totalOutputBytes += entryBytes + Buffer.byteLength(entryJavaScript, "utf8");
            if (totalOutputBytes > options.limits.maxTotalOutputBytes) {
                throw new CliError("TypeScript output set exceeds --max-total-output-bytes", 5);
            }
            writeArtifact(publication, applicationEntryPath, applicationEntry.code);
            writeArtifact(publication, "__as3_runtime/ApplicationEntry.generated.js", entryJavaScript);
            if(applicationEntry.applicationStart) {
                const startModule=secondaryModules.get(applicationEntry.applicationStart.qname);
                if(!startModule||startModule.typescriptPath!==`__as3_runtime/${applicationEntry.applicationStart.constructorModulePath}`)
                    throw new CliError("application start constructor output identity differs",6);
                applicationStartEvidence=Object.freeze({schema:"as3-application-start-evidence@1",
                    profileSha256:transpileAuthority!.profileSha256!,typeAuthoritySha256:runtimeAuthority.sha256,
                    contract:applicationEntry.applicationStart,
                    applicationEntry:Object.freeze({path:"__as3_runtime/ApplicationEntry.generated.js",
                        bytes:Buffer.byteLength(entryJavaScript,"utf8"),sha256:sha256(entryJavaScript)}),
                    constructorModule:Object.freeze({path:startModule.javascriptPath,bytes:startModule.javascriptBytes,
                        sha256:startModule.javascriptSha256,exportName:startModule.exportName})});
            }
            if (secondaryRequest) {
                const modules = secondaryRequest.exports.map(item => secondaryModules.get(item.qname));
                if (modules.some(module => module === undefined)) {
                    throw new CliError("secondary authority export is absent from the authenticated output set", 6);
                }
                const expectedExecutableQNames=inputs.files.filter(file=>!file.includeFragment)
                    .flatMap(file=>file.expectedQNames||[]).sort((left,right)=>Buffer.compare(Buffer.from(left,"utf8"),Buffer.from(right,"utf8")));
                const executableModules=[...secondaryModules.values()].sort((left,right)=>
                    Buffer.compare(Buffer.from(left.qname,"utf8"),Buffer.from(right.qname,"utf8")));
                if(canonicalJson(expectedExecutableQNames)!==canonicalJson(executableModules.map(module=>module.qname)))
                    throw new CliError("secondary executable QName mapping differs from the authenticated source closure",6);
                const sourceClosureBytes=readFileSync(options.sourceClosurePath!);
                const sourceClosureIdentity={path:"AchievementModule.source-closure.json",bytes:sourceClosureBytes.length,
                    sha256:sha256(sourceClosureBytes)};
                if(sourceClosureIdentity.sha256!==inputs.sourceClosureSha256) throw new CliError("source closure changed during generation",6);
                if(secondaryRequest.schema==="as3-secondary-authority-request@1") {
                    writeArtifact(publication,`__as3_runtime/${sourceClosureIdentity.path}`,sourceClosureBytes);
                    totalOutputBytes+=sourceClosureBytes.length;
                    secondaryAuthority = emitSecondaryAuthorityReceipt(secondaryRequest, {
                        applicationId: transpileAuthority!.applicationId, profileSha256: transpileAuthority!.profileSha256!,
                        sourceClosureSha256: inputs.sourceClosureSha256!, typeAuthoritySha256: runtimeAuthority.sha256,
                        compiler: {toolVersion:TOOL_VERSION,parserWorkerSha256,typeScriptVersion:transpileAuthority!.typeScriptVersion},
                        compilerProvider:compilerProvider!,executableModules,
                        packageMetadata: {path:"package.json",bytes:Buffer.byteLength(packageJson,"utf8"),sha256:sha256(packageJson)},
                        runtimeAuthority: authorityJavaScriptIdentity,
                        sourceClosure:sourceClosureIdentity,
                        executableClosure: secondaryExecutableArtifacts.sort((left,right)=>
                            Buffer.compare(Buffer.from(left.path,"utf8"),Buffer.from(right.path,"utf8"))),
                        modules: modules as SecondaryModuleIdentity[],
                    });
                    totalOutputBytes += Buffer.byteLength(secondaryAuthority.json,"utf8");
                    if (totalOutputBytes > options.limits.maxTotalOutputBytes) throw new CliError("secondary authority receipt exceeds output limit",5);
                    writeArtifact(publication, `__as3_runtime/${secondaryAuthority.path}`, secondaryAuthority.json);
                } else {
                    secondaryBrowserPackage=emitBrowserSecondaryLinkerPackage(secondaryRequest,compilerProvider!,sourceClosureBytes,
                        inputs.authenticatedSourceDocument,browserLinkerPrograms,browserAuthoritySources);
                    for(const file of secondaryBrowserPackage.files) {
                        totalOutputBytes+=file.identity.bytes;
                        if(totalOutputBytes>options.limits.maxTotalOutputBytes)throw new CliError("browser secondary linker package exceeds output limit",5);
                        writeArtifact(publication,`__as3_runtime/${secondaryBrowserPackage.root}/${file.path}`,file.body);
                    }
                    const browserRuntimeSources:BrowserEsmSource[]=[...runtimeSourceTemplates(
                        transpileAuthority!.includeBigTurnTableDto,true).map(template=>Object.freeze({
                            path:template.path.slice(0,-3)+".mjs",
                            code:template.path==="AS3JSONDefinition.ts"&&transpileAuthority!.authority.jsonDefinitionProvider
                                ?jsonDefinitionFacade(transpileAuthority!.authority.jsonDefinitionProvider)
                                :template.path==="AS3ByteArrayAMF3.ts"&&transpileAuthority!.authority.byteArrayAMF3
                                ?byteArrayAMF3Facade(transpileAuthority!.authority.byteArrayAMF3)
                                :template.path==="AS3ByteArrayNative.ts"&&transpileAuthority!.authority.byteArrayNative
                                ?`import { ${transpileAuthority!.authority.byteArrayNative.targetExport} as NativeByteArray } from "${targetModuleSpecifier(transpileAuthority!.authority.byteArrayNative.targetModule)}";\nexport function uncompressNativeByteArray(state: {bytes:Uint8Array;position:number;endian:string}, algorithm?:unknown) {\n    const value=new NativeByteArray(state.bytes.slice());\n    value.position=state.position;value.endian=state.endian;\n    if(arguments.length===1)value.uncompress();else value.uncompress(algorithm as string);\n    return {bytes:new Uint8Array(value.buffer),position:value.position,endian:value.endian};\n}\n`
                                :template.code})),
                        Object.freeze({path:"AS3Authority.generated.mjs",code:browserRuntimeAuthorityCode!}),
                        ...browserApplicationSources.filter(source=>source.sourceModule==="bootstrap")];
                    const runtimeRoots=["AS3Authority.generated.mjs",...secondaryBrowserPackage.primaryHostInventory.runtimeImports.map(specifier=>{
                        if(!specifier.startsWith(`${transpileAuthority!.runtimePackage}/`))
                            throw new CliError(`browser primary runtime import is outside the compiler-owned package: ${specifier}`,6);
                        return `${specifier.slice(transpileAuthority!.runtimePackage.length+1)}.mjs`;
                    })];
                    primaryBrowserRuntime=emitBrowserEsmRuntime(browserRuntimeSources,transpileAuthority!.runtimePackage,runtimeRoots);
                    for(const file of primaryBrowserRuntime.files) {
                        totalOutputBytes+=file.identity.bytes;
                        if(totalOutputBytes>options.limits.maxTotalOutputBytes)throw new CliError("browser primary runtime exceeds output limit",5);
                        writeArtifact(publication,`__as3_runtime/${primaryBrowserRuntime.root}/${file.path}`,file.body);
                    }
                    primarySecondaryHostPackage=emitPrimarySecondaryHostPackage(secondaryBrowserPackage,compilerProvider!,
                        primaryBrowserRuntime,transpileAuthority!.runtimePackage,
                        runtimeAuthoritySources.filter((source):source is RuntimeAuthorityClassSource=>source.kind==="class"));
                    for(const file of primarySecondaryHostPackage.files) {
                        totalOutputBytes+=file.identity.bytes;
                        if(totalOutputBytes>options.limits.maxTotalOutputBytes)throw new CliError("browser primary host package exceeds output limit",5);
                        writeArtifact(publication,`__as3_runtime/${primarySecondaryHostPackage.root}/${file.path}`,file.body);
                    }
                    primaryHostBundleCandidate=emitPrimaryHostBundleCandidate(primarySecondaryHostPackage,
                        primaryBrowserRuntime,compilerProvider!);
                    for(const file of primaryHostBundleCandidate.files) {
                        totalOutputBytes+=file.identity.bytes;
                        if(totalOutputBytes>options.limits.maxTotalOutputBytes)
                            throw new CliError("browser primary host bundle candidate exceeds output limit",5);
                        writeArtifact(publication,`__as3_runtime/${primaryHostBundleCandidate.root}/${file.path}`,file.body);
                    }
                }
            }
        }

        if(transpileAuthority?.sourceIncludes) loadSourceIncludes(JSON.stringify(transpileAuthority.sourceIncludes.inventory));
        assertParserWorkerSha256(parserWorkerSha256);
        for (const file of inputs.files) readInput(file);
        if (inputs.sourceClosureSha256 !== undefined
            && sha256(readFileSync(options.operation === "parse" ? "" : options.sourceClosurePath!)) !== inputs.sourceClosureSha256) {
            throw new CliError("source closure changed during generation", 6);
        }
        if(inputs.sourcePlanSha256!==undefined&&options.operation!=="parse"
            &&sha256(readFileSync(options.sourcePlanPath!))!==inputs.sourcePlanSha256)
            throw new CliError("source plan changed during generation",6);
        if (secondaryRequest) assertSecondaryAuthorityRequestUnchanged(secondaryRequest);
        if(compilerProvider) assertCompilerProviderAuthorityUnchanged(compilerProvider);
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
            ...(applicationStartEvidence?{applicationStart:applicationStartEvidence}:{}),
            nativeTimerAuthoritySha256: transpileAuthority!.nativeTimerAuthoritySha256,
            applicationId: transpileAuthority!.applicationId,
            profileLockSha256: transpileAuthority!.profileSha256,
            runtimePackage: transpileAuthority!.runtimePackage,
            classification: "capability-authenticated-typescript-proposal",
            embeddedResources,
            ...(secondaryAuthority ? {secondaryAuthorityReceiptPath:`__as3_runtime/${secondaryAuthority.path}`,
                secondaryAuthorityReceiptSha256:secondaryAuthority.sha256} : {}),
            ...(secondaryBrowserPackage?{secondaryBrowserLinkerPackageRoot:`__as3_runtime/${secondaryBrowserPackage.root}`,
                secondaryBrowserLinkerReceipt:secondaryBrowserPackage.receipt,
                secondaryBrowserLinkerModule:secondaryBrowserPackage.module,
                secondaryBrowserLinkerTypeAuthority:secondaryBrowserPackage.typeAuthority,
                secondaryBrowserLinkerSourceClosure:secondaryBrowserPackage.sourceClosure}:{}),
            ...(primarySecondaryHostPackage?{primarySecondaryHostCandidatePackageRoot:`__as3_runtime/${primarySecondaryHostPackage.root}`,
                primarySecondaryHostCandidateStatus:"held",
                primarySecondaryHostCandidateHolds:["AP_ACHIEVEMENT_PRIMARY_HOST_BROWSER_ESM_CLOSURE_UNQUALIFIED"],
                primarySecondaryHostCandidateReceipt:primarySecondaryHostPackage.receipt,
                primarySecondaryHostCandidateModule:primarySecondaryHostPackage.module,
                primaryBrowserRuntimeCandidateRoot:`__as3_runtime/${primaryBrowserRuntime!.root}`}:{}),
            ...(primaryHostBundleCandidate?{primaryHostBundleCandidatePackageRoot:`__as3_runtime/${primaryHostBundleCandidate.root}`,
                primaryHostBundleCandidateStatus:"held",
                primaryHostBundleCandidateHolds:["AP_ACHIEVEMENT_PRIMARY_HOST_BROWSER_EXECUTION_UNVERIFIED"],
                primaryHostBundleCandidateReceipt:primaryHostBundleCandidate.receipt,
                primaryHostBundleCandidateModule:primaryHostBundleCandidate.module}:{}),
            ...(inputs.sourceClosureSha256 ? {sourceClosureSha256: inputs.sourceClosureSha256} : {}),
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
            ...(transpileAuthority!.applicationStart?{applicationStartContract:transpileAuthority!.applicationStart}:{}),
            counts: qualificationCounts,
            ...(inputs.sourceClosureSha256 ? {sourceClosureSha256: inputs.sourceClosureSha256} : {}),
            ...(inputs.sourcePlanSha256?{sourcePlanSha256:inputs.sourcePlanSha256}:{}),
            ...(derivedSourceClosure?{derivedSourceClosurePath:derivedSourceClosure.path,
                derivedSourceClosureSha256:derivedSourceClosure.sha256}:{}),
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
