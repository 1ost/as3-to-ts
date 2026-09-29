"use strict";
const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),path=require('node:path'),
 os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),air=process.env.HARDENED_FIXTURE_AIR_SDK,
 laya=process.env.HARDENED_FIXTURE_LAYA,ffdec=process.env.HARDENED_FIXTURE_FFDEC,sha=x=>crypto.createHash('sha256').update(x).digest('hex');
test('original final classes retain source identity and cannot be extended or lose authenticated finality',t=>{
 assert.ok(air&&laya&&ffdec,'AIR, Laya and FFDec fixture paths required');
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'final-class-')));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const source=path.join(dir,'source'),fixture=path.join(laya,'tests/nativeFlashOracle/final-class');fs.mkdirSync(source);
 const retained=JSON.parse(fs.readFileSync(path.join(fixture,'native-air.json')));
 for(const [name,hash] of Object.entries(retained.sourceFiles)){
  const bytes=fs.readFileSync(path.join(fixture,name));assert.equal(sha(bytes),hash);const target=path.join(source,name);
  fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);
 }
 const run=(command,args)=>{const r=cp.spawnSync(command,args,{cwd:root,encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stdout+r.stderr);};
 const profile=path.join(dir,'profile');
 const makeProfile=()=>run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','FinalClassProbe','--air-sdk',air,'--laya',laya,'--ffdec-jar',ffdec,'--output',profile]);
 const compile=(op,out)=>run(process.execPath,['bin/as3-frontend',op,source,path.join(dir,out),'--source-census',path.join(profile,'census.json'),'--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(profile,'profile-lock.json')]);
 makeProfile();const snapshots=[];
 for(const output of ['first','second']){
  compile('transpile',output);const rows=JSON.parse(fs.readFileSync(path.join(dir,output,'manifest.json'))).files;
  for(const row of rows)assert.equal(row.sourceSha256,retained.sourceFiles[row.sourcePath]);
  const authority=fs.readFileSync(path.join(dir,output,'__as3_runtime/AS3Authority.generated.js'),'utf8');
  for(const name of ['FinalValue','game.manager.RuntimeArtifactContext']){
   const line=authority.split('\n').find(line=>line.includes('qname: "'+name+'"'));
   assert.ok(line,'missing runtime class '+name);assert.match(line,/objectTraits: \{ "dynamic": false, "final": true/);
  }
  snapshots.push([rows,authority]);
 }
 assert.deepEqual(snapshots[0],snapshots[1]);
 const invalid='package {public class InvalidFinalChild extends FinalValue {public function InvalidFinalChild(){super(7);}}}';
 fs.writeFileSync(path.join(source,'InvalidFinalChild.as'),invalid);
 const jar=path.join(air,'lib',fs.existsSync(path.join(air,'lib/mxmlc-cli.jar'))?'mxmlc-cli.jar':'mxmlc.jar');
 const native=cp.spawnSync('java',['-Xmx512m','-Dflexlib='+path.join(air,'frameworks'),'-jar',jar,'+flexlib='+path.join(air,'frameworks'),'+configname=air','-source-path='+source,'-output='+path.join(dir,'invalid.swf'),path.join(source,'InvalidFinalChild.as')],{encoding:'utf8',timeout:60000});
 assert.notEqual(native.status,0);assert.match(native.stdout+native.stderr,/base class[^\n]*final/i);assert.match(native.stdout+native.stderr,/FinalValue/);
 fs.rmSync(profile,{recursive:true,force:true});makeProfile();compile('qualify','negative');
 const rows=JSON.parse(fs.readFileSync(path.join(dir,'negative/manifest.json'))).files;
 assert.equal(rows.find(x=>x.sourcePath==='InvalidFinalChild.as').code,'HARDENED_FINAL_BASE');
 const lockPath=path.join(profile,'profile-lock.json'),lock=JSON.parse(fs.readFileSync(lockPath));
 const membersPath=path.join(profile,lock.files.localMemberMap.path),members=JSON.parse(fs.readFileSync(membersPath));
 delete members.entries.find(x=>x.qname==='FinalValue').declaration.finalClass;
 const bytes=JSON.stringify(members)+'\n';fs.writeFileSync(membersPath,bytes);lock.files.localMemberMap.sha256=sha(bytes);fs.writeFileSync(lockPath,JSON.stringify(lock)+'\n');
 compile('qualify','missing-final-authority');
 const held=JSON.parse(fs.readFileSync(path.join(dir,'missing-final-authority/manifest.json'))).files;
 assert.equal(held.find(x=>x.sourcePath==='FinalValue.as').code,'HARDENED_FINAL_CLASS_AUTHORITY');
});
