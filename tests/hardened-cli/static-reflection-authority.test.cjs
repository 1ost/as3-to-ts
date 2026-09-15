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
function loadTranspiled(file,resolver,value={exports:{}}) {
    const source=fs.readFileSync(file,"utf8");
    const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
    Function("require","module","exports","__dirname",compiled)(resolver,value,value.exports,
        path.basename(file)==="reflection-provider-authority.ts" ? path.join(ROOT,"lib") : path.dirname(file));return value.exports;
}
const localModules=new Map();
function loadLocalModule(file) {
    if (localModules.has(file)) return localModules.get(file);
    // Match CommonJS: publish partial exports before evaluating dependencies.
    const module={exports:{}};localModules.set(file,module.exports);
    try {
        const value=loadTranspiled(file,specifier=>specifier.startsWith(".")
            ? loadLocalModule(path.resolve(path.dirname(file),specifier+".ts")) : require(specifier),module);
        localModules.set(file,value);return value;
    } catch(error) {localModules.delete(file);throw error;}
}
const staticConstants=loadLocalModule(path.join(ROOT,"src/hardened/static-constants.ts"));
const emitterModule=loadTranspiled(path.join(ROOT,"src/hardened/emitter.ts"),specifier=>specifier==="./contracts"?{HardenedSemanticError}
    :specifier==="./adapter"?adapterModule:specifier==="./static-constants"?staticConstants
        :specifier==="./local-interface-literal-read-authority"?loadLocalModule(path.join(ROOT,"src/hardened/local-interface-literal-read-authority.ts"))
            :specifier==="./mapped-native-dynamic-literal-read-authority"?loadLocalModule(path.join(ROOT,"src/hardened/mapped-native-dynamic-literal-read-authority.ts"))
                :specifier==="../hardened-runtime/internal/AS3FileLocalIdentity"?loadLocalModule(path.join(ROOT,"src/hardened-runtime/internal/AS3FileLocalIdentity.ts")):require(specifier));
const sourceMembers=loadTranspiled(path.join(ROOT,"src/hardened/source-member-authority.ts"),specifier=>specifier==="./contracts"?{HardenedSemanticError}:require(specifier));
const source = fs.readFileSync(path.join(ROOT, "src/hardened/type-authority.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS } }).outputText;
const moduleValue = { exports: {} };
Function("require", "module", "exports", compiled)(specifier=>specifier==="./contracts"?{HardenedSemanticError}
    :specifier==="./native-date-authority"?loadLocalModule(path.join(ROOT,"src/hardened/native-date-authority.ts")):specifier==="./reflection-provider-authority"?loadLocalModule(path.join(ROOT,"src/hardened/reflection-provider-authority.ts")):specifier==="./ledger"?loadLocalModule(path.join(ROOT,"src/hardened/ledger.ts")):specifier==="./source-member-authority"?sourceMembers:specifier==="./adapter"?adapterModule:specifier==="./emitter"?emitterModule
        :specifier==="./static-constants"?staticConstants:specifier==="../hardened-runtime/internal/AS3FileLocalIdentity"?loadLocalModule(path.join(ROOT,"src/hardened-runtime/internal/AS3FileLocalIdentity.ts")):specifier==="typescript-4-9"?ts:require(specifier),moduleValue,moduleValue.exports);
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


test("static reflection producer filters authenticated semantic fields and seals descriptor order",()=>{
 const field=(name,modifiers=["public","static"],readonly=false)=>({...semanticIdentity,kind:"field",name,modifiers,namespaceName:null,readonly,type:typeRef("String"),implicitDefault:"null",initializer:null});
 const program=classProgram("Formats",{members:[field("zeta"),field("alpha"),field("constant",["public","static"],true),field("privateField",["private","static"]),field("instance",["public"])]});
 prove(program);
 const result=localRuntimeTypeAuthoritySource(program,"./Formats");
 assert.deepEqual(result.staticReflection.variables,[{name:"zeta",type:"String"},{name:"alpha",type:"String"}]);
 assert.ok(Object.isFrozen(result.staticReflection.variables[0]));
 const emitted=emitRuntimeTypeAuthority([result],sha256);
 assert.match(emitted.code,/staticReflection:.*zeta.*alpha/);
 assert.equal(emitted.code.includes('"constant","type"'),false);
 const drift=classProgram("Formats",{members:[field("alpha"),field("zeta")]});prove(drift);
 const reordered=emitRuntimeTypeAuthority([localRuntimeTypeAuthoritySource(drift,"./Formats")],sha256);
 assert.notEqual(emitted.sha256,reordered.sha256);
 const uncertain=field("unknown");uncertain.type={...typeRef("Object"),sourceName:"Unproved",runtimeName:null};
 const unsupported=classProgram("Unsupported",{members:[field("known"),uncertain]});prove(unsupported);
 assert.equal(localRuntimeTypeAuthoritySource(unsupported,"./Unsupported").staticReflection,undefined);
 const qualified=field("format");qualified.type=typeRef("flash.text.TextFormat");
 const named=classProgram("Named",{members:[qualified]});prove(named);
 assert.equal(localRuntimeTypeAuthoritySource(named,"./Named").staticReflection.variables[0].type,"flash.text::TextFormat");
});
test("runtime package pins reflection and registry source bytes",()=>{
 const cli=fs.readFileSync(path.join(ROOT,"src/hardened-cli/cli.ts"),"utf8");
 for(const name of ["AS3Reflection.ts","internal/AS3TypeRegistry.ts"]){
  const hash=sha256(fs.readFileSync(path.join(ROOT,"src/hardened-runtime",name)));
  assert.ok(cli.includes(JSON.stringify(name)+": "+JSON.stringify(hash)));
 }
});

test("verified optional provider installs after seal before application initialization",{skip:!process.env.HARDENED_FIXTURE_LAYA},()=>{
 const laya=fs.realpathSync(process.env.HARDENED_FIXTURE_LAYA),targetPath=path.join(laya,"docTool/architecture/authored-content-capabilities.json");
 const targetJson=fs.readFileSync(targetPath,"utf8"),ledger=JSON.parse(targetJson),capability=ledger.capabilities.find(c=>c.id==="api.flash.utils");
 const rows=["createFlashReflectionMetadata","describeTypeXml"].map(name=>capability.obligations.find(r=>r.export===name));
 const canonical=v=>v===null||typeof v!=="object"?JSON.stringify(v):Array.isArray(v)?`[${v.map(canonical).join(",")}]`:`{${Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+canonical(v[k])).join(",")}}`;
 const targetSources={};
 for(const row of rows){
  const result=childProcess.spawnSync(process.execPath,[path.join(ROOT,"tools/resolve-laya-export.cjs")],{input:JSON.stringify({root:laya,facade:{module:row.module,export:row.export,sha256:row.sha256},candidates:[row]}),encoding:"utf8",timeout:30000});
  assert.equal(result.status,0,result.stderr);
  for(const [file,hash] of Object.entries(JSON.parse(result.stdout).inputs))targetSources[path.relative(laya,file).split(path.sep).join("/")]=hash;
 }
 const proof={schema:"as3-reflection-provider-target@1",targetCapabilitiesSha256:sha256(targetJson),targetCapabilityId:"api.flash.utils",targets:rows.map(({module,export:exported,signature,sha256})=>({module,export:exported,signature,sha256})),targetSources};
 const provider=loadLocalModule(path.join(ROOT,"src/hardened/reflection-provider-authority.ts")).loadReflectionProviderTarget(canonical(proof)+"\n",targetPath,targetJson);
 const plain=emitRuntimeTypeAuthority([],sha256);
 assert.equal(emitRuntimeTypeAuthority([],sha256,undefined).code,plain.code);
 assert.equal(plain.code.includes("installAS3ReflectionProvider"),false);
 assert.throws(()=>emitRuntimeTypeAuthority([],sha256,{target:{...provider},targetCapabilitiesJson:targetJson}),/verified target/);
 const wired=emitRuntimeTypeAuthority([],sha256,{target:provider,targetCapabilitiesJson:targetJson});
 assert.equal(wired.sha256,plain.sha256); // Same class authority; provider has its separate target/profile proof.
 const events=[],shared={createFlashReflectionMetadata(){},describeTypeXml(){}};
 const exports={};
 const code=ts.transpileModule(wired.code,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
 Function("require","exports",code)(name=>{
  if(name==="./internal/AS3TypeRegistry")return {installAS3TypeAuthority(){events.push("seal");}};
  if(name==="./AS3Reflection")return {installAS3ReflectionProvider(value){assert.deepEqual(events,["seal"]);assert.equal(value.createFlashReflectionMetadata,shared.createFlashReflectionMetadata);events.push("provider");}};
  if(name==="./AS3ClassInitialization")return {as3InitializeClass(){events.push("initializer");}};
  if(name.startsWith("laya/flash/utils/"))return shared;
  throw Error(name);
 },exports);
 const entry=emitRuntimeApplicationEntry(["application/Original.ts"],sha256);
 const entryCode=ts.transpileModule(entry.code,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
 Function("require","exports",entryCode)(name=>{
  if(name==="./AS3Authority.generated")return exports;
  assert.deepEqual(events,["seal","provider"]);
  class Original { constructor(){events.push("constructor");} }
  new Original();return {Original};
 },{});
 assert.deepEqual(events,["seal","provider","constructor"]);
});


// This gate invokes the actual built CLI and fixture authority producer. It must
// run in the coordinator's heavy lane, after building this exact compiler source.
test("actual CLI package installs verified shared reflection before original static initialization", {
 skip: !(process.env.HARDENED_FIXTURE_AIR_SDK && process.env.HARDENED_FIXTURE_LAYA && process.env.HARDENED_FIXTURE_FFDEC)
}, t => {
 const laya=fs.realpathSync(process.env.HARDENED_FIXTURE_LAYA);
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"static-reflection-cli-")));
 let completed=false;
 t.after(()=>{if(completed)fs.rmSync(dir,{recursive:true,force:true});else t.diagnostic(`Failed packaged reflection artifacts retained: ${dir}`);});
 const sourceRoot=path.join(dir,"source"),profile=path.join(dir,"profile");
 fs.mkdirSync(sourceRoot);
 // No source describeType call: source-call lowering is a separate acceptance gate.
 const original='package { public class ReflectionStartup { public static var calls:int = 0; public static var zeta:String = seed(); public static var alpha:int = 7; private static function seed():String { calls = calls + 1; return "ready"; } public function ReflectionStartup() {} } }\n';
 const originalPath=path.join(sourceRoot,"ReflectionStartup.as");fs.writeFileSync(originalPath,original);
 const run=(command,args)=>{
  const result=childProcess.spawnSync(command,args,{cwd:ROOT,encoding:"utf8",timeout:180000});
  assert.equal(result.status,0,`${command} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  return result;
 };
 run("python3",["-B","tools/create-fixture-profile.py","--source",sourceRoot,"--entry","ReflectionStartup",
  "--air-sdk",process.env.HARDENED_FIXTURE_AIR_SDK,"--laya",laya,"--ffdec-jar",process.env.HARDENED_FIXTURE_FFDEC,"--output",profile]);
 const targetPath=path.join(laya,"docTool/architecture/authored-content-capabilities.json");
 const targetJson=fs.readFileSync(targetPath,"utf8"),ledger=JSON.parse(targetJson);
 const capability=ledger.capabilities.find(row=>row.id==="api.flash.utils");assert.ok(capability);
 const rows=["createFlashReflectionMetadata","describeTypeXml"].map(name=>{
  const matches=capability.obligations.filter(row=>row.export===name);assert.equal(matches.length,1);return matches[0];
 });
 const canonical=value=>value===null||typeof value!=="object"?JSON.stringify(value):Array.isArray(value)
  ?`[${value.map(canonical).join(",")}]`:`{${Object.keys(value).sort().map(key=>JSON.stringify(key)+":"+canonical(value[key])).join(",")}}`;
 const targetSources={};
 for(const row of rows){
  const result=childProcess.spawnSync(process.execPath,[path.join(ROOT,"tools/resolve-laya-export.cjs")],{
   input:JSON.stringify({root:laya,facade:{module:row.module,export:row.export,sha256:row.sha256},candidates:[row]}),encoding:"utf8",timeout:30000});
  assert.equal(result.status,0,result.stderr);
  for(const [file,hash] of Object.entries(JSON.parse(result.stdout).inputs)){
   const relative=path.relative(laya,file).split(path.sep).join("/");
   if(targetSources[relative])assert.equal(targetSources[relative],hash);
   targetSources[relative]=hash;
  }
 }
 const proof={schema:"as3-reflection-provider-target@1",targetCapabilitiesSha256:sha256(targetJson),targetCapabilityId:"api.flash.utils",
  targets:rows.map(({module,export:exported,signature,sha256})=>({module,export:exported,signature,sha256})),targetSources};
 const proofBytes=canonical(proof)+"\n",lockPath=path.join(profile,"profile-lock.json"),plainLock=fs.readFileSync(lockPath);
 const transpile=name=>{
  const output=path.join(dir,name);
  run(process.execPath,["bin/as3-frontend","transpile",sourceRoot,output,"--source-census",path.join(profile,"census.json"),
   "--target-capabilities",targetPath,"--profile-lock",lockPath]);
  const manifest=JSON.parse(fs.readFileSync(path.join(output,"manifest.json")));
  assert.equal(manifest.files.length,1);assert.equal(manifest.files[0].sourceSha256,sha256(original));
  assert.equal(fs.readFileSync(originalPath,"utf8"),original);
  return output;
 };
 const plain=transpile("plain");
 fs.writeFileSync(path.join(profile,"reflection-provider.json"),proofBytes);
 const lock=JSON.parse(plainLock);lock.files.reflectionProvider={path:"reflection-provider.json",sha256:sha256(proofBytes)};
 fs.writeFileSync(lockPath,canonical(lock)+"\n");
 const wired=transpile("wired");
 for(const [output,enabled] of [[plain,false],[wired,true]]){
  const runtimeRoot=path.join(output,"__as3_runtime");
  const packageDirectory=path.join(output,"node_modules/@laya");fs.mkdirSync(packageDirectory,{recursive:true});
  fs.symlinkSync(runtimeRoot,path.join(packageDirectory,"as3-runtime"),"dir");
  const bundle=path.join(output,"reflection-consumer.cjs");
  // Bundle untouched generated JavaScript and the exact verified shared TS
  // modules. No replacement runtime, registry, provider, or generated-code edits.
  const result=require("esbuild").buildSync({stdin:{contents:
   'exports.entry = require("./__as3_runtime/ApplicationEntry.generated.js"); exports.runtime = require("./__as3_runtime/AS3Authority.generated.js");',
   resolveDir:output,sourcefile:"reflection-consumer.js"},outfile:bundle,bundle:true,platform:"node",format:"cjs",
   alias:{laya:path.join(laya,"src/layaAir")},metafile:true,logLevel:"silent"});
  const inputs=new Set(Object.keys(result.metafile.inputs).map(file=>path.resolve(file)));
  for(const row of rows)assert.equal(inputs.has(path.join(laya,row.module)),enabled,
   "optional package includes actual verified provider sources only when requested");
  const {entry,runtime}=require(bundle);
  assert.equal(entry.AS3_APPLICATION_TYPE_AUTHORITY_SHA256,runtime.AS3_TYPE_AUTHORITY_SHA256);
  const publication=runtime.AS3_CLASS_DEFINITIONS.find(row=>row.name==="ReflectionStartup");assert.ok(publication);
  const constructor=publication.definition;
  const dataValue=name=>{
   const descriptor=Object.getOwnPropertyDescriptor(constructor,name);assert.ok(descriptor);
   assert.ok(Object.hasOwn(descriptor,"value"),"observe original data slots without invoking a getter");
   return descriptor.value;
  };
  assert.equal(dataValue("calls"),0,"original initializer side effect has not run after entry import");
  assert.equal(dataValue("zeta"),null,"nonconstant original initializer retains its implicit slot default");
  if(enabled){
   const xml=runtime.as3DescribeTypeStatic(constructor);
   assert.deepEqual(Array.from(xml.variable,node=>[node.attribute("name").toPropertyKey(),node.attribute("type").toString()]),
    [["calls","int"],["zeta","String"],["alpha","int"]]);
   assert.equal(dataValue("calls"),0,"shared reflection does not execute original initializer side effects");
   assert.equal(dataValue("zeta"),null);
   assert.throws(()=>runtime.as3DescribeTypeStatic(function ReflectionStartup(){}),/registered|authenticated|authority/i);
  }else assert.throws(()=>runtime.as3DescribeTypeStatic(constructor),/authenticated shared provider/);
  publication.initialize();
  assert.equal(dataValue("calls"),1);assert.equal(dataValue("zeta"),"ready");assert.equal(dataValue("alpha"),7);
  constructor.alpha=19;publication.initialize();
  assert.equal(dataValue("calls"),1,"original initializer side effect occurs exactly once");
  assert.equal(dataValue("alpha"),19,"second initialization does not reset slots");
 }
 for(const [relative,hash] of Object.entries(targetSources))assert.equal(sha256(fs.readFileSync(path.join(laya,relative))),hash);
 completed=true;
});
