const fs=require('fs'),path=require('path'),z=require('zlib'),crypto=require('crypto'),assert=require('assert/strict');
const {engine,root,sources,frozen,hash}=require('./compile.cjs'),bytes=fs.readFileSync(path.join(__dirname,'report.json.gz'));
assert.equal(hash(bytes),require('./pin.json').sha256);const document=JSON.parse(z.gunzipSync(bytes)),report=document.reports.data;
assert.equal(report.engineCommit,'0d177fba3c05c932b87a8b0c5e553c63ee6f1020');assert.deepEqual(report.sources,sources);assert.deepEqual(Object.keys(sources),['model.DataEventUse']);
const original=require(path.join(engine,'tests/nativeFlashOracle/data-event-source/verify.cjs'));
assert.equal(report.receiptSha256,hash(frozen('evidence/receipt.json')));assert.equal(original.length,36);assert.equal(report.startupQualified,false);
assert.deepEqual(report.runs.map(r=>r.target),['ES5','ES2015']);
for(const run of report.runs){assert.deepEqual(run.node,original);assert.deepEqual(run.web,original);assert.equal(run.guards.length,12);assert.equal(run.controls.length,2);assert.equal(run.artifact.generatedSources.length,2);assert.deepEqual(run.typecheck.diagnostics,[]);for(const control of run.controls)assert.match(control.error,/AS3_[A-Z_]+UNSUPPORTED/);}
assert.equal(document.baseline.commit,'d0a6f010b26acdf5fc9a7567a49df5a1f424eb4a');assert.deepEqual(document.baseline.results.map(r=>r.target),['ES5','ES2015']);for(const r of document.baseline.results)assert.match(r.message,/reference type operation requires class-evaluation authority: flash.events.DataEvent/);
for(const [name,suite,count,guards] of [['references','error-event-reference',23,14],['construction','error-event-construction',21,9]]){
 const r=document.reports[name],rows=require(path.join(engine,'tests/nativeFlashOracle/'+suite+'/verify.cjs'));assert.equal(rows.length,count);assert.deepEqual(r.runs.map(v=>v.target),['ES5','ES2015']);
 for(const run of r.runs){assert.deepEqual(run.node,rows);assert.deepEqual(run.web,rows);assert.deepEqual(run.typecheck.diagnostics,[]);assert.equal(run.guards.length,guards);assert.match(run.controlError,/AS3_[A-Z_]+UNSUPPORTED/);}
}
const ancestors=document.reports.ancestors,ancestorRows=require('../native-generated-ancestor-static-booleans/oracle/verify.cjs');assert.deepEqual(ancestors.typecheck.diagnostics,[]);assert.equal(ancestors.rejectionGuards,16);assert.equal(ancestors.results.length,2);
for(const run of ancestors.results){assert.deepEqual(run.node,ancestorRows);assert.deepEqual(run.web,ancestorRows);assert.equal(run.appliedReceiverControls.length,2);assert.equal(run.domainIsolationChecks,3);}
if(process.argv.includes('--check-current')){
 for(const i of document.inputs)assert.equal(hash(fs.readFileSync(path.join(root,i.file))),i.sha256,i.file);
 for(const name of ['data','references','construction']){const r=document.reports[name];for(const i of r.compilerInputs)assert.equal(hash(fs.readFileSync(i.file)),i.sha256,i.file);for(const run of r.runs)for(const i of [...run.inputs,...run.typecheck.inputs])assert.equal(hash(fs.readFileSync(i.file)),i.sha256,i.file);}
 for(const i of ancestors.providerGraph)assert.equal(hash(fs.readFileSync(path.resolve(engine,i.file))),i.sha256,i.file);
}
console.log(JSON.stringify({rows:36,targets:2,realms:2,guards:12,controls:2,typeErrors:0,regressionRows:70,wholeClientQualified:false}));module.exports=document;
