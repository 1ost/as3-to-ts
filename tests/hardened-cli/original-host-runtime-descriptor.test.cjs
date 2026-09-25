"use strict";

const assert=require("node:assert/strict");
const childProcess=require("node:child_process");
const crypto=require("node:crypto");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const test=require("node:test");
const ts=require("typescript-4-9");

const root=path.resolve(__dirname,"../.."),output=fs.mkdtempSync(path.join(os.tmpdir(),"as3-original-host-descriptor-"));
test.after(()=>fs.rmSync(output,{recursive:true,force:true}));
fs.writeFileSync(path.join(output,"tsconfig.json"),JSON.stringify({compilerOptions:{target:"ES2022",module:"CommonJS",
    strict:true,skipLibCheck:true,esModuleInterop:true,rootDir:path.join(root,"src"),outDir:output,
    typeRoots:[path.join(root,"node_modules/@types")],types:["node"]},files:[
    path.join(root,"src/hardened-cli/original-host-runtime-descriptor.ts"),path.join(root,"src/hardened-cli/errors.ts"),
    ]}));
childProcess.execFileSync(process.execPath,[path.join(root,"node_modules/typescript/bin/tsc"),"-p",path.join(output,"tsconfig.json")],
    {cwd:root,stdio:"inherit"});
fs.symlinkSync(path.join(root,"node_modules"),path.join(output,"node_modules"),"dir");
const {emitOriginalHostRuntimeAbiCandidate,emitOriginalHostRuntimeDescriptorCandidate}=
    require(path.join(output,"hardened-cli/original-host-runtime-descriptor.js"));

const sha256=value=>crypto.createHash("sha256").update(value).digest("hex");
function canonical(value){
    if(value===null||typeof value==="boolean"||typeof value==="string"||typeof value==="number")return JSON.stringify(value);
    if(Array.isArray(value))return `[${value.map(canonical).join(",")}]`;
    return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
}
function artifact(file,body,format){return {path:file,bytes:Buffer.byteLength(body),sha256:sha256(body),format};}
function fixture(hostBody){
    const emittedHost=hostBody===undefined?emitOriginalHostRuntimeAbiCandidate("4".repeat(64)):{
        path:"AS3OriginalHostRuntime.candidate.mjs",body:hostBody,
        identity:artifact("AS3OriginalHostRuntime.candidate.mjs",hostBody,"browser-esm-single-file-effect-free-runtime@1")};
    hostBody=emittedHost.body;
    const authorityBody='"use strict";\nthrow new Error("AS3Authority.generated.js evaluated");\nexports.AS3_TYPE_AUTHORITY_SHA256="4";\n',
        applicationBody='"use strict";\nthrow new Error("ApplicationEntry.generated.js evaluated");\n',artifacts=[
        artifact("AS3Authority.generated.js",authorityBody,"commonjs@1"),
        emittedHost.identity,
        artifact("ApplicationEntry.generated.js",applicationBody,"commonjs@1"),
    ],modules=[
        {specifier:"@test/as3-runtime/AS3Authority",artifactPath:"AS3Authority.generated.js",
            exports:["AS3_CLASS_DEFINITIONS","AS3_TYPE_AUTHORITY_QNAMES","AS3_TYPE_AUTHORITY_SHA256"]},
        {specifier:"@test/as3-runtime/ApplicationEntry",artifactPath:"ApplicationEntry.generated.js",
            exports:["AS3_APPLICATION_MODULES","AS3_APPLICATION_TYPE_AUTHORITY_SHA256"]},
        {specifier:"@test/as3-runtime/OriginalHostRuntime",artifactPath:emittedHost.path,
            exports:["AS3_ORIGINAL_HOST_RUNTIME_ABI"]},
    ],provider={repository:"https://example.invalid/as3",commit:"1".repeat(40),packageLockSha256:"2".repeat(64)},
    hostRuntime={moduleSpecifier:"@test/as3-runtime/OriginalHostRuntime",artifactPath:emittedHost.path,
        exportName:"AS3_ORIGINAL_HOST_RUNTIME_ABI",schema:"as3-original-host-runtime-abi@1",
        installerExports:["installAS3EmbeddedBitmapDataHost","installAS3TimerExecutionCapture"]},
    authorityInstaller={moduleSpecifier:"@test/as3-runtime/OriginalHostRuntime",artifactPath:emittedHost.path,
        operation:"commitAS3TypeAuthority",poisonOperation:"poisonAS3TypeAuthority",
        commitReceiptSchema:"as3-type-authority-commit-receipt@1",typeAuthoritySha256:"4".repeat(64)},
    authority={schema:"as3-original-host-runtime-package-authority@1",provider,runtimePackage:"@test/as3-runtime",
        typeAuthoritySha256:"4".repeat(64),artifacts,modules,hostRuntime,authorityInstaller},authorityText=`${canonical(authority)}\n`,
    sourcePackageAuthority={path:"AS3OriginalHostRuntime.package-authority.json",bytes:Buffer.byteLength(authorityText),sha256:sha256(authorityText)},
    pin={sourcePackageAuthority,provider,runtimePackage:authority.runtimePackage,typeAuthoritySha256:authority.typeAuthoritySha256,
        artifacts,modules,hostRuntime,authorityInstaller},artifactInputs=[
            {path:artifacts[0].path,bytes:Buffer.from(authorityBody)},
            {path:artifacts[1].path,bytes:Buffer.from(hostBody)},
            {path:artifacts[2].path,bytes:Buffer.from(applicationBody)},
        ];
    return {authority,authorityText,pin,artifactInputs};
}
function rewriteAuthority(value,mutate){const changed=structuredClone(value.authority);mutate(changed);return `${canonical(changed)}\n`;}

test("compiler emits the exact held zero-effect ABI grammar instead of accepting a copied fixture",async()=>{
    const emitted=emitOriginalHostRuntimeAbiCandidate("4".repeat(64)),parsed=ts.createSourceFile(emitted.path,emitted.body,
        ts.ScriptTarget.ES2020,true,ts.ScriptKind.JS);
    assert.equal(parsed.parseDiagnostics.length,0);assert.equal(emitted.identity.format,"browser-esm-single-file-effect-free-runtime@1");
    assert.deepEqual(parsed.statements.map(statement=>ts.SyntaxKind[statement.kind]),[
        "FunctionDeclaration","FunctionDeclaration","FunctionDeclaration","FunctionDeclaration","FirstStatement"]);
    assert.equal(parsed.statements.filter(ts.isImportDeclaration).length,0);
    const namespace=await import(`data:text/javascript;base64,${Buffer.from(emitted.body).toString("base64")}`),
        abi=namespace.AS3_ORIGINAL_HOST_RUNTIME_ABI;
    assert.deepEqual(Object.keys(namespace),["AS3_ORIGINAL_HOST_RUNTIME_ABI"]);assert.equal(Object.getPrototypeOf(abi),null);
    assert.deepEqual(Object.keys(abi),["schema","typeAuthoritySha256","installAS3EmbeddedBitmapDataHost",
        "installAS3TimerExecutionCapture","commitAS3TypeAuthority","poisonAS3TypeAuthority"]);
    for(const operation of Object.keys(abi).slice(2))assert.throws(()=>abi[operation]({}),/held and not connected/);
});

test("emits exactly one held receipt and one import-free, call-free canonical data module",async()=>{
    const value=fixture(),result=emitOriginalHostRuntimeDescriptorCandidate(Buffer.from(value.authorityText),value.pin,value.artifactInputs);
    assert.equal(result.root,"original-host-runtime-descriptor-candidate");
    assert.deepEqual(result.files.map(file=>file.path),[
        "AS3OriginalHostRuntimeDescriptor.candidate.mjs","AS3OriginalHostRuntimeDescriptor.candidate-receipt.json"]);
    const module=result.files[0].body,parsed=ts.createSourceFile("candidate.mjs",module,ts.ScriptTarget.ES2020,true,ts.ScriptKind.JS);
    assert.equal(parsed.parseDiagnostics.length,0);assert.equal(parsed.statements.length,1);
    let calls=0,imports=0;const visit=node=>{if(ts.isCallExpression(node))calls++;if(ts.isImportDeclaration(node)
        ||node.kind===ts.SyntaxKind.ImportKeyword)imports++;ts.forEachChild(node,visit);};visit(parsed);
    assert.equal(calls,0);assert.equal(imports,0);assert.doesNotMatch(module,/(?:\brequire\s*\(|^\s*import\s)/m);
    const namespace=await import(`data:text/javascript;base64,${Buffer.from(module).toString("base64")}`);
    assert.deepEqual(Object.keys(namespace),["AS3_ORIGINAL_HOST_RUNTIME_DESCRIPTOR_JSON"]);
    const descriptor=JSON.parse(namespace.AS3_ORIGINAL_HOST_RUNTIME_DESCRIPTOR_JSON);
    assert.equal(descriptor.schema,"as3-original-host-runtime-descriptor-candidate@1");
    assert.deepEqual(descriptor.artifacts,value.pin.artifacts);assert.deepEqual(descriptor.modules,value.pin.modules);
    const receipt=JSON.parse(result.files[1].body);
    assert.equal(receipt.schema,"ap-original-host-runtime-descriptor-candidate-receipt@1");assert.equal(receipt.status,"held");
    assert.deepEqual(receipt.holds.map(item=>item.code),["AP_ORIGINAL_HOST_RUNTIME_DESCRIPTOR_NOT_QUALIFIED",
        "AP_ORIGINAL_HOST_RUNTIME_ABI_EFFECTS_UNAUDITED","AP_ORIGINAL_HOST_RUNTIME_ABI_PROTOCOL_UNPROVEN"]);
    assert.equal(receipt.module.sha256,sha256(module));assert.deepEqual(receipt.namespaceExports,["AS3_ORIGINAL_HOST_RUNTIME_DESCRIPTOR_JSON"]);
});

test("rejects forged authority bytes and self-consistent claims that differ from independent pins",()=>{
    {const value=fixture(),forged=rewriteAuthority(value,authority=>{authority.provider.commit="9".repeat(40);});
        assert.throws(()=>emitOriginalHostRuntimeDescriptorCandidate(Buffer.from(forged),value.pin,value.artifactInputs),/differs from the independent pin/);}
    {const value=fixture(),forged=rewriteAuthority(value,authority=>{authority.provider.commit="9".repeat(40);}),forgedIdentity={
        ...value.pin.sourcePackageAuthority,bytes:Buffer.byteLength(forged),sha256:sha256(forged)};
        assert.throws(()=>emitOriginalHostRuntimeDescriptorCandidate(Buffer.from(forged),{...value.pin,sourcePackageAuthority:forgedIdentity},
            value.artifactInputs),/claims differ from the independent pin/);}
});

test("rejects missing, extra, reordered, accessor, or byte-drifted executable inventories",()=>{
    {const value=fixture();assert.throws(()=>emitOriginalHostRuntimeDescriptorCandidate(Buffer.from(value.authorityText),value.pin,
        value.artifactInputs.slice(0,1)),/inventory is incomplete/);}
    {const value=fixture();assert.throws(()=>emitOriginalHostRuntimeDescriptorCandidate(Buffer.from(value.authorityText),value.pin,
        [...value.artifactInputs,{path:"extra.mjs",bytes:Buffer.from("export {};\n")}]),/(?:strictly UTF-8 sorted|inventory is incomplete)/);}
    {const value=fixture();value.artifactInputs[0]={...value.artifactInputs[0],bytes:Buffer.from("drift")};
        assert.throws(()=>emitOriginalHostRuntimeDescriptorCandidate(Buffer.from(value.authorityText),value.pin,value.artifactInputs),/artifact bytes differ/);}
    {const value=fixture(),input={bytes:Buffer.from("x")};Object.defineProperty(input,"path",{enumerable:true,get(){return "x.mjs";}});
        assert.throws(()=>emitOriginalHostRuntimeDescriptorCandidate(Buffer.from(value.authorityText),value.pin,[input]),/byte input is invalid/);}
});

test("rejects noncanonical inventories, portable collisions, and a widened host ABI module",()=>{
    {const value=fixture(),authority=structuredClone(value.authority);authority.artifacts.reverse();const text=`${canonical(authority)}\n`,pin={...value.pin,
        sourcePackageAuthority:{...value.pin.sourcePackageAuthority,bytes:Buffer.byteLength(text),sha256:sha256(text)},artifacts:authority.artifacts};
        assert.throws(()=>emitOriginalHostRuntimeDescriptorCandidate(Buffer.from(text),pin,value.artifactInputs),/strictly UTF-8 sorted/);}
    {const value=fixture(),authority=structuredClone(value.authority);authority.artifacts[1].path="as3authority.generated.js";
        authority.modules[2].artifactPath="as3authority.generated.js";authority.hostRuntime.artifactPath="as3authority.generated.js";
        authority.authorityInstaller.artifactPath="as3authority.generated.js";authority.artifacts.sort((a,b)=>Buffer.compare(Buffer.from(a.path),Buffer.from(b.path)));
        const text=`${canonical(authority)}\n`,pin={...authority,
            sourcePackageAuthority:{path:value.pin.sourcePackageAuthority.path,bytes:Buffer.byteLength(text),sha256:sha256(text)}};delete pin.schema;
        const inputs=[value.artifactInputs[0],value.artifactInputs[2],{
            path:"as3authority.generated.js",bytes:value.artifactInputs[1].bytes}];
        assert.throws(()=>emitOriginalHostRuntimeDescriptorCandidate(Buffer.from(text),pin,inputs),/portable path collision/);}
    for(const hostBody of [
        'import "./effect.mjs"; export const AS3_ORIGINAL_HOST_RUNTIME_ABI={};\n',
        'export const AS3_ORIGINAL_HOST_RUNTIME_ABI={}; export const widened=1;\n',
        'export const AS3_ORIGINAL_HOST_RUNTIME_ABI={load:()=>import("./effect.mjs")};\n',
    ]) {const value=fixture(hostBody);assert.throws(()=>emitOriginalHostRuntimeDescriptorCandidate(Buffer.from(value.authorityText),
        value.pin,value.artifactInputs),/not a single import-free/);}
});

test("requires the future transactional ABI identities and never accepts the current immediate installer name",()=>{
    const value=fixture(),authority=structuredClone(value.authority);
    authority.authorityInstaller.operation="installAS3TypeAuthority";const text=`${canonical(authority)}\n`,pin={...authority,
        sourcePackageAuthority:{path:value.pin.sourcePackageAuthority.path,bytes:Buffer.byteLength(text),sha256:sha256(text)}};delete pin.schema;
    assert.throws(()=>emitOriginalHostRuntimeDescriptorCandidate(Buffer.from(text),pin,value.artifactInputs),/ABI or installer identity is invalid/);
});

test("records why the current generated authority cannot yet supply the qualified pre-evaluation ABI",()=>{
    const authorityEmitter=fs.readFileSync(path.join(root,"src/hardened/type-authority.ts"),"utf8"),
        cli=fs.readFileSync(path.join(root,"src/hardened-cli/cli.ts"),"utf8");
    assert.match(authorityEmitter,/installAS3TypeAuthority\(\{ schema: \\"as3-runtime-type-authority@1\\"/);
    assert.doesNotMatch(authorityEmitter,/export const AS3_ORIGINAL_HOST_RUNTIME_ABI/);
    assert.doesNotMatch(authorityEmitter,/commitAS3TypeAuthority|poisonAS3TypeAuthority/);
    assert.match(cli,/type: "commonjs", exports/);
});
