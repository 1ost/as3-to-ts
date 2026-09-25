"use strict";

const assert=require("node:assert/strict");
const childProcess=require("node:child_process");
const crypto=require("node:crypto");
const fs=require("node:fs");
const moduleApi=require("node:module");
const os=require("node:os");
const path=require("node:path");
const test=require("node:test");
const ts=require("typescript-4-9");

const ROOT=path.resolve(__dirname,"../..");
const AIR=process.env.HARDENED_FIXTURE_AIR_SDK;
const LAYA=process.env.HARDENED_FIXTURE_LAYA;
const FFDEC=process.env.HARDENED_FIXTURE_FFDEC;
const sha256=value=>crypto.createHash("sha256").update(value).digest("hex");
const canonical=value=>Array.isArray(value)?`[${value.map(canonical).join(",")}]`
    :value!==null&&typeof value==="object"?`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`
    :JSON.stringify(value);

function loadTypeScript(file,cache=new Map()) {
    if(cache.has(file)) return cache.get(file).exports;
    const record={exports:{}};cache.set(file,record);
    const output=ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{
        target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,
    }}).outputText;
    Function("require","module","exports",output)(specifier=>specifier.startsWith(".")
        ?loadTypeScript(path.resolve(path.dirname(file),specifier+".ts"),cache):require(specifier),record,record.exports);
    return record.exports;
}

function run(command,args,timeout=180000) {
    const result=childProcess.spawnSync(command,args,{cwd:ROOT,encoding:"utf8",timeout});
    assert.equal(result.status,0,result.stdout+result.stderr);
    return result;
}

test("computed local-interface read trust root binds exact retained AIR and runtime bytes",{skip:!LAYA},()=>{
    const authority=loadTypeScript(path.join(ROOT,"src/hardened/local-interface-computed-read-authority.ts"))
        .LOCAL_INTERFACE_COMPUTED_READ_AUTHORITY;
    const laya=fs.realpathSync(LAYA);
    assert.equal(sha256(fs.readFileSync(path.join(laya,authority.nativeEvidencePath))),authority.nativeEvidenceSha256);
    for(const [source,digest] of [
        [authority.runtimeObjectDispatchSourcePath,authority.runtimeObjectDispatchSourceSha256],
        [authority.runtimeTypeSourcePath,authority.runtimeTypeSourceSha256],
        [authority.runtimeTypeRegistrySourcePath,authority.runtimeTypeRegistrySourceSha256],
    ]) assert.equal(sha256(fs.readFileSync(path.join(ROOT,source))),digest,source);
    const {authoritySha256,...document}=authority;
    assert.equal(sha256(canonical(document)+"\n"),authoritySha256);
    const native=JSON.parse(fs.readFileSync(path.join(laya,authority.nativeEvidencePath),"utf8"));
    assert.equal(native.schema,"laya.nested-interface-computed-read-native-air@1");
    assert.equal(native.capture.runtime.version,"MAC 51,3,3,2");
    assert.equal(native.runtimeAuthority.artifacts["frameworks/libs/air/airglobal.swc"],
        "e0f81fdb2029d2bb16e6987c8d85d4eba5eedfa3a23ed6e7f780bf6eb67b0546");
});

test("computed String interface reads match retained AIR output and evaluate the receiver once",
    {skip:!(AIR&&LAYA&&FFDEC)},t=>{
    const temporary=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"local-interface-computed-read-")));
    t.after(()=>fs.rmSync(temporary,{recursive:true,force:true}));
    const source=path.join(temporary,"source");fs.mkdirSync(source);
    const fixture=path.join(fs.realpathSync(LAYA),"tests/nativeFlashOracle/nested-interface-computed-read");
    const native=JSON.parse(fs.readFileSync(path.join(fixture,"native-air.json"),"utf8"));
    for(const [name,digest] of Object.entries(native.sourceFiles)) {
        if(!name.endsWith(".as")) continue;
        const bytes=fs.readFileSync(path.join(fixture,name));assert.equal(sha256(bytes),digest,name);
        if(name!=="NestedInterfaceComputedReadProbe.as") fs.writeFileSync(path.join(source,name),bytes);
    }
    fs.writeFileSync(path.join(source,"ComputedReadGeneratedProbe.as"),`package {
 public final class ComputedReadGeneratedProbe {
  public function read(box:ComputedReadBox,key:String):* {return box.value[key];}
  public function readNull(value:IComputedRead,key:String):* {return value[key];}
  public function owns(box:ComputedReadBox,key:String):Boolean {return Object(box.value).hasOwnProperty(key);}
 }
}\n`);
    const profile=path.join(temporary,"profile");
    run("python3",["-B","tools/create-fixture-profile.py","--source",source,
        "--entry","ComputedReadGeneratedProbe","--air-sdk",AIR,"--laya",LAYA,
        "--ffdec-jar",FFDEC,"--output",profile]);
    const output=path.join(temporary,"output");
    run(process.execPath,["bin/as3-frontend","transpile",source,output,
        "--source-census",path.join(profile,"census.json"),"--target-capabilities",
        path.join(LAYA,"docTool/architecture/authored-content-capabilities.json"),
        "--profile-lock",path.join(profile,"profile-lock.json")]);
    const relative="__as3_runtime/application/";
    const probeCode=fs.readFileSync(path.join(output,relative,"ComputedReadGeneratedProbe.ts"),"utf8");
    assert.match(probeCode,/__as3ObjectRead\(__as3Cast\(box!\.value, __as3NamedReferenceType\("IComputedRead"\)\), key, "ComputedReadGeneratedProbe"\)/);
    assert.equal((probeCode.match(/box!\.value/g)||[]).length,2,
        "read and hasOwnProperty helpers must each evaluate their receiver once");

    const emittedRoot=path.join(output,relative);
    const emittedFiles=fs.readdirSync(emittedRoot).filter(name=>name.endsWith(".ts")).map(name=>path.join(emittedRoot,name));
    const strictConfig=path.join(temporary,"strict.json");
    fs.writeFileSync(strictConfig,JSON.stringify({compilerOptions:{target:"ES2022",module:"CommonJS",moduleResolution:"Node",
        strict:true,skipLibCheck:true,noEmit:true,baseUrl:ROOT,paths:{"@laya/as3-runtime/*":["src/hardened-runtime/*"]}},files:emittedFiles}));
    run(process.execPath,[path.join(ROOT,"node_modules/typescript-4-9/bin/tsc"),"-p",strictConfig]);

    const entryPath=path.join(output,"__as3_runtime/ApplicationEntry.generated.js");
    const entry=moduleApi.createRequire(entryPath)(entryPath);
    const find=name=>entry.AS3_APPLICATION_MODULES.find(module=>module[name])[name];
    const Probe=find("ComputedReadGeneratedProbe"),Box=find("ComputedReadBox"),Trace=find("ComputedReadTrace");
    const probe=new Probe(),box=new Box(),expected=native.capture.state.observations[0].result;
    const read=key=>{Trace.reset();try{return {kind:"return",value:probe.read(box,key),trace:Trace.snapshot()};}
        catch(error){return {kind:"throw",name:error.name,errorID:error.errorID,trace:Trace.snapshot()};}};
    for(const key of ["declaredValue","extraGetter","extraField"]) {
        const expectedKey={declaredValue:"declared",extraGetter:"extraGetter",extraField:"extraField"}[key];
        assert.deepEqual(read(key),expected[expectedKey]);
    }
    for(const key of ["missing","privateValue","protectedValue"]) {
        const expectedKey={missing:"missing",privateValue:"privateRead",protectedValue:"protectedRead"}[key];
        const actual=read(key),retained=expected[expectedKey];
        assert.deepEqual(actual,{kind:"throw",name:retained.name,errorID:retained.errorID,trace:retained.trace});
    }
    for(const [key,expectedKey] of [["declaredValue","declaredOwn"],["extraGetter","extraGetterOwn"],
        ["extraField","extraFieldOwn"],["missing","missingOwn"]]) {
        Trace.reset();assert.deepEqual({value:probe.owns(box,key),trace:Trace.snapshot()},expected[expectedKey]);
    }
    assert.throws(()=>probe.readNull(null,"declaredValue"),error=>
        error.name===expected.nullRead.name&&error.errorID===expected.nullRead.errorID);
});

test("effectful, non-String, mutation, and invocation computed-interface forms remain held",
    {skip:!(AIR&&LAYA&&FFDEC)},t=>{
    const temporary=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"local-interface-computed-guards-")));
    t.after(()=>fs.rmSync(temporary,{recursive:true,force:true}));
    const source=path.join(temporary,"source");fs.mkdirSync(source);
    const files={
        "IValue.as":`package {public interface IValue {function get value():String;}}\n`,
        "Value.as":`package {public final class Value implements IValue {public function get value():String{return "ok";}}}\n`,
        "Good.as":`package {public final class Good {public function run(value:IValue,key:String):* {return value[key];}}}\n`,
        "Effectful.as":`package {public final class Effectful {private function key():String{return "value";} public function run(value:IValue):* {return value[key()];}}}\n`,
        "Numeric.as":`package {public final class Numeric {public function run(value:IValue,key:int):* {return value[key];}}}\n`,
        "ClassKey.as":`package {public final class ClassKey {public function run(value:IValue,key:Value):* {return value[key];}}}\n`,
        "Write.as":`package {public final class Write {public function run(value:IValue,key:String):void {value[key]="x";}}}\n`,
        "DeleteRead.as":`package {public final class DeleteRead {public function run(value:IValue,key:String):Boolean {return delete value[key];}}}\n`,
        "CallRead.as":`package {public final class CallRead {public function run(value:IValue,key:String):* {return value[key]();}}}\n`,
    };
    for(const [name,bytes] of Object.entries(files)) fs.writeFileSync(path.join(source,name),bytes);
    const profile=path.join(temporary,"profile");
    run("python3",["-B","tools/create-fixture-profile.py","--source",source,"--entry","Good",
        "--air-sdk",AIR,"--laya",LAYA,"--ffdec-jar",FFDEC,"--output",profile]);
    const output=path.join(temporary,"output");
    run(process.execPath,["bin/as3-frontend","qualify",source,output,
        "--source-census",path.join(profile,"census.json"),"--target-capabilities",
        path.join(LAYA,"docTool/architecture/authored-content-capabilities.json"),
        "--profile-lock",path.join(profile,"profile-lock.json")]);
    const rows=JSON.parse(fs.readFileSync(path.join(output,"manifest.json"),"utf8")).files;
    assert.equal(rows.find(row=>row.sourcePath==="Good.as").status,"admitted");
    for(const name of ["Effectful.as","Numeric.as","ClassKey.as","Write.as","DeleteRead.as","CallRead.as"])
        assert.equal(rows.find(row=>row.sourcePath===name).status,"held",name);
});
