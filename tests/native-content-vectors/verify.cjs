const fs=require('fs'),path=require('path'),assert=require('assert/strict'),z=require('zlib'),c=require('crypto');
const hash=b=>c.createHash('sha256').update(b).digest('hex');
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2');
const expected=require(path.join(engine,'tests/nativeFlashOracle/content-vectors/verify.cjs'));
const bytes=fs.readFileSync(path.join(__dirname,'runtime.json.gz'));
assert.equal(hash(bytes),require('./runtime-pin.json').sha256);
const report=JSON.parse(z.gunzipSync(bytes));
assert.equal(report.combined,true);assert.equal(report.emitted.length,4);
for(const emitted of report.emitted){assert.equal(emitted.source,fs.readFileSync(path.join(engine,'tests/nativeFlashOracle/content-vectors/source/'+emitted.qname.replaceAll('.','/')+'.as'),'utf8'));assert.equal(hash(emitted.source),emitted.sourceSha256);assert.equal(hash(emitted.output),emitted.outputSha256);}
assert.equal(hash(fs.readFileSync(path.join(__dirname,'run.cjs'),'utf8').replace(/\r\n/g,'\n')),report.runnerSha256);
assert.equal(hash(fs.readFileSync(path.join(__dirname,'runtime-driver.js'),'utf8').replace(/\r\n/g,'\n')),report.observer.sha256);
assert.deepEqual(report.results.map(r=>r.target),[1,2]);
for(const result of report.results)assert.deepEqual(result.web,expected);
assert.equal(report.rejectionGuards,40);assert.equal(report.runtimeGuards,16);assert.equal(report.comparisonNegativeControls,3);
assert.deepEqual(report.typecheck.diagnostics,[]);
console.log(JSON.stringify({status:'passed',rows:164,targets:2,runtime:'Chromium with Laya',rejectionGuards:40,runtimeGuards:16}));
