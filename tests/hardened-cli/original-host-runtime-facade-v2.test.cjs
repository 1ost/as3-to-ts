"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),
    os=require("node:os"),path=require("node:path"),childProcess=require("node:child_process"),ts=require("typescript-4-9");

const root=path.resolve(__dirname,"../.."),output=fs.mkdtempSync(path.join(os.tmpdir(),"as3-original-host-v2-"));
test.after(()=>fs.rmSync(output,{recursive:true,force:true}));
fs.writeFileSync(path.join(output,"tsconfig.json"),JSON.stringify({compilerOptions:{target:"ES2022",module:"CommonJS",
    strict:true,skipLibCheck:true,esModuleInterop:true,rootDir:path.join(root,"src"),outDir:output,
    typeRoots:[path.join(root,"node_modules/@types")],types:["node"]},files:[
    path.join(root,"src/hardened-cli/original-host-runtime-facade-v2.ts"),
    path.join(root,"src/hardened-cli/browser-esm-runtime.ts"),path.join(root,"src/hardened-cli/errors.ts")]}));
childProcess.execFileSync(process.execPath,[path.join(root,"node_modules/typescript/bin/tsc"),"-p",path.join(output,"tsconfig.json")],
    {cwd:root,stdio:"inherit"});
fs.symlinkSync(path.join(root,"node_modules"),path.join(output,"node_modules"),"dir");
const {emitBrowserEsmRuntime}=require(path.join(output,"hardened-cli/browser-esm-runtime.js"));
const {deferOriginalHostRuntimeAuthoritySource,emitOriginalHostRuntimeFacadeV2Candidate,originalHostRuntimeFacadeV2ClosureSha256}=
    require(path.join(output,"hardened-cli/original-host-runtime-facade-v2.js"));
const TYPE_SHA="a".repeat(64);
const COMPILER_PROVIDER=Object.freeze({repository:"https://example.invalid/as3-to-ts",commit:"1".repeat(40),
    packageLockSha256:"2".repeat(64),authoritySha256:"3".repeat(64),authorityPath:"compiler-provider-authority.json"});

function fixture(changes={}) {
    const sources=[
        {path:"AS3Authority.generated.mjs",code:`import { SyntheticDefinition } from "./application/SyntheticDefinition";
export const AS3_TYPE_AUTHORITY_SHA256=${JSON.stringify(TYPE_SHA)};
export const AS3_TYPE_AUTHORITY_DOCUMENT=Object.freeze({schema:"as3-runtime-type-authority@1",sha256:AS3_TYPE_AUTHORITY_SHA256,qnames:Object.freeze(["test.SyntheticDefinition"]),entries:Object.freeze([Object.freeze({kind:"class",qname:"test.SyntheticDefinition",constructor:SyntheticDefinition})])});
`},
        {path:"application/SyntheticDefinition.mjs",code:changes.definitionCode||`export function SyntheticDefinition() {}
export function __as3ClassCinitMustRemainDeferred() { throw new Error("class cinit ran during facade transaction"); }
`},
        {path:"ApplicationEntry.generated.mjs",code:changes.applicationCode||`import { SyntheticDefinition } from "./application/SyntheticDefinition";
import { isSyntheticDefinitionRegistered } from "./internal/AS3TypeRegistry";
let started=false;
export function startAS3Application(signal){if(signal.aborted)throw new Error("synthetic application signal is aborted");if(!isSyntheticDefinitionRegistered(SyntheticDefinition))throw new Error("application registry identity differs");if(started)throw new Error("synthetic application already started");started=true;return Object.freeze({started:true});}
`},
        {path:"internal/AS3TypeRegistry.mjs",code:changes.registryCode||`let phase="open";
const reservations=new WeakSet();
let receipts=new WeakSet();
let active=null;let registeredConstructor=null;
export function preflightAS3TypeAuthority(document) { if(phase!=="open"||document.schema!=="as3-runtime-type-authority@1"||document.entries.length!==1) throw new TypeError("synthetic registry preflight rejected"); registeredConstructor=document.entries[0].constructor;const reservation=Object.freeze({schema:"synthetic-reservation",sha256:document.sha256}); reservations.add(reservation); active=reservation; phase="reserved"; return reservation; }
export function commitAS3TypeAuthority(reservation) { if(phase!=="reserved"||reservation!==active||!reservations.has(reservation)) throw new TypeError("synthetic registry commit rejected"); const receipt=Object.freeze({schema:"as3-type-authority-commit-receipt@1",typeAuthoritySha256:reservation.sha256}); receipts.add(receipt); phase="sealed"; return receipt; }
export function abortAS3TypeAuthority(reservation) { if(phase!=="reserved"||reservation!==active) throw new TypeError("synthetic registry abort rejected"); reservations.delete(reservation); active=null; phase="open"; }
export function poisonAS3TypeAuthority(reservation) { if(reservation!==active||!(phase==="reserved"||phase==="sealed")) throw new TypeError("synthetic registry poison rejected"); receipts=new WeakSet(); reservations.delete(reservation); active=null; phase="poisoned"; }
export function isAS3TypeAuthorityCommitReceipt(value) { return receipts.has(value); }
export function isSyntheticDefinitionRegistered(value) { return phase==="sealed"&&value===registeredConstructor; }
`},
        {path:"AS3Embed.mjs",code:`let prepared=null;
let installed=null;
const owners=new WeakMap();
export function prepareAS3EmbeddedBitmapDataHost(host) { if(typeof host!=="function") throw new TypeError("synthetic embedded prepare requires a function"); if(prepared!==null||installed!==null) throw new Error("synthetic embedded host already owned"); const token=Object.freeze({kind:"bitmap-preparation"}); owners.set(token,host); prepared=token; return token; }
export function commitAS3EmbeddedBitmapDataHost(token) { if(token!==prepared||!owners.has(token)) throw new TypeError("synthetic embedded commit rejected"); let disposed=false; const lease=Object.freeze({get disposed(){return disposed;},dispose(){if(disposed)return;disposed=true;if(installed===lease)installed=null;owners.delete(token);}}); installed=lease; prepared=null; return lease; }
export function abortAS3EmbeddedBitmapDataHost(token) { if(token!==prepared||!owners.has(token)) throw new TypeError("synthetic embedded abort rejected"); owners.delete(token);prepared=null; }
`},
        {path:"AS3TimerExecution.mjs",code:`let prepared=null;
let installed=null;
const owners=new WeakMap();
export function prepareAS3TimerExecutionCapture(capture) { if(typeof capture!=="function") throw new TypeError("synthetic timer prepare requires a function"); if(prepared!==null||installed!==null) throw new Error("synthetic timer capture already owned"); const token=Object.freeze({kind:"timer-preparation"}); owners.set(token,capture); prepared=token; return token; }
export function commitAS3TimerExecutionCapture(token) { if(token!==prepared||!owners.has(token)) throw new TypeError("synthetic timer commit rejected"); let disposed=false; const lease=Object.freeze({get disposed(){return disposed;},dispose(){if(disposed)return;disposed=true;if(installed===lease)installed=null;owners.delete(token);}}); installed=lease; prepared=null; return lease; }
export function abortAS3TimerExecutionCapture(token) { if(token!==prepared||!owners.has(token)) throw new TypeError("synthetic timer abort rejected"); owners.delete(token);prepared=null; }
`},
    ];
    sources.push(...(changes.extraSources||[]));
    const runtime=emitBrowserEsmRuntime(sources,"@test/as3-runtime",sources.map(item=>item.path));
    const bindings={application:{path:"ApplicationEntry.generated.mjs",startOperation:"startAS3Application"},
        authority:{path:"AS3Authority.generated.mjs",documentExport:"AS3_TYPE_AUTHORITY_DOCUMENT",typeIdentityExport:"AS3_TYPE_AUTHORITY_SHA256"},
        registry:{path:"internal/AS3TypeRegistry.mjs",preflightOperation:"preflightAS3TypeAuthority",commitOperation:"commitAS3TypeAuthority",
            abortOperation:"abortAS3TypeAuthority",poisonOperation:"poisonAS3TypeAuthority",receiptPredicate:"isAS3TypeAuthorityCommitReceipt"},
        embeddedHost:{path:"AS3Embed.mjs",prepareOperation:"prepareAS3EmbeddedBitmapDataHost",
            commitOperation:"commitAS3EmbeddedBitmapDataHost",abortOperation:"abortAS3EmbeddedBitmapDataHost"},
        timerCapture:{path:"AS3TimerExecution.mjs",prepareOperation:"prepareAS3TimerExecutionCapture",
            commitOperation:"commitAS3TimerExecutionCapture",abortOperation:"abortAS3TimerExecutionCapture"}};
    const pin={schema:"as3-original-host-runtime-facade-pin@2",typeAuthoritySha256:TYPE_SHA,
        runtimeClosureSha256:originalHostRuntimeFacadeV2ClosureSha256(runtime,bindings),compilerProvider:COMPILER_PROVIDER,bindings};
    return {runtime,pin};
}
function emit(changes){const value=fixture(changes);return emitOriginalHostRuntimeFacadeV2Candidate(value.runtime,value.pin);}
async function load(result){return import(`data:text/javascript;base64,${Buffer.from(result.files[0].body).toString("base64")}#${crypto.randomUUID()}`);}

function realRuntimeFixture() {
    const qnames=["test.IOriginalHost"],entries=[{kind:"interface",qname:qnames[0],bases:[]}],metadata={
        schema:"as3-runtime-type-authority@1",qnames,entries},typeAuthoritySha256=crypto.createHash("sha256")
        .update(JSON.stringify(metadata)).digest("hex"),runtimeRoot=path.join(root,"src/hardened-runtime"),sources=[
            {path:"AS3Authority.generated.mjs",code:`export const AS3_TYPE_AUTHORITY_SHA256=${JSON.stringify(typeAuthoritySha256)};\nexport const AS3_TYPE_AUTHORITY_DOCUMENT=Object.freeze({schema:"as3-runtime-type-authority@1",sha256:AS3_TYPE_AUTHORITY_SHA256,qnames:Object.freeze(["test.IOriginalHost"]),entries:Object.freeze([Object.freeze({kind:"interface",qname:"test.IOriginalHost",bases:Object.freeze([])})])});\n`},
            {path:"ApplicationEntry.generated.mjs",code:'import { lookupInterfaceType } from "./internal/AS3TypeRegistry";\nlet started=false;\nexport function startAS3Application(signal){if(signal.aborted)throw new Error("aborted");if(started)throw new Error("started");started=true;return "real-runtime-started:"+lookupInterfaceType("test.IOriginalHost").name;}\n'},
            {path:"internal/AS3TypeRegistry.mjs",code:fs.readFileSync(path.join(runtimeRoot,"internal/AS3TypeRegistry.ts"),"utf8")},
            {path:"internal/AS3FileLocalIdentity.mjs",code:fs.readFileSync(path.join(runtimeRoot,"internal/AS3FileLocalIdentity.ts"),"utf8")},
            {path:"AS3Embed.mjs",code:fs.readFileSync(path.join(runtimeRoot,"AS3Embed.ts"),"utf8")},
            {path:"AS3TimerExecution.mjs",code:fs.readFileSync(path.join(runtimeRoot,"AS3TimerExecution.ts"),"utf8")},
        ],runtime=emitBrowserEsmRuntime(sources,"@test/as3-runtime",sources.map(item=>item.path)),bindings={
            application:{path:"ApplicationEntry.generated.mjs",startOperation:"startAS3Application"},
            authority:{path:"AS3Authority.generated.mjs",documentExport:"AS3_TYPE_AUTHORITY_DOCUMENT",typeIdentityExport:"AS3_TYPE_AUTHORITY_SHA256"},
            registry:{path:"internal/AS3TypeRegistry.mjs",preflightOperation:"preflightAS3TypeAuthority",commitOperation:"commitAS3TypeAuthority",
                abortOperation:"abortAS3TypeAuthority",poisonOperation:"poisonAS3TypeAuthority",receiptPredicate:"isAS3TypeAuthorityCommitReceipt"},
            embeddedHost:{path:"AS3Embed.mjs",prepareOperation:"prepareAS3EmbeddedBitmapDataHost",
                commitOperation:"commitAS3EmbeddedBitmapDataHost",abortOperation:"abortAS3EmbeddedBitmapDataHost"},
            timerCapture:{path:"AS3TimerExecution.mjs",prepareOperation:"prepareAS3TimerExecutionCapture",
                commitOperation:"commitAS3TimerExecutionCapture",abortOperation:"abortAS3TimerExecutionCapture"}},pin={
            schema:"as3-original-host-runtime-facade-pin@2",typeAuthoritySha256,
            runtimeClosureSha256:originalHostRuntimeFacadeV2ClosureSha256(runtime,bindings),compilerProvider:COMPILER_PROVIDER,bindings};
    return {runtime,pin};
}

test("emits one dependency-free effect-free-import v2 artifact with exact inventory",async()=>{
    const result=emit(),source=result.files[0].body,parsed=ts.createSourceFile(result.module.path,source,ts.ScriptTarget.ES2020,true,ts.ScriptKind.JS);
    assert.equal(result.root,"original-host-runtime-facade-v2-candidate");
    assert.deepEqual(result.files.map(file=>file.path),["AS3OriginalHostRuntime.bundle-candidate.mjs","AS3OriginalHostRuntime.bundle-candidate-receipt.json"]);
    assert.equal(parsed.parseDiagnostics.length,0);assert.equal(parsed.statements.filter(ts.isImportDeclaration).length,0);
    let topLevelCalls=0;for(const statement of parsed.statements)if(ts.isVariableStatement(statement))for(const declaration of statement.declarationList.declarations) {
        const visit=node=>{if(ts.isCallExpression(node)||ts.isNewExpression(node))topLevelCalls++;ts.forEachChild(node,visit);};
        if(declaration.initializer)visit(declaration.initializer);
    }
    assert.equal(topLevelCalls,0);assert.doesNotMatch(source,/^\s*import\s/m);
    const namespace=await load(result),abi=namespace.AS3_ORIGINAL_HOST_RUNTIME_ABI;
    assert.deepEqual(Object.keys(namespace),["AS3_ORIGINAL_HOST_RUNTIME_ABI"]);assert.equal(Object.getPrototypeOf(abi),null);
    assert.deepEqual(Object.keys(abi),["schema","typeAuthoritySha256","runtimeClosureSha256","preflightAS3TypeAuthority",
        "installAS3EmbeddedBitmapDataHost","installAS3TimerExecutionCapture","commitAS3TypeAuthority",
        "abortAS3TypeAuthority","poisonAS3TypeAuthority"]);
    assert.equal(abi.schema,"as3-original-host-runtime-abi@2");assert.equal(Object.isFrozen(abi),false);
    assert.throws(()=>abi.installAS3EmbeddedBitmapDataHost(()=>{}),/out of sequence/);
    assert.equal(Object.isFrozen(abi),true);
    const receipt=JSON.parse(result.files[1].body);
    assert.equal(receipt.schema,"as3-original-host-runtime-facade-candidate-receipt@2");assert.equal(receipt.status,"held");
    assert.deepEqual(receipt.artifactInventory,[result.module]);assert.equal(receipt.output.sha256,crypto.createHash("sha256").update(source).digest("hex"));
    assert.deepEqual(receipt.effects,{ambientWrites:0,applicationEntryEvaluation:"post-commit-start",definitionCinit:"deferred",
        format:"browser-esm-single-file-effect-free-runtime@2",imports:0,lazyFactoryInitialization:true,topLevelCalls:0});
    assert.deepEqual(receipt.abi.operations,["preflightAS3TypeAuthority","installAS3EmbeddedBitmapDataHost",
        "installAS3TimerExecutionCapture","commitAS3TypeAuthority","abortAS3TypeAuthority","poisonAS3TypeAuthority"]);
    assert.equal(receipt.factoryInventory.length,6);
});

test("derives a document-only authority source without invoking the legacy immediate installer",()=>{
    const source=`// Generated authority fixture.\nimport { installAS3TypeAuthority } from "./internal/AS3TypeRegistry";\nimport { as3InitializeClass as __as3InitializePublishedClass } from "./AS3ClassInitialization";\n\nexport const AS3_TYPE_AUTHORITY_SHA256 = ${JSON.stringify(TYPE_SHA)};\nexport const AS3_TYPE_AUTHORITY_QNAMES = Object.freeze(["test.IOriginalHost"] as const);\nconst entries = [\n    { kind: "interface", qname: "test.IOriginalHost", bases: [] },\n] as const;\ninstallAS3TypeAuthority({ schema: "as3-runtime-type-authority@1", sha256: AS3_TYPE_AUTHORITY_SHA256,\n    qnames: AS3_TYPE_AUTHORITY_QNAMES, entries });\nexport const AS3_CLASS_DEFINITIONS = Object.freeze([] as const);\n`,result=deferOriginalHostRuntimeAuthoritySource(source);
    assert.doesNotMatch(result,/installAS3TypeAuthority/);
    assert.match(result,/export const AS3_TYPE_AUTHORITY_DOCUMENT = Object\.freeze\(\{ schema:/);
    assert.match(result,/qnames: AS3_TYPE_AUTHORITY_QNAMES, entries \}\);/);
    assert.throws(()=>deferOriginalHostRuntimeAuthoritySource(source.replace(" entries });"," entries, extra: true });")),/document schema differs/);
    assert.throws(()=>deferOriginalHostRuntimeAuthoritySource(source.replace("export const AS3_CLASS_DEFINITIONS",'installAS3ReflectionProvider({});\nexport const AS3_CLASS_DEFINITIONS')),/reflection provider/);
    assert.throws(()=>deferOriginalHostRuntimeAuthoritySource(source.replace("const entries",'const escaped = installAS3TypeAuthority;\nconst entries')),/installer identity escaped/);
});

test("lazily evaluates the bound private factories only at preflight",async()=>{
    const value=fixture({registryCode:'const invalidPrivateCollection=new WeakMap(1);\nexport function preflightAS3TypeAuthority(){}\nexport function commitAS3TypeAuthority(){}\nexport function abortAS3TypeAuthority(){}\nexport function poisonAS3TypeAuthority(){}\nexport function isAS3TypeAuthorityCommitReceipt(){return false;}\n'}),
        result=emitOriginalHostRuntimeFacadeV2Candidate(value.runtime,value.pin),namespace=await load(result),abi=namespace.AS3_ORIGINAL_HOST_RUNTIME_ABI;
    assert.throws(()=>abi.installAS3EmbeddedBitmapDataHost(()=>{}),/out of sequence/);
    // A fresh module is required because the preceding out-of-order operation intentionally owns its one-shot state.
    const fresh=(await load(result)).AS3_ORIGINAL_HOST_RUNTIME_ABI;
    assert.throws(()=>fresh.preflightAS3TypeAuthority(),/iterable/);
    assert.throws(()=>fresh.preflightAS3TypeAuthority(),/out of sequence/);
});

test("defers the application entry and its private dependency graph until post-commit start",async()=>{
    const result=emit({applicationCode:'import { start } from "./application/ApplicationOnly";\nexport function startAS3Application(signal){return start(signal);}\n',
        extraSources:[{path:"application/ApplicationOnly.mjs",code:'const invalidPrivateCollection=new WeakMap(1);\nexport function start(){return invalidPrivateCollection;}\n'}]}),
        abi=(await load(result)).AS3_ORIGINAL_HOST_RUNTIME_ABI;
    assert.equal(abi.preflightAS3TypeAuthority(),undefined);
    assert.equal(abi.installAS3EmbeddedBitmapDataHost(()=>({})),undefined);
    assert.equal(abi.installAS3TimerExecutionCapture(callback=>callback),undefined);
    const application=abi.commitAS3TypeAuthority();
    await assert.rejects(()=>application.startAS3Application(new AbortController().signal),/iterable/);
    assert.throws(()=>abi.poisonAS3TypeAuthority(),/out of sequence/);

    const beforeLoad=(await load(result)).AS3_ORIGINAL_HOST_RUNTIME_ABI;
    beforeLoad.preflightAS3TypeAuthority();beforeLoad.installAS3EmbeddedBitmapDataHost(()=>({}));
    beforeLoad.installAS3TimerExecutionCapture(callback=>callback);
    const aborted=beforeLoad.commitAS3TypeAuthority(),controller=new AbortController();controller.abort();
    await assert.rejects(()=>aborted.startAS3Application(controller.signal),error=>error.name==="AbortError");
});

test("embeds multiline template literals byte-for-byte without changing runtime values",async()=>{
    const registryCode=`let phase="open";let active=null;
export function preflightAS3TypeAuthority(document) { if(document.entries[0].constructor()!=="first\\nsecond") throw new Error("multiline template value drifted"); active=Object.freeze({sha256:document.sha256});phase="reserved";return active; }
export function commitAS3TypeAuthority(){throw new Error("unused");}
export function abortAS3TypeAuthority(reservation){if(phase!=="reserved"||reservation!==active)throw new Error("abort");phase="open";}
export function poisonAS3TypeAuthority(){phase="poisoned";}
export function isAS3TypeAuthorityCommitReceipt(){return false;}
`,definitionCode='export function SyntheticDefinition(){return `first\nsecond`;}\n',abi=(await load(emit({registryCode,definitionCode}))).AS3_ORIGINAL_HOST_RUNTIME_ABI;
    assert.equal(abi.preflightAS3TypeAuthority(),undefined);assert.equal(abi.abortAS3TypeAuthority(),undefined);
});

test("runs the exact internal transaction in order while leaving class cinit deferred",async()=>{
    const result=emit(),wrong=(await load(result)).AS3_ORIGINAL_HOST_RUNTIME_ABI;
    wrong.preflightAS3TypeAuthority();assert.throws(()=>wrong.commitAS3TypeAuthority(),/out of sequence/);
    assert.throws(()=>wrong.installAS3EmbeddedBitmapDataHost(()=>({})),/out of sequence/);
    const abi=(await load(result)).AS3_ORIGINAL_HOST_RUNTIME_ABI;
    const preflight=abi.preflightAS3TypeAuthority;assert.throws(()=>preflight(),/receiver is not authentic/);
    assert.equal(abi.preflightAS3TypeAuthority(),undefined);
    assert.equal(abi.installAS3EmbeddedBitmapDataHost(()=>({bitmap:true})),undefined);
    assert.equal(abi.installAS3TimerExecutionCapture(callback=>callback),undefined);
    const capability=abi.commitAS3TypeAuthority();assert.equal(Object.getPrototypeOf(capability),null);assert.equal(Object.isFrozen(capability),true);
    assert.deepEqual(Object.keys(capability),["schema","typeAuthoritySha256","runtimeClosureSha256","startAS3Application"]);
    const start=capability.startAS3Application;await assert.rejects(()=>start(new AbortController().signal),/receiver is not authentic/);
    assert.deepEqual(await capability.startAS3Application(new AbortController().signal),{started:true});
    await assert.rejects(()=>capability.startAS3Application(new AbortController().signal),/out of sequence/);
    abi.poisonAS3TypeAuthority();
    assert.throws(()=>abi.commitAS3TypeAuthority(capability),/out of sequence/);
    assert.throws(()=>abi.poisonAS3TypeAuthority(),/out of sequence/);
});

test("aborts before commit, cleans private host ownership, and is terminal",async()=>{
    const abi=(await load(emit())).AS3_ORIGINAL_HOST_RUNTIME_ABI;
    abi.preflightAS3TypeAuthority();abi.installAS3EmbeddedBitmapDataHost(()=>({}));abi.installAS3TimerExecutionCapture(callback=>callback);
    assert.equal(abi.abortAS3TypeAuthority(),undefined);
    for(const operation of ["preflightAS3TypeAuthority","commitAS3TypeAuthority","abortAS3TypeAuthority","poisonAS3TypeAuthority"])
        assert.throws(()=>abi[operation](),/out of sequence/);
});

test("underlying installer failure poisons the facade and cannot be retried",async()=>{
    const abi=(await load(emit())).AS3_ORIGINAL_HOST_RUNTIME_ABI;abi.preflightAS3TypeAuthority();
    assert.throws(()=>abi.installAS3EmbeddedBitmapDataHost(null),/synthetic embedded prepare requires a function/);
    assert.throws(()=>abi.installAS3EmbeddedBitmapDataHost(()=>({})),/out of sequence/);
    assert.throws(()=>abi.commitAS3TypeAuthority(),/out of sequence/);
});

test("binds the current compiler registry and atomic host installers, not facade placeholders",async()=>{
    const value=realRuntimeFixture(),result=emitOriginalHostRuntimeFacadeV2Candidate(value.runtime,value.pin),
        abi=(await load(result)).AS3_ORIGINAL_HOST_RUNTIME_ABI;
    abi.preflightAS3TypeAuthority();abi.installAS3EmbeddedBitmapDataHost(()=>({}));
    abi.installAS3TimerExecutionCapture(callback=>callback);const application=abi.commitAS3TypeAuthority();
    assert.equal(await application.startAS3Application(new AbortController().signal),"real-runtime-started:test.IOriginalHost");
    assert.equal(abi.poisonAS3TypeAuthority(),undefined);
    assert.throws(()=>abi.commitAS3TypeAuthority({schema:"as3-type-authority-commit-receipt@1",
        typeAuthoritySha256:value.pin.typeAuthoritySha256}),/out of sequence/);
    const receipt=JSON.parse(result.files[1].body),paths=receipt.inputClosure.files.map(file=>file.path);
    assert.deepEqual(paths,["AS3Authority.generated.mjs","AS3Embed.mjs","AS3TimerExecution.mjs","ApplicationEntry.generated.mjs",
        "internal/AS3FileLocalIdentity.mjs","internal/AS3TypeRegistry.mjs"]);
});

test("contains asynchronous start failure, reentrant poison, and receiver-sensitive application code",async()=>{
    {const abi=(await load(emit({applicationCode:'export async function startAS3Application(){throw new Error("async start rejected");}\n'}))).AS3_ORIGINAL_HOST_RUNTIME_ABI;
        abi.preflightAS3TypeAuthority();abi.installAS3EmbeddedBitmapDataHost(()=>({}));abi.installAS3TimerExecutionCapture(callback=>callback);
        const application=abi.commitAS3TypeAuthority();await assert.rejects(()=>application.startAS3Application(new AbortController().signal),/async start rejected/);
        assert.throws(()=>abi.poisonAS3TypeAuthority(),/out of sequence/);}
    {const abi=(await load(emit({applicationCode:'export async function startAS3Application(){return this;}\n'}))).AS3_ORIGINAL_HOST_RUNTIME_ABI;
        abi.preflightAS3TypeAuthority();abi.installAS3EmbeddedBitmapDataHost(()=>({}));abi.installAS3TimerExecutionCapture(callback=>callback);
        const application=abi.commitAS3TypeAuthority();assert.equal(await application.startAS3Application(new AbortController().signal),undefined);abi.poisonAS3TypeAuthority();}
    {const abi=(await load(emit({applicationCode:'export function startAS3Application(signal){void signal.aborted;return "returned";}\n'}))).AS3_ORIGINAL_HOST_RUNTIME_ABI;abi.preflightAS3TypeAuthority();abi.installAS3EmbeddedBitmapDataHost(()=>({}));
        abi.installAS3TimerExecutionCapture(callback=>callback);const application=abi.commitAS3TypeAuthority();let reads=0;
        const signal={addEventListener(){},get aborted(){reads+=1;if(reads===3)abi.poisonAS3TypeAuthority();return false;}};
        await assert.rejects(()=>application.startAS3Application(signal),/terminal before completion/);
        assert.throws(()=>abi.poisonAS3TypeAuthority(),/out of sequence/);}
});

test("rejects a widened or replaced ABI before allocating its runtime",async()=>{
    {const abi=(await load(emit())).AS3_ORIGINAL_HOST_RUNTIME_ABI;abi.schema="forged";
        assert.throws(()=>abi.preflightAS3TypeAuthority(),/identity differs/);}
    {const abi=(await load(emit())).AS3_ORIGINAL_HOST_RUNTIME_ABI;abi.commitAS3TypeAuthority=()=>undefined;
        assert.throws(()=>abi.preflightAS3TypeAuthority(),/operation differs/);}
});

test("rejects closure drift, forged bindings, unreachable input, and eager module effects",()=>{
    {const value=fixture(),runtime={...value.runtime,files:value.runtime.files.map((file,index)=>index===0?{...file,body:file.body+"// drift\n"}:file)};
        assert.throws(()=>emitOriginalHostRuntimeFacadeV2Candidate(runtime,value.pin),/runtime identity differs/);}
    {const value=fixture(),pin={...value.pin,runtimeClosureSha256:"b".repeat(64)};
        assert.throws(()=>emitOriginalHostRuntimeFacadeV2Candidate(value.runtime,pin),/differs from the independent pin/);}
    {const value=fixture(),pin={...value.pin,bindings:{...value.pin.bindings,registry:{...value.pin.bindings.registry,
        commitOperation:"callerCommit"}}};
        assert.throws(()=>emitOriginalHostRuntimeFacadeV2Candidate(value.runtime,pin),/differs from the independent pin/);}
    {const value=fixture(),runtime={...value.runtime,files:[...value.runtime.files,{path:"unused.mjs",body:"export const unused=1;\n",
        identity:{path:"unused.mjs",bytes:23,sha256:"0".repeat(64)},imports:[]}]};
        assert.throws(()=>emitOriginalHostRuntimeFacadeV2Candidate(runtime,value.pin),/(?:identity differs|independent pin)/);}
    {const value=fixture({registryCode:'globalThis.compromised=true;\nexport function preflightAS3TypeAuthority(){}\nexport function commitAS3TypeAuthority(){}\nexport function abortAS3TypeAuthority(){}\nexport function poisonAS3TypeAuthority(){}\nexport function isAS3TypeAuthorityCommitReceipt(){return false;}\n'});
        assert.throws(()=>emitOriginalHostRuntimeFacadeV2Candidate(value.runtime,value.pin),/private-state constrained/);}
    assert.throws(()=>{const value=fixture({registryCode:'const escaped=require;\nexport function preflightAS3TypeAuthority(){}\nexport function commitAS3TypeAuthority(){}\nexport function abortAS3TypeAuthority(){}\nexport function poisonAS3TypeAuthority(){}\nexport function isAS3TypeAuthorityCommitReceipt(){return false;}\n'});
        emitOriginalHostRuntimeFacadeV2Candidate(value.runtime,value.pin);},/(?:contains CommonJS|private-state constrained|escaped require identity)/);
});
