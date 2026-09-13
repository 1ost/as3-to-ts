"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript-4-9");

const ROOT = path.resolve(__dirname, "../..");
class HardenedSemanticError extends Error { constructor(code,message){super(message);this.code=code;} }
const adapterModule={assertAdaptedSemanticProgram(){}};
function loadTranspiled(file,resolver) {
    const source=fs.readFileSync(file,"utf8");
    const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
    const value={exports:{}};Function("require","module","exports",compiled)(resolver,value,value.exports);return value.exports;
}
const localModules=new Map();
function loadLocalModule(file) {
    if (localModules.has(file)) return localModules.get(file);
    const value=loadTranspiled(file,specifier=>specifier.startsWith(".")
        ? loadLocalModule(path.resolve(path.dirname(file),specifier+".ts")) : require(specifier));
    localModules.set(file,value);return value;
}
const staticConstants=loadLocalModule(path.join(ROOT,"src/hardened/static-constants.ts"));
const emitterModule=loadTranspiled(path.join(ROOT,"src/hardened/emitter.ts"),specifier=>specifier==="./contracts"?{HardenedSemanticError}
    :specifier==="./adapter"?adapterModule:specifier==="./static-constants"?staticConstants:require(specifier));
const sourceMembers=loadTranspiled(path.join(ROOT,"src/hardened/source-member-authority.ts"),specifier=>specifier==="./contracts"?{HardenedSemanticError}:require(specifier));
const source = fs.readFileSync(path.join(ROOT, "src/hardened/type-authority.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS } }).outputText;
const moduleValue = { exports: {} };
Function("require", "module", "exports", compiled)(specifier=>specifier==="./contracts"?{HardenedSemanticError}
    :specifier==="./source-member-authority"?sourceMembers:specifier==="./adapter"?adapterModule:specifier==="./emitter"?emitterModule
        :specifier==="./static-constants"?staticConstants:specifier==="typescript-4-9"?ts:require(specifier),moduleValue,moduleValue.exports);
const { assertLocalRuntimeDefinitionClosure, emitRuntimeTypeAuthority, loadMappedRuntimeTypeAuthority, localRuntimeTypeAuthoritySource,
    localRuntimeInterfaceAuthoritySource, emitRuntimeApplicationEntry } = moduleValue.exports;
const sha256 = value => crypto.createHash("sha256").update(value).digest("hex");
const typeRef=runtimeName=>({sourceNodeId:"test",sourceSpan:null,sourceName:runtimeName,emittedName:runtimeName.split(".").at(-1),runtimeName,nullable:false,typeArguments:[]});
const classProgram=(name,{packageName="game",base=null,interfaces=[],members=[],imports=[],outputModulePath=`${packageName.replace(/\./g,"/")}/${name}.ts`}={})=>({schema:"as3-semantic-ir@1",
    sourceSha256:sha256(`${packageName}.${name}`),packageName,outputModulePath,imports,declaration:{declarationKind:"class",name,modifiers:["public"],
        extendsType:base===null?null:typeRef(base),interfaceExtendsTypes:[],implementsTypes:interfaces.map(runtimeName=>({runtimeName,type:typeRef(runtimeName)})),
        members:base===null?members:[{sourceNodeId:"test",sourceSpan:null,kind:"constructor",modifiers:["public"],parameters:[],body:[{
            sourceNodeId:"test",sourceSpan:null,kind:"expression",expression:{sourceNodeId:"test",sourceSpan:null,kind:"call",
                callee:{sourceNodeId:"test",sourceSpan:null,kind:"super"},calleeNullable:false,arguments:[],capabilitySource:null,capabilityMember:null,resultType:null}}]},...members]}});
const interfaceProgram=(name,bases=[],packageName="game")=>({schema:"as3-semantic-ir@1",sourceSha256:sha256(`${packageName}.${name}`),packageName,
    outputModulePath:`${packageName.replace(/\./g,"/")}/${name}.ts`,imports:[],
    declaration:{declarationKind:"interface",name,modifiers:["public"],extendsType:null,interfaceExtendsTypes:bases.map(typeRef),implementsTypes:[],members:[]}});
const packageProgram=(name,{packageName="game",imports=[],typeName="Object"}={})=>({schema:"as3-semantic-ir@1",sourceSha256:sha256(`${packageName}.${name}`),packageName,
    outputModulePath:`${packageName.replace(/\./g,"/")}/${name}.ts`,imports,declaration:{declarationKind:"packageField",name,
        type:{sourceName:typeName},initializer:{kind:"new",typeName}}});
const localImport=(targetModule,localValueType=null)=>{const name=path.posix.basename(targetModule);return {sourceNodeId:"test",sourceSpan:null,authorityKind:"local",
    localNodeId:"test",runtimeConstructible:localValueType===null,runtimeInterface:false,localValueType,compileTimeNamespace:false,
    sourceQualifiedName:`game.${name}`,sourceLocalName:name,targetModule,targetExport:name};};
const prove=(...programs)=>{assertLocalRuntimeDefinitionClosure(programs,ts);return programs;};
const semanticIdentity={sourceNodeId:"test",sourceSpan:null};
const methodReturningNew=(name,runtimeName)=>({...semanticIdentity,kind:"method",name,modifiers:["public"],namespaceName:null,parameters:[],
    returnType:typeRef(runtimeName),body:[{...semanticIdentity,kind:"return",expression:{...semanticIdentity,kind:"new",sourceType:typeRef(runtimeName),arguments:[]}}]});

test("mapped Laya predicate authority is pinned as one exact 28-type capability input",()=>{
    const lock=JSON.parse(fs.readFileSync(path.join(ROOT,"config/runtime-type-authority-lock.json"),"utf8"));
    assert.equal(lock.layaRevision,"ecade82aa369d890730c4dc847f9d769d74e8878");
    assert.equal(lock.predicateAuthorityCanonicalLfSha256,"6e97bb0b9f46c7e112408f69da2683d6c5c49276a4322f14e772c4bc215fa976");
    assert.equal(lock.predicateAuthorityEntryCount,28);
    assert.equal(lock.predicateAuthorityQNames.length,28);
    assert.equal(lock.predicateAuthorityQNames.at(-1),"flash.utils.Timer");
    assert.equal(lock.installation,"generated-package-internal-central-authority-before-application-entry");
    const inventory=JSON.parse(fs.readFileSync(path.join(ROOT,"package.json"),"utf8")).files;
    assert.ok(inventory.includes("config/runtime-type-authority-lock.json"));
    assert.ok(inventory.includes("config/runtime-type-predicates.json"));
});

test("mapped predicate loader rejects QName, heritage, signature, and canonical-byte drift",()=>{
    const row=(name,base=null)=>({sourceQName:name,targetCapabilityId:"api.test",targetModule:`src/layaAir/flash/test/${name}.ts`,
        constructorExport:name,constructorSignature:`typeof ${name}`,constructSignatures:[`new (): ${name}`],
        predicateExport:`isFlash${name}`,predicateSignature:`(value: unknown) => value is ${name}`,
        heritageClosure:base?[base]:[],moduleSha256:"a".repeat(64)});
    const document={schema:"laya-flash-runtime-type-predicates@1",hashMode:"canonical-lf-utf8",types:[row("Base"),row("Child","Base")]};
    const bytes=`${JSON.stringify(document)}\n`; const lock={schema:"bleach-as3-runtime-type-authority-lock@1",
        predicateAuthorityCanonicalLfSha256:sha256(bytes),predicateAuthorityEntryCount:2};
    const loaded=loadMappedRuntimeTypeAuthority(JSON.stringify(lock),bytes,["Base","Child"],sha256);
    assert.deepEqual(loaded.map(value=>[value.qname,value.base]),[["Base",null],["Child","Base"]]);
    assert.deepEqual(loaded.map(value=>value.module),["laya/flash/test/Base","laya/flash/test/Child"]);
    const censusDocument={schema:"as3-source-member-authority@2",generator:"air-sdk-swfdump-abc@1",
        sourceArtifactSha256:"c".repeat(64),entryCount:3,entries:[
            {qname:"Base",baseQName:"Composed",ownInstanceMemberNames:["nativeOnly"],dynamic:false},
            {qname:"Child",baseQName:"Base",ownInstanceMemberNames:[],dynamic:false},
            {qname:"Composed",baseQName:null,ownInstanceMemberNames:["composedMethod"],dynamic:false}]};
    const censusJson=JSON.stringify(censusDocument);
    const census=sourceMembers.loadSourceMemberAuthority(censusJson,sha256(censusJson),sha256);
    const enriched=moduleValue.exports.withNativeObjectMemberCensus(loaded,census);
    assert.deepEqual(enriched[0].nativeObjectTraits,{dynamic:false,names:["composedMethod","nativeOnly"],sourceArtifactSha256:"c".repeat(64)});
    assert.throws(()=>moduleValue.exports.withNativeObjectMemberCensus(loaded,{...census}),error=>error.code==="HARDENED_SOURCE_MEMBER_AUTHORITY_INSTANCE");
    const legacy={...censusDocument,schema:"as3-source-member-authority@1",entries:censusDocument.entries.map(({dynamic,...entry})=>entry)};
    const legacyJson=JSON.stringify(legacy);
    assert.equal(moduleValue.exports.withNativeObjectMemberCensus(loaded,sourceMembers.loadSourceMemberAuthority(legacyJson,sha256(legacyJson),sha256))[0].nativeObjectTraits.dynamic,null);
    const forged=JSON.stringify({...censusDocument,entries:censusDocument.entries.map(entry=>({...entry,dynamic:"false"}))});
    assert.throws(()=>sourceMembers.loadSourceMemberAuthority(forged,sha256(forged),sha256),error=>error.code==="HARDENED_SOURCE_MEMBER_AUTHORITY_ENTRY");

    assert.throws(()=>loadMappedRuntimeTypeAuthority(JSON.stringify(lock),bytes,["Base"],sha256),error=>error.code==="HARDENED_TYPE_AUTHORITY_CAPABILITIES");
    const drift=bytes.replace("typeof Child","typeof Object");
    const driftLock={...lock,predicateAuthorityCanonicalLfSha256:sha256(drift)};
    assert.throws(()=>loadMappedRuntimeTypeAuthority(JSON.stringify(driftLock),drift,["Base","Child"],sha256),error=>error.code==="HARDENED_TYPE_AUTHORITY_PREDICATE");
    const moduleDrift=bytes.replace("src/layaAir/flash/test/Base.ts","node:fs");
    const moduleDriftLock={...lock,predicateAuthorityCanonicalLfSha256:sha256(moduleDrift)};
    assert.throws(()=>loadMappedRuntimeTypeAuthority(JSON.stringify(moduleDriftLock),moduleDrift,["Base","Child"],sha256),error=>error.code==="HARDENED_TYPE_AUTHORITY_PREDICATE");
});

test("central authority emission is deterministic, closed, ordered, hash-pinned, and executable before lookup", () => {
    const child=classProgram("Child",{base:"game.Base",interfaces:["game.IRun"]});
    const runner=interfaceProgram("IRun"); const base=classProgram("Base"); prove(child,runner,base);
    const sources = [
        localRuntimeTypeAuthoritySource(child,"./Child"),
        localRuntimeInterfaceAuthoritySource(runner),
        localRuntimeTypeAuthoritySource(base,"./Base"),
    ];
    const first=emitRuntimeTypeAuthority(sources,sha256); const second=emitRuntimeTypeAuthority([...sources].reverse(),sha256);
    assert.equal(first.code,second.code); assert.equal(first.sha256,second.sha256);
    assert.deepEqual(first.qnames,["game.Base","game.IRun","game.Child"]);
    assert.match(first.code,new RegExp(`sourceSha256: "${sources[2].sourceSha256}"`));
    assert.doesNotMatch(first.code,/as3RegisterClass|as3DefineInterface|brand\s*\(/);
    const output=fs.mkdtempSync(path.join(os.tmpdir(),"as3-authority-module-"));
    try{
        fs.mkdirSync(path.join(output,"internal"));
        fs.copyFileSync(path.join(ROOT,"src/hardened-runtime/internal/AS3TypeRegistry.ts"),path.join(output,"internal/AS3TypeRegistry.ts"));
        fs.copyFileSync(path.join(ROOT,"src/hardened-runtime/AS3Type.ts"),path.join(output,"AS3Type.ts"));
        fs.copyFileSync(path.join(ROOT,"src/hardened-runtime/AS3MethodClosure.ts"),path.join(output,"AS3MethodClosure.ts"));
        fs.copyFileSync(path.join(ROOT,"src/hardened-runtime/AS3ClassInitialization.ts"),path.join(output,"AS3ClassInitialization.ts"));
        fs.writeFileSync(path.join(output,"AS3Authority.generated.ts"),first.code,"utf8");
        fs.writeFileSync(path.join(output,"Base.ts"),"const b=new WeakSet<object>(); export class Base{readonly _b=b.add(this)} export const isAS3ClassInstance=(v:unknown):v is Base=>b.has(v as object); export const as3ConstructionTarget=(_v:unknown):typeof Base|null=>null; export const isAS3ConstructionProof=(_v:unknown):boolean=>false;\n","utf8");
        fs.writeFileSync(path.join(output,"Child.ts"),"import {Base} from './Base'; const b=new WeakSet<object>(); export class Child extends Base{readonly _c=b.add(this)} export const isAS3ClassInstance=(v:unknown):v is Child=>b.has(v as object); export const as3ConstructionTarget=(_v:unknown):typeof Child|null=>null; export const isAS3ConstructionProof=(_v:unknown):boolean=>false;\n","utf8");
        const config=path.join(output,"tsconfig.json");
        fs.writeFileSync(config,JSON.stringify({compilerOptions:{target:"ES2022",module:"CommonJS",moduleResolution:"Node",strict:true,skipLibCheck:true,outDir:"./js"},include:["./*.ts","./internal/*.ts"]}),"utf8");
        childProcess.execFileSync(process.execPath,[path.join(ROOT,"node_modules/typescript-4-9/bin/tsc"),"-p",config],{cwd:output,stdio:"inherit"});
        const authority=require(path.join(output,"js/AS3Authority.generated.js"));
        const api=require(path.join(output,"js/AS3Type.js")); const {Base}=require(path.join(output,"js/Base.js")); const {Child}=require(path.join(output,"js/Child.js"));
        assert.equal(Object.isFrozen(authority.AS3_CLASS_DEFINITIONS),true);
        assert.deepEqual(authority.AS3_CLASS_DEFINITIONS.map(row=>row.name),["game.Base","game.Child"]);
        assert.deepEqual(authority.AS3_CLASS_DEFINITIONS.map(row=>row.definition),[Base,Child]);
        for(const row of authority.AS3_CLASS_DEFINITIONS) {
            assert.equal(Object.isFrozen(row),true);
            assert.equal(typeof row.initialize,"function");
            row.initialize();
        }
        assert.equal(api.as3Is(new Child(),api.as3ClassType("game.Base",Base)),true);
        assert.equal(api.as3Is(new Child(),api.as3InterfaceType("game.IRun")),true);
        assert.equal(api.as3Is(new Base(),api.as3ClassType("game.Child",Child)),false);
    }finally{fs.rmSync(output,{recursive:true,force:true});}
});

test("central authority source rejects duplicate QName, missing/cyclic closure, invalid imports, and bad hashes",()=>{
    const I=localRuntimeInterfaceAuthoritySource(interfaceProgram("I",[],""));
    assert.throws(()=>emitRuntimeTypeAuthority([I,I],sha256),error=>error.code==="HARDENED_TYPE_AUTHORITY_IDENTITY");
    const missing=localRuntimeInterfaceAuthoritySource(interfaceProgram("I",["Missing"],""));
    assert.throws(()=>emitRuntimeTypeAuthority([missing],sha256),error=>error.code==="HARDENED_TYPE_AUTHORITY_CLOSURE");
    const cycleI=localRuntimeInterfaceAuthoritySource(interfaceProgram("I",["J"],""));
    const cycleJ=localRuntimeInterfaceAuthoritySource(interfaceProgram("J",["I"],""));
    assert.throws(()=>emitRuntimeTypeAuthority([cycleI,cycleJ],sha256),error=>error.code==="HARDENED_TYPE_AUTHORITY_CLOSURE");
    const classSource=module=>({kind:"class",qname:"C",base:null,interfaces:[],sourceSha256:"a".repeat(64),definitionSafe:true,module,constructorExport:"C",predicateExport:"isC"});
    const localC=classProgram("C",{packageName:"",outputModulePath:"C.ts"}); prove(localC);
    ["node:fs","javascript:x","/absolute/C","C:/absolute/C","../game/../C","..\\game\\C","./game/\u0000C"].forEach(module=>
        assert.throws(()=>localRuntimeTypeAuthoritySource(localC,module),error=>error.code==="HARDENED_TYPE_AUTHORITY_LOCAL",module));
    [classSource("./C"),{...classSource("./C"),constructorExport:"bad-name"},{...classSource("./C"),definitionSafe:false}].forEach(source=>
        assert.throws(()=>emitRuntimeTypeAuthority([source],sha256),error=>error.code==="HARDENED_TYPE_AUTHORITY_SOURCE"));
    assert.throws(()=>emitRuntimeTypeAuthority([I],()=>"0"),error=>error.code==="HARDENED_TYPE_AUTHORITY_HASH");
});

test("application entry pins authority evaluation before every application module",()=>{
    const entry=emitRuntimeApplicationEntry(["z/B.ts","a/A.ts"],sha256);
    assert.equal(entry.path,"ApplicationEntry.generated.ts");
    assert.match(entry.sha256,/^[0-9a-f]{64}$/);
    assert.equal(entry.code.indexOf("./AS3Authority.generated") < entry.code.indexOf("./a/A"),true);
    assert.equal(entry.code.indexOf("./a/A") < entry.code.indexOf("./z/B"),true);
    ["../A.ts","/A.ts","C:/A.ts","a\\A.ts","a/../A.ts","node:fs.ts","ApplicationEntry.generated.ts"].forEach(module=>
        assert.throws(()=>emitRuntimeApplicationEntry([module],sha256),error=>error.code==="HARDENED_TYPE_AUTHORITY_ENTRY",module));
});

test("local authority imports require a fresh definition-only proof",()=>{
    const program=classProgram("Demo");
    prove(program);
    const admitted=localRuntimeTypeAuthoritySource(program,"../game/Demo");
    assert.equal(admitted.definitionSafe,true); assert.equal(admitted.sourceSha256,program.sourceSha256);
    ["node:fs","/game/Demo","C:/game/Demo","../game/../Demo","..\\game\\Demo","./game/\u0000Demo"].forEach(module=>
        assert.throws(()=>localRuntimeTypeAuthoritySource(program,module),error=>error.code==="HARDENED_TYPE_AUTHORITY_LOCAL",module));
    const unsafe={...program,declaration:{...program.declaration,members:[{kind:"field",name:"state",modifiers:["static"]}]}};
    assert.throws(()=>localRuntimeTypeAuthoritySource(unsafe,"../game/Demo"),error=>error.code==="HARDENED_TYPE_AUTHORITY_DEFINITION_CLOSURE");
    assert.throws(()=>localRuntimeTypeAuthoritySource({...program,declaration:{...program.declaration,modifiers:[]}},"../game/Demo"),error=>error.code==="HARDENED_TYPE_AUTHORITY_LOCAL");
});

test("local authority derives emitted edges, rejects unsafe cycles, and invalidates stale proofs",()=>{
    const direct=classProgram("Direct",{imports:[localImport("./SCore","game.Direct")]});
    const singleton=packageProgram("SCore",{typeName:"Direct",imports:[localImport("./Direct")]});
    assert.doesNotThrow(()=>assertLocalRuntimeDefinitionClosure([direct,singleton],ts));
    const vectorCtor=classProgram("VectorCtor");
    const vectorSingleton=packageProgram("VectorSingleton",{typeName:"VectorCtor",imports:[localImport("./VectorCtor")]});
    const helper=classProgram("Helper",{imports:[localImport("./VectorSingleton","game.VectorCtor")]});
    const root=classProgram("Root",{imports:[localImport("./Helper")]});
    assert.doesNotThrow(()=>assertLocalRuntimeDefinitionClosure([vectorCtor,vectorSingleton,helper,root],ts));
    const missing=classProgram("Missing",{imports:[localImport("./Absent")]});
    assert.throws(()=>assertLocalRuntimeDefinitionClosure([missing],ts),
        error=>error.code==="HARDENED_TYPE_AUTHORITY_DEFINITION_CLOSURE");
    const cycleA=classProgram("CycleA",{imports:[localImport("./CycleB")]});
    const cycleB=classProgram("CycleB",{imports:[localImport("./CycleA")]});
    assert.doesNotThrow(()=>assertLocalRuntimeDefinitionClosure([cycleA,cycleB],ts));
    const heritageBase=classProgram("HeritageBase",{imports:[localImport("./HeritageDerived")]});
    const heritageDerived=classProgram("HeritageDerived",{base:"game.HeritageBase",imports:[localImport("./HeritageBase")]});
    assert.doesNotThrow(()=>assertLocalRuntimeDefinitionClosure([heritageBase,heritageDerived],ts));
    const derivedSource=localRuntimeTypeAuthoritySource(heritageDerived,"./HeritageDerived");
    const baseSource=localRuntimeTypeAuthoritySource(heritageBase,"./HeritageBase");
    assert.ok(baseSource.evaluationOrder < derivedSource.evaluationOrder);
    assertLocalRuntimeDefinitionClosure([heritageDerived,heritageBase],ts);
    const currentDerivedSource=localRuntimeTypeAuthoritySource(heritageDerived,"./HeritageDerived");
    const currentBaseSource=localRuntimeTypeAuthoritySource(heritageBase,"./HeritageBase");
    assert.equal(currentDerivedSource.evaluationOrder,derivedSource.evaluationOrder);
    assert.equal(currentBaseSource.evaluationOrder,baseSource.evaluationOrder);
    const heritageAuthority=emitRuntimeTypeAuthority([currentBaseSource,currentDerivedSource],sha256).code;
    assert.ok(heritageAuthority.indexOf('from "./HeritageBase"') < heritageAuthority.indexOf('from "./HeritageDerived"'));
    assert.ok(heritageAuthority.indexOf('qname: "game.HeritageBase"') < heritageAuthority.indexOf('qname: "game.HeritageDerived"'));
    const impossibleA=classProgram("ImpossibleA",{base:"game.ImpossibleB",imports:[localImport("./ImpossibleB")]});
    const impossibleB=classProgram("ImpossibleB",{base:"game.ImpossibleA",imports:[localImport("./ImpossibleA")]});
    const mintedBeforeFailure=currentBaseSource;
    assert.throws(()=>assertLocalRuntimeDefinitionClosure([impossibleA,impossibleB],ts),
        error=>error.code==="HARDENED_TYPE_AUTHORITY_DEFINITION_CLOSURE");
    assert.throws(()=>localRuntimeTypeAuthoritySource(heritageBase,"./HeritageBase"),
        error=>error.code==="HARDENED_TYPE_AUTHORITY_DEFINITION_CLOSURE");
    assert.throws(()=>emitRuntimeTypeAuthority([mintedBeforeFailure],sha256),
        error=>error.code==="HARDENED_TYPE_AUTHORITY_DEFINITION_CLOSURE");
    const duplicate=classProgram("CycleA",{outputModulePath:"game/DuplicateCycleA.ts"});
    assert.throws(()=>assertLocalRuntimeDefinitionClosure([cycleA,duplicate],ts),
        error=>error.code==="HARDENED_TYPE_AUTHORITY_DEFINITION_CLOSURE");
    const contract=interfaceProgram("IContract");
    const constructsContract=classProgram("ConstructsContract",{imports:[localImport("./IContract")],
        members:[methodReturningNew("create","game.IContract")]});
    assert.throws(()=>assertLocalRuntimeDefinitionClosure([contract,constructsContract],ts),
        error=>error.code==="HARDENED_TYPE_AUTHORITY_DEFINITION_CLOSURE");
    const nestedRequire=classProgram("NestedRequire",{members:[{...semanticIdentity,kind:"method",name:"probe",modifiers:["public"],namespaceName:null,
        parameters:[],returnType:typeRef("void"),body:[{...semanticIdentity,kind:"expression",expression:{...semanticIdentity,kind:"call",
            callee:{...semanticIdentity,kind:"identifier",name:"require"},calleeNullable:false,
            arguments:[{...semanticIdentity,kind:"literal",value:"./CycleA"}],capabilitySource:null,capabilityMember:null,resultType:null}}]}]});
    assert.throws(()=>assertLocalRuntimeDefinitionClosure([nestedRequire],ts),
        error=>error.code==="HARDENED_TYPE_AUTHORITY_DEFINITION_CLOSURE");
    assert.throws(()=>localRuntimeTypeAuthoritySource(classProgram("Unproved"),"./Unproved"),
        error=>error.code==="HARDENED_TYPE_AUTHORITY_DEFINITION_CLOSURE");
});

test('static source expressions are deferred and malformed emitted registrations remain held',()=>{
 const literal=value=>({...semanticIdentity,kind:'literal',value});
 const array=elements=>({...semanticIdentity,kind:'array',elements});
 const object=value=>({...semanticIdentity,kind:'object',properties:[{...semanticIdentity,name:'data',value}]});
 const program=initializer=>classProgram('StaticContainers',{members:[{...semanticIdentity,kind:'field',name:'state',modifiers:['public','static'],namespaceName:null,
  readonly:false,type:{...typeRef('Object'),emittedName:'unknown',runtimeName:null},initializer,implicitDefault:"null",embeddedBitmap:null}]});
 for(const initializer of [array([]),array([literal(1),literal(null)]),object(array([literal('x')]))]){
  const value=program(initializer);prove(value);
  assert.equal(localRuntimeTypeAuthoritySource(value,'../game/StaticContainers').definitionSafe,true);
 }
 const call={...semanticIdentity,kind:'math',member:'max',arguments:[literal(1),literal(2)]};
 for(const initializer of [array([call]),object(call),{...semanticIdentity,kind:'coercion',targetType:typeRef('String'),argument:array([])}]) {
  const value=program(initializer);prove(value);
  assert.equal(localRuntimeTypeAuthoritySource(value,'../game/StaticContainers').definitionSafe,true);
 }
 const corrupt={...ts,createPrinter(options){const printer=ts.createPrinter(options);return {...printer,
  printFile(file){return printer.printFile(file).replace('__as3DefineClassInitialization(StaticContainers','__as3MissingRegistration(StaticContainers');}};}};
 assert.throws(()=>assertLocalRuntimeDefinitionClosure([program(array([call]))],corrupt),error=>error.code==='HARDENED_TYPE_AUTHORITY_STATIC_INIT');

});

test("v2 mapped interfaces retain nominal class relationships and reject invalid closures",()=>{
    const nativeInterface={kind:"interface",sourceQName:"flash.events.IEventDispatcher",targetCapabilityId:"api.flash.events",
        targetModule:"src/layaAir/flash/events/EventDispatcher.ts",interfaceExport:"IEventDispatcher",heritageClosure:[],moduleSha256:"a".repeat(64)};
    const dispatcher={kind:"class",sourceQName:"flash.events.EventDispatcher",targetCapabilityId:"api.flash.events",
        targetModule:"src/layaAir/flash/events/EventDispatcher.ts",constructorExport:"EventDispatcher",
        constructorSignature:"typeof EventDispatcher",constructSignatures:["new (): EventDispatcher"],
        predicateExport:"isFlashEventDispatcher",predicateSignature:"(value: unknown) => value is EventDispatcher",
        heritageClosure:[],interfaces:[nativeInterface.sourceQName],moduleSha256:"b".repeat(64)};
    const load=types=>{
        const bytes=JSON.stringify({schema:"laya-flash-runtime-type-predicates@2",hashMode:"canonical-lf-utf8",types});
        return loadMappedRuntimeTypeAuthority(JSON.stringify({schema:"as3-application-runtime-type-authority-lock@1",
            predicateAuthorityCanonicalLfSha256:sha256(bytes),predicateAuthorityEntryCount:types.length}),bytes,types.map(row=>row.sourceQName),sha256);
    };
    const rows=load([dispatcher,nativeInterface]);
    assert.deepEqual(rows[0].interfaces,[nativeInterface.sourceQName]);
    assert.deepEqual(rows[1],{kind:"interface",qname:nativeInterface.sourceQName,bases:[]});
    const authority=emitRuntimeTypeAuthority(rows,sha256);
    assert.deepEqual(authority.qnames,[nativeInterface.sourceQName,dispatcher.sourceQName]);
    assert.equal(authority.code,emitRuntimeTypeAuthority([...rows].reverse(),sha256).code);
    assert.doesNotMatch(authority.code,/typeof.*addEventListener|in value/);
    for(const types of [
        [dispatcher],
        [{...dispatcher,interfaces:[dispatcher.sourceQName]},nativeInterface],
        [{...dispatcher,heritageClosure:[nativeInterface.sourceQName]},nativeInterface],
        [dispatcher,{...nativeInterface,heritageClosure:[nativeInterface.sourceQName]}],
        [dispatcher,{...nativeInterface,heritageClosure:["flash.events.IChild"]},
            {...nativeInterface,sourceQName:"flash.events.IChild",heritageClosure:[nativeInterface.sourceQName]}],
    ]) assert.throws(()=>load(types),error=>error.code==="HARDENED_TYPE_AUTHORITY_HERITAGE");
    for(const value of [{...nativeInterface,interfaceExport:"bad.export"},{...dispatcher,interfaces:[nativeInterface.sourceQName,nativeInterface.sourceQName]},
        {...nativeInterface,constructorExport:"IEventDispatcher"},{...dispatcher,kind:"unknown"}])
        assert.throws(()=>load([value]),error=>error.code==="HARDENED_TYPE_AUTHORITY_PREDICATE");
});
