const fs=require('fs'),path=require('path'),z=require('zlib'),crypto=require('crypto'),assert=require('assert/strict');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),read=f=>fs.readFileSync(path.join(__dirname,f));
const bytes=read('report.json.gz');assert.equal(hash(bytes),JSON.parse(read('pin.json')).sha256);const report=JSON.parse(z.gunzipSync(bytes));
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||path.join(__dirname,'../../../LayaAir-op2-number-accessor-review'));
const expected=require(path.join(engine,'tests/nativeGeneratedNumberAccessors/verify.cjs')),receipt=JSON.parse(fs.readFileSync(path.join(engine,'tests/nativeGeneratedNumberAccessors/evidence/receipt.json')));
assert.equal(report.receiptSha256,hash(fs.readFileSync(path.join(engine,'tests/nativeGeneratedNumberAccessors/evidence/receipt.json'))));
assert.equal(report.nativeProtocolSha256,hash(fs.readFileSync(path.join(engine,'tests/nativeGeneratedNumberAccessors/observe.ts'))));
for(const i of report.runnerInputs)assert.equal(hash(read(i.file)),i.sha256,i.file);
assert.equal(Object.keys(report.sources).length,8);for(const [q,s]of Object.entries(report.sources)){assert.equal(hash(s.source),s.sourceSha256);assert.equal(s.sourceSha256,receipt.artifacts['source/'+q.replaceAll('.','/')+'.as']);}
assert.deepEqual(report.runs.map(r=>r.target),['ES5','ES2015']);
for(const r of report.runs){assert.equal(r.artifact.generatedSources.length,9);assert.deepEqual(r.actual.node.rows,expected);assert.deepEqual(r.actual.web,r.actual.node);assert.equal(r.guards.length,12);for(const g of r.guards)assert.match(g.error,/AS3_[A-Z_]+UNSUPPORTED/);assert.equal(r.controls.length,2);for(const c of r.controls)for(const realm of [c.node,c.web])assert.match(realm.error,/selected parent accessor requires matching nonfinal half authority/);assert.deepEqual(r.typecheck.diagnostics,[]);}
if(process.argv.includes('--check-current'))for(const i of [...report.compilerInputs,...report.runs.flatMap(r=>[...r.inputs,...r.typecheck.inputs])])assert.equal(hash(fs.readFileSync(path.resolve(__dirname,'../..',i.file))),i.sha256,i.file);
console.log(JSON.stringify({rows:36,originalClasses:8,targets:2,realms:2,guards:12,appliedControls:2,typeErrors:0}));
