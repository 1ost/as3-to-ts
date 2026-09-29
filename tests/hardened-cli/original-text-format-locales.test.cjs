"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),childProcess=require('node:child_process'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'../..'),sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
test('original TextFormatLib retains all format values and locale mutations through the shared provider',t=>{
 const laya=fs.realpathSync(process.env.HARDENED_FIXTURE_LAYA);
 const fixture=process.env.HARDENED_FIXTURE_SOURCE || path.join(laya,'tests/nativeFlashOracle/original-text-format-locales');
 const native=JSON.parse(fs.readFileSync(path.join(fixture,'native-air.json')));
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'original-text-format-locales-')));let completed=false;
 t.after(()=>{if(completed)fs.rmSync(dir,{recursive:true,force:true});else t.diagnostic('Retained failure: '+dir);});
 const sourceRoot=path.join(dir,'source'),profile=path.join(dir,'profile');fs.mkdirSync(sourceRoot);
 for(const [name,digest] of Object.entries(native.sourceFiles)){const bytes=fs.readFileSync(path.join(fixture,name));assert.equal(sha256(bytes),digest);fs.mkdirSync(path.dirname(path.join(sourceRoot,name)),{recursive:true});fs.writeFileSync(path.join(sourceRoot,name),bytes);}
 assert.equal(sha256(fs.readFileSync(path.join(fixture,'scenario.json'))),native.scenarioSha256);
 const originals=JSON.parse(fs.readFileSync(path.join(fixture,'original-source-manifest.json')));
 for(const file of originals.files){const bytes=fs.readFileSync(path.join(fixture,file.fixturePath));assert.equal(bytes.length,file.bytes);assert.equal(sha256(bytes),file.sha256);}
 assert.equal(originals.snapshotNames.length,370);assert.equal(originals.snapshotProperties.length,19);
 const baseline=native.capture.state.observations.find(row=>row.id==='baseline').result;
 const previousFixture=process.env.HARDENED_ORIGINAL_REFLECTION_SOURCE || path.join(laya,'tests/nativeFlashOracle/original-reflection');
 const previous=JSON.parse(fs.readFileSync(path.join(previousFixture,'native-air.json')));
 const oldRows=previous.capture.state.observations.find(row=>row.id==='original-static-variables').result.rows;
 assert.equal(oldRows.length,370);
 for(const row of oldRows){assert.ok(baseline[row[0]],row[0]);assert.deepEqual(baseline[row[0]].slice(0,2),row.slice(5,7),row[0]);}

 const run=(command,args)=>{const result=childProcess.spawnSync(command,args,{cwd:ROOT,encoding:'utf8',timeout:180000});assert.equal(result.status,0,result.stdout+result.stderr);return result;};
 const make=()=>run('python3',['-B','tools/create-fixture-profile.py','--source',sourceRoot,'--entry','OriginalTextFormatLocaleProbe','--air-sdk',process.env.HARDENED_FIXTURE_AIR_SDK,'--laya',laya,'--ffdec-jar',process.env.HARDENED_FIXTURE_FFDEC,'--output',profile,'--native-describe-type']);make();
 const targetPath=path.join(laya,"docTool/architecture/authored-content-capabilities.json");
 const targetJson=fs.readFileSync(targetPath,"utf8"),ledger=JSON.parse(targetJson);
 const capability=ledger.capabilities.find(row=>row.id==="api.flash.utils");assert.ok(capability);
 const rows=["createFlashReflectionMetadata","describeTypeXml"].map(name=>{
  const matches=capability.obligations.filter(row=>row.export===name);assert.equal(matches.length,1);return matches[0];
 });
 const canonical=value=>value===null||typeof value!=="object"?JSON.stringify(value):Array.isArray(value)
  ?`[${value.map(canonical).join(",")}]`:`{${Object.keys(value).sort().map(key=>JSON.stringify(key)+":"+canonical(value[key])).join(",")}}`;
 const targetSources={};
 for(const row of rows){
  const result=childProcess.spawnSync(process.execPath,[path.join(ROOT,"tools/resolve-laya-export.cjs")],{
   input:JSON.stringify({root:laya,facade:{module:row.module,export:row.export,sha256:row.sha256},candidates:[row]}),encoding:"utf8",timeout:30000});
  assert.equal(result.status,0,result.stderr);
  for(const [file,hash] of Object.entries(JSON.parse(result.stdout).inputs)){
   const relative=path.relative(laya,file).split(path.sep).join("/");
   if(targetSources[relative])assert.equal(targetSources[relative],hash);
   targetSources[relative]=hash;
  }
 }
 const proof={schema:"as3-reflection-provider-target@1",targetCapabilitiesSha256:sha256(targetJson),targetCapabilityId:"api.flash.utils",
  targets:rows.map(({module,export:exported,signature,sha256})=>({module,export:exported,signature,sha256})),targetSources};
 const proofBytes=canonical(proof)+"\n",lockPath=path.join(profile,"profile-lock.json"),plainLock=fs.readFileSync(lockPath);

 const attach=()=>{fs.writeFileSync(path.join(profile,'reflection-provider.json'),proofBytes);const lock=JSON.parse(fs.readFileSync(lockPath));lock.files.reflectionProvider={path:'reflection-provider.json',sha256:sha256(proofBytes)};fs.writeFileSync(lockPath,canonical(lock)+'\n');};attach();
 const compile=(operation,name)=>{const output=path.join(dir,name);run(process.execPath,['bin/as3-frontend',operation,sourceRoot,output,'--source-census',path.join(profile,'census.json'),'--target-capabilities',targetPath,'--profile-lock',lockPath]);return output;};
 const snapshots=[];
 for(const name of ['first','second']){
  const output=compile('transpile',name),manifest=JSON.parse(fs.readFileSync(path.join(output,'manifest.json')));
  assert.equal(manifest.files.length,Object.keys(native.sourceFiles).length);
  for(const row of manifest.files)assert.equal(row.sourceSha256,native.sourceFiles[row.sourcePath]);
  snapshots.push(manifest.files.map(row=>[row.sourcePath,row.typescriptSha256]));
  const packageDirectory=path.join(output,'node_modules/@laya');fs.mkdirSync(packageDirectory,{recursive:true});fs.symlinkSync(path.join(output,'__as3_runtime'),path.join(packageDirectory,'as3-runtime'),'dir');
  const bundle=path.join(output,'source-reflection.cjs');
  const result=require('esbuild').buildSync({stdin:{contents:'exports.entry=require("./__as3_runtime/ApplicationEntry.generated.js");',resolveDir:output,sourcefile:'source-reflection.js'},outfile:bundle,bundle:true,platform:'node',format:'cjs',alias:{laya:path.join(laya,'src/layaAir')},metafile:true,logLevel:'silent'});
  const inputs=new Set(Object.keys(result.metafile.inputs).map(file=>path.resolve(file)));for(const row of rows)assert.ok(inputs.has(path.join(laya,row.module)));
  const entry=require(bundle).entry,Probe=entry.AS3_APPLICATION_MODULES.find(row=>row.OriginalTextFormatLocaleProbe).OriginalTextFormatLocaleProbe;
  const probe=new Probe();
  const scenario=JSON.parse(fs.readFileSync(path.join(fixture,'scenario.json')));
  assert.equal(scenario.steps.length,11);assert.equal(native.capture.state.observations.length,11);
  for(const step of scenario.steps){
   for(const call of step.calls)probe[call.method](...call.args);
   const expected=native.capture.state.observations.find(row=>row.id===step.id);assert.ok(expected);
   assert.equal(Object.keys(probe.result).length,370);
   assert.deepEqual(probe.result,expected.result,step.id);
  }
 }
 assert.deepEqual(snapshots[0],snapshots[1]);
 for(const [name,digest] of Object.entries(native.sourceFiles))assert.equal(sha256(fs.readFileSync(path.join(sourceRoot,name))),digest);
 // An exact constructor/property mapping is insufficient for runtime as/is:
 // removing its separately pinned nominal predicate must hold before emission.
 const savedLock=fs.readFileSync(lockPath),predicateLock=JSON.parse(savedLock);
 const predicatePath=path.resolve(profile,predicateLock.files.runtimeTypePredicates.path);
 const runtimeLockPath=path.resolve(profile,predicateLock.files.runtimeTypeAuthorityLock.path);
 const savedPredicates=fs.readFileSync(predicatePath),savedRuntimeLock=fs.readFileSync(runtimeLockPath);
 const predicates=JSON.parse(savedPredicates),runtimeLock=JSON.parse(savedRuntimeLock);
 assert.ok(predicates.types.some(row=>row.sourceQName==='flash.text.TextFormat'));
 predicates.types=predicates.types.filter(row=>row.sourceQName!=='flash.text.TextFormat');
 fs.writeFileSync(predicatePath,canonical(predicates)+'\n');
 runtimeLock.predicateAuthorityCanonicalLfSha256=sha256(fs.readFileSync(predicatePath));
 runtimeLock.predicateAuthorityEntryCount=predicates.types.length;
 runtimeLock.predicateAuthorityQNames=predicates.types.map(row=>row.sourceQName).sort();
 predicateLock.runtimePredicateQNames=[...runtimeLock.predicateAuthorityQNames];
 fs.writeFileSync(runtimeLockPath,canonical(runtimeLock)+'\n');
 predicateLock.files.runtimeTypePredicates.sha256=sha256(fs.readFileSync(predicatePath));
 predicateLock.files.runtimeTypeAuthorityLock.sha256=sha256(fs.readFileSync(runtimeLockPath));
 fs.writeFileSync(lockPath,canonical(predicateLock)+'\n');
 const predicateNegative=compile('qualify','missing-nominal-predicate');
 const predicateRow=JSON.parse(fs.readFileSync(path.join(predicateNegative,'manifest.json'))).files.find(row=>row.sourcePath==='OriginalTextFormatLocaleProbe.as');
 assert.equal(predicateRow.code,'HARDENED_RUNTIME_TYPE_IDENTITY',JSON.stringify(predicateRow));
 fs.writeFileSync(predicatePath,savedPredicates);fs.writeFileSync(runtimeLockPath,savedRuntimeLock);fs.writeFileSync(lockPath,savedLock);
 // A known native QName alone must not authorize a descriptor field: require
 // the exact selected Flash class mapping, independently of the probe's imports.
 fs.writeFileSync(path.join(sourceRoot,'MissingDescriptorMapping.as'),'package {import flash.utils.describeType;import mmo.ext.font.TextFormatLib;public class MissingDescriptorMapping {public function run():Object {return describeType(TextFormatLib).variable;}}}');
 fs.rmSync(profile,{recursive:true,force:true});make();attach();
 const negativeLock=JSON.parse(fs.readFileSync(lockPath));
 const mapPath=path.resolve(profile,negativeLock.files.capabilityMapping.path),map=JSON.parse(fs.readFileSync(mapPath));
 map.mappings=map.mappings.filter(row=>row.sourceQName!=='flash.text.TextFormat');
 fs.writeFileSync(mapPath,canonical(map)+'\n');negativeLock.files.capabilityMapping.sha256=sha256(fs.readFileSync(mapPath));
 negativeLock.counts.mappedTypes=map.mappings.filter(row=>row.sourceMember===null).length;
 negativeLock.counts.mappedMembers=map.mappings.filter(row=>row.sourceMember!==null).length;
 // Retained nominal predicate evidence can itself prove the descriptor type.
 // This adversary removes both authoritative routes, leaving only the QName.
 fs.writeFileSync(predicatePath,canonical(predicates)+'\n');fs.writeFileSync(runtimeLockPath,canonical(runtimeLock)+'\n');
 negativeLock.files.runtimeTypePredicates.sha256=sha256(fs.readFileSync(predicatePath));
 negativeLock.files.runtimeTypeAuthorityLock.sha256=sha256(fs.readFileSync(runtimeLockPath));
 negativeLock.runtimePredicateQNames=[...runtimeLock.predicateAuthorityQNames];
 fs.writeFileSync(lockPath,canonical(negativeLock)+'\n');
 const negative=compile('qualify','missing-native-field-map');
 const row=JSON.parse(fs.readFileSync(path.join(negative,'manifest.json'))).files.find(row=>row.sourcePath==='MissingDescriptorMapping.as');
 assert.equal(row.code,'HARDENED_REFLECTION_CLASS',JSON.stringify(row));
 completed=true;
});
