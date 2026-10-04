const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||path.join(root,'../LayaAir-op2-private-numeric-addition-review'));
const specs=[
 {name:'lexical-receiver-chain',fixture:path.join(engine,'tests/nativeFlashOracle/lexical-receiver-chain'),test:'native-generated-lexical-receiver-chain',rows:31,guards:11,mutations:2},
 {name:'numeric-addition',fixture:path.join(root,'tests/native-generated-numeric-addition'),test:'native-generated-numeric-addition',rows:12,guards:5,mutations:1},
 {name:'lexical-addition',fixture:path.join(engine,'tests/nativeFlashOracle/lexical-property-addition'),test:'native-generated-lexical-addition',rows:25,guards:2,mutations:1}
];
const archive=path.join(__dirname,'adjacent.json.gz'),pinFile=path.join(__dirname,'adjacent-pin.json');
const inputsFor=(r,s)=>s.name==='numeric-addition'?[...r.compilerInputs,...r.typeInputs,...r.providerGraph.map(i=>({...i,file:path.resolve(r.engine,i.file)})),r.runner,...r.observer.files.map(file=>({file,sha256:r.observer.sha256}))]:[...r.compilerInputs,...r.results.flatMap(x=>[...x.inputs,...x.typechecks.flatMap(t=>t.inputs)]),{file:path.join(root,'tests',s.test,'run.cjs'),sha256:r.runnerSha256},{file:path.join(root,'tests',s.test,'observer.ts'),sha256:r.observerSha256}];
if(require.main===module&&process.argv[2]==='--retain'){
 assert.equal(process.argv.length,6);assert(!fs.existsSync(archive));
 const files=new Map(),inputs=[],reports=[];
 const add=(file,sha)=>{file=path.resolve(root,file);const bytes=fs.readFileSync(file);if(sha)assert.equal(hash(bytes),sha,file);files.set(file,{file,sha256:hash(bytes),base64:bytes.toString('base64')});};
 const walk=dir=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else add(f);}};
 specs.forEach((s,index)=>{
  const file=path.resolve(process.argv[3+index]),r=JSON.parse(fs.readFileSync(file));reports.push({file,...s});
  for(const i of inputsFor(r,s)){add(i.file,i.sha256);inputs.push({...i,file:path.resolve(root,i.file)});}
  walk(path.dirname(file));walk(path.join(s.fixture,'evidence'));walk(path.join(s.fixture,'source'));
  for(const f of ['expected.json','evidence-pin.json',s.name==='numeric-addition'?'verify-air.cjs':'verify.cjs'])add(path.join(s.fixture,f));
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
 for(const cohort of Object.values(r.cohorts||{}))for(const v of Object.values(cohort)){assert.equal(hash(v.source),v.sourceSha256);assert(Object.values(receipt.artifacts).includes(v.sourceSha256));}
 for(const i of inputsFor(r,s))assert.equal(hash(read(path.resolve(root,i.file))),i.sha256,i.file);
 if(s.name==='numeric-addition'){
  assert.deepEqual(r.results.map(x=>x.target),[1,2]);assert.equal(r.rejectionGuards,5);assert.equal(r.comparisonNegativeControls,3);assert.deepEqual(r.typecheck.diagnostics,[]);
  for(const x of r.results){assert.deepEqual(x.node,expected);assert.deepEqual(x.web,expected);assert.deepEqual(x.mutation.mismatches,['routed','routed-storage']);assert.notDeepEqual(x.mutation.changed,expected);}
 }else{
  assert.deepEqual(r.results.map(x=>x.target),['ES5','ES2015']);
  for(const x of r.results){
   assert.deepEqual(x.node,x.web);assert.deepEqual(x.web.rows,expected);assert.equal(x.rejectionGuards,s.guards);assert.equal(x.mutations,s.mutations);
   for(const t of x.typechecks)assert.deepEqual(t.diagnostics,[]);
   if(s.name==='lexical-receiver-chain'){assert.equal(x.node.hostGuards,4);assert.equal(x.controls.length,2);for(const c of x.controls){assert.equal(c.applied,1);assert.notDeepEqual(c.control.rows,expected);}}
   else {assert.equal(x.node.domainChecks.length,2);assert.equal(x.node.authorityGuards,3);}
  }
 }
}
for(const i of packet.inputs)assert.equal(hash(read(i.file)),i.sha256,i.file);
if(process.argv.includes('--check-current')||process.argv[2]==='--retain')for(const f of files.keys())assert.equal(hash(fs.readFileSync(f)),files.get(f).sha256,f);
// The older lexical-property runner asserts its mutation at runtime but does not
// serialize the result. Replay its exact retained bundle and mutation here.
async function verifyLexicalMutation(){
 const s=packet.reports.find(r=>r.name==='lexical-addition'),expected=JSON.parse(read(path.join(s.fixture,'expected.json')));
 const execute=async code=>{const context=vm.createContext({console,setTimeout,clearTimeout,AbortController,AbortSignal,DOMException,performance});context.window=context;context.document={};new vm.Script(code).runInContext(context);await context.completion;return JSON.parse(JSON.stringify(context.result));};
 for(const target of ['ES5','ES2015']){
  const code=read(path.join(path.dirname(s.file),target,'bundle.js')).toString('utf8');assert.deepEqual((await execute(code)).rows,expected);
  const changed=code.replace(/as3SetLexicalProperty\(lexical,\s*writeTarget\(\),\s*(property\d*),\s*(value\d*)\)/,'as3SetLexicalProperty(lexical, readTarget, $1, $2)');assert.notEqual(changed,code);assert.notDeepEqual((await execute(changed)).rows,expected);
 }
 console.log(JSON.stringify({status:'verified',adjacentObservations:68,targets:2,realms:2,typeErrors:0}));
}
if(require.main===module)verifyLexicalMutation().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={packet,files,read};
