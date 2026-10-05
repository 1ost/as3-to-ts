const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib');
const root=path.resolve(__dirname,'../..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const archive=path.join(__dirname,'runtime.json.gz'),pinFile=path.join(__dirname,'runtime-pin.json'),retaining=process.argv[2]==='--retain';
let packet,bytes;
if(retaining){
 assert.equal(process.argv.length,7);assert.ok(!fs.existsSync(archive));assert.ok(!fs.existsSync(pinFile));
 const reports=process.argv.slice(3).map(f=>path.resolve(f)),files=new Map(),inputs=[];
 const add=(file,sha)=>{file=path.resolve(file);const b=fs.readFileSync(file);if(sha)assert.equal(hash(b),sha,file);files.set(file,{file,sha256:hash(b),base64:b.toString('base64')});};
 const input=i=>{const file=path.resolve(root,i.file);inputs.push({...i,file});add(file,i.sha256);};
 const walk=dir=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else add(f);}};
 const evidence=[path.resolve(root,'../engine/tests/nativeFlashOracle/native-cast-namespace'),path.resolve(root,'../engine/tests/nativeFlashOracle/generated-movieclip-references'),path.resolve(root,'../engine/tests/nativeFlashOracle/namespace-namesake')];
 const runners=['native-generated-native-cast-namespace','native-generated-movieclip-references','native-generated-namespace-namesake'];
 reports.forEach((file,index)=>{
  const r=JSON.parse(fs.readFileSync(file));
  if(index===0||index===2){r.compilerInputs.forEach(input);r.results.flatMap(t=>[...t.inputs,...t.typechecks.flatMap(c=>c.inputs)]).forEach(input);
   for(const [name,h]of [['run.cjs',r.runnerSha256],['observer.ts',r.observerSha256]])input({file:path.join(root,'tests',runners[index],name),sha256:h});}
  else if(index===1){r.providerGraph.forEach(i=>input({...i,file:path.resolve(root,'../engine',i.file)}));for(const i of r.emitted)input({file:i.file,sha256:i.outputSha256});input({file:path.join(root,'tests',runners[index],'runtime-driver.js'),sha256:r.observer.sha256});add(path.join(root,'tests',runners[index],'run.cjs'));}
  else{r.inputs.forEach(input);add(path.join(__dirname,'replay.cjs'));}
  walk(path.dirname(file));if(index<3)walk(evidence[index]);
 });
 walk(path.join(__dirname,'baseline-failure'));add(path.resolve(root,'../engine/tests/nativeCanonicalDisplayAncestry/init-imports.ts'));
 packet={reports,evidence,inputs,files:[...files.values()]};bytes=z.gzipSync(JSON.stringify(packet),{level:9});
}else{bytes=fs.readFileSync(archive);const p=JSON.parse(fs.readFileSync(pinFile));assert.equal(hash(bytes),p.sha256);assert.equal(bytes.length,p.bytes);packet=JSON.parse(z.gunzipSync(bytes));assert.equal(packet.files.length,p.files);}
const files=new Map(packet.files.map(i=>[i.file,i]));assert.equal(files.size,packet.files.length);
const read=f=>{const i=files.get(f);assert.ok(i,f);const b=Buffer.from(i.base64,'base64');assert.equal(hash(b),i.sha256,f);return b;};for(const f of files.keys())read(f);
for(const i of packet.inputs)assert.equal(hash(read(i.file)),i.sha256,i.file);
const reports=packet.reports.map(f=>JSON.parse(read(f)));
for(let index=0;index<3;index++){
 const r=reports[index],evidence=packet.evidence[index],dir=path.join(evidence,index===0?'evidence-expanded':'evidence');
 const receiptBytes=read(path.join(dir,'receipt.json')),receipt=JSON.parse(receiptBytes);
 assert.equal(hash(receiptBytes),JSON.parse(read(path.join(evidence,'evidence-pin.json'))).receiptSha256);
 if(index!==1)assert.equal(hash(receiptBytes),r.receiptSha256);
 assert.equal(receipt.status,'passed');assert.equal(receipt.capture.identical,true);assert.equal(receipt.capture.runs,2);
 for(const [f,h]of Object.entries(receipt.artifacts))assert.equal(hash(read(path.join(dir,f))),h,f);
 const capture=JSON.parse(read(path.join(dir,'run-1/capture.json')));assert.deepEqual(capture,JSON.parse(read(path.join(dir,'run-2/capture.json'))));
 let rows=capture.state.observations;assert.equal(rows.length,[15,22,16][index]);
 if(index===2)rows=rows.map(row=>row.id.startsWith('metadata-')?{...row,value:row.value.replace(/>\s+</g,'><')}:row);
 if(index===0||index===2){
  for(const [q,u]of Object.entries(r.cohorts.parent)){assert.equal(hash(u.source),u.sourceSha256);assert.equal(hash(read(path.join(dir,'source',q.replaceAll('.','/')+'.as'))),u.sourceSha256);}
  assert.deepEqual(r.results.map(t=>t.target),['ES5','ES2015']);
  for(const t of r.results){
   assert.deepEqual(t.web.rows,rows);assert.equal(t.rejectionGuards,index===0?11:7);if(index===0)assert.ok(t.web.checks.every(c=>c.passed));else assert.equal(t.web.hostGuards,4);for(const c of t.typechecks)assert.deepEqual(c.diagnostics,[]);
   if(index===0){assert.equal(t.web.checks.length,4);assert.deepEqual(t.controls.map(c=>c.mutation),['erased-cast','wrong-namespace','null-error']);assert.equal(t.mutations,3);}
   else{assert.deepEqual(t.node,t.web);assert.equal(t.mutations,2);assert.deepEqual(t.controls.map(c=>c.mutation),['wrong-method','repeat-receiver']);}
   const targetDir=path.join(path.dirname(packet.reports[index]),t.target);
   assert.equal(read(path.join(targetDir,'parent/parent-factory.js')).toString(),t.artifacts.parent.moduleSource);
   for(const m of t.controls){assert.ok(m.applied>0);assert.equal(m.control.failure,undefined);assert.notDeepEqual(m.control.rows,rows);
    if(index===0){assert.notDeepEqual(m.control.rows.find(row=>row.id===m.detectedAt),rows.find(row=>row.id===m.detectedAt));assert.equal(hash(read(path.join(targetDir,'mutant-'+m.mutation+'-factory.js'))),m.factorySha256);assert.equal(hash(read(path.join(targetDir,'mutant-'+m.mutation+'.js'))),m.bundleSha256);}
   }
  }
 }else{
  for(const i of r.emitted){assert.equal(hash(read(path.join(evidence,'source',i.qname.replaceAll('.','/')+'.as'))),i.sourceSha256);assert.equal(hash(read(i.file)),i.outputSha256);}
  assert.equal(r.results.length,2);assert.equal(new Set(r.results.map(t=>t.target)).size,2);for(const t of r.results)assert.deepEqual(t.web,rows);assert.equal(r.rejectionGuards,9);assert.deepEqual(r.typecheck.diagnostics,[]);
 }
}
const baselineDir=path.join(__dirname,'baseline-failure'),b=JSON.parse(read(path.join(baselineDir,'failure.json')));
assert.equal(b.message,'AS3_NAMESPACE_UNSUPPORTED: open namespace member requires explicit selector: stop');
for(const [d,e]of [['src','ts'],['lib','js']]){const f=path.join(root,d,'emit/emitter.'+e);assert.equal(hash(read(path.join(baselineDir,'emitter.'+e))),b.compilerInputs.find(i=>i.file===f).sha256);}
assert.equal(hash(read(path.join(baselineDir,'run.cjs'))),b.runnerSha256);
for(const [q,u]of Object.entries(b.cohorts.parent)){assert.equal(hash(u.source),u.sourceSha256);assert.equal(hash(read(path.join(packet.evidence[0],'evidence-qualified/source',q.replaceAll('.','/')+'.as'))),u.sourceSha256);}
const replay=reports[3];assert.equal(replay.sourceCount,1356);assert.equal(replay.classScriptCount,95);assert.equal(replay.productionProviderPromoted,false);
assert.equal(replay.baseline.message,'AS3_CLASS_INITIALIZER_UNSUPPORTED: unresolved class-value identity: Capabilities');assert.equal(replay.unqualifiedProvider.status,'emitted');assert.equal(hash(read(replay.unqualifiedProvider.file)),replay.unqualifiedProvider.sha256);assert.equal(read(replay.unqualifiedProvider.file).toString().length,replay.unqualifiedProvider.characters);
const original=JSON.parse(z.gunzipSync(read(replay.inputs[0].file)));assert.equal(replay.identity,original.emission.identity);assert.equal(replay.sources.length,1356);for(const i of replay.sources)assert.equal(hash(original.input.sources[i.identity].source),i.sha256);
if(retaining||process.argv.includes('--check-current'))for(const [f,i]of files)assert.equal(hash(fs.readFileSync(f)),i.sha256,f);
if(retaining){fs.writeFileSync(archive,bytes,{flag:'wx'});fs.writeFileSync(pinFile,JSON.stringify({sha256:hash(bytes),bytes:bytes.length,files:files.size},null,2)+'\n',{flag:'wx'});}
console.log(JSON.stringify({status:'verified',primaryRows:15,adjacentRows:[22,16],targets:2,primaryRuntime:'Chromium with Laya under strict CSP',primaryGuards:11,hostChecks:4,mutationsPerTarget:3,typeErrors:0,originalSources:1356,originalEmission:replay.unqualifiedProvider.status}));
module.exports={packet,reports,read};
