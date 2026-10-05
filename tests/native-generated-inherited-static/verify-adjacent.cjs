const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib');
const here=__dirname,root=path.resolve(here,'../..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const engine=path.resolve(root,'../LayaAir-op2-inherited-static-review');
const specs=[{name:'protected-static-booleans',rows:10,guards:12},{name:'protected-static-strings',rows:13,guards:4}];
const archive=path.join(here,'adjacent.json.gz'),pinFile=path.join(here,'adjacent-pin.json'),retaining=process.argv[2]==='--retain';
let bytes,pin;
if(retaining){
 assert.equal(process.argv.length,5);assert.ok(!fs.existsSync(archive));assert.ok(!fs.existsSync(pinFile));
 const files=new Map(),inputs=[],reports=[];
 const add=(file,sha)=>{const b=fs.readFileSync(file);if(sha)assert.equal(hash(b),sha,file);files.set(file,{file,sha256:hash(b),base64:b.toString('base64')});};
 const walk=dir=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else add(f);}};
 for(const [i,s]of specs.entries()){
  const file=path.resolve(process.argv[3+i]),r=JSON.parse(fs.readFileSync(file)),fixture=path.join(engine,'tests/nativeFlashOracle/generated-'+s.name);
  const runner=path.join(root,'tests/native-generated-'+s.name+'/run.cjs');add(runner);reports.push({...s,file,fixture,runner,runnerSha256:hash(fs.readFileSync(runner))});
  for(const p of r.providerGraph){const item={file:path.join(engine,p.file),sha256:p.sha256};inputs.push(item);add(item.file,item.sha256);}
  for(const p of r.emitted)add(p.file,p.outputSha256);
  for(const file of r.observer.files)add(file,r.observer.sha256);
  walk(path.dirname(file));walk(fixture);
 }
 // The older regression runners do not retain their compiler graph. They ran
 // after the primary proof with this same, unchanged source and compiled graph.
 for(const i of require('./verify.cjs').report.compilerInputs){inputs.push(i);add(i.file,i.sha256);}
 bytes=z.gzipSync(JSON.stringify({reports,inputs,files:[...files.values()]}),{level:9});pin={sha256:hash(bytes),bytes:bytes.length,files:files.size};
}else{bytes=fs.readFileSync(archive);pin=JSON.parse(fs.readFileSync(pinFile));}
assert.equal(hash(bytes),pin.sha256);assert.equal(bytes.length,pin.bytes);
const packet=JSON.parse(z.gunzipSync(bytes)),files=new Map(packet.files.map(i=>[i.file,i]));assert.equal(files.size,pin.files);
const read=f=>{const i=files.get(f);assert.ok(i,f);const b=Buffer.from(i.base64,'base64');assert.equal(hash(b),i.sha256,f);return b;};for(const f of files.keys())read(f);
assert.deepEqual(packet.reports.map(s=>({name:s.name,rows:s.rows,guards:s.guards})),specs);
for(const s of packet.reports){
 const r=JSON.parse(read(s.file)),expected=JSON.parse(read(path.join(s.fixture,'expected.json')));assert.equal(expected.length,s.rows);
 assert.equal(hash(read(s.runner)),s.runnerSha256);
 const receiptBytes=read(path.join(s.fixture,'evidence/receipt.json')),receipt=JSON.parse(receiptBytes),ep=JSON.parse(read(path.join(s.fixture,'evidence-pin.json')));
 assert.equal(hash(receiptBytes),ep.receiptSha256);assert.equal(receipt.status,'passed');assert.equal(receipt.capture.identical,true);assert.equal(receipt.capture.runs,2);assert.equal(receipt.capture.observationCount,s.rows);
 for(const [f,sha]of Object.entries(receipt.artifacts))assert.equal(hash(read(path.join(s.fixture,'evidence',f))),sha,f);
 for(const n of [1,2])assert.deepEqual(JSON.parse(read(path.join(s.fixture,'evidence/run-'+n+'/capture.json'))).state.observations,expected);
 assert.equal(r.combined,true);assert.equal(r.rejectionGuards,s.guards);assert.deepEqual(r.typecheck.diagnostics,[]);assert.deepEqual(r.results.map(x=>x.target),[1,2]);
 for(const x of r.results){assert.deepEqual(x.node,expected);assert.deepEqual(x.web,x.node);}
 for(const e of r.emitted){assert.equal(hash(read(e.file)),e.outputSha256);assert.equal(receipt.artifacts['source/'+e.qname.replaceAll('.','/')+'.as'],e.sourceSha256);}
 for(const file of r.observer.files)assert.equal(hash(read(file)),r.observer.sha256);
}
for(const i of packet.inputs)assert.equal(hash(read(i.file)),i.sha256,i.file);
if(retaining||process.argv.includes('--check-current'))for(const f of files.keys())assert.equal(hash(fs.readFileSync(f)),files.get(f).sha256,f);
if(retaining){fs.writeFileSync(archive,bytes,{flag:'wx'});fs.writeFileSync(pinFile,JSON.stringify(pin,null,2)+'\n',{flag:'wx'});}
console.log(JSON.stringify({status:'verified',adjacentAIRRows:23,targets:2,realms:2,guards:16,typeErrors:0,strictCSP:false}));
