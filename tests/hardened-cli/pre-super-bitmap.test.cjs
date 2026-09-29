"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),test=require("node:test");
const {spawnSync}=require("node:child_process");
const ROOT=path.resolve(__dirname,"../.."),sdk=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA,ffdec=process.env.HARDENED_FIXTURE_FFDEC;
test("native Bitmap pre-super staging preserves own fields and rejects receiver escape",{skip:!sdk||!laya||!ffdec},t=>{
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"pre-super-bitmap-")));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const source=path.join(root,"source"),profile=path.join(root,"profile"),out=path.join(root,"qualified");fs.mkdirSync(source);
 const cases={
  GoodBefore:'public var value:int=3; public function GoodBefore(){ this.value=7; super(); }',
  GoodAfter:'public function GoodAfter(){ this.value=7; super(); } public var value:int=3;',
  GoodArgs:'public var saved:BitmapData; public function GoodArgs(data:BitmapData){this.saved=data; super(this.saved);}',
  BadEarlySelf:'public var self:Object=this; public function BadEarlySelf(){ super(); }',
  BadLateSelf:'public function BadLateSelf(){ super(); } public var self:Object=this;',
  BadLeak:'public function BadLeak(){var escaped:Object=this; super();}',
  BadInherited:'public function BadInherited(){var width:Number=this.width; super();}',
  BadMethod:'public function helper():int{return 7;} public var value:int=this.helper(); public function BadMethod(){super();}',
  BadAccessor:'public function get sample():int{return 7;} public var value:int=this.sample; public function BadAccessor(){super();}'
 };
 for(const [name,body] of Object.entries(cases)) fs.writeFileSync(path.join(source,name+'.as'),`package { import flash.display.Bitmap; import flash.display.BitmapData; public class ${name} extends Bitmap { ${body} } }\n`);
 function run(args,timeout=60000){return spawnSync(args[0],args.slice(1),{encoding:'utf8',timeout});}
 const generated=run(['python3',path.join(ROOT,'tools/create-fixture-profile.py'),'--source',source,'--entry','GoodBefore','--air-sdk',sdk,'--laya',laya,'--ffdec-jar',ffdec,'--output',profile],120000);
 assert.equal(generated.status,0,generated.stdout+generated.stderr);
 const result=run([process.execPath,path.join(ROOT,'bin/as3-frontend'),'qualify',source,out,'--source-census',path.join(profile,'census.json'),'--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(profile,'profile-lock.json')]);
 assert.equal(result.status,0,result.stdout+result.stderr);
 const manifest=JSON.parse(fs.readFileSync(path.join(out,'manifest.json'),'utf8'));
 for(const row of manifest.files) {
  if(path.basename(row.sourcePath).startsWith('Good'))assert.equal(row.status,'admitted',JSON.stringify(row));
  else assert.equal(row.code,'HARDENED_SUPER_FIELD_RECEIVER',JSON.stringify(row));
 }
 assert.equal(manifest.files.length,Object.keys(cases).length);
 const good=path.join(root,'good');fs.mkdirSync(good);for(const name of ['GoodBefore','GoodAfter','GoodArgs'])fs.copyFileSync(path.join(source,name+'.as'),path.join(good,name+'.as'));
 const emitted=path.join(root,'emitted');const emission=run([process.execPath,path.join(ROOT,'bin/as3-frontend'),'transpile',good,emitted,'--source-census',path.join(profile,'census.json'),'--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(profile,'profile-lock.json')]);
 assert.equal(emission.status,0,emission.stdout+emission.stderr);
 for(const name of ['GoodBefore','GoodAfter']) {
  const code=fs.readFileSync(path.join(emitted,'__as3_runtime/application',name+'.ts'),'utf8');
  assert.ok(code.indexOf('__as3PreSuperFields.value = __as3Int(3)')<code.indexOf('__as3PreSuperFields.value = __as3Int(7)'),code);
  assert.ok(code.indexOf('__as3PreSuperFields.value = __as3Int(7)')<code.indexOf('super('),code);
  assert.ok(code.indexOf('this.value = __as3PreSuperFields.value')>code.indexOf('super('),code);
 }
});
