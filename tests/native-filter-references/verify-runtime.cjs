const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const expected=require('./verify.cjs'),root=path.resolve(__dirname,'../..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const bytes=fs.readFileSync(path.join(__dirname,'runtime.json.gz'));assert.equal(hash(bytes),require('./runtime-pin.json').sha256);const report=JSON.parse(zlib.gunzipSync(bytes));
assert.equal(report.runnerSha256,hash(fs.readFileSync(path.join(__dirname,'run.cjs'))));assert.equal(report.observerSha256,hash(fs.readFileSync(path.join(__dirname,'observer.ts'))));
for(const item of report.compilerInputs)assert.equal(hash(fs.readFileSync(path.join(root,item.file),'utf8').replace(/\r\n/g,'\n')),item.sha256,item.file);
for(const [q,source]of Object.entries(report.cohorts.subject))assert.equal(hash(fs.readFileSync(path.join(__dirname,'source',q.replaceAll('.','/')+'.as'))),source.sourceSha256);
assert.deepEqual(report.results.map(r=>r.target),['ES5','ES2015']);
for(const result of report.results){
 assert.deepEqual(result.web.rows,expected);assert.deepEqual(result.node,result.web);assert.equal(result.mutations,0);assert.equal(result.rejectionGuards,5);
 for(const control of result.controls)assert.notDeepEqual(control.result.rows,expected,control.mode);
 for(const check of result.typechecks){assert.equal(check.guards,5);assert.deepEqual(check.diagnostics,[]);}
 assert.equal(result.artifacts.subject.generatedSources.length,3);
 if(process.argv.includes('--check-current'))for(const input of [...result.bundleInputs,...result.typechecks.flatMap(c=>c.inputs)])assert.equal(hash(fs.readFileSync(input.file)),input.sha256,input.file);
}
console.log(JSON.stringify({airRows:16,targets:2,realms:2,typeErrors:0,guardsPerTarget:5,mutationsPerTarget:0}));

const bytes2=fs.readFileSync(path.join(__dirname,'regressions.json.gz'));assert.equal(hash(bytes2),require('./regressions-pin.json').sha256);const regressions=JSON.parse(zlib.gunzipSync(bytes2));
assert.deepEqual(regressions.bitmap.results.map(r=>r.target),[1,2]);assert.deepEqual(regressions.bitmap.typecheck.diagnostics,[]);
for(const r of regressions.bitmap.results){assert.deepEqual(r.node,r.web);assert.equal(r.node.length,34);}
assert.deepEqual(regressions.unary.results.map(r=>r.target),['ES5','ES2015']);
for(const r of regressions.unary.results){assert.deepEqual(r.node,r.web);assert.equal(r.node.rows.length,2);for(const c of r.typechecks)assert.deepEqual(c.diagnostics,[]);}
for(const item of regressions.unary.compilerInputs)assert.equal(hash(fs.readFileSync(path.join(root,item.file),'utf8').replace(/\r\n/g,'\n')),item.sha256,item.file);
console.log(JSON.stringify({adjacentRows:36,targets:2,realms:2}));
