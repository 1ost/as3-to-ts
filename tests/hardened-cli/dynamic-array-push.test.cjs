"use strict";
const assert=require("node:assert/strict"),test=require("node:test"),fs=require("node:fs"),path=require("node:path"),
 os=require("node:os"),cp=require("node:child_process"),crypto=require("node:crypto");
const root=path.resolve(__dirname,"../.."),air=process.env.HARDENED_FIXTURE_AIR_SDK,
 laya=process.env.HARDENED_FIXTURE_LAYA,ffdec=process.env.HARDENED_FIXTURE_FFDEC;
test("fixed-name dynamic push is deterministic without admitting arbitrary computed or argument calls",t=>{
 assert.ok(air&&laya&&ffdec,"AIR, Laya and FFDec fixture paths required");
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"dynamic-array-push-")));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const source=path.join(dir,"source"),fixture=path.join(laya,"tests/nativeFlashOracle/dynamic-array-push");fs.mkdirSync(source);
 const retained=JSON.parse(fs.readFileSync(path.join(fixture,"native-air.json")));
 for(const [name,hash] of Object.entries(retained.sourceFiles)){
  const bytes=fs.readFileSync(path.join(fixture,name));assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"),hash);
  fs.writeFileSync(path.join(source,name),bytes);
 }
 const run=(command,args)=>{const r=cp.spawnSync(command,args,{cwd:root,encoding:"utf8",timeout:120000});assert.equal(r.status,0,r.stdout+r.stderr);};
 const profile=path.join(dir,"profile");
 const makeProfile=()=>run("python3",["-B","tools/create-fixture-profile.py","--source",source,"--entry","DynamicArrayPushProbe","--air-sdk",air,"--laya",laya,"--ffdec-jar",ffdec,"--output",profile]);
 const compile=(op,out)=>run(process.execPath,["bin/as3-frontend",op,source,path.join(dir,out),"--source-census",path.join(profile,"census.json"),"--target-capabilities",path.join(laya,"docTool/architecture/authored-content-capabilities.json"),"--profile-lock",path.join(profile,"profile-lock.json")]);
 makeProfile();const snapshots=[];
 for(const output of ["first","second"]){
  compile("transpile",output);const rows=JSON.parse(fs.readFileSync(path.join(dir,output,"manifest.json"))).files;
  for(const row of rows)assert.equal(row.sourceSha256,retained.sourceFiles[row.sourcePath]);
  const code=fs.readFileSync(path.join(dir,output,"__as3_runtime/application/DynamicArrayPushProbe.ts"),"utf8");
  assert.match(code,/__as3ObjectCall/);assert.doesNotMatch(code,/as Array|as unknown\[\]/);snapshots.push([rows,code]);
 }
 assert.deepEqual(snapshots[0],snapshots[1]);
 for(const [name,body] of Object.entries({Computed:'value[key](7);',Unproved:'value.other(7);'}))
  fs.writeFileSync(path.join(source,name+'.as'),`package {public class ${name} {public function run(value:*,key:String):void {${body}}}}`);
 fs.writeFileSync(path.join(source,'MappedDictionary.as'),'package {import flash.utils.Dictionary; public class MappedDictionary {public function run():void {var dict:Dictionary=new Dictionary();var value:*;for each(value in dict){}}}}');
 fs.rmSync(profile,{recursive:true,force:true});makeProfile();compile("qualify","negative");
 const rows=JSON.parse(fs.readFileSync(path.join(dir,"negative/manifest.json"))).files;
 for(const name of ["Computed.as","Unproved.as"]){const row=rows.find(x=>x.sourcePath===name);assert.equal(row.status,"held");assert.equal(row.code,"HARDENED_OBJECT_CALL_TARGET");}
 assert.equal(rows.find(x=>x.sourcePath==='MappedDictionary.as').code,'HARDENED_FOREACH_DICTIONARY_AUTHORITY');
});
