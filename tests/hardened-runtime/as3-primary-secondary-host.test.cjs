"use strict";

const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const childProcess=require("node:child_process");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const test=require("node:test");

const root=path.resolve(__dirname,"../.."),output=fs.mkdtempSync(path.join(os.tmpdir(),"as3-primary-secondary-host-"));
test.after(()=>fs.rmSync(output,{recursive:true,force:true}));
fs.writeFileSync(path.join(output,"tsconfig.json"),JSON.stringify({compilerOptions:{target:"ES2022",module:"CommonJS",
    strict:true,skipLibCheck:true,rootDir:path.join(root,"src"),outDir:output},files:[
    path.join(root,"src/hardened-runtime/internal/AS3TypeRegistry.ts"),
    path.join(root,"src/hardened-runtime/internal/AS3PrimarySecondaryHost.ts")]}));
childProcess.execFileSync(process.execPath,[path.join(root,"node_modules/typescript-4-9/bin/tsc"),"-p",path.join(output,"tsconfig.json")],
    {cwd:root,stdio:"inherit"});
const registryPath=path.join(output,"hardened-runtime/internal/AS3TypeRegistry.js");
const hostPath=path.join(output,"hardened-runtime/internal/AS3PrimarySecondaryHost.js");
function fresh(){delete require.cache[require.resolve(hostPath)];delete require.cache[require.resolve(registryPath)];
    const registry=require(registryPath);return {registry,host:require(hostPath)};}
const sha=value=>crypto.createHash("sha256").update(value).digest("hex");
const metadata=entry=>entry.kind==="interface"?{kind:entry.kind,qname:entry.qname,bases:entry.bases}:
    {kind:entry.kind,qname:entry.qname,base:entry.base,interfaces:entry.interfaces,sourceSha256:entry.sourceSha256,fields:entry.fields};
function primary(entries=[]){const value={schema:"as3-runtime-type-authority@1",qnames:entries.map(item=>item.qname),entries:entries.map(metadata)};
    return {schema:value.schema,sha256:sha(JSON.stringify(value)),qnames:value.qnames,entries};}
function secondary(primarySha256,entries){const value={schema:"as3-runtime-secondary-type-authority@1",primarySha256,
    qnames:entries.map(item=>item.qname),entries:entries.map(metadata)};
    return {schema:value.schema,primarySha256,sha256:sha(JSON.stringify(value)),qnames:value.qnames,entries};}
function configured(host,typeSha,secondarySha,qnames,definitions=[]){const runtimeSha="a".repeat(64),provider=Object.freeze({commit:"b".repeat(40)});
    const expectedPlan=Object.freeze({schema:"as3-secondary-type-authority-plan@1",sourceClosureSha256:"c".repeat(64),provider,
        primaryAuthority:Object.freeze({runtimeAuthoritySha256:runtimeSha,typeAuthoritySha256:typeSha}),
        secondaryTypeAuthoritySha256:secondarySha,qnames:Object.freeze([...qnames])});
    const linkage=host.createAS3PrimarySecondaryLinkage({schema:"as3-primary-secondary-host-authority@1",
        runtimeAuthoritySha256:runtimeSha,typeAuthoritySha256:typeSha,expectedPlan,definitions,
        runtimeModules:[{specifier:"@test/runtime",module:Object.freeze({probe:1})}]});
    return {linkage,expectedPlan};
}

test("package-internal primary host binds sealed digests, literal resolvers, and one exact begin",()=>{
    const {registry,host}=fresh();class Bootstrap{}class Forged{}
    const primaryDocument=primary([{kind:"class",qname:"bootstrap.B",base:null,interfaces:[],sourceSha256:"9".repeat(64),fields:[],
        constructor:Bootstrap,predicate:value=>value instanceof Bootstrap,constructionTarget:null,constructionProof:null}]);
    assert.throws(()=>configured(host,primaryDocument.sha256,"d".repeat(64),["secondary.C"]),/not the exact sealed registry identity/);
    registry.installAS3TypeAuthority(primaryDocument);
    assert.throws(()=>configured(host,primaryDocument.sha256,"d".repeat(64),["secondary.C"],
        [{qname:"bootstrap.B",definition:Forged}]),/differs from the exact sealed class identity/);
    assert.throws(()=>configured(host,primaryDocument.sha256,"d".repeat(64),["secondary.C"],
        [{qname:"bootstrap.Missing",definition:Bootstrap}]),/differs from the exact sealed class identity/);
    const {linkage,expectedPlan}=configured(host,primaryDocument.sha256,"d".repeat(64),["secondary.C"],
        [{qname:"bootstrap.B",definition:Bootstrap}]);
    assert.deepEqual(Object.keys(linkage).sort(),["beginSecondaryAuthority","resolveDefinition","resolveRuntimeModule","runtimeAuthoritySha256","schema","typeAuthoritySha256"]);
    assert.equal(linkage.resolveDefinition("bootstrap.B"),Bootstrap);assert.equal(linkage.resolveRuntimeModule("@test/runtime").probe,1);
    assert.throws(()=>linkage.resolveDefinition("bootstrap.Missing"),/outside the authenticated literal resolver/);
    assert.throws(()=>linkage.beginSecondaryAuthority({...expectedPlan,sourceClosureSha256:"e".repeat(64)}),/differs/);
    const transaction=linkage.beginSecondaryAuthority(expectedPlan);assert.equal(transaction.active,true);
    assert.throws(()=>transaction.abort.call({...transaction}),/receiver identity differs/);transaction.abort();assert.equal(transaction.active,false);
    assert.throws(()=>linkage.beginSecondaryAuthority(expectedPlan),/only once/);
    assert.equal(registry.secondaryAuthorityOwnershipStatus().active,false);
    const packageJson=JSON.parse(fs.readFileSync(path.join(root,"src/hardened-runtime/package.json")));
    assert.equal(Object.keys(packageJson.exports).some(name=>/PrimarySecondary|TypeRegistry/.test(name)),false);
});

test("primary host passes the exact live document into the real branded registry and can poison only its lease",()=>{
    const {registry,host}=fresh(),primaryDocument=primary();registry.installAS3TypeAuthority(primaryDocument);class Child{}
    const document=secondary(primaryDocument.sha256,[{kind:"class",qname:"secondary.Child",base:null,interfaces:[],
        sourceSha256:"f".repeat(64),fields:[],constructor:Child,predicate:value=>value instanceof Child,
        constructionTarget:null,constructionProof:null}]);
    const {linkage,expectedPlan}=configured(host,primaryDocument.sha256,document.sha256,document.qnames);
    const transaction=linkage.beginSecondaryAuthority(expectedPlan),reservation=transaction.preflight(document);
    assert.equal(transaction.active,false);assert.equal(reservation.active,true);
    assert.equal(registry.secondaryAuthorityOwnershipStatus().phase,"reserved");
    assert.throws(()=>reservation.commit.call({...reservation}),/active owned identity/);
    const lease=reservation.commit();assert.equal(reservation.active,false);assert.equal(lease.active,true);
    assert.equal(registry.lookupClassType("secondary.Child",Child).name,"secondary.Child");
    assert.throws(()=>lease.poison.call({...lease}),/cannot poison/);lease.poison();assert.equal(lease.active,false);
    assert.equal(registry.secondaryAuthorityOwnershipStatus().phase,"poisoned");
    assert.throws(()=>registry.lookupClassType("secondary.Child",Child),/poisoned or revoked/);
    assert.throws(()=>lease.seal(),/cannot seal/);
});

test("primary host reservation abort consumes only the exact internal reservation",()=>{
    const {registry,host}=fresh(),primaryDocument=primary();registry.installAS3TypeAuthority(primaryDocument);class Child{}
    const document=secondary(primaryDocument.sha256,[{kind:"class",qname:"secondary.Child",base:null,interfaces:[],
        sourceSha256:"f".repeat(64),fields:[],constructor:Child,predicate:value=>value instanceof Child,
        constructionTarget:null,constructionProof:null}]);
    const {linkage,expectedPlan}=configured(host,primaryDocument.sha256,document.sha256,document.qnames);
    const reservation=linkage.beginSecondaryAuthority(expectedPlan).preflight(document);
    assert.throws(()=>reservation.abort.call({...reservation}),/receiver identity differs/);reservation.abort();reservation.abort();
    assert.equal(reservation.active,false);assert.equal(registry.secondaryAuthorityOwnershipStatus().active,false);
    assert.throws(()=>registry.lookupNamedReferenceType("secondary.Child"),/not registered/);
});
