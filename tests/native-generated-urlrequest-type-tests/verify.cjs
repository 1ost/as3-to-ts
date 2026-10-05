const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib');
const root=path.resolve(__dirname,'../..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex'),archive=path.join(__dirname,'runtime.json.gz'),pinFile=path.join(__dirname,'runtime-pin.json');
const retaining=process.argv[2]==='--retain';let packet,bytes;
if(retaining){
 assert.equal(process.argv.length,5);assert.ok(!fs.existsSync(archive));assert.ok(!fs.existsSync(pinFile));
 const reports=process.argv.slice(3).map(f=>path.resolve(f)),files=new Map(),inputs=[];
 const add=(file,sha)=>{file=path.resolve(file);const b=fs.readFileSync(file);if(sha)assert.equal(hash(b),sha,file);files.set(file,{file,sha256:hash(b),base64:b.toString('base64')});};
 const input=i=>{const file=path.resolve(root,i.file);inputs.push({...i,file});add(file,i.sha256);};
 const walk=dir=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else add(f);}};
 const evidence=[path.resolve(root,'../engine/tests/nativeFlashOracle/urlrequest-type-tests'),path.resolve(root,'../engine/tests/nativeFlashOracle/generated-url-references')];
 const runners=['native-generated-urlrequest-type-tests','native-generated-url-references'];
 reports.forEach((file,index)=>{
  const r=JSON.parse(fs.readFileSync(file));if(index===0)r.compilerInputs.forEach(input);
  if(index===0){r.results.flatMap(t=>[...t.inputs,...t.typechecks.flatMap(c=>c.inputs)]).forEach(input);for(const [name,h]of [['run.cjs',r.runnerSha256],['observer.ts',r.observerSha256]])input({file:path.join(root,'tests',runners[index],name),sha256:h});}
  else{
   r.providerGraph.forEach(i=>input({...i,file:path.resolve(root,'../engine',i.file)}));
   for(const i of r.emitted)input({file:i.file,sha256:i.outputSha256});
   input({file:path.join(root,'tests',runners[index],'runtime-driver.js'),sha256:r.observer.sha256});
   add(path.join(root,'tests',runners[index],'run.cjs'));
  }
  walk(path.dirname(file));walk(evidence[index]);
 });
 walk(path.join(__dirname,'baseline-failure'));
 packet={reports,evidence,inputs,files:[...files.values()]};bytes=z.gzipSync(JSON.stringify(packet),{level:9});
}else{bytes=fs.readFileSync(archive);const p=JSON.parse(fs.readFileSync(pinFile));assert.equal(hash(bytes),p.sha256);assert.equal(bytes.length,p.bytes);packet=JSON.parse(z.gunzipSync(bytes));assert.equal(packet.files.length,p.files);}
const files=new Map(packet.files.map(i=>[i.file,i]));assert.equal(files.size,packet.files.length);
const read=f=>{const i=files.get(f);assert.ok(i,f);const b=Buffer.from(i.base64,'base64');assert.equal(hash(b),i.sha256,f);return b;};for(const f of files.keys())read(f);
for(const i of packet.inputs)assert.equal(hash(read(i.file)),i.sha256,i.file);
const reports=packet.reports.map(f=>JSON.parse(read(f)));
reports.forEach((r,index)=>{
 const evidence=packet.evidence[index],dir=path.join(evidence,'evidence');
 const receiptBytes=read(path.join(dir,'receipt.json')),receipt=JSON.parse(receiptBytes);
 if(index===0)assert.equal(hash(receiptBytes),r.receiptSha256);else assert.equal(hash(receiptBytes),JSON.parse(read(path.join(evidence,'evidence-pin.json'))).receiptSha256);assert.equal(receipt.status,'passed');assert.equal(receipt.capture.identical,true);assert.equal(receipt.capture.runs,2);
 for(const [f,h]of Object.entries(receipt.artifacts))assert.equal(hash(read(path.join(dir,f))),h,f);
 const rows=JSON.parse(read(path.join(dir,'run-1/capture.json'))).state.observations;
 assert.deepEqual(rows,JSON.parse(read(path.join(dir,'run-2/capture.json'))).state.observations);assert.equal(rows.length,index===0?31:77);
 if(index===0)for(const [q,s]of Object.entries(r.cohorts.parent)){assert.equal(hash(s.source),s.sourceSha256);assert.equal(hash(read(path.join(dir,'source',q.replaceAll('.','/')+'.as'))),s.sourceSha256);}
 else for(const i of r.emitted){assert.equal(hash(read(path.join(evidence,'source',i.qname.replaceAll('.','/')+'.as'))),i.sourceSha256);assert.equal(hash(read(i.file)),i.outputSha256);}
 if(index===0){
  assert.deepEqual(r.results.map(t=>t.target),['ES5','ES2015']);
  for(const t of r.results){
   assert.deepEqual(t.node,t.web);assert.deepEqual(t.web.rows,rows);assert.equal(t.rejectionGuards,10);assert.equal(t.node.checks.length,6);assert.ok(t.node.checks.every(c=>c.passed));for(const c of t.typechecks)assert.deepEqual(c.diagnostics,[]);
   assert.deepEqual(t.controls.map(c=>c.mutation),['is-false','as-null','short-circuit']);
   for(const m of t.controls){assert.ok(m.applied>0);assert.deepEqual(m.control,m.browserControl);assert.equal(m.control.failure,undefined);assert.notDeepEqual(m.control.rows.find(row=>row.id===m.detectedAt),rows.find(row=>row.id===m.detectedAt));}
  }
 }else{
  assert.equal(r.results.length,2);assert.equal(new Set(r.results.map(t=>t.target)).size,2);
  for(const t of r.results){assert.deepEqual(t.node,rows);assert.deepEqual(t.web,rows);}assert.equal(r.rejectionGuards,6);assert.equal(r.providerGuards,6);assert.deepEqual(r.typecheck.diagnostics,[]);
 }
});
const baselineDir=path.join(__dirname,'baseline-failure'),b=JSON.parse(read(path.join(baselineDir,'failure.json')));
assert.equal(b.message,'AS3_REFERENCE_COERCION_UNSUPPORTED: reference type operation requires class-evaluation authority: flash.net.URLRequest at offset 275');
for(const name of ['native-reference-coercion','emitter'])for(const [d,e]of [['src','ts'],['lib','js']]){const f=path.join(root,d,'emit/'+name+'.'+e);assert.equal(hash(read(path.join(baselineDir,d,'emit/'+name+'.'+e))),b.compilerInputs.find(i=>i.file===f).sha256);}
if(retaining||process.argv.includes('--check-current'))for(const [f,i]of files)assert.equal(hash(fs.readFileSync(f)),i.sha256,f);
if(retaining){fs.writeFileSync(archive,bytes,{flag:'wx'});fs.writeFileSync(pinFile,JSON.stringify({sha256:hash(bytes),bytes:bytes.length,files:files.size},null,2)+'\n',{flag:'wx'});}
console.log(JSON.stringify({status:'verified',primaryRows:31,adjacentRows:77,targets:2,realms:2,primaryGuards:10,hostGuards:6,mutationsPerTarget:3,typeErrors:0}));
module.exports={packet,reports,read};
