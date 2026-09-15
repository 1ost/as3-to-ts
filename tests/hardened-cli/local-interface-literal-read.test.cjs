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
const REVISION="0bea00b53688f473a33071c6edf347a32c14e202";
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

test("local-interface literal-read trust root binds exact retained AIR/browser and runtime bytes",{skip:!LAYA},()=>{
    const authority=loadTypeScript(path.join(ROOT,"src/hardened/local-interface-literal-read-authority.ts"))
        .LOCAL_INTERFACE_LITERAL_READ_AUTHORITY;
    assert.equal(authority.evidenceRevision,REVISION);
    const revision=childProcess.spawnSync("git",["merge-base","--is-ancestor",REVISION,"HEAD"],{cwd:LAYA,encoding:"utf8"});
    assert.equal(revision.status,0,revision.stdout+revision.stderr);
    const evidenceRoot=path.join(fs.realpathSync(LAYA),"tests/nativeFlashOracle/nested-interface-literal-read");
    for(const [name,digest] of [
        ["native-air.json",authority.nativeEvidenceSha256],
        ["browser-air.json",authority.browserEvidenceSha256],
        ["browser-pin.json",authority.browserPinSha256],
        ["run-browser.mjs",authority.browserRunnerSha256],
    ]) assert.equal(sha256(fs.readFileSync(path.join(evidenceRoot,name))),digest,name);
    for(const [source,digest] of [
        [authority.runtimeObjectDispatchSourcePath,authority.runtimeObjectDispatchSourceSha256],
        [authority.runtimeTypeSourcePath,authority.runtimeTypeSourceSha256],
        [authority.runtimeTypeRegistrySourcePath,authority.runtimeTypeRegistrySourceSha256],
    ]) assert.equal(sha256(fs.readFileSync(path.join(ROOT,source))),digest,source);
    const {authoritySha256,...document}=authority;
    assert.equal(sha256(canonical(document)+"\n"),authoritySha256);
    const native=JSON.parse(fs.readFileSync(path.join(evidenceRoot,"native-air.json"),"utf8"));
    assert.equal(native.capture.runtime.version,"MAC 51,3,3,2");
    assert.equal(native.runtimeAuthority.artifacts["frameworks/libs/air/airglobal.swc"],
        "e0f81fdb2029d2bb16e6987c8d85d4eba5eedfa3a23ed6e7f780bf6eb67b0546");
});

test("exact nested local-interface literal reads emit one nominal object-read and preserve AIR behavior",
    {skip:!(AIR&&LAYA&&FFDEC)},t=>{
    const temporary=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"local-interface-read-")));
    t.after(()=>fs.rmSync(temporary,{recursive:true,force:true}));
    const source=path.join(temporary,"source");fs.mkdirSync(source);
    const fixture=path.join(fs.realpathSync(LAYA),"tests/nativeFlashOracle/nested-interface-literal-read");
    const native=JSON.parse(fs.readFileSync(path.join(fixture,"native-air.json"),"utf8"));
    for(const [name,digest] of Object.entries(native.sourceFiles)) {
        if(!name.endsWith(".as")) continue;
        const bytes=fs.readFileSync(path.join(fixture,name));assert.equal(sha256(bytes),digest,name);
        fs.writeFileSync(path.join(source,name),bytes);
    }
    const synthetic={
        "IBasicInterface.as":`package {public interface IBasicInterface {}}\n`,
        "ItemTemplate.as":`package {public final class ItemTemplate implements IBasicInterface {public function get type():int {return 17;}}}\n`,
        "Item.as":`package {public final class Item {private var value:IBasicInterface=new ItemTemplate(); public function get template():IBasicInterface {return value;}}}\n`,
        "ItemReadProbe.as":`package {public final class ItemReadProbe {public function run(arg1:Item):* {return arg1.template["type"];}}}\n`,
        "InterfaceDirectRead.as":`package {public final class InterfaceDirectRead {public function run(value:INestedRead):* {return value["extraGetter"];}}}\n`,
    };
    for(const [name,bytes] of Object.entries(synthetic)) fs.writeFileSync(path.join(source,name),bytes);
    const run=(command,args,timeout=180000)=>{const result=childProcess.spawnSync(command,args,{cwd:ROOT,encoding:"utf8",timeout});
        assert.equal(result.status,0,result.stdout+result.stderr);return result;};
    const profile=path.join(temporary,"profile");
    run("python3",["-B","tools/create-fixture-profile.py","--source",source,"--entry","NestedInterfaceLiteralReadProbe",
        "--air-sdk",AIR,"--laya",LAYA,"--ffdec-jar",FFDEC,"--output",profile]);
    const compile=(name)=>run(process.execPath,["bin/as3-frontend","transpile",source,path.join(temporary,name),
        "--source-census",path.join(profile,"census.json"),"--target-capabilities",
        path.join(LAYA,"docTool/architecture/authored-content-capabilities.json"),"--profile-lock",path.join(profile,"profile-lock.json")]);
    compile("first");compile("second");
    const relative="__as3_runtime/application/",read=(output,name)=>fs.readFileSync(path.join(temporary,output,relative,name+".ts"),"utf8");
    const firstProbe=read("first","NestedInterfaceLiteralReadProbe"),secondProbe=read("second","NestedInterfaceLiteralReadProbe");
    assert.equal(firstProbe,secondProbe);
    assert.match(firstProbe,/__as3ObjectRead\(__as3Cast\(box!\.value, __as3NamedReferenceType\("INestedRead"\)\), "extraGetter", "NestedInterfaceLiteralReadProbe"\)/);
    const itemCode=read("first","ItemReadProbe");
    assert.match(itemCode,/__as3ObjectRead\(__as3Cast\(arg1!\.template, __as3NamedReferenceType\("IBasicInterface"\)\), "type", "ItemReadProbe"\)/);
    assert.equal((itemCode.match(/arg1!\.template/g)||[]).length,1,"nested receiver must be evaluated once");

    const emittedRoot=path.join(temporary,"first",relative);
    const emittedFiles=fs.readdirSync(emittedRoot).filter(name=>name.endsWith(".ts")).map(name=>path.join(emittedRoot,name));
    const strictConfig=path.join(temporary,"strict.json");
    fs.writeFileSync(strictConfig,JSON.stringify({compilerOptions:{target:"ES2022",module:"CommonJS",moduleResolution:"Node",
        strict:true,skipLibCheck:true,noEmit:true,baseUrl:ROOT,paths:{"@laya/as3-runtime/*":["src/hardened-runtime/*"]}},files:emittedFiles}));
    run(process.execPath,[path.join(ROOT,"node_modules/typescript-4-9/bin/tsc"),"-p",strictConfig]);

    const entryPath=path.join(temporary,"first/__as3_runtime/ApplicationEntry.generated.js");
    const loader=moduleApi.createRequire(entryPath),entry=loader(entryPath);
    const find=name=>entry.AS3_APPLICATION_MODULES.find(module=>module[name])[name];
    const Probe=find("NestedInterfaceLiteralReadProbe"),probe=new Probe();probe.exercise();
    assert.deepEqual(probe.result,native.capture.state.observations[0].result);
    const Item=find("Item"),ItemReadProbe=find("ItemReadProbe"),itemProbe=new ItemReadProbe();
    assert.equal(itemProbe.run(new Item()),17);
    let forgedGetterReads=0;
    const forgedItem={template:{get type(){forgedGetterReads+=1;return 99;}}};
    assert.throws(()=>itemProbe.run(forgedItem),error=>error.name==="TypeError"&&error.errorID===1034);
    assert.equal(forgedGetterReads,0,"nominal rejection must precede public trait lookup");
    const InterfaceDirectRead=find("InterfaceDirectRead"),direct=new InterfaceDirectRead(),Impl=find("NestedReadImpl");
    assert.equal(direct.run(new Impl()),"getter");
    assert.throws(()=>direct.run(null),error=>error.name==="TypeError"&&error.errorID===1009);
    assert.throws(()=>direct.run({extraGetter:"forged"}),error=>error.name==="TypeError"&&error.errorID===1034);
});

test("computed, mutation, invocation, static, and incomplete-interface variants remain held",
    {skip:!(AIR&&LAYA&&FFDEC)},t=>{
    const temporary=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"local-interface-read-hostile-")));
    t.after(()=>fs.rmSync(temporary,{recursive:true,force:true}));
    const source=path.join(temporary,"source");fs.mkdirSync(source);
    const files={
        "IValue.as":`package {public interface IValue {function get value():String;}}\n`,
        "Value.as":`package {public final class Value implements IValue {public function get value():String{return "ok";}}}\n`,
        "Good.as":`package {public final class Good {public function run(value:IValue):* {return value["value"];}}}\n`,
        "Computed.as":`package {public final class Computed {public function run(value:IValue,key:String):* {return value[key];}}}\n`,
        "Write.as":`package {public final class Write {public function run(value:IValue):void {value["value"]="x";}}}\n`,
        "DeleteRead.as":`package {public final class DeleteRead {public function run(value:IValue):Boolean {return delete value["value"];}}}\n`,
        "CallRead.as":`package {public final class CallRead {public function run(value:IValue):* {return value["value"]();}}}\n`,
        "StaticRead.as":`package {public final class StaticRead {public function run():* {return IValue["value"];}}}\n`,
        "FlashRead.as":`package {import flash.events.IEventDispatcher; public final class FlashRead {public function run(value:IEventDispatcher):* {return value["value"];}}}\n`,
    };
    for(const [name,bytes] of Object.entries(files)) fs.writeFileSync(path.join(source,name),bytes);
    const run=(command,args,expected=0)=>{const result=childProcess.spawnSync(command,args,{cwd:ROOT,encoding:"utf8",timeout:180000});
        assert.equal(result.status,expected,result.stdout+result.stderr);return result;};
    const profile=path.join(temporary,"profile");
    run("python3",["-B","tools/create-fixture-profile.py","--source",source,"--entry","Good","--air-sdk",AIR,
        "--laya",LAYA,"--ffdec-jar",FFDEC,"--output",profile]);
    const output=path.join(temporary,"out");
    run(process.execPath,["bin/as3-frontend","qualify",source,output,"--source-census",path.join(profile,"census.json"),
        "--target-capabilities",path.join(LAYA,"docTool/architecture/authored-content-capabilities.json"),
        "--profile-lock",path.join(profile,"profile-lock.json")]);
    const rows=JSON.parse(fs.readFileSync(path.join(output,"manifest.json"),"utf8")).files;
    assert.equal(rows.find(row=>row.sourcePath==="Good.as").status,"admitted");
    for(const [name,codes] of Object.entries({
        "Computed.as":["HARDENED_LOCAL_INTERFACE_LITERAL_READ_KEY"],
        "Write.as":["HARDENED_LOCAL_INTERFACE_LITERAL_READ_CONTEXT"],
        "DeleteRead.as":["HARDENED_LOCAL_INTERFACE_LITERAL_READ_CONTEXT"],
        "CallRead.as":["HARDENED_LOCAL_INTERFACE_LITERAL_READ_CONTEXT"],
        "StaticRead.as":["HARDENED_ASSIGNMENT_TYPE","HARDENED_INDEX_TARGET"],
        "FlashRead.as":["HARDENED_INDEX_TARGET","HARDENED_TYPE_UNRESOLVED","HARDENED_IMPORT_UNMAPPED"],
    })) {
        const row=rows.find(row=>row.sourcePath===name);assert.equal(row.status,"held",JSON.stringify(row));
        assert(codes.includes(row.code),`${name}: unexpected ${row.code}`);
    }
    const lockPath=path.join(profile,"profile-lock.json"),lock=JSON.parse(fs.readFileSync(lockPath,"utf8"));
    const membersPath=path.join(profile,lock.files.localMemberMap.path);
    const members=JSON.parse(fs.readFileSync(membersPath,"utf8"));
    const interfaceEntry=members.entries.find(entry=>entry.qname==="IValue");
    assert.equal(interfaceEntry.status,"complete");
    interfaceEntry.status="held";interfaceEntry.declaration=null;
    interfaceEntry.holdCode="TEST_INTERFACE_INCOMPLETE";interfaceEntry.holdSha256="a".repeat(64);
    members.completeCount-=1;members.heldCount+=1;
    const membersJson=canonical(members)+"\n";fs.writeFileSync(membersPath,membersJson);
    lock.files.localMemberMap.sha256=sha256(membersJson);
    lock.counts.localMembersComplete-=1;lock.counts.localMembersHeld+=1;
    fs.writeFileSync(lockPath,canonical(lock)+"\n");
    const incompleteOutput=path.join(temporary,"incomplete");
    run(process.execPath,["bin/as3-frontend","qualify",source,incompleteOutput,
        "--source-census",path.join(profile,"census.json"),"--target-capabilities",
        path.join(LAYA,"docTool/architecture/authored-content-capabilities.json"),"--profile-lock",lockPath]);
    const incompleteRows=JSON.parse(fs.readFileSync(path.join(incompleteOutput,"manifest.json"),"utf8")).files;
    assert.equal(incompleteRows.find(row=>row.sourcePath==="Good.as").code,"HARDENED_LOCAL_MEMBER_HELD");
});
