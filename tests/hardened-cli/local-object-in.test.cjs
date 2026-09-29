'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const cp=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const laya=process.env.HARDENED_FIXTURE_LAYA;
const air=process.env.HARDENED_FIXTURE_AIR_SDK;
const ffdec=process.env.HARDENED_FIXTURE_FFDEC;
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');

test('typed local class in uses authenticated Object dispatch and retained AIR trait membership',async()=>{
 assert.ok(laya&&air&&ffdec,'AIR, Laya and FFDec required');
 const fixture=path.join(laya,'tests/nativeFlashOracle/dynamic-class');
 const evidence=JSON.parse(fs.readFileSync(path.join(fixture,'native-air.json'),'utf8'));
 for(const [file,expected] of Object.entries(evidence.sourceSha256))
  assert.equal(sha(fs.readFileSync(path.join(fixture,file))),expected,file);
 const expected=Object.fromEntries(evidence.capture.state.observations
  .filter(row=>row.id.startsWith('read-')).map(row=>[row.id.slice(5),row.present]));

 const base=path.join(root,'.cache/local-object-in');fs.mkdirSync(base,{recursive:true});
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(base,'run-')));
 const source=path.join(dir,'source'),profile=path.join(dir,'profile');fs.mkdirSync(source);
 fs.writeFileSync(path.join(source,'LocalObjectInProbe.as'),`package {
 public final class LocalObjectInProbe {
  public var field:int=7;
  private var hidden:String='private';
  public const fixed:int=3;
  public function LocalObjectInProbe() {}
  public function method():String { return 'method'; }
  public function containsThis(key:*):Boolean { return key in this; }
  public function containsParameter(key:*, target:LocalObjectInProbe):Boolean { return key in target; }
 }
}\n`);
 const run=(command,args)=>{const result=cp.spawnSync(command,args,{cwd:root,encoding:'utf8',timeout:120000});
  assert.equal(result.status,0,result.stdout+result.stderr);return result;};
 run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','LocalObjectInProbe',
  '--air-sdk',air,'--laya',laya,'--ffdec-jar',ffdec,'--output',profile]);
 const output=path.join(dir,'output');
 run(process.execPath,['bin/as3-frontend','transpile',source,output,'--source-census',path.join(profile,'census.json'),
  '--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),
  '--profile-lock',path.join(profile,'profile-lock.json')]);
 const packageRoot=path.join(output,'__as3_runtime');
 const generated=fs.readFileSync(path.join(packageRoot,'application/LocalObjectInProbe.ts'),'utf8');
 assert.equal((generated.match(/__as3ObjectIn\(key, /g)||[]).length,2);
 assert.match(generated,/@laya\/as3-runtime\/AS3ObjectDispatch/);

 const esbuild=require('esbuild');
 const keys=['field','hidden','fixed','method','toString','constructor','__proto__','absent'];
 const entry=`import {startAS3Application} from ${JSON.stringify(path.join(packageRoot,'ApplicationEntry.generated.js'))};
const probe=startAS3Application(new AbortController().signal);
const keys=${JSON.stringify(keys)};
globalThis.localObjectIn=keys.map(key=>[key,probe.containsThis(key)]);
globalThis.localObjectIn.push(['parameter',probe.containsParameter('field',probe)]);`;
 const built=await esbuild.build({stdin:{contents:entry,resolveDir:root,loader:'js'},bundle:true,write:false,
  format:'iife',platform:'browser',target:'es2020'});
 const actual=JSON.parse(JSON.stringify(new Function(built.outputFiles[0].text+';return globalThis.localObjectIn;')()));
 assert.deepEqual(actual,[...keys.map(key=>[key,expected[key]]),['parameter',true]]);
 console.log(JSON.stringify({dir,status:'passed',observations:keys.length+1}));
});
