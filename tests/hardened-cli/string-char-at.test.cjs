"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),test=require("node:test");
const {spawnSync}=require("node:child_process");
const ROOT=path.resolve(__dirname,"../.."),sdk=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA;
test("String.charAt admits numeric indices and keeps unproved call signatures held",{skip:!sdk||!laya},t=>{
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"string-char-at-")));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const source=path.join(root,"source"),profile=path.join(root,"profile"),out=path.join(root,"qualified");fs.mkdirSync(source);
 const cases={
  Good:['public function run(text:String,index:Number):String {return text.charAt(index)+text.charAt();}',null],
  BadArity:['public function run(text:String):String {return text.charAt(0,1);}','HARDENED_STRING_ARITY'],
  BadStringIndex:['public function run(text:String):String {return text.charAt("0");}','HARDENED_STRING_ARGUMENT'],
  BadBooleanIndex:['public function run(text:String):String {return text.charAt(true);}','HARDENED_STRING_ARGUMENT'],
  BadMethodValue:['public function run(text:String):Function {return text.charAt;}','HARDENED_MEMBER_TARGET']
 };
 for(const [name,[body]] of Object.entries(cases))fs.writeFileSync(path.join(source,name+'.as'),`package {public class ${name} {${body}}}\n`);
 const generated=spawnSync('python3',[path.join(ROOT,'tools/create-fixture-profile.py'),'--source',source,'--entry','Good','--air-sdk',sdk,'--laya',laya,'--output',profile],{encoding:'utf8',timeout:120000});assert.equal(generated.status,0,generated.stdout+generated.stderr);
 const result=spawnSync(process.execPath,[path.join(ROOT,'bin/as3-frontend'),'qualify',source,out,'--source-census',path.join(profile,'census.json'),'--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(profile,'profile-lock.json')],{encoding:'utf8',timeout:60000});assert.equal(result.status,0,result.stdout+result.stderr);
 const rows=JSON.parse(fs.readFileSync(path.join(out,'manifest.json'),'utf8')).files;
 assert.equal(rows.length,Object.keys(cases).length);
 for(const row of rows){const expected=cases[path.basename(row.sourcePath,'.as')][1];if(expected)assert.equal(row.code,expected,JSON.stringify(row));else assert.equal(row.status,'admitted',JSON.stringify(row));}
});
