'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),os=require('os'),crypto=require('crypto'),assert=require('assert/strict'),test=require('node:test');
const root=path.resolve(__dirname,'../..'),laya=process.env.FROZEN_LAYA_ROOT||process.env.HARDENED_FIXTURE_LAYA,air=process.env.HARDENED_FIXTURE_AIR_SDK,ffdec=process.env.HARDENED_FIXTURE_FFDEC,sha=b=>crypto.createHash('sha256').update(b).digest('hex');
test('authenticated native frame-script pair subset preserves generated callback frame order',{skip:!laya&&!air&&!ffdec},t=>{
 assert.ok(laya&&air&&ffdec);const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'frame-script-pairs-')));let completed=false;t.after(()=>{if(completed)fs.rmSync(dir,{recursive:true,force:true});else console.error('Retained frame script evidence: '+dir);});
 const input=path.join(__dirname,'fixtures/frame-script-pairs/FrameScriptPairsProbe.as'),bytes=fs.readFileSync(input),expected='4614fe2f0b2becd6d7e2dbfd0e274fd0d4e2cda915e15af7b73cbbc302c8d09c';assert.equal(sha(bytes),expected);
 const nativeRoot=path.join(laya,'tests/nativeFlashOracle/authored-frame-script-controls'),native=JSON.parse(fs.readFileSync(path.join(nativeRoot,'native-air.json')));
 for(const [name,digest] of Object.entries(native.sourceFiles))assert.equal(sha(fs.readFileSync(path.join(nativeRoot,name))),digest);
 assert.equal(sha(fs.readFileSync(path.join(laya,'tests/nativeFlashOracle/original-equipment-effect-library/equipmentEffect.swf'))),native.fixtureSwfSha256);
 const source=path.join(dir,'source'),profile=path.join(dir,'profile'),target=path.join(laya,'docTool/architecture/authored-content-capabilities.json');fs.mkdirSync(source);fs.writeFileSync(path.join(source,'FrameScriptPairsProbe.as'),bytes);
 const run=(command,args)=>{const r=cp.spawnSync(command,args,{cwd:root,encoding:'utf8',timeout:180000});assert.equal(r.status,0,r.stdout+r.stderr);};
 const make=()=>run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','FrameScriptPairsProbe','--air-sdk',air,'--laya',laya,'--ffdec-jar',ffdec,'--output',profile]);make();
 const compile=(op,out)=>run(process.execPath,['bin/as3-frontend',op,source,out,'--source-census',path.join(profile,'census.json'),'--target-capabilities',target,'--profile-lock',path.join(profile,'profile-lock.json')]);
 const snapshots=[];
 for(const name of ['first','second']){
  const out=path.join(dir,name);compile('transpile',out);const manifest=JSON.parse(fs.readFileSync(path.join(out,'manifest.json')));assert.equal(manifest.files.length,1);assert.equal(manifest.files[0].sourceSha256,expected);snapshots.push(fs.readFileSync(path.join(out,manifest.files[0].typescriptPath),'utf8'));
  fs.mkdirSync(path.join(out,'node_modules/@laya'),{recursive:true});fs.symlinkSync(path.join(out,'__as3_runtime'),path.join(out,'node_modules/@laya/as3-runtime'),'dir');
  const bundle=path.join(out,'runner.cjs');require('esbuild').buildSync({stdin:{contents:`
const {LayaGL}=require('laya/laya/layagl/LayaGL');
LayaGL.render2DRenderPassFactory=new (require('laya/laya/RenderDriver/NoRenderDriver/2DRenderPass/NoRender2DProcess').NoRender2DProcess)();
LayaGL.renderDeviceFactory=new (require('laya/laya/RenderDriver/NoRenderDriver/DriverDevice/NoRenderDeviceFactory').NoRenderDeviceFactory)();
const {ILaya}=require('laya/ILaya');ILaya.stage={_graphicUpdateList:new Set(),_tranMatrixUpdateList:new Set(),_componentDriver:{_toDestroys:new Set()}};ILaya.timer={delta:0};
require('laya/laya/ModuleDef');exports.MovieClip=require('laya/flash/display/MovieClip').MovieClip;
exports.entry=require('./__as3_runtime/ApplicationEntry.generated.js');`,resolveDir:out,sourcefile:'runner.js'},outfile:bundle,bundle:true,platform:'node',format:'cjs',loader:{'.glsl':'text','.vs':'text','.fs':'text'},banner:{js:'globalThis.window ??= globalThis; globalThis.document ??= {};'},alias:{laya:path.join(laya,'src/layaAir')},logLevel:'silent'});
  const loaded=require(bundle),Probe=loaded.entry.AS3_APPLICATION_MODULES.find(row=>row.FrameScriptPairsProbe).FrameScriptPairsProbe,probe=new Probe(),movie=new loaded.MovieClip();
  const timeline={totalFrames:28,currentFrame:0,playing:false,play(frame){this.currentFrame=frame;this.playing=true;},stop(){this.playing=false;},gotoAndStop(frame){this.currentFrame=frame;this.playing=false;}};movie._bindNativeTimeline(timeline);
  probe.register(movie);movie.gotoAndStop(1);movie.gotoAndStop(19);movie.gotoAndStop(28);movie.gotoAndStop(28);
  assert.deepEqual(probe.result,native.capture.state.calls.map(row=>[row.id,row.frame]));assert.equal(movie.isPlaying,false);
 }
 assert.deepEqual(...snapshots);
 const negatives={Zero:'movie.addFrameScript()',Odd:'movie.addFrameScript(0,null,1)',StringFrame:'movie.addFrameScript("0",null)',UnknownFrame:'movie.addFrameScript(value,null)',BadCallback:'movie.addFrameScript(0,1)',UnknownCallback:'movie.addFrameScript(0,value)'};
 for(const [name,call] of Object.entries(negatives))fs.writeFileSync(path.join(source,name+'.as'),`package {import flash.display.MovieClip;public class ${name} {public function run(movie:MovieClip,value:*):void {${call};}}}`);
 fs.rmSync(profile,{recursive:true,force:true});make();compile('qualify',path.join(dir,'negative'));const rows=JSON.parse(fs.readFileSync(path.join(dir,'negative/manifest.json'))).files;
 for(const name of Object.keys(negatives)){const row=rows.find(row=>row.sourcePath===name+'.as');assert.equal(row.code,['Zero','Odd'].includes(name)?'HARDENED_FRAME_SCRIPT_ARITY':'HARDENED_FRAME_SCRIPT_ARGUMENT',JSON.stringify(row));}
 assert.equal(sha(fs.readFileSync(input)),expected);assert.equal(sha(fs.readFileSync(path.join(source,'FrameScriptPairsProbe.as'))),expected);completed=true;
});
