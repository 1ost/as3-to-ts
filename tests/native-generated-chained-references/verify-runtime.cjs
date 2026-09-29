const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const expected=require('./verify.cjs'),root=path.resolve(__dirname,'../..');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const bytes=fs.readFileSync(path.join(__dirname,'runtime.json.gz'));
assert.equal(hash(bytes),require('./runtime-pin.json').sha256);
const report=JSON.parse(zlib.gunzipSync(bytes));
assert.equal(report.runnerSha256,hash(fs.readFileSync(path.join(__dirname,'run.cjs'))));
assert.equal(report.observerSha256,hash(fs.readFileSync(path.join(__dirname,'observer.ts'))));
for(const input of report.compilerInputs)assert.equal(hash(fs.readFileSync(path.join(root,input.file))),input.sha256,input.file);
for(const [q,source]of Object.entries(report.cohorts.subject))assert.equal(hash(fs.readFileSync(path.join(__dirname,'source',q.replaceAll('.','/')+'.as'))),source.sourceSha256);
assert.deepEqual(report.results.map(r=>r.target),['ES5','ES2015']);
for(const result of report.results){
 assert.deepEqual(result.web.rows,expected);assert.deepEqual(result.node,result.web);
 assert.equal(result.rejectionGuards,3);
 for(const check of result.typechecks){assert.equal(check.guards,3);assert.deepEqual(check.diagnostics,[]);}

}
console.log('11 original Flash rows match generated chained references in Node/Chromium ES5/ES2015; three guards per target.');
