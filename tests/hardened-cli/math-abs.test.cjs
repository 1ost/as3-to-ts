'use strict';
const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const air=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA,ffdec=process.env.HARDENED_FIXTURE_FFDEC;
test('native numeric Math.abs fixture preserves source and emits deterministic existing Math calls',t=>{
 assert.ok(air&&laya&&ffdec,'AIR, Laya and FFDec paths required');
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'math-abs-')));let completed=false;t.after(()=>{if(completed)fs.rmSync(dir,{recursive:true,force:true});else t.diagnostic('Retained Math.abs evidence: '+dir);});
 const source=path.join(dir,'source'),profile=path.join(dir,'profile');fs.mkdirSync(source);
 const fixture=path.join(process.env.HARDENED_FIXTURE_SOURCE||path.join(laya,'tests/nativeFlashOracle'),'math-abs-bits');
 const retained=JSON.parse(fs.readFileSync(path.join(fixture,'native-air.json'))),bytes=fs.readFileSync(path.join(fixture,'MathAbsBitsProbe.as')),scenario=JSON.parse(fs.readFileSync(path.join(fixture,'scenario.json')));
 assert.equal(sha(bytes),retained.sourceFiles['MathAbsBitsProbe.as']);assert.equal(sha(fs.readFileSync(path.join(fixture,'scenario.json'))),retained.scenarioSha256);
 assert.equal(retained.capture.state.observations.length,28);fs.writeFileSync(path.join(source,'MathAbsBitsProbe.as'),bytes);
 const run=(command,args)=>{const r=cp.spawnSync(command,args,{cwd:root,encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stdout+r.stderr);};
 const make=()=>run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','MathAbsBitsProbe','--air-sdk',air,'--laya',laya,'--ffdec-jar',ffdec,'--output',profile,'--intrinsic-type','flash.utils.ByteArray']);
 const compile=(op,out)=>run(process.execPath,['bin/as3-frontend',op,source,path.join(dir,out),'--source-census',path.join(profile,'census.json'),'--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(profile,'profile-lock.json')]);
 make();const snapshots=[];
 for(const out of ['first','second']){
  compile('transpile',out);const rows=JSON.parse(fs.readFileSync(path.join(dir,out,'manifest.json'))).files;
  assert.equal(rows.length,1);assert.equal(rows[0].sourceSha256,sha(bytes));
  const appRoot=path.join(dir,out,'__as3_runtime/application'),code=fs.readFileSync(path.join(appRoot,'MathAbsBitsProbe.ts'),'utf8');
  assert.match(code,/Math\.abs\(/);assert.doesNotMatch(code,/__as3MathAbs/);snapshots.push([rows,code]);
  const entry=require(path.join(dir,out,'__as3_runtime/ApplicationEntry.generated.js'));const exports=entry.AS3_APPLICATION_MODULES.find(row=>row.MathAbsBitsProbe);assert.ok(exports);const app=new exports.MathAbsBitsProbe();
  for(const [index,step] of scenario.steps.entries()){
   for(const call of step.calls)app[call.method](...call.args);
   assert.deepEqual(app.result,retained.capture.state.observations[index].result,step.id);
  }
 }
 assert.deepEqual(snapshots[0],snapshots[1]);assert.equal(sha(fs.readFileSync(path.join(source,'MathAbsBitsProbe.as'))),sha(bytes));
 const forms={NoArgs:'Math.abs()',ExtraArgs:'Math.abs(1,2)',StringInput:'Math.abs("-1")',ObjectInput:'Math.abs({})',BooleanInput:'Math.abs(true)',MethodValue:'Math.abs'};
 for(const [name,expr] of Object.entries(forms))fs.writeFileSync(path.join(source,name+'.as'),`package {public class ${name} {public function run():* {return ${expr};}}}`);
 fs.rmSync(profile,{recursive:true,force:true});make();compile('qualify','negative');const rows=JSON.parse(fs.readFileSync(path.join(dir,'negative/manifest.json'))).files;
 for(const name of Object.keys(forms)){const row=rows.find(row=>row.sourcePath===name+'.as');assert.equal(row?.status,'held',JSON.stringify(row));assert.equal(row.code,name==='NoArgs'||name==='ExtraArgs'?'HARDENED_MATH_ARITY':name==='MethodValue'?'HARDENED_MATH_MEMBER':'HARDENED_MATH_ARGUMENT',JSON.stringify(row));}
 completed=true;
});
