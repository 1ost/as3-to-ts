"use strict";
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),crypto=require('crypto'),assert=require('assert/strict'),test=require('node:test');
const root=path.resolve(__dirname,'../..'),laya=process.env.FROZEN_LAYA_ROOT||process.env.HARDENED_FIXTURE_LAYA,air=process.env.HARDENED_FIXTURE_AIR_SDK,ffdec=process.env.HARDENED_FIXTURE_FFDEC,sha=b=>crypto.createHash('sha256').update(b).digest('hex');
test('original class includes retain namespace identity and native static values',{skip:!laya&&!air&&!ffdec},t=>{
 assert.ok(laya&&air&&ffdec);const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'class-namespace-includes-')));let completed=false;t.after(()=>{if(completed)fs.rmSync(dir,{recursive:true,force:true});else console.error('Retained include evidence: '+dir);});
 const fixture=process.env.HARDENED_FIXTURE_SOURCE||path.join(laya,'tests/nativeFlashOracle/class-namespace-includes'),native=JSON.parse(fs.readFileSync(path.join(fixture,'native-air.json')));
 const source=path.join(dir,'source'),selected=path.join(dir,'selected'),profile=path.join(dir,'profile');fs.mkdirSync(source);fs.mkdirSync(selected);
 assert.deepEqual(native.invocation.constructorArgs,[]);assert.equal(native.invocation.snapshotMethod,'snapshot');assert.equal(native.invocation.scenario,null);assert.equal(native.invocation.hostSha256,native.receipt.artifacts[native.invocation.hostArtifact]);assert.equal(native.invocation.entry,'IncludeNamespaceProbe');

 for(const [name,hash] of Object.entries(native.sourceFiles)){const bytes=fs.readFileSync(path.join(fixture,name));assert.equal(sha(bytes),hash);fs.mkdirSync(path.dirname(path.join(source,name)),{recursive:true});fs.writeFileSync(path.join(source,name),bytes);if(name!=='fixture/shared_internal.as'){fs.mkdirSync(path.dirname(path.join(selected,name)),{recursive:true});fs.writeFileSync(path.join(selected,name),bytes);}}
 const run=(command,args)=>{const r=cp.spawnSync(command,args,{cwd:root,encoding:'utf8',timeout:180000});fs.appendFileSync(path.join(dir,'commands.log'),JSON.stringify([command,...args])+'\n'+r.stdout+r.stderr);assert.equal(r.status,0,r.stdout+r.stderr);};
 run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','IncludeNamespaceProbe','--source-includes','--air-sdk',air,'--laya',laya,'--ffdec-jar',ffdec,'--output',profile]);
 const compile=(operation,output)=>run(process.execPath,['bin/as3-frontend',operation,selected,output,'--source-census',path.join(profile,'census.json'),'--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(profile,'profile-lock.json')]);
 const snapshots=[];
 for(const label of ['first','second']){
  const out=path.join(dir,label);compile('transpile',out);const manifest=JSON.parse(fs.readFileSync(path.join(out,'manifest.json')));assert.equal(manifest.files.length,3);assert.equal(manifest.includedFragments.length,4);for(const row of [...manifest.files,...manifest.includedFragments])assert.equal(row.sourceSha256,native.sourceFiles[row.sourcePath]);snapshots.push(manifest.files.map(row=>fs.readFileSync(path.join(out,row.typescriptPath),'utf8')));
  fs.mkdirSync(path.join(out,'node_modules/@laya'),{recursive:true});fs.symlinkSync(path.join(out,'__as3_runtime'),path.join(out,'node_modules/@laya/as3-runtime'),'dir');
  const bundle=path.join(out,'runner.cjs');require('esbuild').buildSync({stdin:{contents:`
globalThis.window ||= globalThis;globalThis.document ||= {createElement:()=>({style:{},getContext:()=>null}),documentElement:{style:{}}};
const {LayaGL}=require('laya/laya/layagl/LayaGL');
LayaGL.render2DRenderPassFactory=new (require('laya/laya/RenderDriver/NoRenderDriver/2DRenderPass/NoRender2DProcess').NoRender2DProcess)();
LayaGL.renderDeviceFactory=new (require('laya/laya/RenderDriver/NoRenderDriver/DriverDevice/NoRenderDeviceFactory').NoRenderDeviceFactory)();
const {ILaya}=require('laya/ILaya');ILaya.stage={_graphicUpdateList:new Set(),_tranMatrixUpdateList:new Set(),_componentDriver:{_toDestroys:new Set()}};ILaya.timer={delta:0};
require('laya/laya/ModuleDef');exports.entry=require('./__as3_runtime/ApplicationEntry.generated.js');`,resolveDir:out,sourcefile:'runner.js'},outfile:bundle,bundle:true,platform:'node',format:'cjs',alias:{laya:path.join(laya,'src/layaAir')},loader:{'.vs':'text','.fs':'text','.glsl':'text'},logLevel:'silent'});
  const loaded=require(bundle),Probe=loaded.entry.AS3_APPLICATION_MODULES.find(row=>row.IncludeNamespaceProbe).IncludeNamespaceProbe;const probe=new Probe();assert.deepEqual(JSON.parse(JSON.stringify(probe.snapshot())),native.capture.state);
 }
 assert.deepEqual(...snapshots);
 // A distinct URI with the same imported simple name must not alias the original field's namespace.
 const negatives={
  'other/shared_internal.as':'package other { public namespace shared_internal = "urn:other-native-include"; }',
  'WrongNamespaceProbe.as':'package { import owners.first.FirstOwner; import other.shared_internal; public class WrongNamespaceProbe { public static function value():String { return FirstOwner.shared_internal::VERSION; } } }'
 };
 for(const [name,text] of Object.entries(negatives)){fs.mkdirSync(path.dirname(path.join(source,name)),{recursive:true});fs.writeFileSync(path.join(source,name),text);}
 fs.writeFileSync(path.join(selected,'WrongNamespaceProbe.as'),negatives['WrongNamespaceProbe.as']);
 fs.rmSync(profile,{recursive:true,force:true});run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','IncludeNamespaceProbe','--source-includes','--air-sdk',air,'--laya',laya,'--ffdec-jar',ffdec,'--output',profile]);
 compile('qualify',path.join(dir,'wrong-namespace'));const wrong=JSON.parse(fs.readFileSync(path.join(dir,'wrong-namespace/manifest.json'))).files.find(row=>row.sourcePath==='WrongNamespaceProbe.as');assert.equal(wrong.code,'HARDENED_NAMESPACE_MEMBER_IDENTITY');

 // Unlisted ordinary source retains its existing source-authority hold; authenticated fragments alone are excluded.
 fs.writeFileSync(path.join(selected,'Unknown.as'),'package { public class Unknown { public function Unknown(){} } }');compile('qualify',path.join(dir,'unknown'));
 const unknown=JSON.parse(fs.readFileSync(path.join(dir,'unknown/manifest.json'))).files.find(row=>row.sourcePath==='Unknown.as');assert.equal(unknown.code,'HARDENED_APPLICATION_SOURCE_IDENTITY');
 for(const [name,hash] of Object.entries(native.sourceFiles))assert.equal(sha(fs.readFileSync(path.join(source,name))),hash);
 completed=true;
});

test('namespace-qualified static reads ignore local and parameter field-name shadows',{skip:!laya&&!air&&!ffdec},t=>{
 assert.ok(laya&&air&&ffdec);const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'namespace-static-shadow-')));let completed=false;t.after(()=>{if(completed)fs.rmSync(dir,{recursive:true,force:true});else console.error('Retained include evidence: '+dir);});
 const fixture=process.env.HARDENED_NAMESPACE_SHADOW_FIXTURE_SOURCE||path.join(laya,'tests/nativeFlashOracle/namespace-static-shadow'),native=JSON.parse(fs.readFileSync(path.join(fixture,'native-air.json')));
 const source=path.join(dir,'source'),selected=path.join(dir,'selected'),profile=path.join(dir,'profile');fs.mkdirSync(source);fs.mkdirSync(selected);
 assert.deepEqual(native.invocation.constructorArgs,[]);assert.equal(native.invocation.snapshotMethod,'snapshot');assert.equal(native.invocation.scenario,null);assert.equal(native.invocation.hostSha256,native.receipt.artifacts[native.invocation.hostArtifact]);assert.equal(native.invocation.entry,'NamespaceShadowProbe');

 for(const [name,hash] of Object.entries(native.sourceFiles)){const bytes=fs.readFileSync(path.join(fixture,name));assert.equal(sha(bytes),hash);fs.mkdirSync(path.dirname(path.join(source,name)),{recursive:true});fs.writeFileSync(path.join(source,name),bytes);if(name!=='fixture/shared_internal.as'){fs.mkdirSync(path.dirname(path.join(selected,name)),{recursive:true});fs.writeFileSync(path.join(selected,name),bytes);}}
 const run=(command,args)=>{const r=cp.spawnSync(command,args,{cwd:root,encoding:'utf8',timeout:180000});fs.appendFileSync(path.join(dir,'commands.log'),JSON.stringify([command,...args])+'\n'+r.stdout+r.stderr);assert.equal(r.status,0,r.stdout+r.stderr);};
 run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','NamespaceShadowProbe','--source-includes','--air-sdk',air,'--laya',laya,'--ffdec-jar',ffdec,'--output',profile]);
 const compile=(operation,output)=>run(process.execPath,['bin/as3-frontend',operation,selected,output,'--source-census',path.join(profile,'census.json'),'--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(profile,'profile-lock.json')]);
 const snapshots=[];
 for(const label of ['first','second']){
  const out=path.join(dir,label);compile('transpile',out);const manifest=JSON.parse(fs.readFileSync(path.join(out,'manifest.json')));assert.equal(manifest.files.length,2);assert.equal(manifest.includedFragments.length,1);for(const row of [...manifest.files,...manifest.includedFragments])assert.equal(row.sourceSha256,native.sourceFiles[row.sourcePath]);snapshots.push(manifest.files.map(row=>fs.readFileSync(path.join(out,row.typescriptPath),'utf8')));
  fs.mkdirSync(path.join(out,'node_modules/@laya'),{recursive:true});fs.symlinkSync(path.join(out,'__as3_runtime'),path.join(out,'node_modules/@laya/as3-runtime'),'dir');
  const bundle=path.join(out,'runner.cjs');require('esbuild').buildSync({stdin:{contents:`
globalThis.window ||= globalThis;globalThis.document ||= {createElement:()=>({style:{},getContext:()=>null}),documentElement:{style:{}}};
const {LayaGL}=require('laya/laya/layagl/LayaGL');
LayaGL.render2DRenderPassFactory=new (require('laya/laya/RenderDriver/NoRenderDriver/2DRenderPass/NoRender2DProcess').NoRender2DProcess)();
LayaGL.renderDeviceFactory=new (require('laya/laya/RenderDriver/NoRenderDriver/DriverDevice/NoRenderDeviceFactory').NoRenderDeviceFactory)();
const {ILaya}=require('laya/ILaya');ILaya.stage={_graphicUpdateList:new Set(),_tranMatrixUpdateList:new Set(),_componentDriver:{_toDestroys:new Set()}};ILaya.timer={delta:0};
require('laya/laya/ModuleDef');exports.entry=require('./__as3_runtime/ApplicationEntry.generated.js');`,resolveDir:out,sourcefile:'runner.js'},outfile:bundle,bundle:true,platform:'node',format:'cjs',alias:{laya:path.join(laya,'src/layaAir')},loader:{'.vs':'text','.fs':'text','.glsl':'text'},logLevel:'silent'});
  const loaded=require(bundle),Probe=loaded.entry.AS3_APPLICATION_MODULES.find(row=>row.NamespaceShadowProbe).NamespaceShadowProbe;const probe=new Probe();assert.deepEqual(JSON.parse(JSON.stringify(probe.snapshot())),native.capture.state);
 }
 assert.deepEqual(...snapshots);
 // Unlisted ordinary source retains its existing source-authority hold; authenticated fragments alone are excluded.
 fs.writeFileSync(path.join(selected,'Unknown.as'),'package { public class Unknown { public function Unknown(){} } }');compile('qualify',path.join(dir,'unknown'));
 const unknown=JSON.parse(fs.readFileSync(path.join(dir,'unknown/manifest.json'))).files.find(row=>row.sourcePath==='Unknown.as');assert.equal(unknown.code,'HARDENED_APPLICATION_SOURCE_IDENTITY');
 for(const [name,hash] of Object.entries(native.sourceFiles))assert.equal(sha(fs.readFileSync(path.join(source,name))),hash);
 completed=true;
});
