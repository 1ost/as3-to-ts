'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),zlib=require('zlib');
const {root,engine,frozen,sources,hash}=require('./compile.cjs');
const read=file=>fs.readFileSync(path.join(__dirname,file));
const pin=JSON.parse(read('runtime-pin.json')),bytes=read('runtime.json.gz');assert.equal(hash(bytes),pin.sha256);
const report=JSON.parse(zlib.gunzipSync(bytes));
assert.equal(report.engineCommit,'ed51fdc0c3a740ccc185800fd64ee6b4f46cd1ed');
assert.equal(report.receiptSha256,hash(frozen('evidence/receipt.json')));assert.equal(report.nativeProtocolSha256,hash(frozen('native.ts')));
assert.deepEqual(report.sources,sources);
const expected=JSON.parse(frozen('evidence/run-1/capture.json')).state.observations.filter(r=>r.id!=='static-reflection-prototype');assert.equal(expected.length,31);
const receipt=JSON.parse(read('writes-evidence/receipt.json'));assert.equal(hash(read('writes-evidence/receipt.json')),report.writesReceiptSha256);assert.equal(receipt.status,'passed');assert.equal(receipt.capture.status,'passed');assert.equal(receipt.capture.identical,true);assert.equal(receipt.capture.observationCount,10);
for(const [file,sha]of Object.entries(receipt.artifacts))assert.equal(hash(read('writes-evidence/'+file)),sha,file);
const capture=JSON.parse(read('writes-evidence/run-1/capture.json'));assert.deepEqual(capture,JSON.parse(read('writes-evidence/run-2/capture.json')));assert.equal(capture.runtime.version,'WIN 51,3,4,2');assert.equal(capture.state.failure,'');assert.equal(capture.state.ready,true);assert.equal(capture.state.observations.length,10);expected.push(...capture.state.observations);
assert.deepEqual(report.runs.map(r=>r.target),['ES5','ES2015']);
for(const item of report.runnerInputs)assert.equal(hash(read(item.file)),item.sha256,item.file);
for(const run of report.runs){
 assert.deepEqual(run.actual.node.rows,expected);assert.deepEqual(run.actual.web,run.actual.node);assert.deepEqual(run.typecheck.diagnostics,[]);
 assert.equal(run.artifact.generatedSources.length,7);assert.deepEqual(run.artifact.sourceHashes,Object.fromEntries(Object.entries(sources).map(([q,s])=>[q,s.sourceSha256])));
 assert.equal(run.guards.length,12);for(const guard of run.guards)assert.match(guard.error,/AS3_[A-Z_]+UNSUPPORTED/);
 assert.deepEqual(run.controls.map(c=>c.name),['discard-wildcard-setter-contract','coerce-assignment-result']);
 for(const control of run.controls){assert.deepEqual(control.node,control.web);assert.deepEqual(control.node.rows.map(r=>r.id),expected.map(r=>r.id));assert.notDeepEqual(control.node.rows.find(r=>r.id===control.failedRow),expected.find(r=>r.id===control.failedRow));}

}
if(process.argv.includes('--check-current')){
 for(const item of report.compilerInputs)assert.equal(hash(fs.readFileSync(path.join(root,item.file))),item.sha256,item.file);
 for(const run of report.runs)for(const item of [...run.inputs,...run.typecheck.inputs]){
  const relative=path.win32.relative(report.engineRoot,item.file);
  if(relative.startsWith('..')||path.win32.isAbsolute(relative))continue;
  const current=path.join(engine,...relative.split(/[\\/]/));assert.equal(hash(fs.readFileSync(current)),item.sha256,current);
 }
}
console.log(JSON.stringify({status:'passed',rows:41,targets:2,realms:2,guards:12,appliedControls:2,current:process.argv.includes('--check-current'),scope:report.scope}));
