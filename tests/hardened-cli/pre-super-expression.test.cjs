'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const laya=process.env.HARDENED_FIXTURE_LAYA;
const air=process.env.HARDENED_FIXTURE_AIR_SDK;
const ffdec=process.env.HARDENED_FIXTURE_FFDEC;

test('receiver-free expressions retain AIR order before a local base constructor',async()=>{
 assert.ok(laya&&air&&ffdec,'AIR, Laya and FFDec required');
 const base=path.join(root,'.cache/pre-super-expression');fs.mkdirSync(base,{recursive:true});
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(base,'run-')));
 const source=path.join(dir,'source'),profile=path.join(dir,'profile');fs.mkdirSync(source);
 fs.writeFileSync(path.join(source,'Base.as'),`package {
 public class Base {
  public function Base() { State.value=State.value*10+2; }
 }
}\n`);
 fs.writeFileSync(path.join(source,'State.as'),`package { public final class State { public static var value:int=0; } }\n`);
 fs.writeFileSync(path.join(source,'Good.as'),`package {
 public final class Good extends Base {
  public function Good() { State.value=State.value*10+1; super(); State.value=State.value*10+3; }
  public function getValue():int { return State.value; }
 }
}\n`);
 fs.writeFileSync(path.join(source,'BadThis.as'),`package {
 public class BadThis extends Base { public var value:int; public function BadThis() { this.value=1; super(); } }
}\n`);
 fs.writeFileSync(path.join(source,'ArgBase.as'),`package {
 public class ArgBase { public function ArgBase(value:int) {} }
 }\n`);
 fs.writeFileSync(path.join(source,'BadArg.as'),`package {
 public class BadArg extends ArgBase { public var value:int; public function BadArg() { super(this.value); } }
 }\n`);
 const run=(command,args)=>{const result=cp.spawnSync(command,args,{cwd:root,encoding:'utf8',timeout:120000});
  assert.equal(result.status,0,result.stdout+result.stderr);return result;};
 run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','Good',
  '--air-sdk',air,'--laya',laya,'--ffdec-jar',ffdec,'--output',profile]);
 const qualified=path.join(dir,'qualified');
 const args=output=>[source,output,'--source-census',path.join(profile,'census.json'),
  '--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),
  '--profile-lock',path.join(profile,'profile-lock.json')];
 run(process.execPath,['bin/as3-frontend','qualify',...args(qualified)]);
 const rows=JSON.parse(fs.readFileSync(path.join(qualified,'manifest.json'),'utf8')).files;
 assert.equal(rows.find(row=>row.sourcePath==='Good.as').status,'admitted');
 assert.equal(rows.find(row=>row.sourcePath==='BadThis.as').code,'HARDENED_SUPER_LOCAL_RECEIVER');
 assert.equal(rows.find(row=>row.sourcePath==='BadArg.as').code,'HARDENED_SUPER_LOCAL_RECEIVER');

 const good=path.join(dir,'good');fs.mkdirSync(good);
 for(const name of ['Base.as','State.as','Good.as'])fs.copyFileSync(path.join(source,name),path.join(good,name));
 const goodProfile=path.join(dir,'good-profile');
 run('python3',['-B','tools/create-fixture-profile.py','--source',good,'--entry','Good',
  '--air-sdk',air,'--laya',laya,'--ffdec-jar',ffdec,'--output',goodProfile]);
 const output=path.join(dir,'output');
 run(process.execPath,['bin/as3-frontend','transpile',good,output,'--source-census',path.join(goodProfile,'census.json'),
  '--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),
  '--profile-lock',path.join(goodProfile,'profile-lock.json')]);
 const packageRoot=path.join(output,'__as3_runtime');
 const generated=fs.readFileSync(path.join(packageRoot,'application/Good.ts'),'utf8');
 assert.ok(generated.indexOf('State.value =')<generated.indexOf('super('),generated);
 const esbuild=require('esbuild');
 const entry=`import {startAS3Application} from ${JSON.stringify(path.join(packageRoot,'ApplicationEntry.generated.js'))};
const application=startAS3Application(new AbortController().signal);
globalThis.preSuperValue=application.getValue();`;
 const built=await esbuild.build({stdin:{contents:entry,resolveDir:root,loader:'js'},bundle:true,write:false,
  format:'iife',platform:'browser',target:'es2020'});
 const actual=new Function(built.outputFiles[0].text+';return globalThis.preSuperValue;')();
 assert.equal(actual,123);
 console.log(JSON.stringify({dir,status:'passed',order:actual}));
});
