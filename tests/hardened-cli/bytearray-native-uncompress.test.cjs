'use strict';
const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const air=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA,ffdec=process.env.HARDENED_FIXTURE_FFDEC;
const canonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?`[${v.map(canonical).join(',')}]`:`{${Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')}}`;
const write=(p,v)=>fs.writeFileSync(p,canonical(v)+'\n');
test('intrinsic uncompress requires exact source/target proof and deterministic native facade',t=>{
 assert.ok(air&&laya&&ffdec,'AIR, Laya and FFDec fixture paths required');
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'bytearray-native-uncompress-')));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const source=path.join(dir,'source'),profile=path.join(dir,'profile'),fixture=process.env.HARDENED_FIXTURE_SOURCE || path.join(laya,'tests/nativeFlashOracle/bytearray-intrinsic-uncompress');fs.mkdirSync(source);
 const receipt=JSON.parse(fs.readFileSync(path.join(fixture,'native-air.json')));
 for(const [name,hash] of Object.entries(receipt.sourceFiles)){const bytes=fs.readFileSync(path.join(fixture,name));assert.equal(sha(bytes),hash);fs.mkdirSync(path.dirname(path.join(source,name)),{recursive:true});fs.writeFileSync(path.join(source,name),bytes);}
 assert.equal(sha(fs.readFileSync(path.join(fixture,'scenario.json'))),receipt.scenarioSha256);
 const run=(cmd,args)=>{const r=cp.spawnSync(cmd,args,{cwd:root,encoding:'utf8',timeout:180000});assert.equal(r.status,0,r.stdout+r.stderr);return r;};
 const make=()=>run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','ByteArrayIntrinsicUncompressProbe','--air-sdk',air,'--laya',laya,'--ffdec-jar',ffdec,'--output',profile,'--intrinsic-type','flash.utils.ByteArray','--bytearray-native-uncompress']);
 const args=(op,out)=>['bin/as3-frontend',op,source,path.join(dir,out),'--source-census',path.join(profile,'census.json'),'--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(profile,'profile-lock.json')];
 make();const snapshots=[];
 for(const out of ['first','second']){run(process.execPath,args('transpile',out));const rows=JSON.parse(fs.readFileSync(path.join(dir,out,'manifest.json'))).files;for(const row of rows)assert.equal(row.sourceSha256,receipt.sourceFiles[row.sourcePath]);
  const runtime=fs.readFileSync(path.join(dir,out,'__as3_runtime/AS3Authority.generated.js'),'utf8');assert.match(runtime,/laya\/flash\/utils\/ByteArray/);assert.match(runtime,/\.uncompress\(\)/);snapshots.push([rows,runtime]);}
 assert.deepEqual(snapshots[0],snapshots[1]);
 const lockPath=path.join(profile,'profile-lock.json'),baseLock=fs.readFileSync(lockPath),lock=JSON.parse(baseLock),proofPath=path.join(profile,lock.files.byteArrayNative.path),baseProof=fs.readFileSync(proofPath);
 delete lock.files.byteArrayNative;write(lockPath,lock);run(process.execPath,args('qualify','missing'));
 const missing=JSON.parse(fs.readFileSync(path.join(dir,'missing/manifest.json'))).files[0];assert.equal(missing.status,'held');assert.equal(missing.code,'HARDENED_INTRINSIC_MEMBER');fs.writeFileSync(lockPath,baseLock);
 for(const [label,mutate] of [
  ['signature',p=>{p.sourceSignature='public function uncompress() : void';}],
  ['target',p=>{p.targetExport='Object';}],
  ['stale',p=>{p.targetSources['src/layaAir/laya/utils/Zlib.ts']='0'.repeat(64);}],
  ['closure',p=>{const remove=Object.keys(p.targetSources).find(k=>k!==p.targetModule&&k!=='src/layaAir/laya/utils/Zlib.ts');assert.ok(remove);delete p.targetSources[remove];}]
 ]){const proof=JSON.parse(baseProof);mutate(proof);write(proofPath,proof);const changed=JSON.parse(baseLock);changed.files.byteArrayNative.sha256=sha(fs.readFileSync(proofPath));write(lockPath,changed);
  const rejected=cp.spawnSync(process.execPath,args('qualify',label),{cwd:root,encoding:'utf8',timeout:180000});assert.equal(rejected.status,6,rejected.stdout+rejected.stderr);assert.match(rejected.stderr,/native ByteArray/);}
 fs.writeFileSync(proofPath,baseProof);fs.writeFileSync(lockPath,baseLock);
 const probe=path.join(source,'ByteArrayIntrinsicUncompressProbe.as');fs.writeFileSync(probe,fs.readFileSync(probe,'utf8').replace('bytes.uncompress();','bytes.uncompress("zlib");'));
 fs.rmSync(profile,{recursive:true,force:true});make();run(process.execPath,args('qualify','algorithm'));
 const held=JSON.parse(fs.readFileSync(path.join(dir,'algorithm/manifest.json'))).files[0];assert.equal(held.status,'held');assert.equal(held.code,'HARDENED_INTRINSIC_CALL_ARITY');
});

test('direct capability loader rejects raw or copied native proof objects before admission',()=>{
 const bundled=require('esbuild').buildSync({entryPoints:[path.join(root,'src/hardened/ledger.ts')],bundle:true,platform:'node',format:'cjs',write:false,logLevel:'silent'});
 const Module=require('node:module'),loaded=new Module(path.join(root,'ledger-proof-test.cjs'),module);loaded.filename=path.join(root,'ledger-proof-test.cjs');loaded.paths=module.paths;loaded._compile(bundled.outputFiles[0].text,loaded.filename);
 const raw={targetModule:'src/layaAir/flash/utils/ByteArray.ts',targetExport:'ByteArray',sourceSignature:'public function uncompress(algorithm:String = "zlib") : void'};
 for(const proof of [raw,Object.freeze({...raw}),Object.create(raw),null]){
  assert.throws(()=>loaded.exports.loadCapabilityAuthority({byteArrayNative:proof,targetCapabilitiesJson:'{}'},sha),error=>error.code==='HARDENED_BYTEARRAY_NATIVE_AUTHORITY'&&/genuine verified/.test(error.message));
 }
});
