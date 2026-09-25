'use strict';
const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const air=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA,ffdec=process.env.HARDENED_FIXTURE_FFDEC;
test('Array.filter retains native fixture bytes, deterministic output and unsupported call holds',t=>{
 assert.ok(air&&laya&&ffdec,'AIR, Laya and FFDec fixture paths required');
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'array-filter-source-controls-')));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const source=path.join(dir,'source'),profile=path.join(dir,'profile'),fixture=process.env.HARDENED_FIXTURE_SOURCE || path.join(laya,'tests/nativeFlashOracle/array-filter-bound-callback');fs.mkdirSync(source);
 const retained=JSON.parse(fs.readFileSync(path.join(fixture,'native-air.json'))),bytes=fs.readFileSync(path.join(fixture,'ArrayFilterBoundProbe.as'));
 assert.equal(sha(bytes),retained.sourceSha256);assert.equal(sha(fs.readFileSync(path.join(fixture,'scenario.json'))),retained.scenarioSha256);
 fs.writeFileSync(path.join(source,'ArrayFilterBoundProbe.as'),bytes);
 const run=(command,args)=>{const r=cp.spawnSync(command,args,{cwd:root,encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stdout+r.stderr);};
 const makeProfile=()=>run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','ArrayFilterBoundProbe','--air-sdk',air,'--laya',laya,'--ffdec-jar',ffdec,'--output',profile]);
 const compile=(operation,out)=>run(process.execPath,['bin/as3-frontend',operation,source,path.join(dir,out),'--source-census',path.join(profile,'census.json'),'--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(profile,'profile-lock.json')]);
 makeProfile();const snapshots=[];
 for(const out of ['first','second']){
  compile('transpile',out);const rows=JSON.parse(fs.readFileSync(path.join(dir,out,'manifest.json'))).files;
  assert.equal(rows.length,1);assert.equal(rows[0].sourceSha256,retained.sourceSha256);
  const code=fs.readFileSync(path.join(dir,out,'__as3_runtime/application/ArrayFilterBoundProbe.ts'),'utf8');
  assert.match(code,/__as3ArrayCall\([\s\S]*?"filter"/);
  const output=path.join(dir,out),manifest=JSON.parse(fs.readFileSync(path.join(output,'manifest.json')));
  const paths=rows.map(row=>row.typescriptPath).concat(manifest.applicationEntryPath);
  const emitted=paths.map(p=>[p,fs.readFileSync(path.join(output,p),'utf8')]);snapshots.push([rows,emitted]);
  const ts=require('typescript-4-9');
  for(const [p,text] of emitted)fs.writeFileSync(path.join(output,p.replace(/\.ts$/,'.js')),ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText);
  const entry=require(path.join(output,manifest.applicationEntryPath.replace(/\.ts$/,'.js')));
  const Probe=entry.AS3_APPLICATION_MODULES.find(m=>m.ArrayFilterBoundProbe).ArrayFilterBoundProbe;
  const probe=new Probe(),scenario=JSON.parse(fs.readFileSync(path.join(fixture,'scenario.json')));
  assert.equal(scenario.steps.length,20);assert.equal(retained.capture.state.observations.length,20);
  for(const step of scenario.steps){
   for(const call of step.calls)probe[call.method](...call.args);
   const expected=retained.capture.state.observations.find(row=>row.id===step.id);assert.ok(expected,step.id);
   assert.deepEqual(probe.result,expected.result,step.id);
  }
 }
 assert.deepEqual(snapshots[0],snapshots[1]);assert.equal(sha(fs.readFileSync(path.join(source,'ArrayFilterBoundProbe.as'))),retained.sourceSha256);
 fs.writeFileSync(path.join(source,'NoArgument.as'),'package {public class NoArgument {public function run(value:Array):Array {return value.filter();}}}');
 fs.writeFileSync(path.join(source,'TooMany.as'),'package {public class TooMany {public function run(value:Array):Array {return value.filter(1,0,2);}}}');
 fs.writeFileSync(path.join(source,'Subclass.as'),'package {public dynamic class Subclass extends Array {public function Subclass(){super();} public function run():Array {return this.filter(1);}}}');
 const fullFixture=process.env.HARDENED_FULL_FIXTURE_SOURCE || path.join(laya,'tests/nativeFlashOracle/array-filter-source-controls');
 const fullBytes=fs.readFileSync(path.join(fullFixture,'ArrayFilterSourceProbe.as'));
 const fullNative=JSON.parse(fs.readFileSync(path.join(fullFixture,'native-air.json')));
 assert.equal(sha(fullBytes),fullNative.sourceSha256);
 fs.writeFileSync(path.join(source,'ArrayFilterSourceProbe.as'),fullBytes);
 fs.rmSync(profile,{recursive:true,force:true});makeProfile();compile('qualify','negative');
 const rows=JSON.parse(fs.readFileSync(path.join(dir,'negative/manifest.json'))).files;
 const dynamicThis=rows.find(row=>row.sourcePath==='ArrayFilterSourceProbe.as');
 assert.equal(dynamicThis.code,'HARDENED_LAMBDA_THIS',JSON.stringify(dynamicThis));
 for(const name of ['NoArgument','TooMany','Subclass']){
  const row=rows.find(row=>row.sourcePath===name+'.as');assert.ok(row,name);assert.equal(row.status,'held',JSON.stringify(row));
  assert.match(row.code,name==='Subclass'?/^HARDENED_(MEMBER_TARGET|MEMBER_UNMAPPED|ARRAY_FILTER)$/:/^HARDENED_ARRAY_CALL$/,JSON.stringify(row));
  if(name==='Subclass') assert.match(row.message,/filter/,JSON.stringify(row));
 }
});
