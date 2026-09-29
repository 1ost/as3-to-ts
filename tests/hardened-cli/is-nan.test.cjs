"use strict";
const assert=require("node:assert/strict"),test=require("node:test"),fs=require("node:fs"),
 path=require("node:path"),os=require("node:os"),cp=require("node:child_process"),crypto=require("node:crypto");
const root=path.resolve(__dirname,"../.."),sha=value=>crypto.createHash("sha256").update(value).digest("hex");
const air=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA,ffdec=process.env.HARDENED_FIXTURE_FFDEC;
test("isNaN preserves source bytes, deterministic output and shadowed methods",t=>{
 assert.ok(air&&laya&&ffdec,"AIR, Laya and FFDec fixture paths required");
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"is-nan-")));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const source=path.join(dir,"source"),fixture=path.join(laya,"tests/nativeFlashOracle/is-nan");fs.mkdirSync(source);
 const retained=JSON.parse(fs.readFileSync(path.join(fixture,"native-air.json")));
 for(const [name,hash] of Object.entries(retained.sourceFiles)){
  const bytes=fs.readFileSync(path.join(fixture,name));assert.equal(sha(bytes),hash);fs.writeFileSync(path.join(source,name),bytes);
 }
 assert.equal(sha(fs.readFileSync(path.join(fixture,"scenario.json"))),retained.scenarioSha256);
 const profile=path.join(dir,"profile");
 const run=(command,args)=>{const result=cp.spawnSync(command,args,{cwd:root,encoding:"utf8",timeout:120000});assert.equal(result.status,0,result.stdout+result.stderr);};
 const makeProfile=()=>run("python3",["-B","tools/create-fixture-profile.py","--source",source,"--entry","IsNaNProbe","--air-sdk",air,"--laya",laya,"--ffdec-jar",ffdec,"--output",profile]);
 const compile=(operation,out,input=source)=>run(process.execPath,["bin/as3-frontend",operation,input,path.join(dir,out),"--source-census",path.join(profile,"census.json"),"--target-capabilities",path.join(laya,"docTool/architecture/authored-content-capabilities.json"),"--profile-lock",path.join(profile,"profile-lock.json")]);
 makeProfile();const snapshots=[];
 for(const output of ["first","second"]){
  compile("transpile",output);const rows=JSON.parse(fs.readFileSync(path.join(dir,output,"manifest.json"))).files;
  for(const row of rows)assert.equal(row.sourceSha256,retained.sourceFiles[row.sourcePath]);
  const code=fs.readFileSync(path.join(dir,output,"__as3_runtime/application/IsNaNProbe.ts"),"utf8");
  assert.match(code,/__as3IsNaN\(/);snapshots.push([rows,code]);
 }
 assert.deepEqual(snapshots[0],snapshots[1]);
 fs.writeFileSync(path.join(source,"TooMany.as"),'package {public class TooMany {public function run():Boolean {return isNaN(1,2);}}}');
 const own='package {public class Own {public function isNaN(value:*):Boolean {return false;} public function run(value:*):Boolean {return isNaN(value);}}}';
 fs.writeFileSync(path.join(source,"Own.as"),own);
 fs.rmSync(profile,{recursive:true,force:true});makeProfile();compile("qualify","negative");
 const rows=JSON.parse(fs.readFileSync(path.join(dir,"negative/manifest.json"))).files;
 const rejected=rows.find(row=>row.sourcePath==="TooMany.as");assert.equal(rejected.status,"held");
 assert.equal(rejected.code,"HARDENED_NUMERIC_PREDICATE_ARITY");
 assert.equal(rows.find(row=>row.sourcePath==="Own.as").status,"admitted");
 const shadow=path.join(dir,"shadow");fs.mkdirSync(shadow);fs.writeFileSync(path.join(shadow,"Own.as"),own);
 compile("transpile","shadow-output",shadow);
 const shadowCode=fs.readFileSync(path.join(dir,"shadow-output/__as3_runtime/application/Own.ts"),"utf8");
 assert.doesNotMatch(shadowCode,/__as3IsNaN\(/);
});
