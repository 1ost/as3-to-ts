"use strict";
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),crypto=require('crypto'),assert=require('assert/strict'),test=require('node:test');
const root=path.resolve(__dirname,'../..'),laya=process.env.HARDENED_FIXTURE_LAYA,air=process.env.HARDENED_FIXTURE_AIR_SDK,ffdec=process.env.HARDENED_FIXTURE_FFDEC,sha=b=>crypto.createHash('sha256').update(b).digest('hex');
test('Array typed wildcard reads match native state and conversion order',{skip:!laya&&!air&&!ffdec},t=>{
 assert.ok(laya&&air&&ffdec);const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'array-typed-read-')));let completed=false;t.after(()=>{if(completed)fs.rmSync(dir,{recursive:true,force:true});else console.error('Retained Array read evidence: '+dir);});
 const fixture=process.env.HARDENED_ARRAY_READ_FIXTURE_SOURCE||path.join(laya,'tests/nativeFlashOracle/array-typed-read'),native=JSON.parse(fs.readFileSync(path.join(fixture,'native-air.json')));
 const source=path.join(dir,'source'),selected=path.join(dir,'selected'),profile=path.join(dir,'profile');fs.mkdirSync(source);fs.mkdirSync(selected);
 assert.deepEqual(native.invocation.constructorArgs,[]);assert.equal(native.invocation.snapshotMethod,'snapshot');assert.equal(native.invocation.scenario,null);assert.equal(native.invocation.hostSha256,native.receipt.artifacts["host/OracleHost.as"]);assert.equal(native.invocation.entry,'ArrayTypedReadProbe');

 for(const [name,hash] of Object.entries(native.sourceFiles)){const bytes=fs.readFileSync(path.join(fixture,name));assert.equal(sha(bytes),hash);fs.mkdirSync(path.dirname(path.join(source,name)),{recursive:true});fs.writeFileSync(path.join(source,name),bytes);{fs.mkdirSync(path.dirname(path.join(selected,name)),{recursive:true});fs.writeFileSync(path.join(selected,name),bytes);}}
 const run=(command,args)=>{const r=cp.spawnSync(command,args,{cwd:root,encoding:'utf8',timeout:180000});fs.appendFileSync(path.join(dir,'commands.log'),JSON.stringify([command,...args])+'\n'+r.stdout+r.stderr);assert.equal(r.status,0,r.stdout+r.stderr);};
 run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','ArrayTypedReadProbe','--air-sdk',air,'--laya',laya,'--ffdec-jar',ffdec,'--output',profile]);
 const compile=(operation,output)=>run(process.execPath,['bin/as3-frontend',operation,selected,output,'--source-census',path.join(profile,'census.json'),'--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(profile,'profile-lock.json')]);
 const snapshots=[];
 for(const label of ['first','second']){
  const out=path.join(dir,label);compile('transpile',out);const manifest=JSON.parse(fs.readFileSync(path.join(out,'manifest.json')));assert.equal(manifest.files.length,1);for(const row of manifest.files)assert.equal(row.sourceSha256,native.sourceFiles[row.sourcePath]);snapshots.push(manifest.files.map(row=>fs.readFileSync(path.join(out,row.typescriptPath),'utf8')));
  fs.mkdirSync(path.join(out,'node_modules/@laya'),{recursive:true});fs.symlinkSync(path.join(out,'__as3_runtime'),path.join(out,'node_modules/@laya/as3-runtime'),'dir');
  const bundle=path.join(out,'runner.cjs');require('esbuild').buildSync({stdin:{contents:`
globalThis.window ||= globalThis;globalThis.document ||= {createElement:()=>({style:{},getContext:()=>null}),documentElement:{style:{}}};
const {LayaGL}=require('laya/laya/layagl/LayaGL');
LayaGL.render2DRenderPassFactory=new (require('laya/laya/RenderDriver/NoRenderDriver/2DRenderPass/NoRender2DProcess').NoRender2DProcess)();
LayaGL.renderDeviceFactory=new (require('laya/laya/RenderDriver/NoRenderDriver/DriverDevice/NoRenderDeviceFactory').NoRenderDeviceFactory)();
const {ILaya}=require('laya/ILaya');ILaya.stage={_graphicUpdateList:new Set(),_tranMatrixUpdateList:new Set(),_componentDriver:{_toDestroys:new Set()}};ILaya.timer={delta:0};
require('laya/laya/ModuleDef');exports.entry=require('./__as3_runtime/ApplicationEntry.generated.js');`,resolveDir:out,sourcefile:'runner.js'},outfile:bundle,bundle:true,platform:'node',format:'cjs',alias:{laya:path.join(laya,'src/layaAir')},loader:{'.vs':'text','.fs':'text','.glsl':'text'},logLevel:'silent'});
  const loaded=require(bundle),Probe=loaded.entry.AS3_APPLICATION_MODULES.find(row=>row.ArrayTypedReadProbe).ArrayTypedReadProbe;const probe=new Probe();assert.deepEqual(JSON.parse(JSON.stringify(probe.snapshot())),native.capture.state);
 }
 assert.deepEqual(...snapshots);
 completed=true;
});
