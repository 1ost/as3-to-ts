'use strict';
const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../..');
const sdk=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA,ffdec=process.env.HARDENED_FIXTURE_FFDEC;
test('native parseInt admission retains argument types, arity and lexical shadows',{skip:!sdk||!laya||!ffdec},t=>{
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'as3-parse-integer-profile-')));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const source=path.join(dir,'source'),profile=path.join(dir,'profile'),output=path.join(dir,'output');fs.mkdirSync(source);
 const cases={
  Valid:'public function run(value:*, radix:*):Number { return parseInt(value,radix); }',
  Literal:'public static var color:Number=parseInt("e29f4e",16); public function run():Number { return parseInt(); }',
  Extra:'public function run():Number { return parseInt("12",10,7); }',
  WrongValue:'public function run(value:Object):Number { return parseInt(value,10); }',
  WrongRadix:'public function run(radix:Object):Number { return parseInt("12",radix); }',
  MethodValue:'public function run():Function { return parseInt; }',
  Shadow:'private function parseInt(value:String):Number { return 91; } public function run():Number { return parseInt("12"); }',
 };
 for(const [name,body] of Object.entries(cases)) fs.writeFileSync(path.join(source,name+'.as'),`package { public class ${name} { public function ${name}() {} ${body} } }`);
 const generated=cp.spawnSync('python3',['-B',path.join(root,'tools/create-fixture-profile.py'),'--source',source,'--entry','Valid','--laya',laya,'--air-sdk',sdk,'--ffdec-jar',ffdec,'--output',profile],{encoding:'utf8',timeout:120000});
 assert.equal(generated.status,0,generated.stderr);
 const result=cp.spawnSync(process.execPath,[path.join(root,'bin/as3-frontend'),'qualify',source,output,'--source-census',path.join(profile,'census.json'),'--profile-lock',path.join(profile,'profile-lock.json'),'--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json')],{encoding:'utf8',timeout:30000});
 assert.equal(result.status,0,result.stderr);
 const rows=JSON.parse(fs.readFileSync(path.join(output,'manifest.json'),'utf8')).files;
 const byName=Object.fromEntries(rows.map(row=>[row.sourcePath,row]));
 for(const name of ['Valid','Literal','Shadow'])assert.equal(byName[name+'.as'].status,'admitted',JSON.stringify(byName[name+'.as']));
 assert.equal(byName['Extra.as'].code,'HARDENED_PARSE_INTEGER_ARITY');
 for(const name of ['WrongValue','WrongRadix','MethodValue'])assert.equal(byName[name+'.as'].status,'held',JSON.stringify(byName[name+'.as']));
 const emitted=path.join(dir,'emitted'),admitted=path.join(dir,'admitted');fs.mkdirSync(admitted);
 for(const name of ['Valid','Shadow'])fs.copyFileSync(path.join(source,name+'.as'),path.join(admitted,name+'.as'));
 const transpiled=cp.spawnSync(process.execPath,[path.join(root,'bin/as3-frontend'),'transpile',admitted,emitted,'--source-census',path.join(profile,'census.json'),'--profile-lock',path.join(profile,'profile-lock.json'),'--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json')],{encoding:'utf8',timeout:30000});
 assert.equal(transpiled.status,0,transpiled.stderr);
 const staticSource=path.join(dir,'static-source');fs.mkdirSync(staticSource);fs.copyFileSync(path.join(source,'Literal.as'),path.join(staticSource,'Literal.as'));
 const staticResult=cp.spawnSync(process.execPath,[path.join(root,'bin/as3-frontend'),'transpile',staticSource,path.join(dir,'static-output'),'--source-census',path.join(profile,'census.json'),'--profile-lock',path.join(profile,'profile-lock.json'),'--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json')],{encoding:'utf8',timeout:30000});
 assert.equal(staticResult.status,0,staticResult.stderr);
 const staticFiles=fs.readdirSync(path.join(dir,"static-output"),{recursive:true}).filter(p=>p.endsWith("Literal.ts"));
 assert.equal(staticFiles.length,1);assert.match(fs.readFileSync(path.join(dir,"static-output",staticFiles[0]),"utf8"),/__as3DefineClassInitialization/);
 const files=fs.readdirSync(emitted,{recursive:true}).filter(p=>p.endsWith('Shadow.ts'));
 assert.equal(files.length,1);
 assert.doesNotMatch(fs.readFileSync(path.join(emitted,files[0]),'utf8'),/__as3ParseInt\(/);
});
