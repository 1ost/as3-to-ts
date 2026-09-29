'use strict';
const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const air=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA,ffdec=process.env.HARDENED_FIXTURE_FFDEC;

test('native Math.round fixtures emit source-preserving authenticated helper calls',t=>{
 assert.ok(air&&laya&&ffdec,'AIR, Laya and FFDec paths required');
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'math-round-')));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const source=path.join(dir,'source'),profile=path.join(dir,'profile');fs.mkdirSync(source);const hashes=new Map();
 for(const [folder,name] of [['math-round','MathRoundProbe'],['math-round-bits','MathRoundBitsProbe']]){
  const fixture=path.join(process.env.HARDENED_FIXTURE_SOURCE||path.join(laya,'tests/nativeFlashOracle'),folder),retained=JSON.parse(fs.readFileSync(path.join(fixture,'native-air.json'))),bytes=fs.readFileSync(path.join(fixture,name+'.as'));
  assert.equal(sha(bytes),retained.sourceFiles[name+'.as']);assert.equal(sha(fs.readFileSync(path.join(fixture,'scenario.json'))),retained.scenarioSha256);fs.writeFileSync(path.join(source,name+'.as'),bytes);hashes.set(name+'.as',sha(bytes));
 }
 const run=(command,args)=>{const r=cp.spawnSync(command,args,{cwd:root,encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stdout+r.stderr);};
 const make=()=>run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','MathRoundProbe','--air-sdk',air,'--laya',laya,'--ffdec-jar',ffdec,'--output',profile,'--intrinsic-type','flash.utils.ByteArray']);
 const compile=(op,out)=>run(process.execPath,['bin/as3-frontend',op,source,path.join(dir,out),'--source-census',path.join(profile,'census.json'),'--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(profile,'profile-lock.json')]);
 make();const snapshots=[];
 for(const out of ['first','second']){
  compile('transpile',out);const rows=JSON.parse(fs.readFileSync(path.join(dir,out,'manifest.json'))).files;assert.equal(rows.length,2);const codes=[];
  for(const [name,hash] of hashes){assert.equal(rows.find(row=>row.sourcePath===name)?.sourceSha256,hash);const code=fs.readFileSync(path.join(dir,out,'__as3_runtime/application',name.replace('.as','.ts')),'utf8');assert.match(code,/__as3MathRound/);assert.doesNotMatch(code,/Math\.round/);codes.push(code);}
  const packageRoot=path.join(dir,out,'__as3_runtime'),packageInfo=JSON.parse(fs.readFileSync(path.join(packageRoot,'package.json'))),local=require('node:module').createRequire(path.join(packageRoot,'application/MathRoundProbe.js'));
  const runtime=local(packageInfo.name+'/AS3Coerce');assert.equal(typeof runtime.as3MathRound,'function');assert.equal(runtime.as3MathRound(.49999999999999994),1);assert.equal(1/runtime.as3MathRound(-.25),Infinity);
  snapshots.push([rows,codes]);
 }
 assert.deepEqual(snapshots[0],snapshots[1]);for(const [name,hash] of hashes)assert.equal(sha(fs.readFileSync(path.join(source,name))),hash);
 const forms={NoArgs:'Math.round()',ExtraArgs:'Math.round(1,2)',StringInput:'Math.round("1")',OtherMethod:'Math.floor(1)'};
 for(const [name,expression] of Object.entries(forms))fs.writeFileSync(path.join(source,name+'.as'),`package {public class ${name} {public function run():Number{return ${expression};}}}`);
 fs.rmSync(profile,{recursive:true,force:true});make();compile('qualify','negative');const rows=JSON.parse(fs.readFileSync(path.join(dir,'negative/manifest.json'))).files;
 for(const name of Object.keys(forms)){const row=rows.find(row=>row.sourcePath===name+'.as');assert.equal(row?.status,'held',JSON.stringify(row));assert.equal(row.code,name==='NoArgs'||name==='ExtraArgs'?'HARDENED_MATH_ARITY':name==='StringInput'?'HARDENED_MATH_ARGUMENT':'HARDENED_MATH_MEMBER',JSON.stringify(row));}
});
