const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib');
const root=path.resolve(__dirname,'../..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||path.join(root,'../LayaAir-op2-interface-method-read-review'));
const specs=[{name:'chained-interface',fixture:path.join(engine,'tests/nativeFlashOracle/chained-interface'),rows:13,guards:5},{name:'chained-interface-call',fixture:path.join(engine,'tests/nativeFlashOracle/chained-interface-call'),rows:18,guards:6},{name:'private-implements',fixture:path.join(engine,'tests/nativeFlashOracle/file-local-implements'),rows:21,guards:10,legacy:true}];
const archive=path.join(__dirname,'adjacent.json.gz'),pinFile=path.join(__dirname,'adjacent-pin.json');
function inputsFor(r,s){return [...(r.compilerInputs||[]),...r.results.flatMap(x=>[...(x.inputs||[]),...x.typechecks.flatMap(t=>t.inputs)]),{file:path.join(root,'tests/native-generated-'+s.name+'/run.cjs'),sha256:r.runnerSha256},{file:path.join(root,'tests/native-generated-'+s.name+'/observer.ts'),sha256:r.observerSha256}];}
const retaining=require.main===module&&process.argv[2]==='--retain';let retainedBytes,retainedPin;
if(retaining){
 assert.equal(process.argv.length,6);assert(!fs.existsSync(archive));assert(!fs.existsSync(pinFile));const files=new Map(),inputs=[],reports=[];
 const add=(file,sha,normalize=false)=>{file=path.resolve(root,file);const b=fs.readFileSync(file);if(sha)assert.equal(hash(normalize?b.toString('utf8').replace(/\r\n/g,'\n'):b),sha,file);files.set(file,{file,sha256:hash(b),base64:b.toString('base64')});};
 const walk=dir=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else add(f);}};
 for(const [index,s]of specs.entries()){
  const file=path.resolve(process.argv[3+index]),r=JSON.parse(fs.readFileSync(file));reports.push({file,...s});
  for(const i of inputsFor(r,s)){add(i.file,i.sha256,i.normalize);inputs.push(i);}
  walk(path.dirname(file));walk(s.fixture);
 }
 // Both regressions ran after the primary test without a rebuild or edits.
 // Preserve the complete raw compiler source and JS graph for the older runner.
 for(const i of require('./verify.cjs').report.compilerInputs){add(i.file,i.sha256);inputs.push(i);}
 const b=z.gzipSync(JSON.stringify({reports,inputs,files:[...files.values()]}),{level:9});retainedBytes=b;retainedPin={sha256:hash(b),bytes:b.length,files:files.size};
}
const pin=retaining?retainedPin:JSON.parse(fs.readFileSync(pinFile)),bytes=retaining?retainedBytes:fs.readFileSync(archive);assert.equal(hash(bytes),pin.sha256);assert.equal(bytes.length,pin.bytes);
const packet=JSON.parse(z.gunzipSync(bytes)),files=new Map(packet.files.map(i=>[i.file,i]));assert.equal(files.size,pin.files);
const read=f=>{const i=files.get(f);assert(i,f);const b=Buffer.from(i.base64,'base64');assert.equal(hash(b),i.sha256,f);return b;};for(const f of files.keys())read(f);
assert.deepEqual(packet.reports.map(s=>s.name),specs.map(s=>s.name));
for(const [index,s]of packet.reports.entries()){
 assert.equal(s.rows,specs[index].rows);const r=JSON.parse(read(s.file)),expected=JSON.parse(read(path.join(s.fixture,'expected.json')));assert.equal(expected.length,s.rows);
 const receiptBytes=read(path.join(s.fixture,s.legacy?'flash/receipt.json':'evidence/receipt.json')),receipt=JSON.parse(receiptBytes),ep=JSON.parse(read(path.join(s.fixture,'evidence-pin.json')));
 assert.equal(hash(receiptBytes),ep.receiptSha256||ep.sha256||ep);assert.equal(receipt.status,'passed');if(!s.legacy)assert.equal(receipt.capture.identical,true);assert.equal(receipt.capture.runs,2);if(!s.legacy)assert.equal(receipt.capture.observationCount,s.rows);
 for(const [f,sha]of Object.entries(receipt.artifacts))assert.equal(hash(read(path.join(s.fixture,s.legacy?'flash':'evidence',f))),sha,f);
 for(const n of [1,2])assert.deepEqual(JSON.parse(read(path.join(s.fixture,(s.legacy?'flash':'evidence')+'/run-'+n+'/capture.json'))).state.observations,expected);
 const compared=expected.map(row=>row.id.startsWith('metadata-')?{...row,value:row.value.replace(/>\s+</g,'><')}:row);
 assert.deepEqual(r.results.map(x=>x.target),['ES5','ES2015']);
 for(const x of r.results){assert.deepEqual(x.web.rows,compared);assert.deepEqual(x.node,x.web);assert.equal(x.rejectionGuards,s.guards);if(!s.legacy)assert.equal(x.mutations,2);for(const t of x.typechecks)assert.deepEqual(t.diagnostics,[]);for(const c of x.controls||[]){assert.equal(c.applied,1);assert.notDeepEqual(c.control.rows,compared);}}
 for(const [q,v]of Object.entries(s.legacy?r.cohorts.subject:r.cohorts.parent)){assert.equal(hash(v.source),v.sourceSha256);assert.equal(v.sourceSha256,receipt.artifacts['source/'+q.replaceAll('.','/')+'.as']);}
 for(const i of inputsFor(r,s)){const b=read(path.resolve(root,i.file));assert.equal(hash(i.normalize?b.toString('utf8').replace(/\r\n/g,'\n'):b),i.sha256,i.file);}
}
for(const i of packet.inputs){const b=read(path.resolve(root,i.file));assert.equal(hash(i.normalize?b.toString('utf8').replace(/\r\n/g,'\n'):b),i.sha256,i.file);}
if(process.argv.includes('--check-current')||process.argv[2]==='--retain')for(const f of files.keys())assert.equal(hash(fs.readFileSync(f)),files.get(f).sha256,f);
if(retaining){fs.writeFileSync(archive,bytes,{flag:'wx'});fs.writeFileSync(pinFile,JSON.stringify(pin,null,2)+'\n',{flag:'wx'});}
console.log(JSON.stringify({status:'verified',adjacentObservations:52,targets:2,realms:2,typeErrors:0}));
module.exports={packet,files,read};
