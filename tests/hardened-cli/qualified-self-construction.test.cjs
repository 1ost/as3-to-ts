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

test('fully qualified current-class construction keeps the authenticated self identity',async()=>{
 assert.ok(laya&&air&&ffdec,'AIR, Laya and FFDec required');
 const base=path.join(root,'.cache/qualified-self-construction');fs.mkdirSync(base,{recursive:true});
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(base,'run-')));
 const source=path.join(dir,'source'),profile=path.join(dir,'profile');fs.mkdirSync(path.join(source,'sample'),{recursive:true});
 fs.writeFileSync(path.join(source,'sample/Self.as'),`package sample {
 public final class Self {
  public var value:int;
  public function Self(input:int=7) { this.value=input; }
  public function clone():sample.Self { return new sample.Self(this.value); }
 }
}\n`);
 const run=(command,args)=>{const result=cp.spawnSync(command,args,{cwd:root,encoding:'utf8',timeout:120000});
  assert.equal(result.status,0,result.stdout+result.stderr);return result;};
 run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','sample.Self',
  '--air-sdk',air,'--laya',laya,'--ffdec-jar',ffdec,'--output',profile]);
 const output=path.join(dir,'output');
 run(process.execPath,['bin/as3-frontend','transpile',source,output,'--source-census',path.join(profile,'census.json'),
  '--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),
  '--profile-lock',path.join(profile,'profile-lock.json')]);
 const packageRoot=path.join(output,'__as3_runtime');
 const generated=fs.readFileSync(path.join(packageRoot,'application/sample/Self.ts'),'utf8');
 assert.match(generated,/return new \(__as3InitializeClass\(Self, true\)\)\(this\.value\);/);
 assert.doesNotMatch(generated,/__as3ConstructClass\(/);
 const esbuild=require('esbuild');
 const entry=`import {startAS3Application} from ${JSON.stringify(path.join(packageRoot,'ApplicationEntry.generated.js'))};
const original=startAS3Application(new AbortController().signal);const cloned=original.clone();
globalThis.qualifiedSelf=[original.value,cloned.value,original!==cloned];`;
 const built=await esbuild.build({stdin:{contents:entry,resolveDir:root,loader:'js'},bundle:true,write:false,
  format:'iife',platform:'browser',target:'es2020'});
 const actual=JSON.parse(JSON.stringify(new Function(built.outputFiles[0].text+';return globalThis.qualifiedSelf;')()));
 assert.deepEqual(actual,[7,7,true]);
 console.log(JSON.stringify({dir,status:'passed',observations:3}));
});
