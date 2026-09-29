'use strict';
const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const air=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA,ffdec=process.env.HARDENED_FIXTURE_FFDEC;

test('Array.reverse retains AIR identity, holes and the AP split-array order with narrow call boundaries',t=>{
 assert.ok(air&&laya&&ffdec,'AIR, Laya and FFDec fixture paths required');
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'array-reverse-')));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const source=path.join(dir,'source'),profile=path.join(dir,'profile'),fixture=path.join(laya,'tests/nativeFlashOracle/array-reverse');fs.mkdirSync(source);
 const retained=JSON.parse(fs.readFileSync(path.join(fixture,'native-air.json'))),comparison=JSON.parse(fs.readFileSync(path.join(fixture,'comparison.json'))),bytes=fs.readFileSync(path.join(fixture,'ArrayReverseProbe.as'));
 assert.equal(sha(bytes),retained.sourceSha256);assert.equal(sha(fs.readFileSync(path.join(fixture,'scenario.json'))),retained.scenarioSha256);
 assert.equal(comparison.status,'passed');assert.equal(comparison.nativeReceiptSha256,retained.nativeReceiptSha256);assert.deepEqual(comparison.semanticDifferences,[]);assert.deepEqual(comparison.traceDifferences,[]);assert.equal(comparison.visual.metrics.differingPixels,0);
 assert.deepEqual(retained.capture.state.observations.map(row=>row.result),[
  'same|4,3,2,1','same|3,,,a','same|z,,,,a|true|false|true','same|0','same|3|c;2|b;1|a'
 ]);
 fs.writeFileSync(path.join(source,'ArrayReverseProbe.as'),bytes);
 const run=(command,args)=>{const r=cp.spawnSync(command,args,{cwd:root,encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stdout+r.stderr);};
 const makeProfile=()=>run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','ArrayReverseProbe','--air-sdk',air,'--laya',laya,'--ffdec-jar',ffdec,'--output',profile]);
 const compile=(operation,out)=>run(process.execPath,['bin/as3-frontend',operation,source,path.join(dir,out),'--source-census',path.join(profile,'census.json'),'--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(profile,'profile-lock.json')]);
 makeProfile();const snapshots=[];
 for(const out of ['first','second']){
  compile('transpile',out);const rows=JSON.parse(fs.readFileSync(path.join(dir,out,'manifest.json'))).files;
  assert.equal(rows.length,1);assert.equal(rows[0].sourceSha256,retained.sourceSha256);
  const code=fs.readFileSync(path.join(dir,out,'__as3_runtime/application/ArrayReverseProbe.ts'),'utf8');
  assert.match(code,/__as3ArrayCall\(values, "reverse", \[\]\)/);snapshots.push([rows,code]);
 }
 assert.deepEqual(snapshots[0],snapshots[1]);assert.equal(sha(fs.readFileSync(path.join(source,'ArrayReverseProbe.as'))),retained.sourceSha256);
 fs.writeFileSync(path.join(source,'TooMany.as'),'package {public class TooMany {public function run(value:Array):Array {return value.reverse(1);}}}');
 fs.writeFileSync(path.join(source,'Subclass.as'),'package {public dynamic class Subclass extends Array {public function Subclass(){super();} public function run():Array {return this.reverse();}}}');
 fs.rmSync(profile,{recursive:true,force:true});makeProfile();compile('qualify','negative');
 const rows=JSON.parse(fs.readFileSync(path.join(dir,'negative/manifest.json'))).files;
 const tooMany=rows.find(row=>row.sourcePath==='TooMany.as'),subclass=rows.find(row=>row.sourcePath==='Subclass.as');
 assert.equal(tooMany.status,'held',JSON.stringify(tooMany));assert.equal(tooMany.code,'HARDENED_ARRAY_CALL',JSON.stringify(tooMany));
 assert.equal(subclass.status,'held',JSON.stringify(subclass));assert.match(subclass.code,/^HARDENED_(MEMBER_TARGET|MEMBER_UNMAPPED|ARRAY_REVERSE)$/,JSON.stringify(subclass));
});
