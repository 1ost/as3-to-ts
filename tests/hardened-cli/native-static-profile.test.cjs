'use strict';
const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../..');
const sdk=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA,ffdec=process.env.HARDENED_FIXTURE_FFDEC;
test('authenticated SDK static calls retain geometry types, rest arity and method-value holds',{skip:!sdk||!laya||!ffdec},t=>{
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'as3-static-profile-')));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const source=path.join(dir,'source'),profile=path.join(dir,'profile'),output=path.join(dir,'output');fs.mkdirSync(source);
 const cases={
  Valid:'public function run():void { var p:Point=Point.interpolate(new Point(),new Point(3,4),0.5); var d:Number=Point.distance(p,new Point()); if(ExternalInterface.available) { ExternalInterface.call("console.log"); ExternalInterface.call("console.log","probe",7,true,null); } }',
  MissingRequired:'public function run():void { ExternalInterface.call(); }',
  WrongGeometry:'public function run():void { Point.distance(7,new Point()); }',
  MethodValue:'public function run():void { var f:Function=Point.distance; }',
  ClassName:'public function run(value:*):String { return getQualifiedClassName(value); }',
  ClassNameMissing:'public function run():String { return getQualifiedClassName(); }',
  ClassNameExtra:'public function run():String { return getQualifiedClassName(1,2); }',
  ClassNameValue:'public function run():void { var f:Function=getQualifiedClassName; }',
 };
 for(const [name,body] of Object.entries(cases)) fs.writeFileSync(path.join(source,name+'.as'),`package { import flash.geom.Point; import flash.external.ExternalInterface; import flash.utils.getQualifiedClassName; public class ${name} { public function ${name}() {} ${body} } }`);
 const generated=cp.spawnSync('python3',['-B',path.join(root,'tools/create-fixture-profile.py'),'--source',source,'--entry','Valid','--laya',laya,'--air-sdk',sdk,'--ffdec-jar',ffdec,'--output',profile],{encoding:'utf8',timeout:120000});
 assert.equal(generated.status,0,generated.stderr);
 const result=cp.spawnSync(process.execPath,[path.join(root,'bin/as3-frontend'),'qualify',source,output,'--source-census',path.join(profile,'census.json'),'--profile-lock',path.join(profile,'profile-lock.json'),'--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json')],{encoding:'utf8',timeout:30000});
 assert.equal(result.status,0,result.stderr);
 const rows=JSON.parse(fs.readFileSync(path.join(output,'manifest.json'),'utf8')).files;
 const byName=Object.fromEntries(rows.map(row=>[row.sourcePath,row]));
 assert.equal(byName['Valid.as'].status,'admitted',JSON.stringify(byName['Valid.as']));
 assert.equal(byName['MissingRequired.as'].code,'HARDENED_CAPABILITY_CALL_ARITY');
 assert.equal(byName['WrongGeometry.as'].code,'HARDENED_CAPABILITY_CALL_TYPE');
 assert.equal(byName['MethodValue.as'].code,'HARDENED_STATIC_MEMBER');
 assert.equal(byName['ClassName.as'].status,'admitted',JSON.stringify(byName['ClassName.as']));
 assert.equal(byName['ClassNameMissing.as'].code,'HARDENED_REFLECTION_ARITY');
 assert.equal(byName['ClassNameExtra.as'].code,'HARDENED_REFLECTION_ARITY');
 assert.equal(byName['ClassNameValue.as'].code,'HARDENED_REFLECTION_FUNCTION_VALUE');
 const census=JSON.parse(fs.readFileSync(path.join(profile,'census.json'),'utf8'));
 assert.deepEqual(census.as3SourceCapabilities.apis.find(api=>api.qname==='flash.utils.getQualifiedClassName').signatures,[
  'public function getQualifiedClassName(value:*) : String',
  'public native function getQualifiedClassName(param1:*) : String;',
 ]);
});
