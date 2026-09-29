'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),crypto=require('crypto'),assert=require('assert/strict'),test=require('node:test');
const root=path.resolve(__dirname,'../..'),laya=process.env.FROZEN_LAYA_ROOT||process.env.HARDENED_FIXTURE_LAYA,air=process.env.HARDENED_FIXTURE_AIR_SDK,ffdec=process.env.HARDENED_FIXTURE_FFDEC,sha=b=>crypto.createHash('sha256').update(b).digest('hex');
test('implicit Function fields inside source closures retain lexical lookup and argument ordering',{skip:!laya&&!air&&!ffdec},t=>{
 assert.ok(laya&&air&&ffdec);const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'function-field-lexical-')));let completed=false;t.after(()=>{if(completed)fs.rmSync(dir,{recursive:true,force:true});else console.error('Retained Function-field evidence: '+dir);});
 const fixture=process.env.HARDENED_FIXTURE_SOURCE||path.join(laya,'tests/nativeFlashOracle/function-field-lexical-explicit-super'),native=JSON.parse(fs.readFileSync(path.join(fixture,'native-air.json'))),name='FunctionFieldLexicalProbe.as',bytes=fs.readFileSync(path.join(fixture,name));assert.deepEqual(Object.keys(native.sourceFiles),[name]);assert.equal(sha(bytes),native.sourceFiles[name]);assert.equal(native.capture.state.observations.length,22);assert.equal(native.capture.state.ready,true);assert.equal(native.capture.state.failure,'');
 const source=path.join(dir,'source'),profile=path.join(dir,'profile');fs.mkdirSync(source);fs.writeFileSync(path.join(source,name),bytes);
 const run=(command,args)=>{const r=cp.spawnSync(command,args,{cwd:root,encoding:'utf8',timeout:180000});fs.appendFileSync(path.join(dir,'commands.log'),JSON.stringify([command,...args])+'\n'+r.stdout+r.stderr);assert.equal(r.status,0,r.stdout+r.stderr);};
 const make=()=>run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','FunctionFieldLexicalProbe','--air-sdk',air,'--laya',laya,'--ffdec-jar',ffdec,'--output',profile]);make();
 const compile=(operation,output)=>run(process.execPath,['bin/as3-frontend',operation,source,output,'--source-census',path.join(profile,'census.json'),'--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(profile,'profile-lock.json')]);
 const snapshots=[];
 for(const label of ['first','second']){
  const out=path.join(dir,label);compile('transpile',out);const manifest=JSON.parse(fs.readFileSync(path.join(out,'manifest.json')));assert.equal(manifest.files.length,1);assert.equal(manifest.files[0].sourceSha256,sha(bytes));const code=fs.readFileSync(path.join(out,manifest.files[0].typescriptPath),'utf8');snapshots.push(code);assert.match(code,/__as3LexicalReceiver1/);assert.match(code,/__as3FunctionInvoke\(/);
  fs.mkdirSync(path.join(out,'node_modules/@laya'),{recursive:true});fs.symlinkSync(path.join(out,'__as3_runtime'),path.join(out,'node_modules/@laya/as3-runtime'),'dir');
  const bundle=path.join(out,'runner.cjs');require('esbuild').buildSync({stdin:{contents:`
globalThis.window ||= globalThis;globalThis.document ||= {createElement:()=>({style:{},getContext:()=>null}),documentElement:{style:{}}};
const {LayaGL}=require('laya/laya/layagl/LayaGL');
LayaGL.render2DRenderPassFactory=new (require('laya/laya/RenderDriver/NoRenderDriver/2DRenderPass/NoRender2DProcess').NoRender2DProcess)();
LayaGL.renderDeviceFactory=new (require('laya/laya/RenderDriver/NoRenderDriver/DriverDevice/NoRenderDeviceFactory').NoRenderDeviceFactory)();
const {ILaya}=require('laya/ILaya');ILaya.stage={_graphicUpdateList:new Set(),_tranMatrixUpdateList:new Set(),_componentDriver:{_toDestroys:new Set()}};ILaya.timer={delta:0};
require('laya/laya/ModuleDef');exports.entry=require('./__as3_runtime/ApplicationEntry.generated.js');`,resolveDir:out,sourcefile:'runner.js'},outfile:bundle,bundle:true,platform:'node',format:'cjs',alias:{laya:path.join(laya,'src/layaAir')},loader:{'.vs':'text','.fs':'text','.glsl':'text'},logLevel:'silent'});
  const loaded=require(bundle),Probe=loaded.entry.AS3_APPLICATION_MODULES.find(row=>row.FunctionFieldLexicalProbe).FunctionFieldLexicalProbe;const probe=new Probe();assert.deepEqual(JSON.parse(JSON.stringify(probe.snapshot())),native.capture.state);
 }
 assert.deepEqual(...snapshots);
 const negatives={ExplicitThis:'private var callback:Function; public function make():Function{return function():void{this.callback();};}',Accessor:'private function get callback():Function{return null;} public function make():Function{return function():void{callback();};}',Static:'private static var callback:Function; public static function make():Function{return function():void{callback();};}',Inherited:'public function make():Function{return function():void{callback();};}'};
 fs.writeFileSync(path.join(source,'FieldBase.as'),'package {public class FieldBase {protected var callback:Function;}}');
 for(const [n,body] of Object.entries(negatives))fs.writeFileSync(path.join(source,n+'.as'),`package {public class ${n}${n==='Inherited'?' extends FieldBase':''} {public function ${n}(){${n==='Inherited'?'super();':''}} ${body}}}`);
 fs.rmSync(profile,{recursive:true,force:true});make();compile('qualify',path.join(dir,'negative'));const rows=JSON.parse(fs.readFileSync(path.join(dir,'negative/manifest.json'))).files;
 for(const n of Object.keys(negatives)){const row=rows.find(row=>row.sourcePath===n+'.as');assert.equal(row.status,'held',JSON.stringify(row));assert.equal(row.code,n==='Static'?'HARDENED_CURRENT_STATIC_CALL':'HARDENED_LAMBDA_THIS',JSON.stringify(row));}
 assert.equal(sha(fs.readFileSync(path.join(source,name))),sha(bytes));completed=true;
});
