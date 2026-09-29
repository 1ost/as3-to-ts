'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),os=require('os'),crypto=require('crypto'),assert=require('assert/strict'),test=require('node:test');
const root=path.resolve(__dirname,'../..'),laya=process.env.FROZEN_LAYA_ROOT||process.env.HARDENED_FIXTURE_LAYA,air=process.env.HARDENED_FIXTURE_AIR_SDK,ffdec=process.env.HARDENED_FIXTURE_FFDEC,sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const cases=process.env.HARDENED_REFERENCE_FIXTURE_SOURCE
 ? [{fixture:process.env.HARDENED_REFERENCE_FIXTURE_SOURCE,entry:process.env.HARDENED_REFERENCE_ENTRY||'ClassStaticReferenceArgumentsProbe'}]
 : [
 {fixture:laya&&path.join(laya,'tests/nativeFlashOracle/class-reference-package-explicit-super'),entry:'ClassStaticReferenceArgumentsProbe'},
 {fixture:laya&&path.join(laya,'tests/nativeFlashOracle/class-reference-package-expanded-explicit-super'),entry:'ClassReferenceExpandedProbe'}
 ];
for(const fixtureCase of cases) test('generated computed static reference parameters: '+fixtureCase.entry,{skip:!laya&&!air&&!ffdec},t=>{
 assert.ok(laya&&air&&ffdec);const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'class-static-call-')));let completed=false;t.after(()=>{if(completed)fs.rmSync(dir,{recursive:true,force:true});else console.error('Retained Class call evidence: '+dir);});
 const fixture=fixtureCase.fixture,native=JSON.parse(fs.readFileSync(path.join(fixture,'native-air.json')));
 const entry=fixtureCase.entry;
 const source=path.join(dir,'source'),profile=path.join(dir,'profile'),target=path.join(laya,'docTool/architecture/authored-content-capabilities.json');fs.mkdirSync(source);
 for(const [name,digest] of Object.entries(native.sourceFiles)){const bytes=fs.readFileSync(path.join(fixture,name));assert.equal(sha(bytes),digest);fs.mkdirSync(path.dirname(path.join(source,name)),{recursive:true});fs.writeFileSync(path.join(source,name),bytes);}
 const run=(command,args)=>{const r=cp.spawnSync(command,args,{cwd:root,encoding:'utf8',timeout:180000});fs.appendFileSync(path.join(dir,'commands.log'),JSON.stringify([command,...args])+'\n'+r.stdout+r.stderr);assert.equal(r.status,0,r.stdout+r.stderr);};
 const make=()=>run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry',entry,'--air-sdk',air,'--laya',laya,'--ffdec-jar',ffdec,'--output',profile]);make();
 const compile=(op,out)=>run(process.execPath,['bin/as3-frontend',op,source,out,'--source-census',path.join(profile,'census.json'),'--target-capabilities',target,'--profile-lock',path.join(profile,'profile-lock.json')]);
 const snapshots=[];
 for(const name of ['first','second']){
  const out=path.join(dir,name);compile('transpile',out);const manifest=JSON.parse(fs.readFileSync(path.join(out,'manifest.json')));assert.equal(manifest.files.length,Object.keys(native.sourceFiles).length);
  const code=manifest.files.map(row=>{assert.equal(row.sourceSha256,native.sourceFiles[row.sourcePath]);return[row.sourcePath,fs.readFileSync(path.join(out,row.typescriptPath),'utf8')];});snapshots.push(code);
  fs.mkdirSync(path.join(out,'node_modules/@laya'),{recursive:true});fs.symlinkSync(path.join(out,'__as3_runtime'),path.join(out,'node_modules/@laya/as3-runtime'),'dir');
  const bundle=path.join(out,'runner.cjs');require('esbuild').buildSync({stdin:{contents:`
globalThis.window ||= globalThis;globalThis.document ||= {createElement:()=>({style:{},getContext:()=>null}),documentElement:{style:{}}};
const {LayaGL}=require('laya/laya/layagl/LayaGL');
LayaGL.render2DRenderPassFactory=new (require('laya/laya/RenderDriver/NoRenderDriver/2DRenderPass/NoRender2DProcess').NoRender2DProcess)();
LayaGL.renderDeviceFactory=new (require('laya/laya/RenderDriver/NoRenderDriver/DriverDevice/NoRenderDeviceFactory').NoRenderDeviceFactory)();
const {ILaya}=require('laya/ILaya');ILaya.stage={_graphicUpdateList:new Set(),_tranMatrixUpdateList:new Set(),_componentDriver:{_toDestroys:new Set()}};ILaya.timer={delta:0};
require('laya/laya/ModuleDef');exports.entry=require('./__as3_runtime/ApplicationEntry.generated.js');`,resolveDir:out,sourcefile:'runner.js'},outfile:bundle,bundle:true,platform:'node',format:'cjs',alias:{laya:path.join(laya,'src/layaAir')},loader:{'.vs':'text','.fs':'text','.glsl':'text'},logLevel:'silent'});
  const loaded=require(bundle),Probe=loaded.entry.AS3_APPLICATION_MODULES.find(row=>row[entry])[entry],probe=new Probe();
  assert.deepEqual(JSON.parse(JSON.stringify(probe.snapshot())),native.capture.state);

 }
 assert.deepEqual(...snapshots);
 completed=true;
});
