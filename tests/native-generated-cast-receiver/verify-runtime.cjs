const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib'),cp=require('node:child_process');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),pin=require('./runtime-pin.json'),expected=require('./verify.cjs');
const bytes=fs.readFileSync(path.join(__dirname,'runtime.json.gz'));assert.equal(hash(bytes),pin.sha256);const packet=JSON.parse(z.gunzipSync(bytes));
assert.equal(packet.wholeClientQualified,false);assert.equal(packet.engine.commit,pin.engine);assert.equal(packet.compiler.baseCommit,pin.compilerBase);
assert.deepEqual(packet.baseline.results,['ES5','ES2015'].map(target=>({target,baseline:true,reason:'lexical receiver requires exact source type'})));
const archived=new Map();for(const record of packet.records)for(const file of record.files){const bytes=Buffer.from(file.base64,'base64');assert.equal(hash(bytes),file.sha256,file.file);archived.set(file.file,bytes);}
assert.equal(packet.records.length,5);
const chained=require('../native-generated-chained-references/verify.cjs'),own=require('../native-generated-own-lexical-receiver/verify.cjs');
const air=(read,receiptSha)=>{
 const receiptBytes=read('receipt.json');assert.equal(hash(receiptBytes),receiptSha);const receipt=JSON.parse(receiptBytes);
 assert.equal(receipt.status,'passed');assert.equal(receipt.capture.runs,2);assert.equal(receipt.capture.identical,true);
 for(const [file,sha]of Object.entries(receipt.artifacts))assert.equal(hash(read(file)),sha,file);
 const first=JSON.parse(read('run-1/capture.json'));assert.deepEqual(first,JSON.parse(read('run-2/capture.json')));return first.state.observations;
};
const descendant=air(file=>cp.execFileSync('git',['show','4bcc68bf2e4fe5bdde7c04bfa021aaada548b326:tests/nativeFlashOracle/descendant-private-receiver/fields/evidence/'+file],{cwd:packet.engine.root,maxBuffer:16*1024*1024}),packet.records[2].report.receiptSha256);
const accessors=air(file=>fs.readFileSync(path.join(__dirname,'../native-generated-source-accessors/oracle/evidence',file)),packet.records[4].report.receiptSha256);
const observations=[expected,chained,descendant,own,accessors];
for(const [index,record]of packet.records.entries()){
 const runs=record.report.results||record.report.runs;assert.equal(runs.length,2);
 for(const [targetIndex,run]of runs.entries()){
  assert.equal(run.target,['ES5','ES2015'][targetIndex]);
  const actual=run.actual||run;assert.deepEqual(actual.node,actual.web);
  const rows=actual.node.rows||actual.node;assert.equal(rows.length,pin.rows[index]);
  assert.deepEqual(rows,observations[index]);
  for(const check of run.typechecks||[run.typecheck])assert.deepEqual(check.diagnostics,[]);
  if(index===0){
   assert.deepEqual(rows,expected);assert.equal(run.rejectionGuards,8);assert.equal(run.controls.length,1);assert.match(run.controls[0].baselineError,/lexical receiver requires exact source type/);
   assert.equal(run.mutations.length,1);const mutation=run.mutations[0];assert.equal(mutation.name,'erased-cast');assert.deepEqual(mutation.node,mutation.web);
   assert.notDeepEqual(mutation.node.rows,expected);assert.deepEqual(mutation.node.rows.find(r=>r.id==='wrong-cast-before-arguments').value,['TypeError',1006,10,5]);
  }
 }
}
for(const row of packet.records[0].report.runnerInputs)assert.equal(hash(fs.readFileSync(path.join(__dirname,row.file))),row.sha256,row.file);
if(process.argv.includes('--check-current')){
 assert.equal(cp.execFileSync('git',['rev-parse','HEAD'],{cwd:packet.engine.root,encoding:'utf8'}).trim(),packet.engine.commit);
 for(const row of [...packet.compiler.inputs,...packet.inputs])assert.equal(hash(archived.get(row.file)||fs.readFileSync(row.file)),row.sha256,row.file);
 const inventory=['src','lib'].flatMap(folder=>fs.readdirSync(path.join(packet.compiler.root,folder),{recursive:true}).filter(f=>/\.(ts|js)$/.test(f)).map(f=>path.join(packet.compiler.root,folder,f))).sort();
 assert.deepEqual(inventory,packet.compiler.inputs.map(i=>i.file).sort());
}
console.log(JSON.stringify({status:'passed',AIRRows:14,adjacentRows:45,targets:2,runtimes:['Node','CSP Chromium'],guardsPerTarget:8,compilerControlsPerTarget:1,coercionMutationsPerTarget:1,typeErrors:0,wholeClientQualified:false}));
