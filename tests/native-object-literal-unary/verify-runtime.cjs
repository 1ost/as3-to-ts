const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const expected=require('./verify.cjs'),root=path.resolve(__dirname,'../..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const bytes=fs.readFileSync(path.join(__dirname,'runtime.json.gz'));assert.equal(hash(bytes),require('./runtime-pin.json').sha256);const report=JSON.parse(zlib.gunzipSync(bytes));
assert.equal(report.runnerSha256,hash(fs.readFileSync(path.join(__dirname,'run.cjs'))));assert.equal(report.observerSha256,hash(fs.readFileSync(path.join(__dirname,'observer.ts'))));
for(const item of report.compilerInputs)assert.equal(hash(fs.readFileSync(path.join(root,item.file),'utf8').replace(/\r\n/g,'\n')),item.sha256,item.file);
for(const [q,source]of Object.entries(report.cohorts.subject))assert.equal(hash(fs.readFileSync(path.join(__dirname,'source',q.replaceAll('.','/')+'.as'))),source.sourceSha256);
assert.deepEqual(report.results.map(r=>r.target),['ES5','ES2015']);
for(const result of report.results){
 assert.deepEqual(result.web.rows,expected);assert.deepEqual(result.node,result.web);assert.equal(result.mutations,0);assert.equal(result.rejectionGuards,0);
 for(const control of result.controls)assert.notDeepEqual(control.result.rows,expected,control.mode);
 for(const check of result.typechecks){assert.equal(check.guards,0);assert.deepEqual(check.diagnostics,[]);}
 assert.equal(result.artifacts.subject.generatedSources.length,2);
 if(process.argv.includes('--check-current'))for(const input of [...result.bundleInputs,...result.typechecks.flatMap(c=>c.inputs)])assert.equal(hash(fs.readFileSync(input.file)),input.sha256,input.file);
}
console.log(JSON.stringify({airRows:2,targets:2,realms:2,typeErrors:0,guardsPerTarget:0,mutationsPerTarget:0}));

const regressionsBytes=fs.readFileSync(path.join(__dirname,'regressions.json.gz'));
assert.equal(hash(regressionsBytes),require('./regressions-pin.json').sha256);
const regressions=JSON.parse(zlib.gunzipSync(regressionsBytes));
assert.deepEqual(regressions.literals.results.map(r=>r.target),[1,2]);
assert.deepEqual(regressions.literals.typecheck.diagnostics,[]);
for(const r of regressions.literals.results){assert.deepEqual(r.node,r.web);assert.equal(r.node.length,9);}
assert.deepEqual(regressions.accessors.runs.map(r=>r.target),['ES5','ES2015']);
for(const r of regressions.accessors.runs){assert.deepEqual(r.actual.node,r.actual.web);assert.equal(r.actual.node.rows.length,28);assert.deepEqual(r.typecheck.diagnostics,[]);assert.equal(r.guards.length,12);assert.equal(r.controls.length,2);}
assert.deepEqual(regressions.delayed.results.map(r=>r.target),['ES5','ES2015']);
for(const r of regressions.delayed.results){assert.deepEqual(r.node,r.web);assert.equal(r.node.rows.length,14);for(const c of r.typechecks)assert.deepEqual(c.diagnostics,[]);}
for(const [r,normalize]of [[regressions.accessors,false],[regressions.delayed,true]])for(const input of r.compilerInputs){let bytes=fs.readFileSync(path.join(root,input.file));if(normalize)bytes=bytes.toString('utf8').replace(/\r\n/g,'\n');assert.equal(hash(bytes),input.sha256,input.file);}
console.log(JSON.stringify({adjacentRegressionRows:51,targets:2,realms:2}));
