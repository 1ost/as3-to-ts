"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),test=require("node:test");
const {spawnSync}=require("node:child_process");
const ROOT=path.resolve(__dirname,"../.."),sdk=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA,ffdec=process.env.HARDENED_FIXTURE_FFDEC;
test("inherited super fields retain readonly, visibility, receiver and collision checks",{skip:!sdk||!laya||!ffdec},t=>{
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"inherited-field-read-")));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const source=path.join(root,"source"),profile=path.join(root,"profile"),out=path.join(root,"qualified");fs.mkdirSync(source);fs.mkdirSync(path.join(source,"base"));
 fs.writeFileSync(path.join(source,"base/Base.as"),'package base { import flash.display.Sprite; public class Base extends Sprite { public var amount:int; protected var value:int; public const fixed:int=7; private var secret:int=8; var inside:int; protected function callback():void {amount++;} public function set writeOnly(v:int):void { value=v; } } }\n');
 const cases={
  Good:['public function run():int {super.value=4;super.value++;super.amount;return super.value;}',null],
  GoodCallback:['public function run():Function {return callback;}',null],
  GoodSuperCallback:['public function run():Function {return super.callback;}',null],
  GoodCaseDistinct:['private var Value:int=3;public function run():int {super.value=4;return super.value+this.Value;}',null],
  GoodMappedLambda:['public function run(child:DisplayObject):Function {return function():DisplayObject{return removeChild(child);};}',null],
  BadStaticCallback:['public static function run():Function {return callback;}','HARDENED_LOCAL_METHOD_CLOSURE'],
  BadEarlyCallback:['private var saved:Function=callback;','HARDENED_LOCAL_METHOD_CLOSURE'],
  BadConst:['public function run():void {super.fixed=8;}','HARDENED_ASSIGNMENT_READONLY'],
  BadPrivate:['public function run():int {return super.secret;}','HARDENED_SUPER_MEMBER'],
  BadInternal:['public function run():int {return super.inside;}','HARDENED_LOCAL_MEMBER_VISIBILITY'],
  BadStatic:['public static function run():int {return super.value;}','HARDENED_SUPER_CONTEXT'],
  GoodPrivateCollision:['private var value:int;public function run():int {return super.value+this.value;}',null],
  BadRead:['public function run():void {this.writeOnly;}','HARDENED_LOCAL_INSTANCE_READ']
 };
 for(const [name,[body]] of Object.entries(cases))fs.writeFileSync(path.join(source,name+'.as'),`package {import base.Base;import flash.display.DisplayObject;public class ${name} extends Base {${body}}}\n`);
 fs.writeFileSync(path.join(source,'MappingSeed.as'),'package {import flash.display.Sprite;import flash.display.DisplayObject;public class MappingSeed extends Sprite {public function run(child:DisplayObject):DisplayObject{return removeChild(child);}}}\n');
 const generated=spawnSync('python3',[path.join(ROOT,'tools/create-fixture-profile.py'),'--source',source,'--entry','Good','--air-sdk',sdk,'--laya',laya,'--ffdec-jar',ffdec,'--output',profile],{encoding:'utf8',timeout:120000});assert.equal(generated.status,0,generated.stdout+generated.stderr);
 const result=spawnSync(process.execPath,[path.join(ROOT,'bin/as3-frontend'),'qualify',source,out,'--source-census',path.join(profile,'census.json'),'--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(profile,'profile-lock.json')],{encoding:'utf8',timeout:60000});assert.equal(result.status,0,result.stdout+result.stderr);
 const rows=JSON.parse(fs.readFileSync(path.join(out,'manifest.json'),'utf8')).files;
 assert.equal(rows.length,Object.keys(cases).length+2);
 for(const row of rows){const expected=cases[path.basename(row.sourcePath,'.as')]?.[1];if(expected)assert.equal(row.code,expected,JSON.stringify(row));else assert.equal(row.status,'admitted',JSON.stringify(rows.filter(item=>item.status!=='admitted')));}
});
