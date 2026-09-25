"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),test=require("node:test");
const {spawnSync}=require("node:child_process");
const ROOT=path.resolve(__dirname,"../.."),sdk=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA;
test("Array inheritance uses native authority without admitting unproved overrides or arbitrary dynamic classes",{skip:!sdk||!laya},t=>{
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"array-subclass-")));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const source=path.join(root,"source");fs.mkdirSync(source);
 const cases={
  Good:'public dynamic class Good extends Array { public var marker:int=7; public function Good(){super(2);} public function run():uint {this[0]=7;return this.push(8);} }',
  Child:'public dynamic class Child extends Good {public function Child(){super();} public function count():uint {return this.length;} }',
  BadOverride:'public dynamic class BadOverride extends Array {public function push(...args):uint {return 0;} }',
  BadDynamic:'public dynamic class BadDynamic {public var marker:int;}',
  BadClosure:'public dynamic class BadClosure extends Array {public function getPush():Function {return this.push;} }',
  BadSort:'public dynamic class BadSort extends Array {public function run():Array {return this.sortOn("key",16);} }'
 };
 for(const [name,body] of Object.entries(cases))fs.writeFileSync(path.join(source,name+'.as'),`package {${body}}\n`);
 const profile=path.join(root,'profile'),out=path.join(root,'out');
 const generated=spawnSync('python3',[path.join(ROOT,'tools/create-fixture-profile.py'),'--source',source,'--entry','Good','--air-sdk',sdk,'--laya',laya,'--output',profile],{encoding:'utf8',timeout:120000});assert.equal(generated.status,0,generated.stdout+generated.stderr);
 const result=spawnSync(process.execPath,[path.join(ROOT,'bin/as3-frontend'),'qualify',source,out,'--source-census',path.join(profile,'census.json'),'--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(profile,'profile-lock.json')],{encoding:'utf8',timeout:60000});assert.equal(result.status,0,result.stdout+result.stderr);
 const rows=JSON.parse(fs.readFileSync(path.join(out,'manifest.json'),'utf8')).files;
 assert.equal(rows.length,Object.keys(cases).length);
 for(const row of rows)assert.equal(row.status,['Good','Child'].includes(path.basename(row.sourcePath,'.as'))?'admitted':'held',JSON.stringify(row));
});
