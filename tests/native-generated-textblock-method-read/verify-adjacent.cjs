const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib');
const root=path.resolve(__dirname,'../..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||path.join(root,'../LayaAir-op2-textblock-method-read-review'));
const specs=[
 {name:'chained-interface-call',fixture:path.join(engine,'tests/nativeFlashOracle/chained-interface-call'),test:'native-generated-chained-interface-call',rows:18,guards:6,mutations:2},
 {name:'namespace-namesake',fixture:path.join(engine,'tests/nativeFlashOracle/namespace-namesake'),test:'native-generated-namespace-namesake',rows:16,guards:7,mutations:2},
 {name:'timer',fixture:path.join(root,'tests/native-timer-lexical'),test:'native-timer-lexical',rows:15,guards:8,mutations:1}
];
const archive=path.join(__dirname,'adjacent.json.gz'),pinFile=path.join(__dirname,'adjacent-pin.json');
if(require.main===module&&process.argv[2]==='--retain'){
 assert.equal(process.argv.length,6);assert(!fs.existsSync(archive));
 const files=new Map(),inputs=[],reports=[];
 const add=(file,sha,normalize=false)=>{file=path.resolve(root,file);const bytes=fs.readFileSync(file);if(sha)assert.equal(hash(normalize?bytes.toString('utf8').replace(/\r\n/g,'\n'):bytes),sha,file);files.set(file,{file,sha256:hash(bytes),base64:bytes.toString('base64')});};
 const walk=dir=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else add(f);}};
 specs.forEach((s,index)=>{
  const file=path.resolve(process.argv[3+index]),r=JSON.parse(fs.readFileSync(file));reports.push({file,...s});
  for(const i of r.compilerInputs){add(i.file,i.sha256,s.name==='timer');inputs.push(path.resolve(root,i.file));}
  for(const x of r.results)for(const i of [...(x.inputs||x.bundleInputs),...x.typechecks.flatMap(t=>t.inputs)]){add(i.file,i.sha256);inputs.push(path.resolve(root,i.file));}
  add(path.join(root,'tests',s.test,'run.cjs'),r.runnerSha256);add(path.join(root,'tests',s.test,'observer.ts'),r.observerSha256);
  walk(path.dirname(file));walk(path.join(s.fixture,'evidence'));walk(path.join(s.fixture,'source'));
  for(const f of ['expected.json','evidence-pin.json','verify.cjs'])add(path.join(s.fixture,f));
 });
 const bytes=z.gzipSync(JSON.stringify({reports,inputs,files:[...files.values()]}),{level:9});
 fs.writeFileSync(archive,bytes);fs.writeFileSync(pinFile,JSON.stringify({sha256:hash(bytes),bytes:bytes.length,files:files.size},null,2)+'\n');
}
const pin=JSON.parse(fs.readFileSync(pinFile)),bytes=fs.readFileSync(archive);assert.equal(hash(bytes),pin.sha256);assert.equal(bytes.length,pin.bytes);
const packet=JSON.parse(z.gunzipSync(bytes)),files=new Map(packet.files.map(i=>[i.file,i]));assert.equal(files.size,pin.files);
const read=f=>{const i=files.get(f);assert(i,f);const b=Buffer.from(i.base64,'base64');assert.equal(hash(b),i.sha256,f);return b;};for(const f of files.keys())read(f);
assert.deepEqual(packet.reports.map(r=>r.name),specs.map(s=>s.name));
for(const [index,s]of packet.reports.entries()){
 const spec=specs[index];for(const k of ['rows','guards','mutations'])assert.equal(s[k],spec[k]);
 const r=JSON.parse(read(s.file)),expected=JSON.parse(read(path.join(s.fixture,'expected.json')));assert.equal(expected.length,s.rows);
 const receiptBytes=read(path.join(s.fixture,'evidence/receipt.json')),receipt=JSON.parse(receiptBytes),ep=JSON.parse(read(path.join(s.fixture,'evidence-pin.json')));
 assert.equal(hash(receiptBytes),ep.receiptSha256||ep.sha256);assert.equal(receipt.status,'passed');assert.equal(receipt.capture.identical,true);assert.equal(receipt.capture.runs,2);assert.equal(receipt.capture.observationCount,s.rows);
 for(const [f,sha]of Object.entries(receipt.artifacts))assert.equal(hash(read(path.join(s.fixture,'evidence',f))),sha,f);
 for(const n of [1,2])assert.deepEqual(JSON.parse(read(path.join(s.fixture,'evidence/run-'+n+'/capture.json'))).state.observations,expected);
 for(const cohort of Object.values(r.cohorts))for(const v of Object.values(cohort)){assert.equal(hash(v.source),v.sourceSha256);assert(Object.values(receipt.artifacts).includes(v.sourceSha256));}
 assert.equal(hash(read(path.join(root,'tests',s.test,'run.cjs'))),r.runnerSha256);assert.equal(hash(read(path.join(root,'tests',s.test,'observer.ts'))),r.observerSha256);
 for(const i of r.compilerInputs){const b=read(path.resolve(root,i.file));assert.equal(hash(s.name==='timer'?b.toString('utf8').replace(/\r\n/g,'\n'):b),i.sha256);}
 assert.deepEqual(r.results.map(x=>x.target),['ES5','ES2015']);
 for(const x of r.results){
  assert.deepEqual(x.node,x.web);assert.deepEqual(x.web.rows,expected);assert.equal(x.rejectionGuards,s.guards);assert.equal(x.mutations,s.mutations);assert.equal(x.controls.length,s.mutations);
  for(const t of x.typechecks)assert.deepEqual(t.diagnostics,[]);
  for(const c of x.controls){assert.equal(c.applied,s.name==='timer'?2:1);assert.notDeepEqual((c.control||c.result).rows,expected);}
  for(const i of [...(x.inputs||x.bundleInputs),...x.typechecks.flatMap(t=>t.inputs)])assert.equal(hash(read(path.resolve(root,i.file))),i.sha256);
 }
}
if(process.argv.includes('--check-current')||process.argv[2]==='--retain')for(const f of files.keys())assert.equal(hash(fs.readFileSync(f)),files.get(f).sha256,f);
console.log(JSON.stringify({status:'verified',adjacentObservations:49,targets:2,realms:2,typeErrors:0}));
module.exports={packet,files,read};
