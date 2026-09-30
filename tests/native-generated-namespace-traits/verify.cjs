'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2-namespace-traits-review');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),read=f=>fs.readFileSync(path.join(__dirname,f));
const pin=JSON.parse(read('projection-pin.json')),bytes=read('projection.json.gz');assert.equal(hash(bytes),pin.sha256);
const report=JSON.parse(zlib.gunzipSync(bytes));assert.equal(report.oracleRows,46);assert.equal(report.guards,10);
assert.equal(report.engineCommit,'0e85a408b7b3cfe7041ec20e938b6a58309d3dca');
assert.equal(report.runnerSha256,hash(read('projection.cjs')));
const frozen=file=>execFileSync('git',['show',report.engineCommit+':tests/nativeGeneratedNamespaceTraits/'+file],{cwd:engine,maxBuffer:16*1024*1024});
assert.equal(report.receiptSha256,hash(frozen('evidence/receipt.json')));assert.equal(report.nativeProtocolSha256,hash(frozen('native.ts')));
const expected=JSON.parse(frozen('evidence/run-1/capture.json')).state.observations;
assert.deepEqual(report.runs.map(r=>r.target),['ES5','ES2015']);
for(const run of report.runs){assert.deepEqual(run.actual.node.rows,expected);assert.deepEqual(run.actual.node,run.actual.web);assert.deepEqual(run.typecheck.diagnostics,[]);
 assert.deepEqual(run.controls.map(c=>c.name),['method-uri','constant-uri']);
 for(const control of run.controls){assert.deepEqual(control.node,control.web);assert.match(control.node.error,/AS3_GENERATED_CLASS_UNSUPPORTED/);}
}
if(process.argv.includes('--check-current')){
 for(const item of report.compilerInputs)assert.equal(hash(fs.readFileSync(path.join(root,item.file))),item.sha256,item.file);
 for(const run of report.runs)for(const item of [...run.inputs,...run.typecheck.inputs]){
  const relative=path.win32.relative(report.engineRoot,item.file);
  if(relative.startsWith('..')||path.win32.isAbsolute(relative))continue;
  const current=path.join(engine,...relative.split(/[\\/]/));assert.equal(hash(fs.readFileSync(current)),item.sha256,current);
 }
}
console.log(JSON.stringify({status:'passed',rows:46,targets:2,realms:2,guards:10,appliedControls:2,current:process.argv.includes('--check-current'),scope:'generated trait definitions; native protocol bodies'}));
