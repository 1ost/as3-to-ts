"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),test=require("node:test");
const {spawnSync}=require("node:child_process");
const ROOT=path.resolve(__dirname,"../.."),sdk=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA;
test("Reference enumeration requires authenticated reference slots and supported iterable types",{skip:!sdk||!laya},t=>{
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"reference-enumeration-")));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const source=path.join(root,"source");fs.mkdirSync(source);
 const cases={
  Good:'public function run(values:Array):int {var value:Value=null;var sum:int=0;for each(value in values){if(value)sum+=value.id;}return sum;}',
  DictionaryGood:'public function run(values:Dictionary):int {var value:Value=null;var sum:int=0;for each(value in values){if(value)sum+=value.id;}return sum;}',
  DeclaredGood:'public function run(values:Array):void {for each(var value:Value in values){}}',
  BadIterable:'public function run(values:Number):void {var value:Value=null;for each(value in values){}}',
  Value:'public var id:int=7;'
 };
 for(const [name,body] of Object.entries(cases))fs.writeFileSync(path.join(source,name+'.as'),`package {import flash.utils.Dictionary;public class ${name} {${body}}}\n`);
 for(const intrinsic of [true]) {
  const profile=path.join(root,intrinsic?'intrinsic-profile':'bridge-profile'),out=path.join(root,intrinsic?'intrinsic-out':'bridge-out');
  const generated=spawnSync('python3',[path.join(ROOT,'tools/create-fixture-profile.py'),'--source',source,'--entry','Good','--air-sdk',sdk,'--laya',laya,'--output',profile,...(intrinsic?['--intrinsic-type','flash.utils.Dictionary']:[])],{encoding:'utf8',timeout:120000});assert.equal(generated.status,0,generated.stdout+generated.stderr);
  const result=spawnSync(process.execPath,[path.join(ROOT,'bin/as3-frontend'),'qualify',source,out,'--source-census',path.join(profile,'census.json'),'--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(profile,'profile-lock.json')],{encoding:'utf8',timeout:60000});assert.equal(result.status,0,result.stdout+result.stderr);
  const rows=JSON.parse(fs.readFileSync(path.join(out,'manifest.json'),'utf8')).files;
  assert.equal(rows.length,Object.keys(cases).length);
  for(const row of rows)assert.equal(row.status,['Good','DictionaryGood','DeclaredGood','Value'].includes(path.basename(row.sourcePath,'.as'))?'admitted':'held',JSON.stringify(row));
 }
});
