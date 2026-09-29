'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
test('typed local computed slots preserve native private and protected access and nominal assignments',t=>{
 const air=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA,ffdec=process.env.HARDENED_FIXTURE_FFDEC;assert.ok(air&&laya&&ffdec);
 const fixture=process.env.HARDENED_FIXTURE_SOURCE||path.join(laya,'tests/nativeFlashOracle/typed-instance-computed-slots');
 const native=JSON.parse(fs.readFileSync(path.join(fixture,'native-air.json')));
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'typed-instance-slots-')));let completed=false;t.after(()=>{if(completed)fs.rmSync(dir,{recursive:true,force:true});else console.error('Retained typed instance slot evidence: '+dir);});
 const scenarioBytes=fs.readFileSync(path.join(fixture,'scenario.json'));assert.equal(sha(scenarioBytes),native.scenarioSha256);const scenario=JSON.parse(scenarioBytes);assert.equal(scenario.steps.length,12);assert.deepEqual(scenario.steps.map(step=>step.id),native.capture.state.observations.map(row=>row.id));
 const source=path.join(dir,'source'),profile=path.join(dir,'profile');fs.mkdirSync(source);
 for(const [name,digest] of Object.entries(native.sourceFiles)){const bytes=fs.readFileSync(path.join(fixture,name));assert.equal(sha(bytes),digest);fs.mkdirSync(path.dirname(path.join(source,name)),{recursive:true});fs.writeFileSync(path.join(source,name),bytes);}
 const run=(cmd,args)=>{const r=cp.spawnSync(cmd,args,{cwd:root,encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stdout+r.stderr);};
 const make=(extras=[])=>run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','TypedInstanceComputedProbe','--air-sdk',air,'--laya',laya,'--ffdec-jar',ffdec,'--output',profile,...extras]);make();
 const snapshots=[];
 for(const name of ['first','second']){
  const output=path.join(dir,name);run(process.execPath,['bin/as3-frontend','transpile',source,output,'--source-census',path.join(profile,'census.json'),'--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(profile,'profile-lock.json')]);
  const manifest=JSON.parse(fs.readFileSync(path.join(output,'manifest.json')));assert.equal(manifest.files.length,Object.keys(native.sourceFiles).length);
  const typescript=[];
  for(const row of manifest.files){assert.equal(row.sourceSha256,native.sourceFiles[row.sourcePath]);typescript.push(row.typescriptPath);for(const helper of row.fileLocalOutputs||[])typescript.push('__as3_runtime/application/'+helper.modulePath);}
  typescript.push(manifest.applicationEntryPath);
  const code=typescript.map(p=>[p,fs.readFileSync(path.join(output,p),'utf8')]);snapshots.push([manifest.files,code]);
  const ts=require('typescript-4-9');for(const [p,text] of code)fs.writeFileSync(path.join(output,p.replace(/\.ts$/,'.js')),ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText);
  const entryPath=path.join(output,manifest.applicationEntryPath.replace(/\.ts$/,'.js'));
  // Generated application modules live inside the runtime package and use its self-reference exports.
  const entryRequire=require('node:module').createRequire(entryPath);assert.equal(fs.realpathSync(entryRequire.resolve('@laya/as3-runtime/AS3ObjectDispatch')),fs.realpathSync(path.join(output,'__as3_runtime/AS3Authority.generated.js')));
  const entry=entryRequire(entryPath);const Probe=entry.AS3_APPLICATION_MODULES.find(m=>m.TypedInstanceComputedProbe).TypedInstanceComputedProbe;const probe=new Probe();
  for(const step of scenario.steps){for(const call of step.calls)probe[call.method](...call.args);assert.deepEqual(probe.result,native.capture.state.observations.find(row=>row.id===step.id).result,step.id);}
 }
 assert.deepEqual(snapshots[0],snapshots[1]);
 const qualify=name=>run(process.execPath,['bin/as3-frontend','qualify',source,path.join(dir,name),'--source-census',path.join(profile,'census.json'),'--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(profile,'profile-lock.json')]);
 fs.writeFileSync(path.join(source,'NumericKey.as'),'package {public class NumericKey {private var value:int;public function run(key:int):* {return this[key];}}}');
 fs.writeFileSync(path.join(source,'StaticKey.as'),'package {public class StaticKey {public function run(key:String):* {return SlotOwner[key];}}}');
 fs.rmSync(profile,{recursive:true,force:true});make();qualify('negative');
 const rows=JSON.parse(fs.readFileSync(path.join(dir,'negative/manifest.json'))).files;
 for(const [name,code] of [['NumericKey','HARDENED_LOCAL_INSTANCE_KEY'],['StaticKey','HARDENED_INDEX_TARGET']]){const row=rows.find(row=>row.sourcePath===name+'.as');assert.equal(row.code,code,JSON.stringify(row));}
 for(const [name,digest] of Object.entries(native.sourceFiles))assert.equal(sha(fs.readFileSync(path.join(source,name))),digest);
 completed=true;
});
