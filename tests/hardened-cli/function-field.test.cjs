"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),test=require("node:test");
const {spawnSync}=require("node:child_process");
const ROOT=path.resolve(__dirname,"../.."),sdk=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA;
test("Function field admission retains own instance scope and rejects unproved receivers",{skip:!sdk||!laya},t=>{
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"function-field-")));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const source=path.join(root,"source"),profile=path.join(root,"profile"),out=path.join(root,"qualified");fs.mkdirSync(source);
 const cases={
  Good:'public var callback:Function; public function run():* {this.callback();return callback();}',
  BadForeign:'public function run(other:Good):* {return other.callback();}',
  BadStatic:'private static var callback:Function;public static function run():* {return callback();}',
  BadGetter:'public function get callback():Function {return null;}public function run():* {return this.callback();}',
  BadLambda:'private var callback:Function;public function run():Function {return function():* {return callback();};}',
  BadInitializer:'private var callback:Function;private var value:Object=this.callback();',
  BadNonCallable:'private var callback:int;public function run():* {return this.callback();}',
  BadArgumentsBinding:'public function run(arguments:int):void {}'
 };
 for(const [name,body] of Object.entries(cases))fs.writeFileSync(path.join(source,name+'.as'),`package {public class ${name} {${body}}}\n`);
 const generated=spawnSync('python3',[path.join(ROOT,'tools/create-fixture-profile.py'),'--source',source,'--entry','Good','--air-sdk',sdk,'--laya',laya,'--output',profile],{encoding:'utf8',timeout:120000});assert.equal(generated.status,0,generated.stdout+generated.stderr);
 const result=spawnSync(process.execPath,[path.join(ROOT,'bin/as3-frontend'),'qualify',source,out,'--source-census',path.join(profile,'census.json'),'--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(profile,'profile-lock.json')],{encoding:'utf8',timeout:60000});assert.equal(result.status,0,result.stdout+result.stderr);
 const rows=JSON.parse(fs.readFileSync(path.join(out,'manifest.json'),'utf8')).files;
 assert.equal(rows.length,Object.keys(cases).length);
 for(const row of rows)assert.equal(row.status,path.basename(row.sourcePath,'.as')==='Good'?'admitted':'held',JSON.stringify(row));
});
