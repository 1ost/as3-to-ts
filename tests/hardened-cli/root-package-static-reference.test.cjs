'use strict';
const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const air=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA,ffdec=process.env.HARDENED_FIXTURE_FFDEC;

test('named packages resolve authenticated default-package static classes with exact graph authority',t=>{
 assert.ok(air&&laya&&ffdec,'AIR, Laya and FFDec fixture paths required');
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'root-package-static-')));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const fixture=path.join(laya,'tests/nativeFlashOracle/root-package-static-reference'),retained=JSON.parse(fs.readFileSync(path.join(fixture,'native-air.json')));
 const source=path.join(dir,'source'),profile=path.join(dir,'profile'),target=path.join(laya,'docTool/architecture/authored-content-capabilities.json');fs.mkdirSync(source);
 for(const [name,digest] of Object.entries(retained.sourceFiles)){const bytes=fs.readFileSync(path.join(fixture,name));assert.equal(sha(bytes),digest);fs.mkdirSync(path.dirname(path.join(source,name)),{recursive:true});fs.writeFileSync(path.join(source,name),bytes);}
 assert.equal(sha(fs.readFileSync(path.join(fixture,'scenario.json'))),retained.scenarioSha256);
 assert.deepEqual(retained.capture.state.observations,[{result:'root',id:'root-static-read'}]);
 const run=(command,args)=>{const result=cp.spawnSync(command,args,{cwd:root,encoding:'utf8',timeout:120000});assert.equal(result.status,0,result.stdout+result.stderr);};
 const make=(output,extras=[])=>run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','consumer.RootPackageStaticReferenceProbe','--air-sdk',air,'--laya',laya,'--ffdec-jar',ffdec,'--output',output,...extras]);
 const compile=(operation,profileRoot,output)=>run(process.execPath,['bin/as3-frontend',operation,source,output,'--source-census',path.join(profileRoot,'census.json'),'--target-capabilities',target,'--profile-lock',path.join(profileRoot,'profile-lock.json')]);
 make(profile);const snapshots=[];
 for(const name of ['first','second']){
  const output=path.join(dir,name);compile('transpile',profile,output);const manifest=JSON.parse(fs.readFileSync(path.join(output,'manifest.json')));
  assert.equal(manifest.files.length,2);for(const row of manifest.files)assert.equal(row.sourceSha256,retained.sourceFiles[row.sourcePath]);
  const code=fs.readFileSync(path.join(output,'__as3_runtime/application/consumer/RootPackageStaticReferenceProbe.ts'),'utf8');
  assert.match(code,/import \{ RootAuthority \} from "\.\.\/RootAuthority"/);
  assert.match(code,/__as3InitializeClass\(RootAuthority, false\)\)\.value/);snapshots.push([manifest.files,code]);
 }
 assert.deepEqual(snapshots[0],snapshots[1]);
 fs.mkdirSync(path.join(source,'bridge'));
 fs.writeFileSync(path.join(source,'bridge/Anchor.as'),'package bridge { public class Anchor { public var root:RootAuthority; public var probe:consumer.RootPackageStaticReferenceProbe; } }');
 const missing=path.join(dir,'missing-profile');make(missing,['--omit-direct-edge','consumer.RootPackageStaticReferenceProbe:RootAuthority']);
 const heldOutput=path.join(dir,'missing-output');compile('qualify',missing,heldOutput);
 const held=JSON.parse(fs.readFileSync(path.join(heldOutput,'manifest.json'))).files.find(row=>row.sourcePath==='consumer/RootPackageStaticReferenceProbe.as');
 assert.equal(held.status,'held',JSON.stringify(held));assert.equal(held.code,'HARDENED_LOCAL_IMPORT_EDGE',JSON.stringify(held));
 for(const [name,digest] of Object.entries(retained.sourceFiles))assert.equal(sha(fs.readFileSync(path.join(source,name))),digest);
});
