const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib');
const root=path.resolve(__dirname,'../..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const archive=path.join(__dirname,'runtime.json.gz'),pinFile=path.join(__dirname,'runtime-pin.json'),retaining=process.argv[2]==='--retain';
let packet,bytes;
if(retaining){
 assert.equal(process.argv.length,6);assert.ok(!fs.existsSync(archive));assert.ok(!fs.existsSync(pinFile));
 const reports=process.argv.slice(3).map(f=>path.resolve(f)),files=new Map(),inputs=[];
 const add=(file,sha)=>{file=path.resolve(file);const b=fs.readFileSync(file);if(sha)assert.equal(hash(b),sha,file);files.set(file,{file,sha256:hash(b),base64:b.toString('base64')});};
 const input=i=>{const file=path.resolve(root,i.file);inputs.push({...i,file});add(file,i.sha256);};
 const walk=dir=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else add(f);}};
 const evidence=['capabilities-class-reference','private-static-boolean-relations'].map(n=>path.resolve(root,'../engine/tests/nativeFlashOracle',n));
 const runners=['native-generated-capabilities-class-reference','native-generated-private-static-boolean-relations'];
 reports.forEach((file,index)=>{
  const r=JSON.parse(fs.readFileSync(file));
  if(index<2){
   r.compilerInputs.forEach(input);r.results.flatMap(t=>[...t.inputs,...t.typechecks.flatMap(c=>c.inputs)]).forEach(input);
   for(const [name,h] of [['run.cjs',r.runnerSha256],['observer.ts',r.observerSha256]])input({file:path.join(root,'tests',runners[index],name),sha256:h});
   walk(evidence[index]);
  }else r.inputs.forEach(input);
  walk(path.dirname(file));
 });
 walk(path.join(__dirname,'baseline-failure'));
 packet={reports,evidence,inputs,files:[...files.values()]};bytes=z.gzipSync(JSON.stringify(packet),{level:9});
}else{
 bytes=fs.readFileSync(archive);const p=JSON.parse(fs.readFileSync(pinFile));assert.equal(hash(bytes),p.sha256);assert.equal(bytes.length,p.bytes);
 packet=JSON.parse(z.gunzipSync(bytes));assert.equal(packet.files.length,p.files);
}
const files=new Map(packet.files.map(i=>[i.file,i]));assert.equal(files.size,packet.files.length);
const read=f=>{const i=files.get(f);assert.ok(i,f);const b=Buffer.from(i.base64,'base64');assert.equal(hash(b),i.sha256,f);return b;};
for(const file of files.keys())read(file);for(const i of packet.inputs)assert.equal(hash(read(i.file)),i.sha256,i.file);
const reports=packet.reports.map(f=>JSON.parse(read(f)));
for(let index=0;index<2;index++){
 const r=reports[index],evidence=packet.evidence[index],dir=path.join(evidence,index===0?'evidence':'evidence-qualified');
 const receiptBytes=read(path.join(dir,'receipt.json')),receipt=JSON.parse(receiptBytes);
 assert.equal(hash(receiptBytes),r.receiptSha256);assert.equal(receipt.status,'passed');assert.equal(receipt.capture.identical,true);assert.equal(receipt.capture.runs,2);
 for(const [file,h]of Object.entries(receipt.artifacts))assert.equal(hash(read(path.join(dir,file))),h,file);
 const capture=JSON.parse(read(path.join(dir,'run-1/capture.json')));assert.deepEqual(capture,JSON.parse(read(path.join(dir,'run-2/capture.json'))));
 const rows=capture.state.observations.map(row=>row.id==='reflection'?{...row,value:row.value.replace(/>\s+</g,'><')}:row);
 assert.equal(rows.length,index===0?8:10);
 for(const [q,u]of Object.entries(r.cohorts.parent)){assert.equal(hash(u.source),u.sourceSha256);assert.equal(hash(read(path.join(dir,'source',q.replaceAll('.','/')+'.as'))),u.sourceSha256);}
 assert.deepEqual(r.results.map(t=>t.target),['ES5','ES2015']);
 for(const t of r.results){
  assert.deepEqual(t.node,t.web);assert.deepEqual(t.node.rows,rows);assert.equal(t.rejectionGuards,index===0?9:14);
  assert.equal(t.node.checks.length,6);assert.ok(t.node.checks.every(c=>c.passed));for(const c of t.typechecks)assert.deepEqual(c.diagnostics,[]);
  assert.equal(t.mutations,index===0?2:3);assert.equal(t.controls.length,t.mutations);
  assert.deepEqual(t.controls.map(c=>c.mutation),index===0?['mac-inverted','identity-inverted']:['folded-default','computed-early','comparison-inverted']);
  const targetDir=path.join(path.dirname(packet.reports[index]),t.target);
  assert.equal(read(path.join(targetDir,'parent/parent-factory.js')).toString(),t.artifacts.parent.moduleSource);
  for(const m of t.controls){
   assert.equal(m.applied,1);assert.deepEqual(m.control,m.browserControl);assert.equal(m.control.failure,undefined);
   assert.notDeepEqual(m.control.rows.find(row=>row.id===m.detectedAt),rows.find(row=>row.id===m.detectedAt));
   assert.equal(hash(read(path.join(targetDir,'mutant-'+m.mutation+'-factory.js'))),m.factorySha256);
   assert.equal(hash(read(path.join(targetDir,'mutant-'+m.mutation+'.js'))),m.bundleSha256);
  }
 }
}
const sdkPin=JSON.parse(read(path.join(packet.evidence[0],'pin.json')));
for(const [file,h]of Object.entries(sdkPin.artifacts))assert.equal(hash(read(path.join(packet.evidence[0],file))),h,file);
const baseline=JSON.parse(read(path.join(__dirname,'baseline-failure/observed.json')));
assert.equal(baseline[1].error.message,'AS3_CLASS_UNSUPPORTED: native class lacks exact source metadata');
const replay=reports[2];assert.equal(replay.sourceCount,1356);assert.equal(replay.classScriptCount,95);assert.equal(replay.productionProviderPromoted,false);
assert.equal(replay.baseline.message,'AS3_CLASS_INITIALIZER_UNSUPPORTED: unresolved class-value identity: Capabilities');assert.equal(replay.unqualifiedProvider.status,'emitted');
assert.equal(hash(read(replay.unqualifiedProvider.file)),replay.unqualifiedProvider.sha256);assert.equal(read(replay.unqualifiedProvider.file).toString().length,replay.unqualifiedProvider.characters);
const original=JSON.parse(z.gunzipSync(read(replay.inputs[0].file)));assert.equal(replay.identity,original.emission.identity);assert.equal(replay.sources.length,1356);
for(const i of replay.sources)assert.equal(hash(original.input.sources[i.identity].source),i.sha256);
if(retaining||process.argv.includes('--check-current'))for(const [f,i]of files)assert.equal(hash(fs.readFileSync(f)),i.sha256,f);
if(retaining){fs.writeFileSync(archive,bytes,{flag:'wx'});fs.writeFileSync(pinFile,JSON.stringify({sha256:hash(bytes),bytes:bytes.length,files:files.size},null,2)+'\n',{flag:'wx'});}
console.log(JSON.stringify({status:'verified',primaryRows:8,adjacentRows:10,targets:2,realms:2,primaryGuards:9,hostChecks:6,mutationsPerTarget:2,typeErrors:0,originalSources:1356,productionProviderPromoted:false}));
