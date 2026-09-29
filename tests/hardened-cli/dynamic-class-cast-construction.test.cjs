"use strict";
const assert=require("node:assert/strict"),test=require("node:test"),fs=require("node:fs"),path=require("node:path"),
 os=require("node:os"),cp=require("node:child_process"),crypto=require("node:crypto");
const root=path.resolve(__dirname,"../.."),air=process.env.HARDENED_FIXTURE_AIR_SDK,
 laya=process.env.HARDENED_FIXTURE_LAYA,ffdec=process.env.HARDENED_FIXTURE_FFDEC,
 sha=bytes=>crypto.createHash("sha256").update(bytes).digest("hex");
test("parenthesized as-Class construction is native-paired and remains narrowly admitted",t=>{
 assert.ok(air&&laya&&ffdec,"AIR, Laya and FFDec fixture paths required");
 const fixture=path.join(laya,"tests/nativeFlashOracle/dynamic-class-cast-construction"),
  retained=JSON.parse(fs.readFileSync(path.join(fixture,"native-air.json"))),
  comparison=JSON.parse(fs.readFileSync(path.join(fixture,"comparison.json")));
 assert.equal(comparison.status,"passed");assert.deepEqual(comparison.semanticDifferences,[]);
 assert.equal(retained.capture.state.observations.length,4);
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"dynamic-class-cast-construction-")));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const source=path.join(dir,"source");fs.mkdirSync(source);
 for(const [name,hash] of Object.entries(retained.sourceFiles)) {
  const bytes=fs.readFileSync(path.join(fixture,name));assert.equal(sha(bytes),hash);fs.writeFileSync(path.join(source,name),bytes);
 }
 assert.equal(sha(fs.readFileSync(path.join(fixture,"scenario.json"))),retained.scenarioSha256);
 const run=(command,args)=>{const result=cp.spawnSync(command,args,{cwd:root,encoding:"utf8",timeout:120000});assert.equal(result.status,0,result.stdout+result.stderr);};
 const profile=path.join(dir,"profile"),makeProfile=()=>run("python3",["-B","tools/create-fixture-profile.py","--source",source,
  "--entry","DynamicClassCastConstructionProbe","--air-sdk",air,"--laya",laya,"--ffdec-jar",ffdec,"--output",profile]);
 const compile=(operation,out)=>run(process.execPath,["bin/as3-frontend",operation,source,path.join(dir,out),
  "--source-census",path.join(profile,"census.json"),"--target-capabilities",path.join(laya,"docTool/architecture/authored-content-capabilities.json"),
  "--profile-lock",path.join(profile,"profile-lock.json")]);
 makeProfile();const snapshots=[];
 for(const output of ["first","second"]) {
  compile("transpile",output);
  const rows=JSON.parse(fs.readFileSync(path.join(dir,output,"manifest.json"))).files;
  assert.equal(rows.length,1);assert.equal(rows[0].sourcePath,"DynamicClassCastConstructionProbe.as");assert.ok(rows[0].typescriptPath);
  const code=fs.readFileSync(path.join(dir,output,"__as3_runtime/application/DynamicClassCastConstructionProbe.ts"),"utf8");
  assert.match(code,/__as3ConstructClass\(/);assert.match(code,/__as3As\(/);snapshots.push([rows,code]);
 }
 assert.deepEqual(snapshots[0],snapshots[1]);
 const boundaries={
  Argument:["return new (value as Class)(1);","HARDENED_NEW_DYNAMIC_ARGUMENT"],
  Uncast:["return new (value)();","HARDENED_NEW_DYNAMIC_TYPE"],
  FunctionCast:["return new (value as Function)();","HARDENED_NEW_DYNAMIC_TYPE"],
 };
 for(const [name,[body]] of Object.entries(boundaries))
  fs.writeFileSync(path.join(source,name+".as"),`package {public class ${name} {public function run(value:Object):* {${body}}}}`);
 fs.rmSync(profile,{recursive:true,force:true});makeProfile();compile("qualify","negative");
 const rows=JSON.parse(fs.readFileSync(path.join(dir,"negative/manifest.json"))).files;
 for(const [name,[,code]] of Object.entries(boundaries)) {const row=rows.find(item=>item.sourcePath===name+".as");assert.equal(row.status,"held",name);assert.equal(row.code,code,name);}
});
