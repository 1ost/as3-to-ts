"use strict";
const assert=require("node:assert/strict"),test=require("node:test"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),cp=require("node:child_process"),crypto=require("node:crypto"),Module=require("node:module");
const root=path.resolve(__dirname,"../.."),air=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA;
const sha=bytes=>crypto.createHash("sha256").update(bytes).digest("hex");

test("Array-indexed String slice uses AIR range semantics without admitting arbitrary dynamic receivers",{skip:!air||!laya},t=>{
 const fixture=path.join(fs.realpathSync(laya),"tests/nativeFlashOracle/dynamic-string-range");
 for(const [name,hash] of Object.entries({"DynamicStringRangeProbe.as":"c19076682f1c7bd82fc5f36f24dcfa38ee56b4067f69fdefaed29340484570c5","scenario.json":"53b079afbffdbae1759c728dcef505b0adab333f0dd807f062b489823cdb7200","native-air.json":"328177480129dad73265c2f8846a8263f2b302710de1b17987af137b615bd21f"}))
  assert.equal(sha(fs.readFileSync(path.join(fixture,name))),hash,name);
 const capture=JSON.parse(fs.readFileSync(path.join(fixture,"native-air.json")));
 assert.equal(capture.runtime.playerType,"Desktop");assert.equal(capture.state.ready,true);assert.equal(capture.state.failure,"");
 const expected=new Map(capture.state.observations.map(row=>[row.id,row.result]));assert.equal(expected.size,6);
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"dynamic-indexed-string-slice-")));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const source=path.join(dir,"source"),profile=path.join(dir,"profile"),out=path.join(dir,"out");fs.mkdirSync(source);
 const code="package {public class DynamicIndexedStringSlice {"+
  "public function run():Array {var parts:Array=\"091827,184512\".split(\",\");return [parts[0].slice(0,2),parts[0].slice(2,4),parts[1].slice(4)];}"+
  "public function missing():* {var parts:Array=[null];return parts[0].slice(0,2);}"+
  "public function number():* {var parts:Array=[12];return parts[0].slice(0,2);}"+
  "public function array():* {var parts:Array=[[1,2,3]];return parts[0].slice(1,3);}"+
  "}}";
 fs.writeFileSync(path.join(source,"DynamicIndexedStringSlice.as"),code);
 const run=(command,args)=>{const result=cp.spawnSync(command,args,{cwd:root,encoding:"utf8",timeout:180000});assert.equal(result.status,0,result.stdout+result.stderr);return result;};
 run("python3",["-B","tools/create-fixture-profile.py","--source",source,"--entry","DynamicIndexedStringSlice","--air-sdk",air,"--laya",laya,"--output",profile]);
 run(process.execPath,["bin/as3-frontend","transpile",source,out,"--source-census",path.join(profile,"census.json"),"--target-capabilities",path.join(fixture,"../../../docTool/architecture/authored-content-capabilities.json"),"--profile-lock",path.join(profile,"profile-lock.json")]);
 const manifest=JSON.parse(fs.readFileSync(path.join(out,"manifest.json"))),row=manifest.files.find(file=>file.sourcePath==="DynamicIndexedStringSlice.as");
 assert.ok(row.typescriptPath,JSON.stringify(row));const generated=fs.readFileSync(path.join(out,row.typescriptPath),"utf8");
 assert.match(generated,/__as3ObjectCall\(/);assert.doesNotMatch(generated,/\.slice\(/);
 const ts=require("typescript-4-9"),entryPath=path.join(out,manifest.applicationEntryPath),modulePath=path.join(out,row.typescriptPath);
 for(const file of [modulePath,entryPath])fs.writeFileSync(file.replace(/\.ts$/,".js"),ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText);
 const entry=Module.createRequire(entryPath.replace(/\.ts$/,".js"))(entryPath.replace(/\.ts$/,".js"));
 const Probe=entry.AS3_APPLICATION_MODULES.find(module=>module.DynamicIndexedStringSlice).DynamicIndexedStringSlice,probe=new Probe();
 assert.deepEqual(probe.run(),expected.get("array-string-index").slice(0,3));
 for(const [method,id] of [["missing","dynamic-null"],["number","dynamic-number"]])
  assert.throws(()=>probe[method](),error=>error.name===expected.get(id)[0][0]&&error.errorID===expected.get(id)[0][1]&&error.message===expected.get(id)[0][2]);
 assert.deepEqual(expected.get("dynamic-array"),[[2,3],""]);
 assert.throws(()=>probe.array(),error=>error.name==="AS3ObjectDispatchUnavailable"&&/Dynamic Array\.slice/.test(error.message));
 const foreign="package {public class ForeignSlice {public function run(value:Object):* {return value.slice(0,2);}}}";
 fs.writeFileSync(path.join(source,"ForeignSlice.as"),foreign);fs.rmSync(profile,{recursive:true,force:true});
 run("python3",["-B","tools/create-fixture-profile.py","--source",source,"--entry","DynamicIndexedStringSlice","--air-sdk",air,"--laya",laya,"--output",profile]);
 run(process.execPath,["bin/as3-frontend","qualify",source,path.join(dir,"negative"),"--source-census",path.join(profile,"census.json"),"--target-capabilities",path.join(fixture,"../../../docTool/architecture/authored-content-capabilities.json"),"--profile-lock",path.join(profile,"profile-lock.json")]);
 const foreignRow=JSON.parse(fs.readFileSync(path.join(dir,"negative/manifest.json"))).files.find(file=>file.sourcePath==="ForeignSlice.as");
 assert.equal(foreignRow.status,"held");assert.equal(foreignRow.code,"HARDENED_OBJECT_CALL_TARGET");
});
