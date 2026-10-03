const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const expected=require('./verify.cjs'),root=path.resolve(__dirname,'../..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const bytes=fs.readFileSync(path.join(__dirname,'runtime.json.gz'));assert.equal(hash(bytes),require('./runtime-pin.json').sha256);const report=JSON.parse(zlib.gunzipSync(bytes));
assert.equal(report.runnerSha256,hash(fs.readFileSync(path.join(__dirname,'run.cjs'))));assert.equal(report.observerSha256,hash(fs.readFileSync(path.join(__dirname,'observer.ts'))));
for(const item of report.compilerInputs)assert.equal(hash(fs.readFileSync(path.join(root,item.file),'utf8').replace(/\r\n/g,'\n')),item.sha256,item.file);
for(const [q,source]of Object.entries(report.cohorts.subject))assert.equal(hash(fs.readFileSync(path.join(__dirname,'source',q.replaceAll('.','/')+'.as'))),source.sourceSha256);
assert.deepEqual(report.results.map(r=>r.target),['ES5','ES2015']);
for(const result of report.results){
 assert.deepEqual(result.web.rows,expected);assert.deepEqual(result.node,result.web);assert.equal(result.mutations,4);assert.equal(result.rejectionGuards,15);
 for(const control of result.controls)assert.notDeepEqual(control.result.rows,expected,control.mode);
 for(const check of result.typechecks){assert.equal(check.guards,15);assert.deepEqual(check.diagnostics,[]);}
 assert.equal(result.artifacts.subject.generatedSources.length,2);
 if(process.argv.includes('--check-current'))for(const input of [...result.bundleInputs,...result.typechecks.flatMap(c=>c.inputs)])assert.equal(hash(fs.readFileSync(input.file)),input.sha256,input.file);
}
console.log(JSON.stringify({airRows:14,targets:2,realms:2,typeErrors:0,guardsPerTarget:15,mutationsPerTarget:4}));

assert.equal(report.guardsSha256,hash(fs.readFileSync(path.join(__dirname,"guards.cjs"))));

const regressionBytes=fs.readFileSync(path.join(__dirname,'regressions.json.gz'));assert.equal(hash(regressionBytes),require('./regressions-pin.json').sha256);
for(const [key,r] of Object.entries(JSON.parse(zlib.gunzipSync(regressionBytes)))){assert.deepEqual(r.results.map(t=>t.target),['ES5','ES2015']);for(const result of r.results){assert.deepEqual(result.node,result.web);assert.equal(result.web.rows.length,key==='delayed'?9:key==='controls'?10:19);for(const check of result.typechecks){assert.deepEqual(check.diagnostics,[]);if(process.argv.includes('--check-current'))for(const input of check.inputs)assert.equal(hash(fs.readFileSync(input.file)),input.sha256,input.file);}}}

const baseline=require('./baseline.json');assert.equal(baseline.sourceSha256,hash(fs.readFileSync(path.join(__dirname,'source/DelayedParamsSubject.as'))));for(const [file,sha256] of Object.entries(baseline.logs))assert.equal(hash(fs.readFileSync(path.join(__dirname,file))),sha256);

for(const input of report.dependencyPins)assert.equal(hash(fs.readFileSync(input.file)),input.sha256,input.file);
