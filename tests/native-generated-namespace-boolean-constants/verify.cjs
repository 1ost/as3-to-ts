const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib');
const root=path.resolve(__dirname,'../..'),engine=path.resolve(root,'../engine'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const archive=path.join(__dirname,'runtime.json.gz'),pinFile=path.join(__dirname,'runtime-pin.json'),retaining=process.argv[2]==='--retain';
let packet,bytes;
if(retaining){
 assert.equal(process.argv.length,7);assert.ok(!fs.existsSync(archive));assert.ok(!fs.existsSync(pinFile));
 const reports=process.argv.slice(3,6).map(f=>path.resolve(f)),baseline=path.resolve(process.argv[6]),files=new Map(),inputs=[];
 const add=(file,sha)=>{file=path.resolve(file);const b=fs.readFileSync(file);if(sha)assert.equal(hash(b),sha,file);files.set(file,{file,sha256:hash(b),base64:b.toString('base64')});};
 const input=i=>{const file=path.resolve(root,i.file);inputs.push({...i,file});add(file,i.sha256);};
 const walk=dir=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else add(f);}};
 const evidence=['namespace-boolean-constants','reference-static-initialization'].map(n=>path.join(engine,'tests/nativeFlashOracle',n));
 reports.forEach((file,index)=>{
  const r=JSON.parse(fs.readFileSync(file));
  if(index===0){r.compilerInputs.forEach(input);r.results.flatMap(t=>[...t.inputs,...t.typechecks.flatMap(c=>c.inputs)]).forEach(input);
   for(const [name,h]of [['run.cjs',r.runnerSha256],['observer.ts',r.observerSha256]])input({file:path.join(__dirname,name),sha256:h});}
  else if(index===1){r.providerGraph.forEach(i=>input({...i,file:path.resolve(engine,i.file)}));for(const i of r.emitted)input({file:i.file,sha256:i.outputSha256});input(r.observer);add(path.join(root,'tests/native-generated-reference-constants/run.cjs'));}
  else r.inputs.forEach(input);
  walk(path.dirname(file));if(index<2)walk(evidence[index]);
 });
 add(baseline);packet={reports,baseline,evidence,inputs,files:[...files.values()]};bytes=z.gzipSync(JSON.stringify(packet),{level:9});
}else{bytes=fs.readFileSync(archive);const p=JSON.parse(fs.readFileSync(pinFile));assert.equal(hash(bytes),p.sha256);assert.equal(bytes.length,p.bytes);packet=JSON.parse(z.gunzipSync(bytes));assert.equal(packet.files.length,p.files);}
const files=new Map(packet.files.map(i=>[i.file,i]));assert.equal(files.size,packet.files.length);
const read=f=>{const i=files.get(f);assert.ok(i,f);const b=Buffer.from(i.base64,'base64');assert.equal(hash(b),i.sha256,f);return b;};for(const f of files.keys())read(f);
for(const i of packet.inputs)assert.equal(hash(read(i.file)),i.sha256,i.file);
const reports=packet.reports.map(f=>JSON.parse(read(f)));
for(let index=0;index<2;index++){
 const r=reports[index],evidence=packet.evidence[index],dir=path.join(evidence,index===0?'evidence-qualified':'evidence');
 const receiptBytes=read(path.join(dir,'receipt.json')),receipt=JSON.parse(receiptBytes);
 if(index===0){assert.equal(hash(receiptBytes),r.receiptSha256);const p=JSON.parse(read(path.join(evidence,'pin.json')));for(const [f,h]of Object.entries(p.artifacts))assert.equal(hash(read(path.join(evidence,f))),h);}
 else assert.equal(hash(receiptBytes),JSON.parse(read(path.join(evidence,'evidence-pin.json'))).receiptSha256);
 assert.equal(receipt.status,'passed');assert.equal(receipt.capture.identical,true);assert.equal(receipt.capture.runs,2);
 for(const [f,h]of Object.entries(receipt.artifacts))assert.equal(hash(read(path.join(dir,f))),h,f);
 const capture=JSON.parse(read(path.join(dir,'run-1/capture.json')));assert.deepEqual(capture,JSON.parse(read(path.join(dir,'run-2/capture.json'))));
 const rows=capture.state.observations.filter(row=>index===0||!row.id.startsWith('slotlist-')&&!row.id.startsWith('signal-'));assert.equal(rows.length,index===0?10:22);
 if(index===0){
  for(const [q,s]of Object.entries(r.cohorts.parent)){assert.equal(hash(s.source),s.sourceSha256);assert.equal(hash(read(path.join(dir,'source',q.replaceAll('.','/')+'.as'))),s.sourceSha256);}
  assert.deepEqual(r.results.map(t=>t.target),['ES5','ES2015']);
  for(const t of r.results){
   assert.deepEqual(t.node,t.web);assert.deepEqual(t.node.rows,rows);assert.equal(t.rejectionGuards,6);assert.equal(t.node.checks.length,7);assert.ok(t.node.checks.every(c=>c.passed));for(const c of t.typechecks)assert.deepEqual(c.diagnostics,[]);
   assert.deepEqual(t.controls.map(c=>c.mutation),['wrong-initialization-order','skipped-initializer','wrong-constant-value']);assert.equal(t.mutations,3);
   const targetDir=path.join(path.dirname(packet.reports[0]),t.target);
   assert.equal(read(path.join(targetDir,'parent/parent-factory.js')).toString(),t.artifacts.parent.moduleSource);
   for(const m of t.controls){assert.equal(m.applied,1);assert.deepEqual(m.control,m.browserControl);assert.equal(m.control.failure,undefined);assert.notDeepEqual(m.control.rows.find(row=>row.id===m.detectedAt),rows.find(row=>row.id===m.detectedAt));assert.equal(hash(read(path.join(targetDir,'mutant-'+m.mutation+'-factory.js'))),m.factorySha256);assert.equal(hash(read(path.join(targetDir,'mutant-'+m.mutation+'.js'))),m.bundleSha256);}
  }
 }else{
  for(const i of r.emitted){assert.equal(hash(read(path.join(evidence,'source',i.qname.replaceAll('.','/')+'.as'))),i.sourceSha256);assert.equal(hash(read(i.file)),i.outputSha256);}
  assert.equal(r.results.length,2);assert.equal(new Set(r.results.map(t=>t.target)).size,2);for(const t of r.results){assert.deepEqual(t.node,rows);assert.deepEqual(t.web,rows);}assert.equal(r.rejectionGuards,8);assert.deepEqual(r.typecheck.diagnostics,[]);
 }
}
const b=JSON.parse(read(packet.baseline));assert.match(b.message,/computed static constant initialization requires source authority/);
// The pre-fix failure records the earlier fixture and hashes, not a retained executable compiler snapshot.
for(const s of Object.values(b.cohorts.parent))assert.equal(hash(s.source),s.sourceSha256);
const replay=reports[2];assert.equal(replay.sourceCount,1356);assert.equal(replay.baselineClassScriptCount,95);assert.equal(replay.classScriptCount,96);assert.equal(replay.productionProviderPromoted,false);
assert.equal(replay.baseline.message,'AS3_CLASS_INITIALIZER_UNSUPPORTED: unresolved class-value identity: Capabilities');
for(const result of [replay.unqualifiedProvider,replay.adaptedProvider]){assert.equal(result.status,'emitted');assert.equal(hash(read(result.file)),result.sha256);assert.equal(read(result.file).toString().length,result.characters);}
const original=JSON.parse(z.gunzipSync(read(replay.inputs[0].file)));assert.equal(replay.sources.length,1356);for(const i of replay.sources)assert.equal(hash(original.input.sources[i.identity].source),i.sha256);
const derivation=replay.derivation;assert.equal(derivation.originalSha256,original.input.sources[replay.identity].sourceSha256);let adapted=original.input.sources[replay.identity].source;for(const r of derivation.replacements){assert.equal(adapted.split(r.before).length,2);adapted=adapted.replace(r.before,r.after);}assert.equal(hash(adapted),derivation.adaptedSha256);
if(retaining||process.argv.includes('--check-current'))for(const [f,i]of files)assert.equal(hash(fs.readFileSync(f)),i.sha256,f);
if(retaining){fs.writeFileSync(archive,bytes,{flag:'wx'});fs.writeFileSync(pinFile,JSON.stringify({sha256:hash(bytes),bytes:bytes.length,files:files.size},null,2)+'\n',{flag:'wx'});}
console.log(JSON.stringify({status:'verified',primaryRows:10,adjacentRows:22,targets:2,realms:2,primaryGuards:6,hostChecks:7,mutationsPerTarget:3,typeErrors:0,originalSources:1356,replayScripts:96}));
module.exports={packet,reports,read};
