'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),z=require('zlib');
const {sources,frozen,hash}=require('./compile.cjs');
const read=f=>fs.readFileSync(path.join(__dirname,f)),pin=JSON.parse(read('runtime-pin.json')),bytes=read('runtime.json.gz');assert.equal(hash(bytes),pin.sha256);
const report=JSON.parse(z.gunzipSync(bytes));assert.equal(report.engineCommit,'75566b4bb4e2785f6bd7df6780a94902c4d02eef');assert.equal(report.receiptSha256,hash(frozen('evidence/receipt.json')));assert.deepEqual(report.sources,sources);assert.equal(report.startupQualified,false);
const expected=JSON.parse(frozen('evidence/run-1/capture.json')).state.observations;assert.equal(expected.length,7);
for(const item of report.runnerInputs)assert.equal(hash(read(item.file)),item.sha256);
assert.deepEqual(report.runs.map(r=>r.target),['ES5','ES2015']);
for(const run of report.runs){assert.deepEqual(run.node,expected);assert.deepEqual(run.web,expected);assert.deepEqual(run.typecheck.diagnostics,[]);assert.equal(run.artifact.generatedSources.length,5);assert.deepEqual(run.artifact.sourceHashes,Object.fromEntries(Object.entries(sources).map(([q,s])=>[q,s.sourceSha256])));assert.equal(run.guards.length,5);for(const g of run.guards)assert.match(g.error,/AS3_[A-Z_]+UNSUPPORTED/);assert.match(run.controlError,/internal declaration belongs to another package/);}
if(process.argv.includes('--check-current'))for(const item of [...report.compilerInputs,...report.runs.flatMap(r=>[...r.inputs,...r.typecheck.inputs])])assert.equal(hash(fs.readFileSync(item.file)),item.sha256,item.file);
console.log(JSON.stringify({status:'passed',rows:7,targets:2,realms:2,guards:5,compilerControls:1,current:process.argv.includes('--check-current')}));
