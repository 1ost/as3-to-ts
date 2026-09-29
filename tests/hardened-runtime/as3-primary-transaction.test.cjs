"use strict";

const assert=require("node:assert/strict");
const childProcess=require("node:child_process");
const crypto=require("node:crypto");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const test=require("node:test");

const root=path.resolve(__dirname,"../.."),output=fs.mkdtempSync(path.join(os.tmpdir(),"as3-primary-transaction-"));
test.after(()=>fs.rmSync(output,{recursive:true,force:true}));
fs.writeFileSync(path.join(output,"tsconfig.json"),JSON.stringify({compilerOptions:{target:"ES2022",module:"CommonJS",
    strict:true,skipLibCheck:true,rootDir:path.join(root,"src"),outDir:output},
files:[path.join(root,"src/hardened-runtime/internal/AS3TypeRegistry.ts")]}));
childProcess.execFileSync(process.execPath,[path.join(root,"node_modules/typescript-4-9/bin/tsc"),"-p",path.join(output,"tsconfig.json")],
    {cwd:root,stdio:"inherit"});
const registryPath=path.join(output,"hardened-runtime/internal/AS3TypeRegistry.js");
const fresh=()=>{delete require.cache[require.resolve(registryPath)];return require(registryPath);};
const sha=value=>crypto.createHash("sha256").update(value).digest("hex");
function metadata(entry){return entry.kind==="interface"?{kind:entry.kind,qname:entry.qname,bases:entry.bases}:
    {kind:entry.kind,qname:entry.qname,base:entry.base,interfaces:entry.interfaces,sourceSha256:entry.sourceSha256,
        fields:entry.fields,...(entry.objectTraits?{objectTraits:entry.objectTraits}:{}),
        ...(entry.nativeObjectTraits?{nativeObjectTraits:entry.nativeObjectTraits}:{}),
        ...(entry.fileLocalScope?{fileLocalScope:entry.fileLocalScope}:{}),
        ...(entry.staticReflection!==undefined?{staticReflection:entry.staticReflection}:{}),
        ...(entry.staticCallTraits!==undefined?{staticCallTraits:entry.staticCallTraits}:{})};}
function authority(entries){const value={schema:"as3-runtime-type-authority@1",qnames:entries.map(item=>item.qname),
    entries:entries.map(metadata)};return {schema:value.schema,sha256:sha(JSON.stringify(value)),qnames:value.qnames,entries};}
function primary(){class Base{}class Child extends Base{}const document=authority([
    {kind:"interface",qname:"primary.I",bases:[]},
    {kind:"class",qname:"primary.Base",base:null,interfaces:["primary.I"],sourceSha256:"1".repeat(64),fields:[],
        constructor:Base,predicate:value=>value instanceof Base,constructionTarget:null,constructionProof:null},
    {kind:"class",qname:"primary.Child",base:"primary.Base",interfaces:[],sourceSha256:"2".repeat(64),fields:[],
        constructor:Child,predicate:value=>value instanceof Child,constructionTarget:null,constructionProof:null},
]);return {Base,Child,document};}

test("module import leaves primary authority open and preflight publishes nothing",()=>{
    const registry=fresh(),{Base,document}=primary();
    assert.deepEqual(registry.primaryAuthorityTransactionStatus(),{phase:"open",typeAuthoritySha256:null,publishedMutations:0});
    const reservation=registry.preflightAS3TypeAuthority(document);
    assert.equal(Object.getPrototypeOf(reservation),null);assert.equal(Object.isFrozen(reservation),true);
    assert.deepEqual(registry.primaryAuthorityTransactionStatus(),{phase:"reserved",typeAuthoritySha256:document.sha256,publishedMutations:0});
    assert.throws(()=>registry.lookupClassType("primary.Base",Base),/not sealed/);
    assert.throws(()=>registry.commitAS3TypeAuthority({...reservation}),/owned identity/);
    registry.abortAS3TypeAuthority(reservation);
    assert.deepEqual(registry.primaryAuthorityTransactionStatus(),{phase:"open",typeAuthoritySha256:null,publishedMutations:0});
    assert.throws(()=>registry.lookupClassType("primary.Base",Base),/not sealed/);
    assert.throws(()=>registry.abortAS3TypeAuthority(reservation),/owned identity/);
});

test("accessor authority input is rejected without invocation and clean validation failure remains retryable",()=>{
    const registry=fresh(),inner=authority([{kind:"interface",qname:"inner.I",bases:[]}]);let getterCalls=0;
    const entry={kind:"interface",qname:"outer.I"};Object.defineProperty(entry,"bases",{enumerable:true,get(){
        getterCalls+=1;registry.installAS3TypeAuthority(inner);return [];}});
    const metadata={schema:"as3-runtime-type-authority@1",qnames:["outer.I"],entries:[{kind:"interface",qname:"outer.I",bases:[]}]};
    const outer={schema:metadata.schema,sha256:sha(JSON.stringify(metadata)),qnames:metadata.qnames,entries:[entry]};
    assert.throws(()=>registry.preflightAS3TypeAuthority(outer),/accessor/);assert.equal(getterCalls,0);
    assert.deepEqual(registry.primaryAuthorityTransactionStatus(),{phase:"open",typeAuthoritySha256:null,publishedMutations:0});
    const reservation=registry.preflightAS3TypeAuthority(inner);registry.abortAS3TypeAuthority(reservation);
});

test("Proxy reentrancy cannot publish nested and outer authorities and terminally poisons validation",()=>{
    const registry=fresh(),inner=authority([{kind:"interface",qname:"inner.I",bases:[]}]);let attempted=false,nestedError=null;
    const target={kind:"interface",qname:"outer.I",bases:[]},entry=new Proxy(target,{ownKeys(value){
        if(!attempted){attempted=true;try{registry.installAS3TypeAuthority(inner);}catch(error){nestedError=error;}}
        return Reflect.ownKeys(value);}});
    const metadata={schema:"as3-runtime-type-authority@1",qnames:["outer.I"],entries:[target]};
    const outer={schema:metadata.schema,sha256:sha(JSON.stringify(metadata)),qnames:metadata.qnames,entries:[entry]};
    assert.throws(()=>registry.preflightAS3TypeAuthority(outer),/reentered or compromised/);
    assert.match(String(nestedError),/already installing or sealed/);assert.equal(attempted,true);
    assert.deepEqual(registry.primaryAuthorityTransactionStatus(),{phase:"poisoned",typeAuthoritySha256:null,publishedMutations:0});
    assert.throws(()=>registry.lookupInterfaceType("inner.I"),/not sealed/);
    assert.throws(()=>registry.lookupInterfaceType("outer.I"),/not sealed/);
    assert.throws(()=>registry.preflightAS3TypeAuthority(inner),/already installing or sealed/);
});

test("Vector mutation is blocked throughout validation, reservation, and commit",()=>{
    {const registry=fresh(),valid=authority([{kind:"interface",qname:"outer.I",bases:[]}]),policy={},predicate=()=>false;
        let attempted=false,vectorError=null;const entry=new Proxy(valid.entries[0],{ownKeys(value){if(!attempted){attempted=true;
            try{registry.registerVectorType("Vector.<hostile>",policy,predicate);}catch(error){vectorError=error;}}return Reflect.ownKeys(value);}}),
            outer={...valid,entries:[entry]};
        assert.throws(()=>registry.preflightAS3TypeAuthority(outer),/reentered or compromised/);
        assert.match(String(vectorError),/during AS3 primary authority validation/);
        assert.equal(registry.primaryAuthorityTransactionStatus().phase,"poisoned");}
    {const registry=fresh(),{document}=primary(),policy={},predicate=()=>false,reservation=registry.preflightAS3TypeAuthority(document);
        assert.throws(()=>registry.registerVectorType("Vector.<reserved>",policy,predicate),/during an AS3 primary authority transaction/);
        assert.equal(registry.primaryAuthorityTransactionStatus().phase,"reserved");registry.abortAS3TypeAuthority(reservation);
        assert.equal(registry.registerVectorType("Vector.<reserved>",policy,predicate).name,"Vector.<reserved>");}
    {const registry=fresh(),{document}=primary(),reservation=registry.preflightAS3TypeAuthority(document),originalSet=Map.prototype.set,
        policy={},predicate=()=>false;let attempted=false,vectorError=null;
        Map.prototype.set=function(key,value){if(!attempted){attempted=true;try{
            registry.registerVectorType("Vector.<installing>",policy,predicate);}catch(error){vectorError=error;}}
            return Reflect.apply(originalSet,this,[key,value]);};
        try{registry.commitAS3TypeAuthority(reservation);}finally{Map.prototype.set=originalSet;}
        assert.match(String(vectorError),/during an AS3 primary authority transaction/);assert.equal(attempted,true);
        assert.equal(registry.primaryAuthorityTransactionStatus().phase,"sealed");}
});

test("commit publishes the whole preflight plan and returns one nominal null-prototype receipt",()=>{
    const registry=fresh(),{Base,Child,document}=primary(),reservation=registry.preflightAS3TypeAuthority(document);
    const originalFreeze=Object.freeze;Object.freeze=()=>{throw new Error("late freeze must not run")};
    let receipt;try{receipt=registry.commitAS3TypeAuthority(reservation);}finally{Object.freeze=originalFreeze;}
    assert.equal(Object.getPrototypeOf(receipt),null);assert.equal(Object.isFrozen(receipt),true);
    assert.deepEqual({...receipt},{schema:"as3-type-authority-commit-receipt@1",typeAuthoritySha256:document.sha256});
    assert.equal(registry.isAS3TypeAuthorityCommitReceipt(receipt),true);
    assert.equal(registry.isAS3TypeAuthorityCommitReceipt({...receipt}),false);
    assert.equal(registry.lookupClassType("primary.Base",Base).name,"primary.Base");
    assert.equal(registry.testType(new Child(),registry.lookupInterfaceType("primary.I")),true);
    assert.deepEqual(registry.primaryAuthorityTransactionStatus(),{phase:"sealed",typeAuthoritySha256:document.sha256,
        publishedMutations:24});
    assert.throws(()=>registry.commitAS3TypeAuthority(reservation),/not commit-ready/);
    assert.throws(()=>registry.abortAS3TypeAuthority(reservation),/cannot abort/);
});

test("partial commit is journal-reverted and terminally poisons without retry",()=>{
    const registry=fresh(),{Base,document}=primary(),reservation=registry.preflightAS3TypeAuthority(document),originalSet=Map.prototype.set;
    let calls=0;Map.prototype.set=function(key,value){calls+=1;const result=Reflect.apply(originalSet,this,[key,value]);
        if(calls===2){Map.prototype.set=originalSet;throw new Error("injected map failure after mutation");}return result;};
    try{assert.throws(()=>registry.commitAS3TypeAuthority(reservation),/injected map failure/);}finally{Map.prototype.set=originalSet;}
    assert.deepEqual(registry.primaryAuthorityTransactionStatus(),{phase:"poisoned",typeAuthoritySha256:document.sha256,
        publishedMutations:0});
    assert.throws(()=>registry.lookupClassType("primary.Base",Base),/not sealed/);
    assert.throws(()=>registry.preflightAS3TypeAuthority(document),/already installing or sealed/);
    assert.throws(()=>registry.commitAS3TypeAuthority(reservation),/cannot poison|not commit-ready|ownership|owned identity/);
});

test("owner-side poison covers failed receipt validation and makes every token unusable",()=>{
    const registry=fresh(),{Base,document}=primary(),reservation=registry.preflightAS3TypeAuthority(document),
        receipt=registry.commitAS3TypeAuthority(reservation),token=registry.lookupClassType("primary.Base",Base);
    assert.equal(registry.isAS3TypeAuthorityCommitReceipt(receipt),true);
    assert.throws(()=>{try{throw new Error("consumer receipt validation failed");}catch(error){
        registry.poisonAS3TypeAuthority(reservation);throw error;}},/consumer receipt validation failed/);
    assert.equal(registry.isAS3TypeAuthorityCommitReceipt(receipt),false,
        "terminal poison must revoke a previously authentic receipt");
    assert.equal(registry.primaryAuthorityTransactionStatus().phase,"poisoned");
    assert.throws(()=>registry.lookupClassType("primary.Base",Base),/not sealed/);
    assert.throws(()=>registry.testType(new Base(),token),/primary runtime type authority is poisoned/);
    assert.throws(()=>registry.poisonAS3TypeAuthority(reservation),/cannot poison/);
    assert.throws(()=>registry.preflightAS3TypeAuthority(document),/already installing or sealed/);
});

test("invalid direct preflight is retryable, but compatibility installation remains fail-closed",()=>{
    {const registry=fresh(),{document}=primary(),bad={...document,sha256:"0".repeat(64)};
        assert.throws(()=>registry.preflightAS3TypeAuthority(bad),/canonical SHA-256/);
        assert.equal(registry.primaryAuthorityTransactionStatus().phase,"open");
        const reservation=registry.preflightAS3TypeAuthority(document);registry.abortAS3TypeAuthority(reservation);}
    {const registry=fresh(),{document}=primary(),bad={...document,sha256:"0".repeat(64)};
        assert.throws(()=>registry.installAS3TypeAuthority(bad),/canonical SHA-256/);
        assert.equal(registry.primaryAuthorityTransactionStatus().phase,"poisoned");
        assert.throws(()=>registry.installAS3TypeAuthority(document),/already installing or sealed/);}
});

test("document construction and class initialization remain explicitly outside registry rollback",()=>{
    const registry=fresh();let constructorEffects=0,cinitEffects=0;
    class Original{constructor(){constructorEffects+=1;}static initialize(){cinitEffects+=1;}}
    const document=authority([{kind:"class",qname:"primary.Original",base:null,interfaces:[],sourceSha256:"3".repeat(64),fields:[],
        constructor:Original,predicate:value=>value instanceof Original,constructionTarget:null,constructionProof:null}]);
    const reservation=registry.preflightAS3TypeAuthority(document);assert.equal(constructorEffects,0);assert.equal(cinitEffects,0);
    registry.commitAS3TypeAuthority(reservation);assert.equal(constructorEffects,0);assert.equal(cinitEffects,0);
    Original.initialize();new Original();assert.equal(cinitEffects,1);assert.equal(constructorEffects,1);
    registry.poisonAS3TypeAuthority(reservation);
    assert.equal(cinitEffects,1);assert.equal(constructorEffects,1,"poison does not pretend external effects were rolled back");
});
