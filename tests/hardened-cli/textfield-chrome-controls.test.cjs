'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),os=require('os'),crypto=require('crypto'),assert=require('assert/strict'),test=require('node:test');
const root=path.resolve(__dirname,'../..'),laya=process.env.FROZEN_LAYA_ROOT||process.env.HARDENED_FIXTURE_LAYA,air=process.env.HARDENED_FIXTURE_AIR_SDK,ffdec=process.env.HARDENED_FIXTURE_FFDEC,sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const versions=Object.freeze({
 '411b8420e5e318d5e9667a6e43e4ebcebd92caa18fd3cf975ca6e4076060c0cc':Object.freeze({id:'core29',observations:29,
  nativeAir:'341a648f832f72f20bdc111ef4c5ff1e6868818f258558851542e804a1d9b857',
  receipt:'286503a0c40988e69337e630224b73e8e1b8a57c1e548b1866c7796719880418',
  capture:'c0551f8db2604385254ab408bbeaee8bbad389d27503a42b3a3f73b6f4ba7a28'}),
 'e244a6f370933ad54bace3ca73091adccee93ac6d55d04a83b433d38b22275d8':Object.freeze({id:'controls33',observations:33,
  nativeAir:'ab9df89215412c67780c569cb8a89020aadd44e66ea687a514f453f62733429b',
  receipt:'c3de40023baf373efaa3cff731e479d81ac27ac2a25fe8b304031f33907b5ed8',
  capture:'5319931f2c5a28b47ec033e774670a6709d3f9cbe99fd266e313bdef1964f12f'}),
});
const entry='TextFieldChromeProbe',sourceName=entry+'.as';
function retainedFixture(fixture,nativeOverride){
 const nativeBytes=fs.readFileSync(path.join(fixture,'native-air.json')),native=nativeOverride||JSON.parse(nativeBytes);
 assert.deepEqual(Object.keys(native.sourceFiles),[sourceName]);
 const sourceBytes=fs.readFileSync(path.join(fixture,sourceName)),sourceSha=sha(sourceBytes),version=versions[sourceSha];
 assert.ok(version,'unrecognized retained TextField chrome source identity');
 assert.equal(native.sourceFiles[sourceName],sourceSha);assert.equal(sha(nativeBytes),version.nativeAir);
 const receiptBytes=fs.readFileSync(path.join(fixture,'receipt.json'));
 const captureBytes=fs.readFileSync(path.join(fixture,'capture.json'));
 const repeatBytes=fs.readFileSync(path.join(fixture,'capture-repeat.json'));
 assert.equal(sha(receiptBytes),version.receipt);assert.equal(native.nativeReceiptSha256,version.receipt);
 assert.equal(sha(captureBytes),version.capture);assert.equal(sha(repeatBytes),version.capture);assert.equal(native.captureSha256,version.capture);
 assert.deepEqual(JSON.parse(receiptBytes),native.receipt);assert.deepEqual(JSON.parse(captureBytes),native.capture);assert.deepEqual(JSON.parse(repeatBytes),native.capture);
 assert.equal(native.invocation.mode,'direct-fixture');assert.equal(native.invocation.entry,entry);assert.deepEqual(native.invocation.constructorArgs,[]);
 assert.equal(native.invocation.hostSha256,native.receipt.artifacts[native.invocation.hostArtifact]);
 assert.equal(native.receipt.capture.status,'passed');assert.equal(native.receipt.capture.identical,true);assert.equal(native.receipt.capture.runs,2);
 assert.equal(native.receipt.capture.observationCount,version.observations);assert.equal(native.capture.state.observations.length,version.observations);
 return {native,sourceBytes,version};
}
test('retained TextField chrome native29 and clipping33 identities remain distinct',{skip:!laya},()=>{
 const fixtures=['textfield-chrome-core','textfield-chrome-controls'].map(name=>path.join(laya,'tests/nativeFlashOracle',name));
 assert.deepEqual(fixtures.map(fixture=>retainedFixture(fixture).version.id),['core29','controls33']);
 const fixture=process.env.HARDENED_TEXTFIELD_CHROME_FIXTURE_SOURCE;
 if(fixture)retainedFixture(fixture);
 const core=retainedFixture(fixtures[0]),wrongCount=structuredClone(core.native);wrongCount.receipt.capture.observationCount=33;
 assert.throws(()=>retainedFixture(fixtures[0],wrongCount));
});
test('generated TextField chrome controls match the selected retained fixture',{skip:!laya||!air||!ffdec},t=>{
 assert.ok(laya&&air&&ffdec);const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'textfield-chrome-')));let completed=false;t.after(()=>{if(completed)fs.rmSync(dir,{recursive:true,force:true});else console.error('Retained TextField chrome evidence: '+dir);});
 const fixture=process.env.HARDENED_TEXTFIELD_CHROME_FIXTURE_SOURCE||path.join(laya,'tests/nativeFlashOracle/textfield-chrome-core'),{native}=retainedFixture(fixture);
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
require('laya/laya/ModuleDef');
const {PAL}=require('laya/laya/platform/PlatformAdapters');PAL.browser ??= {on(){},getPixelRatio:()=>1};PAL.textInput ??= {target:null};
const {Browser}=require('laya/laya/utils/Browser');Browser.mainCanvas={source:{oncontextmenu:null}};
ILaya.timer={delta:0,frameLoop(){},clear(){},callLater(){},runCallLater(){},frameOnce(delay,caller,method){queueMicrotask(()=>Reflect.apply(method,caller,[]));}};
ILaya.systemTimer=ILaya.timer;
const {Stage}=require('laya/laya/display/Stage');ILaya.stage=new Stage();
const {FlashStageBoundary}=require('laya/flash/display/FlashStageBoundary');FlashStageBoundary.configure(ILaya.stage,{align:'TL',scaleMode:'noScale',quality:'high',showDefaultContextMenu:false,loaderParameters:FlashStageBoundary.parseLoaderParameters('')});
const viewport=FlashStageBoundary.claimViewport(ILaya.stage,{width:320,height:240});
const lease=require('laya/flash/display/FlashDisplayRootBoundary').FlashDisplayRootBoundary.claim(ILaya.stage,()=>{},{destroyRootOnDispose:true});
const host=new (require('laya/flash/display/Sprite').Sprite)();lease.attach(host);
exports.attach=probe=>host.addChild(probe);exports.dispose=()=>{lease.dispose();viewport.dispose();FlashStageBoundary.dispose(ILaya.stage);};
exports.entry=require('./__as3_runtime/ApplicationEntry.generated.js');`,resolveDir:out,sourcefile:'runner.js'},outfile:bundle,bundle:true,platform:'node',format:'cjs',alias:{laya:path.join(laya,'src/layaAir')},loader:{'.vs':'text','.fs':'text','.glsl':'text'},logLevel:'silent'});
  const loaded=require(bundle),Probe=loaded.entry.AS3_APPLICATION_MODULES.find(row=>row[entry])[entry],probe=new Probe();
  try {assert.deepEqual(JSON.parse(JSON.stringify(probe.snapshot())),native.capture.state);}finally{probe.destroy(true);loaded.dispose();}

 }
 assert.deepEqual(...snapshots);
 completed=true;
});
