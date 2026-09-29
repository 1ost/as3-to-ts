'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),os=require('os'),crypto=require('crypto'),assert=require('assert/strict'),test=require('node:test');
const root=path.resolve(__dirname,'../..'),laya=process.env.FROZEN_LAYA_ROOT||process.env.HARDENED_FIXTURE_LAYA,air=process.env.HARDENED_FIXTURE_AIR_SDK,ffdec=process.env.HARDENED_FIXTURE_FFDEC,sha=b=>crypto.createHash('sha256').update(b).digest('hex');
test('generated Class computed static calls match native identity, initialization, visibility and argument order',{skip:!laya&&!air&&!ffdec},t=>{
 assert.ok(laya&&air&&ffdec);const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'class-static-call-')));let completed=false;t.after(()=>{if(completed)fs.rmSync(dir,{recursive:true,force:true});else console.error('Retained Class call evidence: '+dir);});
 const fixture=process.env.HARDENED_FIXTURE_SOURCE||path.join(laya,'tests/nativeFlashOracle/class-computed-static-call'),native=JSON.parse(fs.readFileSync(path.join(fixture,'native-air.json'))),scenarioBytes=fs.readFileSync(path.join(fixture,'scenario.json'));assert.equal(sha(scenarioBytes),native.scenarioSha256);const scenario=JSON.parse(scenarioBytes);assert.equal(scenario.steps.length,16);assert.deepEqual(scenario.steps.map(row=>row.id),native.capture.state.observations.map(row=>row.id));
 const source=path.join(dir,'source'),profile=path.join(dir,'profile'),target=path.join(laya,'docTool/architecture/authored-content-capabilities.json');fs.mkdirSync(source);
 for(const [name,digest] of Object.entries(native.sourceFiles)){const bytes=fs.readFileSync(path.join(fixture,name));assert.equal(sha(bytes),digest);fs.mkdirSync(path.dirname(path.join(source,name)),{recursive:true});fs.writeFileSync(path.join(source,name),bytes);}
 const run=(command,args)=>{const r=cp.spawnSync(command,args,{cwd:root,encoding:'utf8',timeout:180000});fs.appendFileSync(path.join(dir,'commands.log'),JSON.stringify([command,...args])+'\n'+r.stdout+r.stderr);assert.equal(r.status,0,r.stdout+r.stderr);};
 const make=()=>run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','ClassComputedStaticCallProbe','--air-sdk',air,'--laya',laya,'--ffdec-jar',ffdec,'--output',profile]);make();
 const compile=(op,out)=>run(process.execPath,['bin/as3-frontend',op,source,out,'--source-census',path.join(profile,'census.json'),'--target-capabilities',target,'--profile-lock',path.join(profile,'profile-lock.json')]);
 const snapshots=[];
 for(const name of ['first','second']){
  const out=path.join(dir,name);compile('transpile',out);const manifest=JSON.parse(fs.readFileSync(path.join(out,'manifest.json')));assert.equal(manifest.files.length,Object.keys(native.sourceFiles).length);
  const code=manifest.files.map(row=>{assert.equal(row.sourceSha256,native.sourceFiles[row.sourcePath]);return[row.sourcePath,fs.readFileSync(path.join(out,row.typescriptPath),'utf8')];});snapshots.push(code);
  assert.match(code.find(row=>row[0]==='ClassComputedStaticCallProbe.as')[1],/__as3PrepareClassCall\(/);
  fs.mkdirSync(path.join(out,'node_modules/@laya'),{recursive:true});fs.symlinkSync(path.join(out,'__as3_runtime'),path.join(out,'node_modules/@laya/as3-runtime'),'dir');
  const bundle=path.join(out,'runner.cjs');require('esbuild').buildSync({stdin:{contents:'exports.entry=require("./__as3_runtime/ApplicationEntry.generated.js");',resolveDir:out,sourcefile:'runner.js'},outfile:bundle,bundle:true,platform:'node',format:'cjs',alias:{laya:path.join(laya,'src/layaAir')},loader:{'.vs':'text','.fs':'text','.glsl':'text'},logLevel:'silent'});
  const loaded=require(bundle),Probe=loaded.entry.AS3_APPLICATION_MODULES.find(row=>row.ClassComputedStaticCallProbe).ClassComputedStaticCallProbe,probe=new Probe();
  for(const step of scenario.steps){for(const call of step.calls)probe[call.method](...call.args);assert.deepEqual(probe.result,native.capture.state.observations.find(row=>row.id===step.id).result,step.id);}
 }
 assert.deepEqual(...snapshots);
 const negative={NumericKey:'public function run(owner:Class,key:int):* {return owner[key]();}',UnknownKey:'public function run(owner:Class,key:*):* {return owner[key]();}'};
 for(const [name,body] of Object.entries(negative))fs.writeFileSync(path.join(source,name+'.as'),`package {public class ${name} {${body}}}`);
 fs.writeFileSync(path.join(source,'ConflictingInternal.as'),'package {public class ConflictingInternal {internal public static function run():void {}}}');
 fs.rmSync(profile,{recursive:true,force:true});make();compile('qualify',path.join(dir,'negative'));const rows=JSON.parse(fs.readFileSync(path.join(dir,'negative/manifest.json'))).files;
 for(const name of Object.keys(negative)){const row=rows.find(row=>row.sourcePath===name+'.as');assert.equal(row.code,'HARDENED_CLASS_CALL_KEY',JSON.stringify(row));}
 const conflict=rows.find(row=>row.sourcePath==='ConflictingInternal.as');assert.equal(conflict.code,'HARDENED_MODIFIER_ACCESS',JSON.stringify(conflict));
 for(const [name,digest] of Object.entries(native.sourceFiles))assert.equal(sha(fs.readFileSync(path.join(source,name))),digest);
 completed=true;
});
