"use strict";
const assert=require("node:assert/strict"),test=require("node:test"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),cp=require("node:child_process"),crypto=require("node:crypto"),Module=require("node:module");
const root=path.resolve(__dirname,"../.."),air=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA;
const sha=bytes=>crypto.createHash("sha256").update(bytes).digest("hex");

test("Number parameter decimal calls preserve AIR safe integers and fail closed outside them",{skip:!air||!laya},t=>{
 const fixture=path.join(fs.realpathSync(laya),"tests/nativeFlashOracle/number-parameter-string");
 for(const [name,hash] of Object.entries({"NumberParameterStringProbe.as":"9fc3e1543af19918586998f7741bbb26c7cc9dda8e2c28d71840639c22a9e3b3","scenario.json":"495125cb8db6626e6db1b85c3f8eed16e1d28c9c941494502270eec0f87c13b6","native-air.json":"f1e7dc6465123e2363fc663e56cf6153b2103de810f43aa3e4c70f28a446bd03"}))
  assert.equal(sha(fs.readFileSync(path.join(fixture,name))),hash,name);
 const capture=JSON.parse(fs.readFileSync(path.join(fixture,"native-air.json")));
 assert.equal(capture.runtime.playerType,"Desktop");assert.equal(capture.state.ready,true);assert.equal(capture.state.failure,"");
 const expected=new Map(capture.state.observations.map(row=>[row.id,row.result[0]]));assert.equal(expected.size,7);
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"number-parameter-string-")));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const source=path.join(dir,"source"),profile=path.join(dir,"profile"),out=path.join(dir,"out");fs.mkdirSync(source);
 fs.writeFileSync(path.join(source,"NumberParameterString.as"),"package {public class NumberParameterString {public function run(value:Number):String {return value.toString();}}}");
 const run=(command,args)=>{const result=cp.spawnSync(command,args,{cwd:root,encoding:"utf8",timeout:180000});assert.equal(result.status,0,result.stdout+result.stderr);};
 run("python3",["-B","tools/create-fixture-profile.py","--source",source,"--entry","NumberParameterString","--air-sdk",air,"--laya",laya,"--output",profile]);
 run(process.execPath,["bin/as3-frontend","transpile",source,out,"--source-census",path.join(profile,"census.json"),"--target-capabilities",path.join(fixture,"../../../docTool/architecture/authored-content-capabilities.json"),"--profile-lock",path.join(profile,"profile-lock.json")]);
 const manifest=JSON.parse(fs.readFileSync(path.join(out,"manifest.json"))),row=manifest.files.find(file=>file.sourcePath==="NumberParameterString.as");
 assert.ok(row.typescriptPath,JSON.stringify(row));const generated=fs.readFileSync(path.join(out,row.typescriptPath),"utf8");
 assert.match(generated,/__as3NumberSafeIntegerToString\(/);assert.doesNotMatch(generated,/\.toString\(/);
 const ts=require("typescript-4-9"),entryPath=path.join(out,manifest.applicationEntryPath),modulePath=path.join(out,row.typescriptPath);
 for(const file of [modulePath,entryPath])fs.writeFileSync(file.replace(/\.ts$/,".js"),ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText);
 const entry=Module.createRequire(entryPath.replace(/\.ts$/,".js"))(entryPath.replace(/\.ts$/,".js"));
 const Probe=entry.AS3_APPLICATION_MODULES.find(module=>module.NumberParameterString).NumberParameterString,probe=new Probe();
 for(const [value,id] of [[2026,"year-positive"],[-2026,"year-negative"],[9007199254740991,"safe-upper"],[-9007199254740991,"safe-lower"]])
  assert.equal(probe.run(value),expected.get(id));
 assert.deepEqual([expected.get("fraction-held"),expected.get("nan-held"),expected.get("infinity-held")],["1.5","NaN","Infinity"]);
 for(const value of [1.5,NaN,Infinity,-Infinity,9007199254740992])
  assert.throws(()=>probe.run(value),error=>error.name==="AS3ObjectDispatchUnavailable"&&/safe integer receiver/.test(error.message));
});
