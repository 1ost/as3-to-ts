"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),test=require("node:test");
const {spawnSync}=require("node:child_process");
const ROOT=path.resolve(__dirname,"../.."),sdk=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA;
test("Dictionary membership requires an intrinsic target and a value key",{skip:!sdk||!laya},t=>{
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"dictionary-in-")));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const source=path.join(root,"source");fs.mkdirSync(source);
 const cases={
  Good:'private var values:Dictionary=new Dictionary();public function run(key:*):Boolean {values[key]=undefined;return key in values;} public function number():Number {return 1e21 + .5E+3;}',
  BadVoid:'private function noop():void {} public function run(values:Dictionary):Boolean {return noop() in values;}',
  BadArray:'public function run(values:Array):Boolean {return "key" in values;}',
  BadNumber:'public function run(values:Number):Boolean {return "key" in values;}',
  BadInfiniteLiteral:'public function run():Number {return 1e999;}'
 };
 for(const [name,body] of Object.entries(cases))fs.writeFileSync(path.join(source,name+'.as'),`package {import flash.utils.Dictionary;public class ${name} {${body}}}\n`);
 for(const intrinsic of [true,false]) {
  const profile=path.join(root,intrinsic?'intrinsic-profile':'bridge-profile'),out=path.join(root,intrinsic?'intrinsic-out':'bridge-out');
  const generated=spawnSync('python3',[path.join(ROOT,'tools/create-fixture-profile.py'),'--source',source,'--entry','Good','--air-sdk',sdk,'--laya',laya,'--output',profile,...(intrinsic?['--intrinsic-type','flash.utils.Dictionary']:[])],{encoding:'utf8',timeout:120000});assert.equal(generated.status,0,generated.stdout+generated.stderr);
  const result=spawnSync(process.execPath,[path.join(ROOT,'bin/as3-frontend'),'qualify',source,out,'--source-census',path.join(profile,'census.json'),'--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(profile,'profile-lock.json')],{encoding:'utf8',timeout:60000});assert.equal(result.status,0,result.stdout+result.stderr);
  const rows=JSON.parse(fs.readFileSync(path.join(out,'manifest.json'),'utf8')).files;
  assert.equal(rows.length,Object.keys(cases).length);
  for(const row of rows)assert.equal(row.status,intrinsic&&path.basename(row.sourcePath,'.as')==='Good'?'admitted':'held',JSON.stringify(row));
 }
});
