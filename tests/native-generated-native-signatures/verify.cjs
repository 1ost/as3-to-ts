'use strict';
const fs=require('fs'),path=require('path'),z=require('zlib'),c=require('crypto'),assert=require('assert/strict');
const hash=b=>c.createHash('sha256').update(b).digest('hex'),compiler=path.resolve(__dirname,'../..'),engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||path.join(compiler,'../LayaAir-op2-native-signature-review'));
const bytes=fs.readFileSync(path.join(__dirname,'report.json.gz'));assert.equal(hash(bytes),JSON.parse(fs.readFileSync(path.join(__dirname,'pin.json'))).sha256);const report=JSON.parse(z.gunzipSync(bytes));
const evidence=path.join(engine,'tests/nativeFlashOracle/native-signature-override'),expected=require(path.join(evidence,'verify.cjs')),receipt=JSON.parse(fs.readFileSync(path.join(evidence,'evidence/receipt.json')));
assert.equal(expected.length,37);assert.equal(hash(fs.readFileSync(path.join(evidence,'evidence/receipt.json'))),report.receiptSha256);
assert.equal(hash(fs.readFileSync(path.join(__dirname,'run.cjs'))),report.runnerSha256);assert.equal(hash(fs.readFileSync(path.join(__dirname,'observer.ts'))),report.observerSha256);
for(const [q,s]of Object.entries(report.cohorts.parent)){assert.equal(hash(s.source),s.sourceSha256);assert.equal(s.sourceSha256,receipt.artifacts['source/'+q.replaceAll('.','/')+'.as']);}
assert.deepEqual(report.results.map(r=>r.target),['ES5','ES2015']);
for(const r of report.results){assert.deepEqual(r.node.rows,expected);assert.deepEqual(r.web,r.node);assert.equal(r.rejectionGuards,4);assert.equal(r.mutations,2);for(const t of r.typechecks)assert.deepEqual(t.diagnostics,[]);}
if(process.argv.includes('--check-current'))for(const i of [...report.compilerInputs,...report.results.flatMap(r=>[...r.inputs,...r.typechecks.flatMap(t=>t.inputs)])])assert.equal(hash(fs.readFileSync(path.resolve(compiler,i.file))),i.sha256,i.file);
console.log(JSON.stringify({rows:37,targets:2,runtimes:['Node','CSP Chromium'],guards:4,mutations:2,typeErrors:0}));
