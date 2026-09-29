import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { CliError } from "./errors";
import { assertNoSymlinkComponents, portableCollisionKey } from "./inputs";

const SHA256 = /^[0-9a-f]{64}$/;
const QNAME = /^(?:[A-Za-z_$][A-Za-z0-9_$]*\.)*[A-Za-z_$][A-Za-z0-9_$]*$/;
const ID = /^[a-z][a-z0-9._-]{1,127}$/;

function exactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const actual = Object.keys(value).sort(), expected = [...keys].sort();
    return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

export function canonicalJson(value: unknown): string {
    if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
    if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
    if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
        const record = value as Record<string, unknown>;
        return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
    }
    throw new CliError("secondary authority contains a non-JSON value", 6);
}

export interface LegacySecondaryAuthorityRequest {
    readonly schema: "as3-secondary-authority-request@1";
    readonly applicationId: string;
    readonly profileSha256: string;
    readonly sourceClosureSha256: string;
    readonly compilerProviderSha256: string;
    readonly exports: readonly Readonly<{ qname: string }>[];
    readonly requestSha256: string;
    readonly requestPath: string;
}

export interface BrowserPrimaryAuthorityIdentity {
    readonly runtimeAuthoritySha256:string;
    readonly typeAuthoritySha256:string;
}

export interface BrowserExecutableSourceIdentity {
    readonly qname:string;readonly path:string;readonly sha256:string;readonly bytes:number;
    readonly swfDecompiledSha256:string;readonly swfDecompiledBytes:number;
    readonly swfDecompiledNormalizedSha256:string;readonly swfDecompiledNormalizedBytes:number;
    readonly matchesSwfDecompilationAfterLineEndingNormalization:boolean;
}

export interface BrowserSecondaryAuthorityRequest {
    readonly schema:"as3-secondary-browser-linker-request@2";
    readonly applicationId:string;
    readonly profileSha256:string;
    readonly sourceClosureSha256:string;
    readonly compilerProviderSha256:string;
    readonly primaryAuthority:BrowserPrimaryAuthorityIdentity;
    readonly executable:Readonly<{
        logicalPath:string;documentBundleId:string;modulePartQName:string;
        sourceSwf:Readonly<{path:string;sha256:string;bytes:number}>;
        sources:readonly BrowserExecutableSourceIdentity[];
    }>;
    readonly exports:readonly Readonly<{qname:string}>[];
    readonly requestSha256:string;
    readonly requestPath:string;
}

export type SecondaryAuthorityRequest=LegacySecondaryAuthorityRequest|BrowserSecondaryAuthorityRequest;

export interface CompilerProviderAuthority {
    readonly repository:string;readonly commit:string;readonly packageLockSha256:string;
    readonly authoritySha256:string;
    readonly authorityPath:string;
}

export interface SecondaryArtifactIdentity {
    path: string;
    bytes: number;
    sha256: string;
}

export interface SecondaryModuleIdentity {
    qname: string;
    exportName: string;
    sourceModule:"application"|"bootstrap";
    sourcePath: string;
    sourceBytes: number;
    sourceSha256: string;
    typescriptPath: string;
    typescriptBytes: number;
    typescriptSha256: string;
    javascriptPath: string;
    javascriptBytes: number;
    javascriptSha256: string;
}

export interface EmittedSecondaryAuthority {
    readonly path: "SecondaryAuthority.receipt.json";
    readonly json: string;
    readonly sha256: string;
}

const ACHIEVEMENT_QNAMES=Object.freeze(["AchievementModule",
    "achievement.commands.CmdGetKeepOnlineAchievements",
    "achievement.commands.CmdGetLastOnlineAchievements",
    "achievement.mediator.AchievementPresentionMediator",
    "achievement.proxy.AchievementPresentionProxy",
    "achievement.ui.AchievementPresentationPart"]);

function artifactIdentity(value:unknown,label:string):Readonly<{path:string;sha256:string;bytes:number}> {
    if(!exactKeys(value,["bytes","path","sha256"])||typeof value.path!=="string"||!safeRelative(value.path)
        ||typeof value.sha256!=="string"||!SHA256.test(value.sha256)||!Number.isSafeInteger(value.bytes)||Number(value.bytes)<=0)
        throw new CliError(`${label} is invalid`,6);
    return Object.freeze({path:value.path,sha256:value.sha256,bytes:value.bytes as number});
}

function safeRelative(value:string):boolean {
    return !!value&&value===value.normalize("NFC")&&!value.startsWith("/")&&!/[\\%?#:\s\x00-\x1f\x7f-\x9f]/.test(value)
        &&!value.split("/").some(part=>!part||part==="."||part==="..");
}

export function loadSecondaryAuthorityRequest(pathArgument: string): SecondaryAuthorityRequest {
    const path = resolve(pathArgument);
    assertNoSymlinkComponents(path, "secondary authority request");
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024 || realpathSync.native(path) !== path) {
        throw new CliError("secondary authority request must be an ordinary bounded canonical file", 6);
    }
    const bytes = readFileSync(path), text = bytes.toString("utf8");
    if (Buffer.from(text, "utf8").compare(bytes) !== 0) throw new CliError("secondary authority request must be exact UTF-8", 6);
    let value: unknown;
    try { value = JSON.parse(text); } catch { throw new CliError("secondary authority request is not JSON", 6); }
    if (`${canonicalJson(value)}\n` !== text || !value || typeof value!=="object" || Array.isArray(value)) {
        throw new CliError("secondary authority request has the wrong canonical closed schema", 6);
    }
    const document = value as Record<string, unknown>;
    const browser=document.schema==="as3-secondary-browser-linker-request@2";
    if(!exactKeys(document,browser
        ?["applicationId","compilerProviderSha256","executable","exports","primaryAuthority","profileSha256","schema","sourceClosureSha256"]
        :["applicationId", "compilerProviderSha256", "exports", "profileSha256", "schema", "sourceClosureSha256"])
        ||document.schema !== (browser?"as3-secondary-browser-linker-request@2":"as3-secondary-authority-request@1")
        || typeof document.applicationId !== "string" || !ID.test(document.applicationId)
        || typeof document.profileSha256 !== "string" || !SHA256.test(document.profileSha256)
        || typeof document.sourceClosureSha256 !== "string" || !SHA256.test(document.sourceClosureSha256)
        || typeof document.compilerProviderSha256 !== "string" || !SHA256.test(document.compilerProviderSha256)
        || !Array.isArray(document.exports) || document.exports.length !== 2) {
        throw new CliError("secondary authority request has the wrong canonical closed schema", 6);
    }
    const names: string[] = [];
    for (const item of document.exports) {
        if (!exactKeys(item, ["qname"]) || typeof item.qname !== "string" || !QNAME.test(item.qname)
            || names.includes(item.qname)) {
            throw new CliError("secondary authority export list is invalid, duplicated, or ambiguous", 6);
        }
        names.push(item.qname);
    }
    const expected = [ACHIEVEMENT_QNAMES[0]!,ACHIEVEMENT_QNAMES[5]!];
    if (names.some((name, index) => name !== expected[index])) {
        throw new CliError("secondary authority exports must be AchievementModule then achievement.ui.AchievementPresentationPart", 6);
    }
    const common={applicationId: document.applicationId as string, profileSha256: document.profileSha256 as string,
        sourceClosureSha256: document.sourceClosureSha256 as string,
        compilerProviderSha256:document.compilerProviderSha256 as string,
        exports: Object.freeze(names.map(qname => Object.freeze({qname}))),
        requestSha256: createHash("sha256").update(bytes).digest("hex"), requestPath: path};
    if(!browser)return Object.freeze({schema:"as3-secondary-authority-request@1",...common});
    if(!exactKeys(document.primaryAuthority,["runtimeAuthoritySha256","typeAuthoritySha256"])
        ||typeof document.primaryAuthority.runtimeAuthoritySha256!=="string"||!SHA256.test(document.primaryAuthority.runtimeAuthoritySha256)
        ||typeof document.primaryAuthority.typeAuthoritySha256!=="string"||!SHA256.test(document.primaryAuthority.typeAuthoritySha256)
        ||!exactKeys(document.executable,["documentBundleId","logicalPath","modulePartQName","sourceSwf","sources"])
        ||typeof document.executable.logicalPath!=="string"||!safeRelative(document.executable.logicalPath)
        ||typeof document.executable.documentBundleId!=="string"||document.executable.documentBundleId!==ACHIEVEMENT_QNAMES[0]
        ||typeof document.executable.modulePartQName!=="string"||document.executable.modulePartQName!==ACHIEVEMENT_QNAMES[5]
        ||!Array.isArray(document.executable.sources)||document.executable.sources.length!==ACHIEVEMENT_QNAMES.length)
        throw new CliError("browser secondary authority request has the wrong executable identity",6);
    const sourceSwf=artifactIdentity(document.executable.sourceSwf,"browser secondary source SWF");
    const sources=document.executable.sources.map((item,index)=>{
        if(!exactKeys(item,["bytes","matchesSwfDecompilationAfterLineEndingNormalization","path","qname","sha256",
            "swfDecompiledBytes","swfDecompiledNormalizedBytes","swfDecompiledNormalizedSha256","swfDecompiledSha256"])
            ||item.qname!==ACHIEVEMENT_QNAMES[index]||typeof item.path!=="string"||!safeRelative(item.path)
            ||typeof item.sha256!=="string"||!SHA256.test(item.sha256)||!Number.isSafeInteger(item.bytes)||Number(item.bytes)<=0
            ||typeof item.swfDecompiledSha256!=="string"||!SHA256.test(item.swfDecompiledSha256)||!Number.isSafeInteger(item.swfDecompiledBytes)||Number(item.swfDecompiledBytes)<=0
            ||typeof item.swfDecompiledNormalizedSha256!=="string"||!SHA256.test(item.swfDecompiledNormalizedSha256)
            ||!Number.isSafeInteger(item.swfDecompiledNormalizedBytes)||Number(item.swfDecompiledNormalizedBytes)<=0
            ||typeof item.matchesSwfDecompilationAfterLineEndingNormalization!=="boolean"
            ||item.matchesSwfDecompilationAfterLineEndingNormalization===true
                &&(item.swfDecompiledNormalizedSha256!==item.sha256||item.swfDecompiledNormalizedBytes!==item.bytes))
            throw new CliError("browser secondary executable source identity is invalid",6);
        return Object.freeze({...item}) as unknown as BrowserExecutableSourceIdentity;
    });
    return Object.freeze({ schema: "as3-secondary-browser-linker-request@2",
        ...common,primaryAuthority:Object.freeze({...document.primaryAuthority}) as unknown as BrowserPrimaryAuthorityIdentity,
        executable:Object.freeze({logicalPath:document.executable.logicalPath,documentBundleId:document.executable.documentBundleId,
            modulePartQName:document.executable.modulePartQName,sourceSwf,sources:Object.freeze(sources)})
    });
}

export function loadCompilerProviderAuthority(pathArgument:string,expectedSha256:string,
    actual:Readonly<{packageLockSha256:string;commandSha256:string;parserWorkerSha256:string}>):CompilerProviderAuthority {
    const path=resolve(pathArgument);assertNoSymlinkComponents(path,"compiler provider authority");
    const stat=lstatSync(path);
    if(!stat.isFile()||stat.isSymbolicLink()||stat.size>1024*1024||realpathSync.native(path)!==path)
        throw new CliError("compiler provider authority must be an ordinary bounded canonical file",6);
    const bytes=readFileSync(path),text=bytes.toString("utf8"),authoritySha256=createHash("sha256").update(bytes).digest("hex");
    if(Buffer.from(text,"utf8").compare(bytes)!==0||authoritySha256!==expectedSha256)
        throw new CliError("compiler provider authority bytes differ from the pinned request",6);
    let value:unknown;try{value=JSON.parse(text);}catch{throw new CliError("compiler provider authority is not JSON",6);}
    if(`${canonicalJson(value)}\n`!==text||!exactKeys(value,["commandSha256","commit","packageLockSha256",
        "parserWorkerSha256","repository","schema"])) throw new CliError("compiler provider authority has the wrong canonical closed schema",6);
    const document=value as Record<string,unknown>;
    if(document.schema!=="as3-compiler-provider-authority@1"||typeof document.repository!=="string"
        ||!/^https:\/\/[^\s]+$/.test(document.repository)||typeof document.commit!=="string"||!/^[0-9a-f]{40}$/.test(document.commit)
        ||typeof document.packageLockSha256!=="string"||document.packageLockSha256!==actual.packageLockSha256
        ||typeof document.commandSha256!=="string"||document.commandSha256!==actual.commandSha256
        ||typeof document.parserWorkerSha256!=="string"||document.parserWorkerSha256!==actual.parserWorkerSha256)
        throw new CliError("compiler provider authority differs from the executing compiler bytes",6);
    return Object.freeze({repository:document.repository,commit:document.commit,
        packageLockSha256:document.packageLockSha256,authoritySha256,authorityPath:path});
}

export function assertCompilerProviderAuthorityUnchanged(authority:CompilerProviderAuthority):void {
    assertNoSymlinkComponents(authority.authorityPath,"compiler provider authority");
    if(realpathSync.native(authority.authorityPath)!==authority.authorityPath
        ||createHash("sha256").update(readFileSync(authority.authorityPath)).digest("hex")!==authority.authoritySha256)
        throw new CliError("compiler provider authority changed during generation",6);
}

function validArtifact(item: SecondaryArtifactIdentity): boolean {
    return typeof item.path === "string" && item.path.length > 0 && !item.path.startsWith("/")
        && item.path === item.path.normalize("NFC") && !/[\\%?#:\s\x00-\x1f\x7f-\x9f]/.test(item.path)
        && !item.path.split("/").some(part => part === "" || part === "." || part === "..")
        && Number.isSafeInteger(item.bytes) && item.bytes > 0 && SHA256.test(item.sha256);
}

export function emitSecondaryAuthorityReceipt(request: LegacySecondaryAuthorityRequest,
    identity: Readonly<{ applicationId: string; profileSha256: string; sourceClosureSha256: string;
        typeAuthoritySha256: string; modules: readonly SecondaryModuleIdentity[];
        compiler: Readonly<{toolVersion:string;parserWorkerSha256:string;typeScriptVersion:string}>;
        packageMetadata: SecondaryArtifactIdentity; runtimeAuthority: SecondaryArtifactIdentity;
        sourceClosure: SecondaryArtifactIdentity;
        compilerProvider:CompilerProviderAuthority;executableModules:readonly SecondaryModuleIdentity[];
        executableClosure: readonly SecondaryArtifactIdentity[] }>): EmittedSecondaryAuthority {
    if (request.applicationId !== identity.applicationId || request.profileSha256 !== identity.profileSha256
        || request.sourceClosureSha256 !== identity.sourceClosureSha256
        || request.compilerProviderSha256!==identity.compilerProvider.authoritySha256
        || !SHA256.test(identity.typeAuthoritySha256)) {
        throw new CliError("secondary authority request differs from authenticated compiler inputs", 6);
    }
    if (identity.modules.length !== request.exports.length
        || identity.modules.some((module, index) => module.qname !== request.exports[index]!.qname
            || module.exportName !== module.qname.slice(module.qname.lastIndexOf(".") + 1)
            || !Number.isSafeInteger(module.sourceBytes) || module.sourceBytes < 0
            || !Number.isSafeInteger(module.typescriptBytes) || module.typescriptBytes <= 0
            || !Number.isSafeInteger(module.javascriptBytes) || module.javascriptBytes <= 0
            || !SHA256.test(module.sourceSha256) || !SHA256.test(module.typescriptSha256)
            || !SHA256.test(module.javascriptSha256))) {
        throw new CliError("secondary authority export modules differ from authenticated output identities", 6);
    }
    const closure = [...identity.executableClosure];
    if (!validArtifact(identity.packageMetadata) || identity.packageMetadata.path !== "package.json"
        || !validArtifact(identity.runtimeAuthority) || identity.runtimeAuthority.path !== "AS3Authority.generated.js"
        || !validArtifact(identity.sourceClosure) || identity.sourceClosure.path !== "AchievementModule.source-closure.json"
        || identity.sourceClosure.sha256 !== identity.sourceClosureSha256
        || !SHA256.test(identity.compiler.parserWorkerSha256) || identity.compiler.toolVersion.length === 0
        || identity.compiler.typeScriptVersion.length === 0
        || closure.length === 0 || closure.some(item => !validArtifact(item) || !item.path.endsWith(".js"))
        || closure.some((item, index) => index > 0
            && Buffer.compare(Buffer.from(item.path,"utf8"),Buffer.from(closure[index - 1]!.path,"utf8")) <= 0)
        || new Set(closure.map(item=>portableCollisionKey(item.path))).size !== closure.length
        || !closure.some(item => item.path === identity.runtimeAuthority.path
            && item.bytes === identity.runtimeAuthority.bytes && item.sha256 === identity.runtimeAuthority.sha256)
        || identity.modules.some(module => !closure.some(item => item.path === module.javascriptPath.replace(/^__as3_runtime\//, "")
            && item.bytes === module.javascriptBytes && item.sha256 === module.javascriptSha256))) {
        throw new CliError("secondary authority executable package inventory is invalid or incomplete", 6);
    }
    const executableClosureSha256 = createHash("sha256")
        .update(`${canonicalJson(closure)}\n`).digest("hex");
    const executableModules=identity.executableModules.map(module=>({qname:module.qname,sourceModule:module.sourceModule,
        javascriptPath:module.javascriptPath,javascriptBytes:module.javascriptBytes,javascriptSha256:module.javascriptSha256}));
    if(executableModules.length===0||executableModules.some((module,index)=>!QNAME.test(module.qname)
        ||(module.sourceModule!=="application"&&module.sourceModule!=="bootstrap")
        ||index>0&&Buffer.compare(Buffer.from(module.qname,"utf8"),Buffer.from(executableModules[index-1]!.qname,"utf8"))<=0
        ||!closure.some(file=>file.path===module.javascriptPath.replace(/^__as3_runtime\//,"")
            &&file.bytes===module.javascriptBytes&&file.sha256===module.javascriptSha256)))
        throw new CliError("secondary executable QName ownership mapping is incomplete or ambiguous",6);
    const definedQNames=executableModules.filter(module=>module.sourceModule==="application").map(module=>module.qname);
    const externalQNames=executableModules.filter(module=>module.sourceModule==="bootstrap").map(module=>module.qname);
    const receipt = {
        applicationId: identity.applicationId,
        classification: "data-only-pre-import-authority",
        compiler: identity.compiler,
        compilerProvider:{repository:identity.compilerProvider.repository,commit:identity.compilerProvider.commit,
            packageLockSha256:identity.compilerProvider.packageLockSha256},
        compilerProviderAuthoritySha256:identity.compilerProvider.authoritySha256,
        executableClosure: closure,
        executableClosureSha256,
        executableModules,
        exports: identity.modules,
        loadingPolicy: "authenticate-receipt-package-metadata-and-exact-executable-closure-before-import",
        packageMetadata: identity.packageMetadata,
        profileSha256: identity.profileSha256,
        requestSha256: request.requestSha256,
        runtimeAuthority: identity.runtimeAuthority,
        runtimeAuthorityLinkage:{browserFactory:null as null,definedQNames,externalQNames,
            status:"held-import-free-browser-link-not-emitted"},
        schema: "as3-secondary-authority-receipt@1",
        sourceClosure: identity.sourceClosure,
        sourceClosureSha256: identity.sourceClosureSha256,
        typeAuthoritySha256: identity.typeAuthoritySha256,
    };
    const json = `${canonicalJson(receipt)}\n`, digest = createHash("sha256").update(json).digest("hex");
    return Object.freeze({ path: "SecondaryAuthority.receipt.json", json, sha256: digest });
}

export function assertSecondaryAuthorityRequestUnchanged(request: SecondaryAuthorityRequest): void {
    const current = loadSecondaryAuthorityRequest(request.requestPath);
    if (current.requestSha256 !== request.requestSha256) throw new CliError("secondary authority request changed during generation", 6);
}
