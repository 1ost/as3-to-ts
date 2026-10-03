const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),z=require('node:zlib'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex'),read=f=>fs.readFileSync(path.join(__dirname,f));
const bytes=read('report.json.gz'),pin=require('./pin.json');assert.equal(hash(bytes),pin.sha256);const {reports}=JSON.parse(z.gunzipSync(bytes));
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||reports.object.engineRoot),current=process.argv.includes('--check-current');
assert.equal(reports.object.engineCommit,pin.engineCommit);
const check=inputs=>{if(current)for(const i of inputs)assert.equal(hash(fs.readFileSync(path.resolve(root,i.file))),i.sha256,i.file);};
for(const [name,fixture,rows,classes,guards]of [
 ['object',null,28,7,12],['number','nativeGeneratedNumberAccessors',36,8,12],
 ['string','nativeGeneratedStringAccessors',23,5,12],['display','nativeGeneratedDisplayAccessors',27,4,6]
]){
 const r=reports[name],folder=fixture?path.join(engine,'tests',fixture):path.join(__dirname,'oracle');
 const expected=require(path.join(folder,'verify.cjs')),receipt=JSON.parse(fs.readFileSync(path.join(folder,'evidence/receipt.json')));
 assert.equal(expected.length,rows);assert.equal(r.receiptSha256,hash(fs.readFileSync(path.join(folder,'evidence/receipt.json'))));
 assert.equal(r.nativeProtocolSha256,hash(fs.readFileSync(fixture?path.join(folder,'observe.ts'):path.join(__dirname,'observe.ts'))));
 assert.equal(Object.keys(r.sources).length,classes,name);
 for(const [q,s]of Object.entries(r.sources)){assert.equal(hash(s.source),s.sourceSha256);assert.equal(s.sourceSha256,receipt.artifacts['source/'+q.replaceAll('.','/')+'.as']);}
 for(const input of r.runnerInputs)assert.equal(hash(fs.readFileSync(path.join(root,'tests/native-generated-'+name+'-accessors',input.file))),input.sha256,input.file);
 assert.deepEqual(r.runs.map(v=>v.target),['ES5','ES2015']);check(r.compilerInputs);
 for(const run of r.runs){
  assert.deepEqual(run.actual.node.rows,expected);assert.deepEqual(run.actual.web,run.actual.node);assert.equal(run.guards.length,guards);for(const g of run.guards)assert.match(g.error,/AS3_[A-Z_]+UNSUPPORTED/);
  assert.equal(run.controls.length,2);for(const c of run.controls)for(const realm of [c.node,c.web])assert.match(realm.error,/AS3_[A-Z_]+UNSUPPORTED/);
  if(name==='object')assert.equal(run.artifact.generatedSources.length,8);
  if(name==='display')assert.equal(run.actual.node.runtimeGuards.length,6);
  assert.deepEqual(run.typecheck.diagnostics,[]);check([...run.inputs,...run.typecheck.inputs]);
 }
}
const data=reports.data,originalData=require(path.join(engine,'tests/nativeFlashOracle/data-event-source/verify.cjs'));
assert.equal(originalData.length,36);assert.equal(data.startupQualified,false);assert.equal(data.receiptSha256,hash(fs.readFileSync(path.join(engine,'tests/nativeFlashOracle/data-event-source/evidence/receipt.json'))));
assert.deepEqual(data.runs.map(r=>r.target),['ES5','ES2015']);check(data.compilerInputs);
for(const i of data.runnerInputs)assert.equal(hash(fs.readFileSync(path.resolve(root,'tests/native-generated-data-event',i.file))),i.sha256);
for(const r of data.runs){assert.deepEqual(r.node,originalData);assert.deepEqual(r.web,originalData);assert.equal(r.guards.length,12);assert.equal(r.controls.length,2);for(const c of r.controls)assert.match(c.error,/AS3_[A-Z_]+UNSUPPORTED/);assert.deepEqual(r.typecheck.diagnostics,[]);check([...r.inputs,...r.typecheck.inputs]);}
const native=reports.nativeNumber,originalNumber=require(path.join(engine,'tests/nativeGeneratedNumberAccessors/verify.cjs'));
assert.deepEqual(native.actual.node.rows,originalNumber);assert.deepEqual(native.actual.web,native.actual.node);assert.equal(native.actual.node.guards.length,14);assert.equal(native.negatives.length,2);assert.deepEqual(native.typecheck.diagnostics,[]);
for(const n of native.negatives)for(const rows of [n.node,n.web])assert.notDeepEqual(rows.find(r=>r.id===n.failedRow),originalNumber.find(r=>r.id===n.failedRow));
assert.equal(native.runnerSha256,hash(fs.readFileSync(path.join(engine,'tests/nativeGeneratedNumberAccessors/run.cjs'))));check([...native.inputs,...native.typecheck.inputs]);
if(current)assert.equal(cp.execFileSync('git',['rev-parse','HEAD'],{cwd:engine,encoding:'utf8'}).trim(),pin.engineCommit);
console.log(JSON.stringify({status:'passed',objectRows:28,classes:7,targets:2,realms:2,guards:12,appliedControls:2,regressionRows:122,nativeRegressionRows:36,typeErrors:0,wholeClientQualified:false}));module.exports={reports};
