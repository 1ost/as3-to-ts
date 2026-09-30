'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),zlib=require('zlib');
const {root,engine,frozen,sources,hash}=require('./compile.cjs');
const read=file=>fs.readFileSync(path.join(__dirname,file));
const pin=JSON.parse(read('runtime-pin.json')),bytes=read('runtime.json.gz');assert.equal(hash(bytes),pin.sha256);
const report=JSON.parse(zlib.gunzipSync(bytes));
assert.equal(report.engineCommit,'5ff09c0096fa6051891e80a31acb9921ef2b2ae5');
assert.equal(report.receiptSha256,hash(frozen('evidence/receipt.json')));assert.equal(report.nativeProtocolSha256,hash(frozen('native.ts')));
assert.deepEqual(report.sources,sources);
const expected=JSON.parse(frozen('evidence/run-1/capture.json')).state.observations;assert.equal(expected.length,19);
assert.deepEqual(report.runs.map(r=>r.target),['ES5','ES2015']);
for(const item of report.runnerInputs)assert.equal(hash(read(item.file)),item.sha256,item.file);
for(const run of report.runs){
 assert.deepEqual(run.actual.node.rows,expected);assert.deepEqual(run.actual.web,run.actual.node);assert.deepEqual(run.typecheck.diagnostics,[]);
 assert.equal(run.artifact.generatedSources.length,4);assert.deepEqual(run.artifact.sourceHashes,Object.fromEntries(Object.entries(sources).map(([q,s])=>[q,s.sourceSha256])));
 assert.equal(run.guards.length,16);for(const guard of run.guards)assert.match(guard.error,/AS3_[A-Z_]+UNSUPPORTED/);
 assert.deepEqual(run.controls.map(c=>c.name),['super-uses-virtual-dispatch','override-loses-negation']);
 for(const control of run.controls)for(const runtime of [control.node,control.web])if(control.name==='super-uses-virtual-dispatch')assert.match(runtime.error||'',/call stack|recursion/i);else {assert.equal(runtime.error,undefined);assert.equal(runtime.rows.length,expected.length);assert.notDeepEqual(runtime.rows,expected);}

}
if(process.argv.includes('--check-current')){
 for(const item of report.compilerInputs)assert.equal(hash(fs.readFileSync(path.join(root,item.file))),item.sha256,item.file);
 for(const run of report.runs)for(const item of [...run.inputs,...run.typecheck.inputs]){
  const relative=path.win32.relative(report.engineRoot,item.file);
  if(relative.startsWith('..')||path.win32.isAbsolute(relative))continue;
  const current=path.join(engine,...relative.split(/[\\/]/));assert.equal(hash(fs.readFileSync(current)),item.sha256,current);
 }
}
console.log(JSON.stringify({status:'passed',rows:19,targets:2,realms:2,guards:16,appliedControls:2,current:process.argv.includes('--check-current'),scope:report.scope}));
