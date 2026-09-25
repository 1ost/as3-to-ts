'use strict';
const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const air=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA,ffdec=process.env.HARDENED_FIXTURE_FFDEC;

test('Function.apply admits dynamically checked argument lists and preserves AIR error 1116',t=>{
 assert.ok(air&&laya&&ffdec,'AIR, Laya and FFDec fixture paths required');
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'dynamic-function-apply-')));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const fixture=path.join(laya,'tests/nativeFlashOracle/dynamic-function-apply-arguments'),retained=JSON.parse(fs.readFileSync(path.join(fixture,'native-air.json'))),comparison=JSON.parse(fs.readFileSync(path.join(fixture,'comparison.json')));
 const source=path.join(dir,'source'),profile=path.join(dir,'profile'),target=path.join(laya,'docTool/architecture/authored-content-capabilities.json');fs.mkdirSync(source);
 const name='DynamicFunctionApplyArgumentsProbe.as',bytes=fs.readFileSync(path.join(fixture,name));assert.equal(sha(bytes),retained.sourceSha256);assert.equal(retained.sourceFiles[name],retained.sourceSha256);fs.writeFileSync(path.join(source,name),bytes);
 assert.equal(sha(fs.readFileSync(path.join(fixture,'scenario.json'))),retained.scenarioSha256);assert.equal(comparison.status,'passed');assert.equal(comparison.nativeReceiptSha256,retained.nativeReceiptSha256);assert.deepEqual(comparison.semanticDifferences,[]);assert.deepEqual(comparison.traceDifferences,[]);assert.equal(comparison.visual.metrics.differingPixels,0);
 assert.deepEqual(retained.capture.state.observations.slice(-3).map(row=>row.result),Array(3).fill('TypeError|1116|Error #1116: second argument to Function.prototype.apply must be an array.'));
 const run=(command,args)=>{const result=cp.spawnSync(command,args,{cwd:root,encoding:'utf8',timeout:120000});assert.equal(result.status,0,result.stdout+result.stderr);};
 const make=()=>run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','DynamicFunctionApplyArgumentsProbe','--air-sdk',air,'--laya',laya,'--ffdec-jar',ffdec,'--output',profile]);
 const compile=(operation,out)=>run(process.execPath,['bin/as3-frontend',operation,source,path.join(dir,out),'--source-census',path.join(profile,'census.json'),'--target-capabilities',target,'--profile-lock',path.join(profile,'profile-lock.json')]);
 make();const snapshots=[];
 for(const out of ['first','second']){
  compile('transpile',out);const manifest=JSON.parse(fs.readFileSync(path.join(dir,out,'manifest.json'))),row=manifest.files.find(item=>item.sourcePath===name);assert.ok(row.typescriptPath);assert.equal(row.sourceSha256,retained.sourceSha256);
  const code=fs.readFileSync(path.join(dir,out,row.typescriptPath),'utf8');assert.match(code,/__as3FunctionApply\(this\.target, null, __as3ObjectRead\(holder, "args"/);snapshots.push([manifest.files,code]);
 }
 assert.deepEqual(snapshots[0],snapshots[1]);assert.equal(sha(fs.readFileSync(path.join(source,name))),retained.sourceSha256);
 fs.writeFileSync(path.join(source,'KnownNumber.as'),'package { public class KnownNumber { public function run(callback:Function):* { return callback.apply(null,7); } } }');
 fs.rmSync(profile,{recursive:true,force:true});make();compile('qualify','negative');
 const held=JSON.parse(fs.readFileSync(path.join(dir,'negative/manifest.json'))).files.find(row=>row.sourcePath==='KnownNumber.as');
 assert.equal(held.status,'held',JSON.stringify(held));assert.equal(held.code,'HARDENED_FUNCTION_APPLY_ARGUMENTS',JSON.stringify(held));
});
