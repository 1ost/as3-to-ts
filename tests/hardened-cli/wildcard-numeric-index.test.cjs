'use strict';
const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const air=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA,ffdec=process.env.HARDENED_FIXTURE_FFDEC;
test('wildcard numeric Array indexing preserves original declarations and rejects unproved bindings',t=>{
 assert.ok(air&&laya&&ffdec,'AIR, Laya and FFDec paths required');
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'wildcard-numeric-index-')));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const source=path.join(dir,'source'),profile=path.join(dir,'profile'),fixture=process.env.HARDENED_FIXTURE_SOURCE||path.join(laya,'tests/nativeFlashOracle/wildcard-numeric-index');fs.mkdirSync(source);
 const retained=JSON.parse(fs.readFileSync(path.join(fixture,'native-air.json'))),name='WildcardNumericIndexProbe.as',bytes=fs.readFileSync(path.join(fixture,name));
 const sourceHash=retained.sourceFiles?.[name]||retained.sourceSha256;
 assert.equal(sha(bytes),sourceHash);assert.equal(sha(fs.readFileSync(path.join(fixture,'scenario.json'))),retained.scenarioSha256);fs.writeFileSync(path.join(source,name),bytes);
 const run=(command,args)=>{const r=cp.spawnSync(command,args,{cwd:root,encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stdout+r.stderr);};
 const make=()=>run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','WildcardNumericIndexProbe','--air-sdk',air,'--laya',laya,'--ffdec-jar',ffdec,'--output',profile]);
 const compile=(op,out)=>run(process.execPath,['bin/as3-frontend',op,source,path.join(dir,out),'--source-census',path.join(profile,'census.json'),'--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(profile,'profile-lock.json')]);
 make();const snapshots=[];
 for(const out of ['first','second']){
  compile('transpile',out);const rows=JSON.parse(fs.readFileSync(path.join(dir,out,'manifest.json'))).files;assert.equal(rows.length,1);assert.equal(rows[0].sourceSha256,sourceHash);
  const code=fs.readFileSync(path.join(dir,out,'__as3_runtime/application/WildcardNumericIndexProbe.ts'),'utf8');
  assert.match(code,/cursor\s*:\s*unknown/);assert.match(code,/__as3ArrayRead/);snapshots.push([rows,code]);
 }
 assert.deepEqual(snapshots[0],snapshots[1]);assert.equal(sha(fs.readFileSync(path.join(source,name))),sourceHash);
 const negative={
  StringWrite:'var cursor:*=0; var values:Array=[4]; cursor="0"; return values[cursor];',
  ConditionalInit:'var values:Array=[4]; if(flag){var cursor:*=0;} return values[cursor];',
  EarlyRead:'var values:Array=[4]; var first:*=values[cursor]; var cursor:*=0; return values[cursor];',
  UnknownWrite:'var cursor:*=0; var values:Array=[4]; cursor=flag; return values[cursor];',
  Captured:'var cursor:*=0; var values:Array=[4]; var callback:Function=function():void {cursor=1;}; return values[cursor];',
  CatchShadow:'var cursor:*=0; var values:Array=[4]; try{cursor=1;}catch(cursor:Error){} return values[cursor];',
 };
 for(const [cls,body] of Object.entries(negative))fs.writeFileSync(path.join(source,cls+'.as'),`package {public class ${cls} {public function run(flag:Boolean):* {${body}}}}`);
 fs.rmSync(profile,{recursive:true,force:true});make();compile('qualify','negative');
 const rows=JSON.parse(fs.readFileSync(path.join(dir,'negative/manifest.json'))).files;
 for(const cls of Object.keys(negative)){const row=rows.find(row=>row.sourcePath===cls+'.as');assert.equal(row?.status,'held',JSON.stringify(row));assert.equal(row.code,'HARDENED_ARRAY_INDEX_TYPE',JSON.stringify(row));}
});
