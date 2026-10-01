'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict'),z=require('zlib'),cp=require('child_process');
const root=path.resolve(__dirname,'../..'),engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2-namespace-traits-review');
const read=f=>fs.readFileSync(path.join(__dirname,f)),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const pin=JSON.parse(read('runtime-pin.json')),bytes=read('runtime.json.gz');assert.equal(hash(bytes),pin.sha256);const report=JSON.parse(z.gunzipSync(bytes));assert.equal(report.engineCommit,pin.engineCommit);
const frozen=f=>cp.execFileSync('git',['show',pin.engineCommit+':tests/nativeFlashOracle/namespaced-constructor-initializer/evidence/'+f],{cwd:engine,maxBuffer:16*1024*1024});
assert.equal(hash(frozen('receipt.json')),report.receiptSha256);const receipt=JSON.parse(frozen('receipt.json'));
const capture=frozen('run-1/capture.json');assert.equal(hash(capture),receipt.artifacts['run-1/capture.json']);const expected=JSON.parse(capture).state.observations;assert.equal(expected.length,20);
for(const [q,item]of Object.entries(report.cohorts.parent)){const file='source/'+q.replaceAll('.','/')+'.as';assert.equal(hash(frozen(file)),receipt.artifacts[file]);assert.equal(hash(item.source),receipt.artifacts[file]);assert.equal(item.sourceSha256,receipt.artifacts[file]);}
assert.equal(hash(read('run.cjs')),report.runnerSha256);assert.equal(hash(read('observer.ts')),report.observerSha256);
assert.deepEqual(report.results.map(r=>r.target),['ES5','ES2015']);
for(const run of report.results){assert.deepEqual(run.node.rows,expected);assert.deepEqual(run.web,run.node);assert.deepEqual(run.node.domainChecks,[true,true,true,true,true]);assert.equal(run.rejectionGuards,11);assert.equal(run.mutations,1);for(const error of Object.values(run.mutationResults))assert.match(error,/failed source function creation context/);assert.deepEqual(Object.keys(run.mutationResults),['node','web']);assert.equal(run.artifacts.parent.generatedSources.length,5);for(const check of run.typechecks)assert.deepEqual(check.diagnostics,[]);}
if(process.argv.includes('--check-current')){
 for(const item of report.compilerInputs)assert.equal(hash(fs.readFileSync(item.file)),item.sha256,item.file);
 for(const run of report.results)for(const item of [...run.inputs,...run.typechecks.flatMap(c=>c.inputs)])assert.equal(hash(fs.readFileSync(path.resolve(root,item.file))),item.sha256,item.file);
}
console.log(JSON.stringify({status:'passed',rows:20,targets:2,realms:2,guards:11,domainChecks:5,appliedControls:1,current:process.argv.includes('--check-current')}));
