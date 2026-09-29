"use strict";

const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const childProcess=require("node:child_process");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const test=require("node:test");

const root=path.resolve(__dirname,"../.."),output=fs.mkdtempSync(path.join(os.tmpdir(),"as3-secondary-reservation-"));
test.after(()=>fs.rmSync(output,{recursive:true,force:true}));
fs.writeFileSync(path.join(output,"tsconfig.json"),JSON.stringify({compilerOptions:{target:"ES2022",module:"CommonJS",
    strict:true,skipLibCheck:true,rootDir:path.join(root,"src"),outDir:output},
files:[path.join(root,"src/hardened-runtime/internal/AS3TypeRegistry.ts")]}));
childProcess.execFileSync(process.execPath,[path.join(root,"node_modules/typescript-4-9/bin/tsc"),"-p",path.join(output,"tsconfig.json")],
    {cwd:root,stdio:"inherit"});
const registryPath=path.join(output,"hardened-runtime/internal/AS3TypeRegistry.js");
const freshRegistry=()=>{delete require.cache[require.resolve(registryPath)];return require(registryPath);};
const sha=value=>crypto.createHash("sha256").update(value).digest("hex");
const metadata=entry=>entry.kind==="interface"?{kind:entry.kind,qname:entry.qname,bases:entry.bases}:
    {kind:entry.kind,qname:entry.qname,base:entry.base,interfaces:entry.interfaces,sourceSha256:entry.sourceSha256,
        fields:entry.fields,...(entry.objectTraits?{objectTraits:entry.objectTraits}:{}),
        ...(entry.nativeObjectTraits?{nativeObjectTraits:entry.nativeObjectTraits}:{}),
        ...(entry.fileLocalScope?{fileLocalScope:entry.fileLocalScope}:{}),
        ...(entry.staticReflection!==undefined?{staticReflection:entry.staticReflection}:{}),
        ...(entry.staticCallTraits!==undefined?{staticCallTraits:entry.staticCallTraits}:{})};
function primary(entries){const value={schema:"as3-runtime-type-authority@1",qnames:entries.map(item=>item.qname),
    entries:entries.map(metadata)};return {schema:value.schema,sha256:sha(JSON.stringify(value)),qnames:value.qnames,entries};}
function secondary(primarySha256,entries){const value={schema:"as3-runtime-secondary-type-authority@1",primarySha256,
    qnames:entries.map(item=>item.qname),entries:entries.map(metadata)};
    return {schema:value.schema,primarySha256,sha256:sha(JSON.stringify(value)),qnames:value.qnames,entries};}

test("secondary preflight reserves one digest-bound closed plan without publishing or poisoning primary",()=>{
    const registry=freshRegistry();
    class Base{} class Child extends Base{} class Other{}
    const primaryDocument=primary([
        {kind:"interface",qname:"primary.I",bases:[]},
        {kind:"class",qname:"primary.Base",base:null,interfaces:["primary.I"],sourceSha256:"1".repeat(64),fields:[],
            constructor:Base,predicate:value=>value instanceof Base,constructionTarget:null,constructionProof:null},
    ]);
    registry.installAS3TypeAuthority(primaryDocument);
    const primaryToken=registry.lookupClassType("primary.Base",Base);
    const valid=()=>secondary(primaryDocument.sha256,[
        {kind:"interface",qname:"secondary.I",bases:["primary.I"]},
        {kind:"class",qname:"secondary.Child",base:"primary.Base",interfaces:["secondary.I"],
            sourceSha256:"2".repeat(64),fields:[],constructor:Child,predicate:value=>value instanceof Child,
            constructionTarget:null,constructionProof:null},
    ]);

    const collision=valid();collision.qnames[0]="primary.I";collision.entries[0]={...collision.entries[0],qname:"primary.I"};
    const collisionMetadata={schema:collision.schema,primarySha256:collision.primarySha256,qnames:collision.qnames,
        entries:collision.entries.map(metadata)};collision.sha256=sha(JSON.stringify(collisionMetadata));
    assert.throws(()=>registry.preflightAS3SecondaryTypeAuthority(collision),/collision/);
    assert.deepEqual(registry.secondaryAuthorityReservationStatus(),{active:false,primarySha256:null,sha256:null});

    const wrong=valid();wrong.primarySha256="0".repeat(64);
    const wrongMetadata={schema:wrong.schema,primarySha256:wrong.primarySha256,qnames:wrong.qnames,entries:wrong.entries.map(metadata)};
    wrong.sha256=sha(JSON.stringify(wrongMetadata));
    assert.throws(()=>registry.preflightAS3SecondaryTypeAuthority(wrong),/primary identity/);
    const reused=valid();reused.entries[1]={...reused.entries[1],constructor:Base};
    assert.throws(()=>registry.preflightAS3SecondaryTypeAuthority(reused),/reused/);
    assert.deepEqual(registry.secondaryAuthorityReservationStatus(),{active:false,primarySha256:null,sha256:null});

    const reservation=registry.preflightAS3SecondaryTypeAuthority(valid());
    assert.equal(registry.secondaryAuthorityReservationStatus().active,true);
    assert.equal(registry.lookupClassType("primary.Base",Base),primaryToken);
    assert.throws(()=>registry.lookupNamedReferenceType("secondary.Child"),/not registered/);
    assert.throws(()=>registry.preflightAS3SecondaryTypeAuthority(valid()),/already active/);
    assert.throws(()=>registry.abortAS3SecondaryTypeAuthority({...reservation}),/active owned identity/);
    const expectedSurfaces=["TYPE_TOKENS","TYPE_DETAILS","CLASS_TOKENS","CLASS_BY_QNAME","CLASS_INTERFACES",
        "CLASS_PREDICATES","CLASS_CONSTRUCTION_TARGETS","CLASS_CONSTRUCTION_PROOFS","CLASS_FIELD_DEFAULTS",
        "STATIC_CALLS","STATIC_REFLECTION","CLASS_OBJECT_ENTRIES","CLASS_BASES","REGISTERED_CLASSES",
        "INTERFACE_TOKENS","INITIALIZED_INSTANCE_FIELDS","ACTIVE_CONSTRUCTIONS","PREPARED_CONSTRUCTION_FRAMES",
        "AUTHENTIC_CONSTRUCTION_FRAMES"];
    const ownership=registry.secondaryAuthorityOwnershipStatus();
    assert.equal(Object.isFrozen(ownership),true);
    assert.deepEqual(ownership,{active:true,primarySha256:primaryDocument.sha256,sha256:reservation.sha256,
        phase:"reserved",commitReady:true,rollbackable:false,blockers:[],unownedSurfaces:[],
        surfaces:expectedSurfaces.map(surface=>({surface,mutationCount:0,ownerSha256:null})),
        constructions:{prepared:0,active:0,initializedOrLive:0}});
    assert.equal(Object.isFrozen(ownership.surfaces),true);
    assert.equal(ownership.surfaces.every(Object.isFrozen),true);
    assert.throws(()=>registry.commitAS3SecondaryTypeAuthority({...reservation}),/active owned identity/);
    assert.deepEqual(registry.secondaryAuthorityOwnershipStatus(),ownership);
    assert.equal(registry.lookupClassType("primary.Base",Base),primaryToken);
    assert.throws(()=>registry.lookupNamedReferenceType("secondary.Child"),/not registered/);
    const lease=registry.commitAS3SecondaryTypeAuthority(reservation);
    const secondaryToken=registry.lookupClassType("secondary.Child",Child);
    const interfaceToken=registry.lookupInterfaceType("secondary.I");
    assert.equal(registry.testType(new Child(),secondaryToken),true);
    assert.equal(registry.testType(new Child(),interfaceToken),true);
    const committed=registry.secondaryAuthorityOwnershipStatus();
    assert.equal(committed.phase,"committed");assert.equal(committed.rollbackable,true);
    assert.deepEqual(committed.unownedSurfaces,[]);
    for(const row of committed.surfaces)assert.equal(row.ownerSha256,row.mutationCount===0?null:lease.sha256);
    assert.throws(()=>registry.commitAS3SecondaryTypeAuthority(reservation),/pre-existing owned state/);
    assert.throws(()=>registry.rollbackAS3SecondaryTypeAuthority({...lease}),/active owned identity/);
    registry.rollbackAS3SecondaryTypeAuthority(lease);
    assert.deepEqual(registry.secondaryAuthorityReservationStatus(),{active:false,primarySha256:null,sha256:null});
    assert.deepEqual(registry.secondaryAuthorityOwnershipStatus(),{active:false,primarySha256:null,sha256:null,
        phase:"none",commitReady:false,rollbackable:false,blockers:[],unownedSurfaces:[],
        surfaces:expectedSurfaces.map(surface=>({surface,mutationCount:0,ownerSha256:null})),
        constructions:{prepared:0,active:0,initializedOrLive:0}});
    assert.equal(registry.lookupClassType("primary.Base",Base),primaryToken);
    assert.throws(()=>registry.lookupNamedReferenceType("secondary.I"),/not registered/);
    assert.throws(()=>registry.testType({},secondaryToken),/not an authenticated token/);
    assert.equal(registry.lookupDynamicConstruction(Child),null);
    assert.throws(()=>registry.abortAS3SecondaryTypeAuthority(reservation),/active owned identity/);
    assert.throws(()=>registry.preflightAS3SecondaryTypeAuthority(valid()),/invalid or reused/);

    const afterFailure=valid();afterFailure.entries[1]={...afterFailure.entries[1],constructor:Other,
        base:"missing.Base"};
    afterFailure.sha256=sha(JSON.stringify({schema:afterFailure.schema,primarySha256:afterFailure.primarySha256,
        qnames:afterFailure.qnames,entries:afterFailure.entries.map(metadata)}));
    assert.throws(()=>registry.preflightAS3SecondaryTypeAuthority(afterFailure),/missing, cyclic, or wrong-kind base/);
    const fresh=()=>secondary(primaryDocument.sha256,[{kind:"class",qname:"secondary.Other",base:"primary.Base",interfaces:[],
        sourceSha256:"3".repeat(64),fields:[],constructor:Other,predicate:value=>value instanceof Other,
        constructionTarget:null,constructionProof:null}]);
    const finalReservation=registry.preflightAS3SecondaryTypeAuthority(fresh());
    registry.abortAS3SecondaryTypeAuthority(finalReservation);
    assert.equal(registry.lookupClassType("primary.Base",Base),primaryToken);
});

test("secondary journal owns every publication surface and rollback revokes exact constructors",()=>{
    const registry=freshRegistry();class Base{} const proof={};
    class Generated extends Base {static ping(){return 1;}}
    const primaryDocument=primary([{kind:"class",qname:"primary.Base",base:null,interfaces:[],sourceSha256:"1".repeat(64),
        fields:[],constructor:Base,predicate:value=>value instanceof Base,constructionTarget:null,constructionProof:null}]);
    registry.installAS3TypeAuthority(primaryDocument);const primaryToken=registry.lookupClassType("primary.Base",Base);
    const entry={kind:"class",qname:"secondary.Generated",base:"primary.Base",interfaces:[],sourceSha256:"2".repeat(64),
        fields:[{name:"count",policy:"zero"}],
        objectTraits:{dynamic:false,members:[{name:"count",kind:"field",type:"int",visibility:"public",namespaceName:null}]},
        staticReflection:{variables:[{name:"answer",type:"int"}]},staticCallTraits:{methods:[{name:"ping",visibility:"public",
            required:0,total:0,rest:false,parameterTypes:[]}],noncallableNames:["answer"],unsupportedNames:[]},
        constructor:Generated,predicate:value=>value instanceof Generated,
        constructionTarget:value=>value instanceof Generated?Generated:null,constructionProof:value=>value===proof};
    const reservation=registry.preflightAS3SecondaryTypeAuthority(secondary(primaryDocument.sha256,[entry]));
    const lease=registry.commitAS3SecondaryTypeAuthority(reservation),status=registry.secondaryAuthorityOwnershipStatus();
    const nonzero=new Set(status.surfaces.filter(row=>row.mutationCount!==0).map(row=>row.surface));
    assert.deepEqual([...nonzero],["TYPE_TOKENS","TYPE_DETAILS","CLASS_TOKENS","CLASS_BY_QNAME","CLASS_INTERFACES",
        "CLASS_PREDICATES","CLASS_CONSTRUCTION_TARGETS","CLASS_CONSTRUCTION_PROOFS","CLASS_FIELD_DEFAULTS",
        "STATIC_CALLS","STATIC_REFLECTION","CLASS_OBJECT_ENTRIES","CLASS_BASES","REGISTERED_CLASSES"]);
    assert.equal(registry.lookupStaticCallClass(Generated).traits.methods[0].callable,Generated.ping);
    assert.equal(registry.getAS3StaticReflectionDescriptor(Generated).qualifiedName,"secondary::Generated");
    assert.deepEqual(registry.lookupObjectCaller("secondary.Generated"),["secondary.Generated","primary.Base"]);
    const token=registry.lookupClassType("secondary.Generated",Generated);
    registry.rollbackAS3SecondaryTypeAuthority(lease);
    assert.equal(registry.lookupClassType("primary.Base",Base),primaryToken);
    assert.throws(()=>registry.lookupClassType("secondary.Generated",Generated),/not an exactly registered class/);
    assert.throws(()=>registry.getAS3StaticReflectionDescriptor(Generated),/no sealed static reflection/);
    assert.equal(registry.lookupStaticCallClass(Generated),null);
    assert.throws(()=>registry.lookupObjectCaller("secondary.Generated"),/lacks authenticated/);
    assert.throws(()=>registry.testType({},token),/not an authenticated token/);
});

test("prepared and active construction block rollback; initialized instances seal for application lifetime",()=>{
    const registry=freshRegistry();class Base{} const proof={};class Generated extends Base{}
    const primaryDocument=primary([{kind:"class",qname:"primary.Base",base:null,interfaces:[],sourceSha256:"1".repeat(64),
        fields:[],constructor:Base,predicate:value=>value instanceof Base,constructionTarget:null,constructionProof:null}]);
    registry.installAS3TypeAuthority(primaryDocument);const primaryToken=registry.lookupClassType("primary.Base",Base);
    const entry={kind:"class",qname:"secondary.Generated",base:"primary.Base",interfaces:[],sourceSha256:"2".repeat(64),
        fields:[{name:"count",policy:"zero"}],constructor:Generated,predicate:value=>value instanceof Generated,
        constructionTarget:value=>value instanceof Generated?Generated:null,constructionProof:value=>value===proof};
    const reservation=registry.preflightAS3SecondaryTypeAuthority(secondary(primaryDocument.sha256,[entry]));
    const lease=registry.commitAS3SecondaryTypeAuthority(reservation);
    const frame=registry.prepareConstruction(Generated,Generated,proof);
    let constructionStatus=registry.secondaryAuthorityOwnershipStatus();
    assert.equal(constructionStatus.constructions.prepared,1);
    assert.equal(constructionStatus.surfaces.find(row=>row.surface==="PREPARED_CONSTRUCTION_FRAMES").mutationCount,1);
    assert.equal(constructionStatus.surfaces.find(row=>row.surface==="AUTHENTIC_CONSTRUCTION_FRAMES").mutationCount,1);
    assert.throws(()=>registry.rollbackAS3SecondaryTypeAuthority(lease),/prepared or active construction/);
    registry.cancelPreparedConstruction(Generated,proof,frame);
    const value=Object.create(Generated.prototype);registry.enterConstruction(value,Generated,Generated,proof);
    constructionStatus=registry.secondaryAuthorityOwnershipStatus();
    assert.equal(constructionStatus.constructions.active,1);
    assert.equal(constructionStatus.surfaces.find(row=>row.surface==="ACTIVE_CONSTRUCTIONS").mutationCount,1);
    assert.throws(()=>registry.rollbackAS3SecondaryTypeAuthority(lease),/prepared or active construction/);
    registry.initializeInstanceFields(value,Generated);registry.completeConstruction(value,Generated,Generated,proof);
    constructionStatus=registry.secondaryAuthorityOwnershipStatus();
    assert.equal(value.count,0);assert.equal(constructionStatus.phase,"sealed");
    assert.equal(constructionStatus.constructions.initializedOrLive,1);
    assert.equal(constructionStatus.surfaces.find(row=>row.surface==="INITIALIZED_INSTANCE_FIELDS").mutationCount,1);
    assert.equal(constructionStatus.surfaces.find(row=>row.surface==="ACTIVE_CONSTRUCTIONS").mutationCount,0);
    assert.throws(()=>registry.rollbackAS3SecondaryTypeAuthority(lease),/application-lifetime initialization seal/);
    assert.equal(registry.lookupClassType("primary.Base",Base),primaryToken);
});

test("explicit initialization poison disables secondary identities without poisoning primary",()=>{
    const registry=freshRegistry();class Base{}class Child extends Base{}
    const primaryDocument=primary([{kind:"class",qname:"primary.Base",base:null,interfaces:[],sourceSha256:"1".repeat(64),
        fields:[],constructor:Base,predicate:value=>value instanceof Base,constructionTarget:null,constructionProof:null}]);
    registry.installAS3TypeAuthority(primaryDocument);const primaryToken=registry.lookupClassType("primary.Base",Base);
    const document=secondary(primaryDocument.sha256,[{kind:"class",qname:"secondary.Child",base:"primary.Base",interfaces:[],
        sourceSha256:"2".repeat(64),fields:[],constructor:Child,predicate:value=>value instanceof Child,
        constructionTarget:null,constructionProof:null}]);
    const lease=registry.commitAS3SecondaryTypeAuthority(registry.preflightAS3SecondaryTypeAuthority(document));
    registry.poisonAS3SecondaryTypeAuthority(lease);
    assert.equal(registry.secondaryAuthorityOwnershipStatus().phase,"poisoned");
    assert.throws(()=>registry.lookupClassType("secondary.Child",Child),/poisoned or revoked/);
    assert.throws(()=>registry.rollbackAS3SecondaryTypeAuthority(lease),/initialization poison/);
    assert.equal(registry.lookupClassType("primary.Base",Base),primaryToken);
});

test("explicit application-lifetime seal rejects rollback without revoking the committed identity",()=>{
    const registry=freshRegistry();class Base{}class Child extends Base{}
    const primaryDocument=primary([{kind:"class",qname:"primary.Base",base:null,interfaces:[],sourceSha256:"1".repeat(64),
        fields:[],constructor:Base,predicate:value=>value instanceof Base,constructionTarget:null,constructionProof:null}]);
    registry.installAS3TypeAuthority(primaryDocument);
    const document=secondary(primaryDocument.sha256,[{kind:"class",qname:"secondary.Child",base:"primary.Base",interfaces:[],
        sourceSha256:"2".repeat(64),fields:[],constructor:Child,predicate:value=>value instanceof Child,
        constructionTarget:null,constructionProof:null}]);
    const lease=registry.commitAS3SecondaryTypeAuthority(registry.preflightAS3SecondaryTypeAuthority(document));
    registry.sealAS3SecondaryTypeAuthority(lease);
    assert.equal(registry.secondaryAuthorityOwnershipStatus().phase,"sealed");
    assert.throws(()=>registry.rollbackAS3SecondaryTypeAuthority(lease),/application-lifetime initialization seal/);
    assert.equal(registry.lookupClassType("secondary.Child",Child).name,"secondary.Child");
});
