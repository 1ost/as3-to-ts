"use strict";

const assert=require("node:assert/strict");
const childProcess=require("node:child_process");
const crypto=require("node:crypto");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const test=require("node:test");

const root=path.resolve(__dirname,"../.."),output=fs.mkdtempSync(path.join(os.tmpdir(),"as3-primary-host-bundle-"));
test.after(()=>fs.rmSync(output,{recursive:true,force:true}));
fs.writeFileSync(path.join(output,"tsconfig.json"),JSON.stringify({compilerOptions:{target:"ES2022",module:"CommonJS",
    strict:true,skipLibCheck:true,esModuleInterop:true,rootDir:path.join(root,"src"),outDir:output,
    typeRoots:[path.join(root,"node_modules/@types")],types:["node"]},files:[
    path.join(root,"src/hardened-cli/primary-host-bundle.ts"),path.join(root,"src/hardened-cli/errors.ts"),
    ]}));
childProcess.execFileSync(process.execPath,[path.join(root,"node_modules/typescript/bin/tsc"),"-p",path.join(output,"tsconfig.json")],
    {cwd:root,stdio:"inherit"});
fs.symlinkSync(path.join(root,"node_modules"),path.join(output,"node_modules"),"dir");
const {emitPrimaryHostBundleCandidate}=require(path.join(output,"hardened-cli/primary-host-bundle.js"));

const sha256=value=>crypto.createHash("sha256").update(value).digest("hex");
const identity=(file,body)=>({path:file,bytes:Buffer.byteLength(body),sha256:sha256(body)});
const provider={repository:"https://example.invalid/owned",commit:"1".repeat(40),packageLockSha256:"2".repeat(64)};
const secondaryQNames=["AchievementModule","achievement.commands.CmdGetKeepOnlineAchievements",
    "achievement.commands.CmdGetLastOnlineAchievements","achievement.mediator.AchievementPresentionMediator",
    "achievement.proxy.AchievementPresentionProxy","achievement.ui.AchievementPresentationPart"];
function canonical(value){
    if(value===null||typeof value==="boolean"||typeof value==="string"||typeof value==="number")return JSON.stringify(value);
    if(Array.isArray(value))return `[${value.map(canonical).join(",")}]`;
    return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
}
function fixture(runtimeBody='export const AS3_TYPE_AUTHORITY_SHA256="4"; export function __as3CreatePrimarySecondaryLinkage(){} export const answer=Function.prototype===(()=>{}).constructor.prototype?7:0; export const maybe=null; export const optional=maybe?.module; export const template=`value-${answer}`; export const nul="\\0"; export function collect(values){const result=[];for(const value of values)result.push(value);return result;} export const named={module:1,exports:2,Function};\n',hostBody,
    extraFiles=[],primaryImports=[]){
    hostBody=hostBody??'import {AS3_TYPE_AUTHORITY_SHA256 as typeIdentity,__as3CreatePrimarySecondaryLinkage as adapter} from "../achievement-primary-runtime/value.mjs";\n'
        +'import * as dependency from "../achievement-primary-runtime/value.mjs";\n'
        +'export function createAchievementPrimarySecondaryLinkage(){void typeIdentity;void adapter;return {answer:dependency.answer,module:dependency.named.module,exports:dependency.named.exports,Function:dependency.named.Function,optional:dependency.optional,template:dependency.template,nul:dependency.nul,setValues:dependency.collect(new Set([1,2])),mapValues:dependency.collect(new Map([["a",3],["b",4]]).values()),namespace:dependency};}\n';
    const module=identity("AchievementModule.primary-host.mjs",hostBody),runtimeIdentity=identity("value.mjs",runtimeBody),
        runtimeFiles=[{path:"value.mjs",body:runtimeBody,identity:runtimeIdentity,imports:primaryImports},...extraFiles.map(file=>({
            ...file,identity:identity(file.path,file.body)}))];
    const primaryRuntime={...runtimeIdentity,path:"achievement-primary-runtime/value.mjs"},dependency=file=>({
        role:file.path==="value.mjs"?"primary-runtime":"transitive-module",
        specifier:`../achievement-primary-runtime/${file.path}`,path:`achievement-primary-runtime/${file.path}`,
        bytes:file.identity.bytes,sha256:file.identity.sha256,format:"browser-esm@1",
        imports:file.imports.map(item=>({specifier:item.specifier,path:`achievement-primary-runtime/${item.path}`}))});
    const primaryAuthority={runtimeAuthoritySha256:"3".repeat(64),typeAuthoritySha256:"4".repeat(64)};
    const candidate={schema:"ap-original-achievement-primary-host-candidate-receipt@1",status:"held",holds:[{
        code:"AP_ACHIEVEMENT_PRIMARY_HOST_BROWSER_ESM_CLOSURE_UNQUALIFIED",
        reason:"multi-file browser ESM cannot bind native URL resolution to the authenticated dependency bytes"}],provider,
        primaryAuthority,expectedPlan:{schema:"as3-secondary-type-authority-plan@1",sourceClosureSha256:"5".repeat(64),provider,
            primaryAuthority,secondaryTypeAuthoritySha256:"6".repeat(64),qnames:secondaryQNames},primaryRuntime,
        bootstrapDefinitions:[],runtimeModules:[{specifier:"@test/runtime/value",moduleSpecifier:"../achievement-primary-runtime/value.mjs"}],
        dependencies:runtimeFiles.map(dependency),
        exportName:"createAchievementPrimarySecondaryLinkage",output:module};
    const receiptBody=`${canonical(candidate)}\n`,receipt=identity("AchievementModule.primary-host-candidate-receipt.json",receiptBody);
    const host={root:"achievement-primary-host",module,receipt,files:[
        {path:module.path,body:hostBody,identity:module},{path:receipt.path,body:receiptBody,identity:receipt}]};
    const runtime={root:"achievement-primary-runtime",files:runtimeFiles,primaryRuntime:runtimeFiles[0]};
    return {host,runtime};
}
function rewriteReceipt(host,mutate){
    const file=host.files.find(item=>item.path===host.receipt.path),document=JSON.parse(file.body);mutate(document);
    file.body=`${canonical(document)}\n`;file.identity=identity(file.path,file.body);host.receipt=file.identity;
}

test("import-free bundle preserves property, optional-chain, template, namespace, and exact input semantics",async()=>{
    const {host,runtime}=fixture(),result=emitPrimaryHostBundleCandidate(host,runtime,provider);
    const source=result.files.find(file=>file.path===result.module.path).body;
    assert.doesNotMatch(source,/^\s*import\s/m);assert.doesNotMatch(source,/`/);
    assert.deepEqual(JSON.parse(result.files.find(file=>file.path===result.receipt.path).body).dependencies,[]);
    const namespace=await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
    const linkage=namespace.createAchievementPrimarySecondaryLinkage();
    assert.equal(linkage.answer,7);assert.equal(linkage.module,1);assert.equal(linkage.exports,2);assert.equal(linkage.Function,Function);
    assert.equal(linkage.optional,undefined);assert.equal(linkage.template,"value-7");assert.equal(Object.isFrozen(linkage.namespace),true);
    assert.equal(linkage.nul,"\0");assert.deepEqual(linkage.setValues,[1,2]);assert.deepEqual(linkage.mapValues,[3,4]);
    assert.throws(()=>{linkage.namespace.answer=8;},TypeError);assert.throws(()=>{linkage.namespace.added=1;},TypeError);
});

test("bundle rejects escaped or shadowed CommonJS identities and unowned or unreachable inputs",()=>{
    for(const body of [
        'const alias=module; export const answer=alias;\n',
        'export const answer={module};\n',
        'const require=()=>1; export const answer=require();\n',
        'const escaped=require; export const answer=escaped("./value.mjs");\n',
        'module.exports={answer:1};\n',
        'const Function=()=>1; export const answer=Function();\n',
    ]) {
        const {host,runtime}=fixture(body);
        assert.throws(()=>emitPrimaryHostBundleCandidate(host,runtime,provider),/(?:escapes|shadows) CommonJS ambient/);
    }
    {const {host,runtime}=fixture('export const answer=7;\n',
        'import {answer} from "unowned"; export function createAchievementPrimarySecondaryLinkage(){return answer;}\n');
        assert.throws(()=>emitPrimaryHostBundleCandidate(host,runtime,provider),/literal import inventory differs/);}
    {const {host,runtime}=fixture('export const answer=import.meta.url;\n');
        assert.throws(()=>emitPrimaryHostBundleCandidate(host,runtime,provider),/import metadata/);}
    {const {host,runtime}=fixture('export let answer=1;\n');
        assert.throws(()=>emitPrimaryHostBundleCandidate(host,runtime,provider),/cannot freeze a mutable ESM export/);}
    {const {host,runtime}=fixture('let answer=1; export {answer};\n');
        assert.throws(()=>emitPrimaryHostBundleCandidate(host,runtime,provider),/cannot freeze a mutable aliased ESM export/);}
    {const {host,runtime}=fixture(undefined,undefined,[{path:"unused.mjs",body:"export const unused=1;\n",imports:[]}]);
        assert.throws(()=>emitPrimaryHostBundleCandidate(host,runtime,provider),/unreachable modules/);}
});

test("bundle evaluates a cyclic factory graph once and preserves live namespace identity",async()=>{
    const primary='import {readToken} from "./peer.mjs"; export const token=Object.freeze({cycle:true}); export function readPeer(){return readToken();}\n',
        peer='import {token} from "./value.mjs"; export function readToken(){return token;}\n',
        hostBody='import {AS3_TYPE_AUTHORITY_SHA256 as typeIdentity,__as3CreatePrimarySecondaryLinkage as adapter} from "../achievement-primary-runtime/value.mjs";\n'
            +'import * as dependency from "../achievement-primary-runtime/value.mjs";\n'
            +'export function createAchievementPrimarySecondaryLinkage(){void typeIdentity;void adapter;return {token:dependency.token,seen:dependency.readPeer(),namespace:dependency};}\n';
    const {host,runtime}=fixture(primary,hostBody,[{path:"peer.mjs",body:peer,imports:[{specifier:"./value.mjs",path:"value.mjs"}]}],
        [{specifier:"./peer.mjs",path:"peer.mjs"}]);
    const result=emitPrimaryHostBundleCandidate(host,runtime,provider),receipt=JSON.parse(result.files.find(file=>file.path===result.receipt.path).body);
    assert.deepEqual(receipt.embeddedFactoryCycles,[["achievement-primary-runtime/peer.mjs","achievement-primary-runtime/value.mjs"]]);
    const source=result.files.find(file=>file.path===result.module.path).body,
        namespace=await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`),linkage=namespace.createAchievementPrimarySecondaryLinkage();
    assert.equal(linkage.seen,linkage.token);assert.equal(Object.isFrozen(linkage.namespace),true);
});

test("bundle rejects source receipt, module, and runtime byte identity drift",()=>{
    {const {host,runtime}=fixture();host.files[0].body+="// drift\n";
        assert.throws(()=>emitPrimaryHostBundleCandidate(host,runtime,provider),/candidate input identity differs/);}
    {const {host,runtime}=fixture();host.files[1].body=host.files[1].body.replace('"held"','"ready"');
        assert.throws(()=>emitPrimaryHostBundleCandidate(host,runtime,provider),/candidate input identity differs/);}
    {const {host,runtime}=fixture();runtime.files[0].body+="// drift\n";
        assert.throws(()=>emitPrimaryHostBundleCandidate(host,runtime,provider),/runtime input identity differs/);}
});

test("bundle validates the closed canonical source receipt and every copied inventory",()=>{
    {const {host,runtime}=fixture();rewriteReceipt(host,document=>{document.extra=true;});
        assert.throws(()=>emitPrimaryHostBundleCandidate(host,runtime,provider),/not canonical and closed/);}
    {const {host,runtime}=fixture();rewriteReceipt(host,document=>{document.expectedPlan.qnames.reverse();});
        assert.throws(()=>emitPrimaryHostBundleCandidate(host,runtime,provider),/expected plan differs/);}
    {const {host,runtime}=fixture();rewriteReceipt(host,document=>{document.dependencies[0].sha256="f".repeat(64);});
        assert.throws(()=>emitPrimaryHostBundleCandidate(host,runtime,provider),/dependency edge inventory differs/);}
    {const {host,runtime}=fixture();rewriteReceipt(host,document=>{document.bootstrapDefinitions.push({qname:"mx.core.UIComponent",
            moduleSpecifier:"../achievement-primary-runtime/value.mjs",exportName:"UIComponent"});});
        assert.throws(()=>emitPrimaryHostBundleCandidate(host,runtime,provider),/(?:dependency edge|literal import) inventory differs/);}
});
