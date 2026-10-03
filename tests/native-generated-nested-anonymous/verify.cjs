const fs=require('fs'),path=require('path'),z=require('zlib'),assert=require('assert/strict');
const {hash,engine,sources}=require('./compile.cjs');
const bytes=fs.readFileSync(path.join(__dirname,'report.json.gz')),pin=require('./pin.json');
assert.equal(hash(bytes),pin.sha256);assert.equal(pin.wholeClientQualified,false);
const document=JSON.parse(z.gunzipSync(bytes)),{nested,members,returns,locals,data}=document.reports;
const expected=require('./verify-oracle.cjs');assert.equal(expected.length,16);
assert.equal(nested.engineCommit,'f46db1d33ccf5749ce5ca8c51c625b31426d1c8d');
for(const [folder,subject,key]of [['oracle','NestedClosure','receiptSha256'],['void-oracle','VoidNestedClosure','voidReceiptSha256']]){
 const source=fs.readFileSync(path.join(__dirname,folder,'evidence/source/cases/'+subject+'.as'),'utf8');
 assert.deepEqual(nested.sources['cases.'+subject],{source,sourceSha256:hash(source)});
 assert.equal(nested[key],hash(fs.readFileSync(path.join(__dirname,folder,'evidence/receipt.json'))));
}
assert.deepEqual(nested.runs.map(r=>r.target),['ES5','ES2015']);
for(const run of nested.runs){
 assert.deepEqual(run.actual.node.rows,expected);assert.deepEqual(run.actual.web,run.actual.node);assert.deepEqual(run.typecheck.diagnostics,[]);
 assert.equal(run.guards.length,11);for(const guard of run.guards)assert.match(guard.message,/AS3_[A-Z_]+UNSUPPORTED/);
 assert.deepEqual(run.controls.map(c=>c.name),['dynamic-this-instead-of-parent-owner','uncoerced-uint-storage']);
 for(const control of run.controls)for(const realm of [control.node,control.web])assert.notDeepEqual(realm.rows,expected);
}
const rows=[...require('../native-generated-anonymous-members/oracle/verify.cjs'),...require('../native-generated-anonymous-members/numeric-oracle/verify.cjs')];
assert.equal(rows.length,11);assert.equal(members.engineCommit,'f46db1d33ccf5749ce5ca8c51c625b31426d1c8d');
for(const [q,source]of Object.entries(sources))assert.deepEqual(members.sources[q],source);
assert.deepEqual(members.runs.map(r=>r.target),['ES5','ES2015']);
for(const run of members.runs){
 assert.deepEqual(run.actual.node.rows,rows);assert.deepEqual(run.actual.web,run.actual.node);
 assert.deepEqual(run.typecheck.diagnostics,[]);assert.equal(run.guards.length,12);assert.equal(run.controls.length,2);
 for(const guard of run.guards)assert.match(guard.message,/AS3_[A-Z_]+UNSUPPORTED/);
 for(const control of run.controls)for(const realm of [control.node,control.web])assert.notDeepEqual(realm.rows,rows);
}
const oldRows=require(path.join(engine,'tests/nativeFlashOracle/anonymous-object-return/verify.cjs'));
assert.equal(oldRows.length,17);assert.deepEqual(returns.results.map(r=>r.target),['ES5','ES2015']);
for(const r of returns.results){assert.deepEqual(r.node.rows,oldRows);assert.deepEqual(r.web,r.node);assert.equal(r.rejectionGuards,6);assert.equal(r.mutations.length,2);for(const t of r.typechecks)assert.deepEqual(t.diagnostics,[]);}
const localRows=require('../native-typed-locals/evidence/flash.json').rows;
assert.equal(localRows.length,47);assert.equal(locals.guards,14);assert.deepEqual(locals.typecheck.diagnostics,[]);
assert.deepEqual(locals.results.map(r=>r.target),[1,2]);
for(const r of locals.results){assert.deepEqual(r.node,localRows);assert.deepEqual(r.browser,r.node);}
const dataRows=require(path.join(engine,'tests/nativeFlashOracle/data-event-source/verify.cjs'));
assert.equal(dataRows.length,36);assert.deepEqual(data.runs.map(r=>r.target),['ES5','ES2015']);
for(const r of data.runs){assert.deepEqual(r.node,dataRows);assert.deepEqual(r.web,r.node);assert.deepEqual(r.typecheck.diagnostics,[]);assert.equal(r.guards.length,12);assert.equal(r.controls.length,2);}
if(process.argv.includes('--check-current'))for(const input of document.inputs)assert.equal(hash(fs.readFileSync(input.file)),input.sha256,input.file);
console.log(JSON.stringify({rows:16,targets:2,realms:2,guards:11,controls:2,regressionRows:111,typeErrors:0,wholeClientQualified:false}));
