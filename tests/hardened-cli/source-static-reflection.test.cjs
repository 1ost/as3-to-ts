"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),childProcess=require('node:child_process'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'../..'),sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
test('source static reflection executes the unchanged native Object loop using the verified shared provider',t=>{
 const laya=fs.realpathSync(process.env.HARDENED_FIXTURE_LAYA);
 const fixture=process.env.HARDENED_FIXTURE_SOURCE || path.join(laya,'tests/nativeFlashOracle/source-static-reflection-loop');
 const native=JSON.parse(fs.readFileSync(path.join(fixture,'native-air.json')));
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'source-static-reflection-')));let completed=false;
 t.after(()=>{if(completed)fs.rmSync(dir,{recursive:true,force:true});else t.diagnostic('Retained failure: '+dir);});
 const sourceRoot=path.join(dir,'source'),profile=path.join(dir,'profile');fs.mkdirSync(sourceRoot);
 for(const [name,digest] of Object.entries(native.sourceFiles)){const bytes=fs.readFileSync(path.join(fixture,name));assert.equal(sha256(bytes),digest);fs.mkdirSync(path.dirname(path.join(sourceRoot,name)),{recursive:true});fs.writeFileSync(path.join(sourceRoot,name),bytes);}
 assert.equal(sha256(fs.readFileSync(path.join(fixture,'scenario.json'))),native.scenarioSha256);
 const run=(command,args)=>{const result=childProcess.spawnSync(command,args,{cwd:ROOT,encoding:'utf8',timeout:180000});assert.equal(result.status,0,result.stdout+result.stderr);return result;};
 const make=()=>run('python3',['-B','tools/create-fixture-profile.py','--source',sourceRoot,'--entry','SourceStaticReflectionProbe','--air-sdk',process.env.HARDENED_FIXTURE_AIR_SDK,'--laya',laya,'--ffdec-jar',process.env.HARDENED_FIXTURE_FFDEC,'--output',profile,'--native-describe-type']);make();
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
  const entry=require(bundle).entry,Probe=entry.AS3_APPLICATION_MODULES.find(row=>row.SourceStaticReflectionProbe).SourceStaticReflectionProbe;
  const probe=new Probe();probe.exercise();assert.deepEqual(probe.result,native.capture.state.observations[0].result);
 }
 assert.deepEqual(snapshots[0],snapshots[1]);
 fs.writeFileSync(path.join(sourceRoot,'DynamicClass.as'),'package {import flash.utils.describeType;public class DynamicClass {public function run(value:Class):Object {return describeType(value).variable;}}}');
 fs.writeFileSync(path.join(sourceRoot,'UnsupportedXML.as'),'package {import flash.utils.describeType;public class UnsupportedXML {public function run():Object {return describeType(StaticFormats).factory;}}}');
 fs.writeFileSync(path.join(sourceRoot,'Shadow.as'),'package {import flash.utils.describeType;public class Shadow {public function run(describeType:Function):Object {return describeType(StaticFormats);}}}');
 fs.rmSync(profile,{recursive:true,force:true});make();attach();const negative=compile('qualify','negative');
 const negatives=JSON.parse(fs.readFileSync(path.join(negative,'manifest.json'))).files;
 for(const [name,code] of [['DynamicClass','HARDENED_REFLECTION_CLASS'],['UnsupportedXML','HARDENED_REFLECTION_XML'],['Shadow','HARDENED_REFLECTION_SHADOW']]){const row=negatives.find(row=>row.sourcePath===name+'.as');assert.equal(row.code,code,JSON.stringify(row));}
 for(const [name,digest] of Object.entries(native.sourceFiles))assert.equal(sha256(fs.readFileSync(path.join(sourceRoot,name))),digest);
 completed=true;
});
