const fs=require('fs'),path=require('path'),z=require('zlib'),assert=require('assert/strict');
const {hash,engine,sources}=require('./compile.cjs');
const bytes=fs.readFileSync(path.join(__dirname,'report.json.gz')),pin=require('./pin.json');
assert.equal(hash(bytes),pin.sha256);assert.equal(pin.wholeClientQualified,false);
const document=JSON.parse(z.gunzipSync(bytes)),{returns,boundaries,protected:storage,nested}=document.reports;
const expected=require('./verify-oracle.cjs');assert.equal(expected.length,17);
assert.equal(returns.engineCommit,'f46db1d33ccf5749ce5ca8c51c625b31426d1c8d');
assert.deepEqual(returns.sources,sources);
assert.equal(returns.receiptSha256,hash(fs.readFileSync(path.join(__dirname,'oracle/evidence/receipt.json'))));
assert.deepEqual(returns.runs.map(r=>r.target),['ES5','ES2015']);
for(const run of returns.runs){
 assert.deepEqual(run.actual.node.rows,expected);assert.deepEqual(run.actual.web,run.actual.node);assert.deepEqual(run.typecheck.diagnostics,[]);
 assert.equal(run.guards.length,6);for(const guard of run.guards)assert.match(guard.message,/AS3_[A-Z_]+UNSUPPORTED/);
 assert.deepEqual(run.controls.map(c=>c.name),['unchecked-vector-return','reversed-digit-order']);
 for(const control of run.controls)for(const realm of [control.node,control.web])assert.notDeepEqual(realm.rows,expected);
}
const vectorRows=require(path.join(engine,'tests/nativeFlashOracle/generated-interface-vectors/verify.cjs')).filter(r=>r.id==='default'||/^(read-|exchange-|assign-|local-|catch-|missing-argument|extra-argument)/.test(r.id));
vectorRows.push(...require(path.join(engine,'tests/nativeFlashOracle/generated-private-vector-queues/verify.cjs')));assert.equal(vectorRows.length,58);
const storageRows=require(path.join(engine,'tests/nativeFlashOracle/protected-vector-storage/verify.cjs'));assert.equal(storageRows.length,19);
for(const [report,rows,guards]of [[boundaries,vectorRows,10],[storage,storageRows,5]]){
 assert.deepEqual(report.results.map(r=>r.target),[1,2]);assert.deepEqual(report.typecheck.diagnostics,[]);assert.equal(report.rejectionGuards,guards);
 for(const run of report.results){assert.deepEqual(run.node,rows);assert.deepEqual(run.web,run.node);}
}
const nestedRows=require('../native-generated-nested-anonymous/verify-oracle.cjs');assert.equal(nestedRows.length,16);
assert.deepEqual(nested.runs.map(r=>r.target),['ES5','ES2015']);
for(const run of nested.runs){assert.deepEqual(run.actual.node.rows,nestedRows);assert.deepEqual(run.actual.web,run.actual.node);assert.deepEqual(run.typecheck.diagnostics,[]);assert.equal(run.guards.length,11);assert.equal(run.controls.length,2);}
const baseline=require('./baseline.json');assert.equal(baseline.commit,'40379d5891ec2ed5ff81397472bd6b4886ab322d');
assert.deepEqual(baseline.sourceHashes,Object.fromEntries(Object.entries(sources).map(([q,s])=>[q,s.sourceSha256])));
assert.deepEqual(baseline.results.map(r=>r.target),['ES5','ES2015']);for(const row of baseline.results)assert.equal(row.message,'AS3_GENERATED_LEXICAL_UNSUPPORTED: lexical vector storage authority');
if(process.argv.includes('--check-current'))for(const input of document.inputs)assert.equal(hash(fs.readFileSync(input.file)),input.sha256,input.file);
console.log(JSON.stringify({rows:17,regressionRows:93,targets:2,realms:2,guards:6,controls:2,typeErrors:0,wholeClientQualified:false}));
