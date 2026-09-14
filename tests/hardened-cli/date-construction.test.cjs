'use strict';
const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const canonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
test('Date native proof gates original zeroarg allocation, methods, property and identity',t=>{
 const air=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA,ffdec=process.env.HARDENED_FIXTURE_FFDEC;assert.ok(air&&laya&&ffdec);
 const fixture=process.env.HARDENED_FIXTURE_SOURCE||path.join(laya,'tests/nativeFlashOracle/date-construction'),retained=JSON.parse(fs.readFileSync(path.join(fixture,'native-air.json')));
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'date-cli-')));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const source=path.join(dir,'source'),profile=path.join(dir,'profile');fs.mkdirSync(source);
 const name='DateConstructionProbe.as',bytes=fs.readFileSync(path.join(fixture,name));assert.equal(sha(bytes),retained.sourceFiles[name]);fs.writeFileSync(path.join(source,name),bytes);
 const nullFixture=process.env.HARDENED_DATE_NULL_FIXTURE||path.join(laya,'tests/nativeFlashOracle/date-null-receiver');
 const nullEvidence=JSON.parse(fs.readFileSync(path.join(nullFixture,'native-air.json'))),nullName='DateNullReceiverProbe.as',nullBytes=fs.readFileSync(path.join(nullFixture,nullName));
 assert.equal(sha(nullBytes),nullEvidence.sourceFiles[nullName]);assert.equal(sha(fs.readFileSync(path.join(nullFixture,'scenario.json'))),nullEvidence.scenarioSha256);fs.writeFileSync(path.join(source,nullName),nullBytes);
 const run=(cmd,args)=>{const r=cp.spawnSync(cmd,args,{cwd:root,encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stdout+r.stderr);};
 const make=()=>run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','DateConstructionProbe','--air-sdk',air,'--laya',laya,'--ffdec-jar',ffdec,'--native-date','--output',profile]);
 const args=(op,out)=>['bin/as3-frontend',op,source,path.join(dir,out),'--source-census',path.join(profile,'census.json'),'--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(profile,'profile-lock.json')];
 const compile=(op,out)=>run(process.execPath,args(op,out));make();const snapshots=[];
 const authorityBundle=path.join(dir,'date-authority.cjs');require('esbuild').buildSync({stdin:{contents:'export * from "./src/hardened/native-date-authority"; export {loadSourceMemberAuthority} from "./src/hardened/source-member-authority";',resolveDir:root},outfile:authorityBundle,bundle:true,platform:'node',format:'cjs',logLevel:'silent'});
 const api=require(authorityBundle),profileLock=JSON.parse(fs.readFileSync(path.join(profile,'profile-lock.json')));
 const readProfile=name=>fs.readFileSync(path.join(profile,profileLock.files[name].path),'utf8');
 const sourceJson=readProfile('sourceMemberAuthority'),loaded=api.loadSourceMemberAuthority(sourceJson,sha(sourceJson),sha);
 assert.equal(api.hasNativeDateAuthority(loaded),false);assert.equal(api.hasNativeDateAuthority({...loaded}),false);
 assert.throws(()=>api.verifyNativeDateAuthority({...loaded},profile,readProfile('nativeDate'),readProfile('sourceManifest')));
 api.verifyNativeDateAuthority(loaded,profile,readProfile('nativeDate'),readProfile('sourceManifest'));assert.equal(api.hasNativeDateAuthority(loaded),true);assert.equal(api.hasNativeDateAuthority({...loaded}),false);

 for(const out of ['first','second']){
  compile('transpile',out);const rows=JSON.parse(fs.readFileSync(path.join(dir,out,'manifest.json'))).files;assert.equal(rows.find(row=>row.sourcePath===name).sourceSha256,sha(bytes));assert.equal(rows.find(row=>row.sourcePath===nullName).sourceSha256,sha(nullBytes));
  const code=fs.readFileSync(path.join(dir,out,'__as3_runtime/application/DateConstructionProbe.ts'),'utf8');assert.match(code,/new AS3Date\(\)/);const nullCode=fs.readFileSync(path.join(dir,out,'__as3_runtime/application/DateNullReceiverProbe.ts'),'utf8');assert.match(nullCode,/__as3DateReceiver\(/);snapshots.push([rows,code,nullCode]);
  const runtime=path.join(dir,out,'__as3_runtime');assert.ok(JSON.parse(fs.readFileSync(path.join(runtime,'package.json'))).exports['./AS3Date']);
  const ts=require('typescript-4-9'),Module=require('node:module');
  const emittedManifest=JSON.parse(fs.readFileSync(path.join(dir,out,'manifest.json')));
  const entryPath=path.join(dir,out,emittedManifest.applicationEntryPath);
  const entryCode=fs.readFileSync(entryPath,'utf8');assert.equal(sha(entryCode),emittedManifest.applicationEntrySha256);
  // Preserve generated module paths and load its authority-first entry. A copied
  // class at another path has a different identity and must not be constructible.
  for(const [sourcePath,text] of [[path.join(runtime,'application/DateConstructionProbe.ts'),code],[path.join(runtime,'application/DateNullReceiverProbe.ts'),nullCode],[entryPath,entryCode]])
   fs.writeFileSync(sourcePath.replace(/\.ts$/,'.js'),ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText);
  const outputEntry=entryPath.replace(/\.ts$/,'.js'),requireGenerated=Module.createRequire(outputEntry),application=requireGenerated(outputEntry);
  assert.match(application.AS3_APPLICATION_TYPE_AUTHORITY_SHA256,/^[a-f0-9]{64}$/);
  const Probe=application.AS3_APPLICATION_MODULES.find(module=>module.DateConstructionProbe).DateConstructionProbe;
  assert.equal(Probe,requireGenerated('./application/DateConstructionProbe.js').DateConstructionProbe);
  const probe=new Probe();probe.exercise();
  assert.deepEqual(probe.result,retained.captures.construction.capture.state.observations[0].result);
  const NullProbe=application.AS3_APPLICATION_MODULES.find(module=>module.DateNullReceiverProbe).DateNullReceiverProbe;
  const nullProbe=new NullProbe();
  for(const [mode,observation] of nullEvidence.capture.state.observations.entries()){nullProbe.exercise(mode);assert.deepEqual(nullProbe.result,observation.result,observation.id);}
 }
 assert.deepEqual(snapshots[0],snapshots[1]);
 const lockFile=path.join(profile,'profile-lock.json'),original=fs.readFileSync(lockFile),lock=JSON.parse(original);
 delete lock.files.nativeDate;fs.writeFileSync(lockFile,canonical(lock)+'\n');compile('qualify','absent');const absent=JSON.parse(fs.readFileSync(path.join(dir,'absent/manifest.json'))).files[0];assert.equal(absent.status,'held');fs.writeFileSync(lockFile,original);
 const proofPath=path.join(profile,JSON.parse(original).files.nativeDate.path),saved=fs.readFileSync(proofPath),proof=JSON.parse(saved);proof.declarationSha256='0'.repeat(64);fs.writeFileSync(proofPath,canonical(proof)+'\n');const forged=JSON.parse(original);forged.files.nativeDate.sha256=sha(fs.readFileSync(proofPath));fs.writeFileSync(lockFile,canonical(forged)+'\n');const rejected=cp.spawnSync(process.execPath,args('qualify','forged'),{cwd:root,encoding:'utf8'});assert.notEqual(rejected.status,0);assert.match(rejected.stdout+rejected.stderr,/Date|SDK/);fs.writeFileSync(proofPath,saved);fs.writeFileSync(lockFile,original);
 const holds={StringCoercion:'var d:Date=new Date();var s:String=String(d);',Addition:'var d:Date=new Date();var n:Number=d+1;',WithArgument:'var d:Date=new Date(0);',Mutation:'var d:Date=new Date();d.time=0;',OtherMember:'var d:Date=new Date();d.getFullYear();',Closure:'var d:Date=new Date();var f:Function=d.getTime;',Shadow:'var Date:Function=null;new Date();'};
 for(const [cls,body] of Object.entries(holds))fs.writeFileSync(path.join(source,cls+'.as'),`package {public class ${cls} {public function run():void {${body}}}}`);
 fs.rmSync(profile,{recursive:true,force:true});make();compile('qualify','holds');const rows=JSON.parse(fs.readFileSync(path.join(dir,'holds/manifest.json'))).files;
 for(const cls of Object.keys(holds)){const row=rows.find(r=>r.sourcePath===cls+'.as');assert.equal(row?.status,'held',JSON.stringify(row));}
 assert.equal(sha(fs.readFileSync(path.join(source,name))),sha(bytes));
});
