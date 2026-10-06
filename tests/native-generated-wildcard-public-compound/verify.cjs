const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib');
const root=path.resolve(__dirname,'../..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex'),archive=path.join(__dirname,'runtime.json.gz'),pinFile=path.join(__dirname,'runtime-pin.json');
const names=['wildcard-public-compound','interface-compound','public-compound'],retaining=process.argv[2]==='--retain';let packet,bytes;
if(retaining){
 assert.equal(process.argv.length,6);assert(!fs.existsSync(archive));assert(!fs.existsSync(pinFile));
 const reports=process.argv.slice(3).map(f=>path.resolve(f)),files=new Map(),inputs=[],engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../engine');
 const evidence=[...names.slice(0,2).map(name=>path.join(engine,'tests/nativeFlashOracle',name)),path.join(root,'tests/native-generated-public-compound')];
 const add=(file,sha,normalized=false)=>{file=path.resolve(file);const b=fs.readFileSync(file);if(sha)assert.equal(hash(normalized?b.toString().replace(/\r\n/g,'\n'):b),sha,file);files.set(file,{file,sha256:hash(b),base64:b.toString('base64')});};
 const input=(i,normalized=false)=>{const file=path.resolve(root,i.file);inputs.push({...i,file,normalized});add(file,i.sha256,normalized);};
 const walk=dir=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else add(f);}};
 reports.forEach((file,index)=>{const r=JSON.parse(fs.readFileSync(file));r.compilerInputs.forEach(i=>input(i,index===2));
  if(index===1){r.runs.flatMap(t=>[...t.inputs,...t.typecheck.inputs]).forEach(i=>input(i));r.runnerInputs.forEach(i=>input({...i,file:path.join(root,'tests/native-generated-interface-compound',i.file)}));}
  else{r.results.flatMap(t=>[...(t.inputs||t.bundleInputs),...t.typechecks.flatMap(c=>c.inputs)]).forEach(i=>input(i));for(const [name,h]of [['run.cjs',r.runnerSha256],['observer.ts',r.observerSha256]])input({file:path.join(root,'tests','native-generated-'+names[index],name),sha256:h});}
  walk(path.dirname(file));walk(evidence[index]);
 });walk(path.join(__dirname,'baseline-failure'));packet={reports,evidence,inputs,files:[...files.values()]};bytes=z.gzipSync(JSON.stringify(packet),{level:9});
}else{bytes=fs.readFileSync(archive);const p=JSON.parse(fs.readFileSync(pinFile));assert.equal(hash(bytes),p.sha256);assert.equal(bytes.length,p.bytes);packet=JSON.parse(z.gunzipSync(bytes));assert.equal(packet.files.length,p.files);}
const files=new Map(packet.files.map(i=>[i.file,i]));assert.equal(files.size,packet.files.length);
const read=f=>{const i=files.get(f);assert.ok(i,f);const b=Buffer.from(i.base64,'base64');assert.equal(hash(b),i.sha256,f);return b;};for(const f of files.keys())read(f);for(const i of packet.inputs){const b=read(i.file);assert.equal(hash(i.normalized?b.toString().replace(/\r\n/g,'\n'):b),i.sha256,i.file);}
const reports=packet.reports.map(f=>JSON.parse(read(f)));
reports.forEach((r,index)=>{
 const evidence=packet.evidence[index],dir=path.join(evidence,'evidence'),receiptBytes=read(path.join(dir,'receipt.json')),receipt=JSON.parse(receiptBytes);if(index!==2)assert.equal(hash(receiptBytes),r.receiptSha256);assert.equal(receipt.status,'passed');assert.equal(receipt.capture.identical,true);assert.equal(receipt.capture.runs,2);
 for(const [f,h]of Object.entries(receipt.artifacts))assert.equal(hash(read(path.join(dir,f))),h,f);
 const rows=JSON.parse(read(path.join(dir,'run-1/capture.json'))).state.observations;assert.deepEqual(rows,JSON.parse(read(path.join(dir,'run-2/capture.json'))).state.observations);assert.deepEqual(rows,JSON.parse(read(path.join(evidence,'expected.json'))));assert.equal(rows.length,index===0?44:24);
 const sources=index===1?r.sources:index===0?r.cohorts.parent:r.cohorts.subject;for(const [q,s]of Object.entries(sources)){assert.equal(hash(s.source),s.sourceSha256);assert.equal(hash(read(path.join(dir,'source',q.replaceAll('.','/')+'.as'))),s.sourceSha256);}
 const results=r.results||r.runs;assert.deepEqual(results.map(t=>t.target),['ES5','ES2015']);
 for(const t of results){
  const result=index===1?t.actual:t;assert.deepEqual(result.node,result.web);assert.deepEqual(result.node.rows,rows);
  if(index===1){assert.deepEqual(t.typecheck.diagnostics,[]);assert.equal(t.guards.length,12);assert.equal(t.controls.length,1);for(const m of t.controls){assert.deepEqual(m.node,m.web);assert.notDeepEqual(m.node.rows,rows);assert(packet.files.some(f=>f.sha256===m.bundleSha256));}}
  else{assert.equal(t.rejectionGuards,index===0?9:7);for(const c of t.typechecks)assert.deepEqual(c.diagnostics,[]);assert.equal(t.mutations,4);
   if(index===0){assert.deepEqual(t.controls.map(c=>c.mutation),['addition-write-receiver','subtraction-write-receiver','subtraction-order','addition-order']);for(const m of t.controls){assert(m.applied>0);assert.deepEqual(m.control,m.browserControl);assert.equal(m.control.failure,undefined);assert.notDeepEqual(m.control.rows.find(row=>row.id===m.detectedAt),rows.find(row=>row.id===m.detectedAt));}}
  }
 }
});
const b=JSON.parse(read(path.join(__dirname,'baseline-failure/failure.json')));assert.deepEqual(b.cohorts,reports[0].cohorts);assert.equal(b.message,'AS3_GENERATED_LEXICAL_UNSUPPORTED: foreign public lexical collision operation');
for(const [d,e]of [['src','ts'],['lib','js']]){const f=path.join(root,d,'emit/native-generated-lexical.'+e);assert.equal(hash(read(path.join(__dirname,'baseline-failure',d,'emit/native-generated-lexical.'+e))),b.compilerInputs.find(i=>i.file===f).sha256);}
if(retaining||process.argv.includes('--check-current'))for(const [f,i]of files)assert.equal(hash(fs.readFileSync(f)),i.sha256,f);
if(retaining){fs.writeFileSync(archive,bytes,{flag:'wx'});fs.writeFileSync(pinFile,JSON.stringify({sha256:hash(bytes),bytes:bytes.length,files:files.size},null,2)+'\n',{flag:'wx'});}
console.log(JSON.stringify({status:'verified',rows:[44,24,24],targets:2,realms:2,primaryGuards:9,primaryMutations:4,typeErrors:0}));module.exports={packet,reports,read};
