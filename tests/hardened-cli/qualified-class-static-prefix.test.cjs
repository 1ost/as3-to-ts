'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
test('qualified class prefixes preserve native imported-package precedence and exact dependency authority',t=>{
 const air=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA,ffdec=process.env.HARDENED_FIXTURE_FFDEC;assert.ok(air&&laya&&ffdec);
 const fixture=process.env.HARDENED_FIXTURE_SOURCE||path.join(laya,'tests/nativeFlashOracle/qualified-class-static-prefix');
 const native=JSON.parse(fs.readFileSync(path.join(fixture,'native-air.json')));
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'qualified-static-')));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const source=path.join(dir,'source'),profile=path.join(dir,'profile');fs.mkdirSync(source);
 for(const [name,digest] of Object.entries(native.sourceFiles)){const bytes=fs.readFileSync(path.join(fixture,name));assert.equal(sha(bytes),digest);fs.mkdirSync(path.dirname(path.join(source,name)),{recursive:true});fs.writeFileSync(path.join(source,name),bytes);}
 const run=(cmd,args)=>{const r=cp.spawnSync(cmd,args,{cwd:root,encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stdout+r.stderr);};
 const make=(extras=[])=>run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','QualifiedClassStaticProbe','--air-sdk',air,'--laya',laya,'--ffdec-jar',ffdec,'--output',profile,...extras]);make();
 const snapshots=[];
 for(const name of ['first','second']){
  const output=path.join(dir,name);run(process.execPath,['bin/as3-frontend','transpile',source,output,'--source-census',path.join(profile,'census.json'),'--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(profile,'profile-lock.json')]);
  const manifest=JSON.parse(fs.readFileSync(path.join(output,'manifest.json')));assert.equal(manifest.files.length,Object.keys(native.sourceFiles).length);
  const typescript=[];
  for(const row of manifest.files){assert.equal(row.sourceSha256,native.sourceFiles[row.sourcePath]);typescript.push(row.typescriptPath);for(const helper of row.fileLocalOutputs||[])typescript.push('__as3_runtime/application/'+helper.modulePath);}
  typescript.push(manifest.applicationEntryPath);
  const code=typescript.map(p=>[p,fs.readFileSync(path.join(output,p),'utf8')]);snapshots.push([manifest.files,code]);
  const ts=require('typescript-4-9');for(const [p,text] of code)fs.writeFileSync(path.join(output,p.replace(/\.ts$/,'.js')),ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText);
  const entry=require(path.join(output,manifest.applicationEntryPath.replace(/\.ts$/,'.js')));const Probe=entry.AS3_APPLICATION_MODULES.find(m=>m.QualifiedClassStaticProbe).QualifiedClassStaticProbe;const probe=new Probe();probe.exercise();assert.deepEqual(probe.result,native.capture.state.observations[0].result);
 }
 assert.deepEqual(snapshots[0],snapshots[1]);
 const qualify=name=>run(process.execPath,['bin/as3-frontend','qualify',source,path.join(dir,name),'--source-census',path.join(profile,'census.json'),'--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(profile,'profile-lock.json')]);
 fs.rmSync(profile,{recursive:true,force:true});make(['--omit-direct-edge','QualifiedClassStaticProbe:sample.Factory']);qualify('missing-edge');
 const held=JSON.parse(fs.readFileSync(path.join(dir,'missing-edge/manifest.json'))).files.find(row=>row.sourcePath==='QualifiedClassStaticProbe.as');
 assert.equal(held.code,'HARDENED_LOCAL_IMPORT_EDGE',JSON.stringify(held));
 fs.writeFileSync(path.join(source,'Ambiguous.as'),'package { import sample.*; import sample.deep.*; public class Ambiguous { public function run():void {var value:Factory;} } }');
 fs.rmSync(profile,{recursive:true,force:true});make();qualify('ambiguous');
 const ambiguous=JSON.parse(fs.readFileSync(path.join(dir,'ambiguous/manifest.json'))).files.find(row=>row.sourcePath==='Ambiguous.as');
 assert.equal(ambiguous.code,'HARDENED_IMPORT_COLLISION',JSON.stringify(ambiguous));
 for(const [name,digest] of Object.entries(native.sourceFiles))assert.equal(sha(fs.readFileSync(path.join(source,name))),digest);
});
