const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib');
const root=path.resolve(__dirname,'../..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||path.join(root,'../LayaAir-op2-rectangle-return-review'));
const specs=[{name:'rectangle-constructors',fixture:path.join(engine,'tests/nativeFlashOracle/generated-rectangle-constructors'),rows:29},{name:'textline-return',fixture:path.join(engine,'tests/nativeFlashOracle/textline-return'),rows:85}];
const archive=path.join(__dirname,'adjacent.json.gz'),pinFile=path.join(__dirname,'adjacent-pin.json');
function inputsFor(r,s){
 if(s.name==='textline-return')return [...r.compilerInputs,...r.results.flatMap(x=>[...x.inputs,...x.typechecks.flatMap(t=>t.inputs)]),{file:path.join(root,'tests/native-generated-textline-return/run.cjs'),sha256:r.runnerSha256},{file:path.join(root,'tests/native-generated-textline-return/observer.ts'),sha256:r.observerSha256}];
 return [...r.compilerGraph,...r.results.flatMap(x=>x.providerGraph),...['run.cjs','observer.ts'].map((f,i)=>({file:path.join(root,'tests/native-generated-rectangle-constructors',f),sha256:r[i?'observerSha256':'runnerSha256']}))].map(i=>({...i,file:path.resolve(root,i.file),normalize:true}));
}
if(require.main===module&&process.argv[2]==='--retain'){
 assert.equal(process.argv.length,5);assert(!fs.existsSync(archive));const files=new Map(),inputs=[],reports=[];
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
 const b=z.gzipSync(JSON.stringify({reports,inputs,files:[...files.values()]}),{level:9});fs.writeFileSync(archive,b);fs.writeFileSync(pinFile,JSON.stringify({sha256:hash(b),bytes:b.length,files:files.size},null,2)+'\n');
}
const pin=JSON.parse(fs.readFileSync(pinFile)),bytes=fs.readFileSync(archive);assert.equal(hash(bytes),pin.sha256);assert.equal(bytes.length,pin.bytes);
const packet=JSON.parse(z.gunzipSync(bytes)),files=new Map(packet.files.map(i=>[i.file,i]));assert.equal(files.size,pin.files);
const read=f=>{const i=files.get(f);assert(i,f);const b=Buffer.from(i.base64,'base64');assert.equal(hash(b),i.sha256,f);return b;};for(const f of files.keys())read(f);
assert.deepEqual(packet.reports.map(s=>s.name),specs.map(s=>s.name));
for(const [index,s]of packet.reports.entries()){
 assert.equal(s.rows,specs[index].rows);const r=JSON.parse(read(s.file)),expected=JSON.parse(read(path.join(s.fixture,'expected.json')));assert.equal(expected.length,s.rows);
 const receiptBytes=read(path.join(s.fixture,'evidence/receipt.json')),receipt=JSON.parse(receiptBytes),ep=JSON.parse(read(path.join(s.fixture,'evidence-pin.json')));
 assert.equal(hash(receiptBytes),ep.receiptSha256||ep.sha256);assert.equal(receipt.status,'passed');assert.equal(receipt.capture.identical,true);assert.equal(receipt.capture.runs,2);assert.equal(receipt.capture.observationCount,s.rows);
 for(const [f,sha]of Object.entries(receipt.artifacts))assert.equal(hash(read(path.join(s.fixture,'evidence',f))),sha,f);
 for(const n of [1,2])assert.deepEqual(JSON.parse(read(path.join(s.fixture,'evidence/run-'+n+'/capture.json'))).state.observations,expected);
 if(s.name==='rectangle-constructors'){
  assert.deepEqual(r.results.map(x=>x.target),['ES5','ES2015']);
  for(const x of r.results){assert.deepEqual(x.web.rows,expected);assert.equal(x.web.guards,2);assert.deepEqual(x.node,x.web);assert.equal(x.guards,7);assert.deepEqual(x.diagnostics,[]);assert.deepEqual(x.errors,[]);}
  for(const [q,v]of Object.entries(r.sources)){assert.equal(hash(v.source),v.sourceSha256);assert.equal(v.sourceSha256,receipt.artifacts['source/'+q.replaceAll('.','/')+'.as']);}
 }else{
  assert.deepEqual(r.results.map(x=>x.target),['ES5','ES2015']);
  for(const x of r.results){assert.deepEqual(x.web.rows,expected);assert.equal(x.web.hostGuards,3);assert.equal(x.web.hostFailures,0);assert.equal(x.rejectionGuards,6);assert.equal(x.mutations,2);for(const t of x.typechecks)assert.deepEqual(t.diagnostics,[]);for(const c of x.controls){assert.equal(c.applied,1);assert.notDeepEqual(c.control.rows,expected);}}
  for(const [q,v]of Object.entries(r.cohorts.parent)){assert.equal(hash(v.source),v.sourceSha256);assert.equal(v.sourceSha256,receipt.artifacts['source/'+q.replaceAll('.','/')+'.as']);}

 }
 for(const i of inputsFor(r,s)){const b=read(path.resolve(root,i.file));assert.equal(hash(i.normalize?b.toString('utf8').replace(/\r\n/g,'\n'):b),i.sha256,i.file);}
}
for(const i of packet.inputs){const b=read(path.resolve(root,i.file));assert.equal(hash(i.normalize?b.toString('utf8').replace(/\r\n/g,'\n'):b),i.sha256,i.file);}
if(process.argv.includes('--check-current')||process.argv[2]==='--retain')for(const f of files.keys())assert.equal(hash(fs.readFileSync(f)),files.get(f).sha256,f);
console.log(JSON.stringify({status:'verified',adjacentObservations:114,targets:2,constructorRealms:2,textLineReturnRealms:1,typeErrors:0}));
module.exports={packet,files,read};
