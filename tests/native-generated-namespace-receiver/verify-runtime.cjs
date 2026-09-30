const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const expected=require('./verify.cjs'),root=path.resolve(__dirname,'../..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const bytes=fs.readFileSync(path.join(__dirname,'runtime.json.gz'));assert.equal(hash(bytes),require('./runtime-pin.json').sha256);const report=JSON.parse(zlib.gunzipSync(bytes));
assert.equal(report.runnerSha256,hash(fs.readFileSync(path.join(__dirname,'run.cjs'))));assert.equal(report.observerSha256,hash(fs.readFileSync(path.join(__dirname,'observer.ts'))));
for(const item of report.compilerInputs)assert.equal(hash(fs.readFileSync(path.join(root,item.file),'utf8').replace(/\r\n/g,'\n')),item.sha256,item.file);
for(const [q,source]of Object.entries(report.cohorts.subject))assert.equal(hash(fs.readFileSync(path.join(__dirname,'source',q.replaceAll('.','/')+'.as'))),source.sourceSha256);
assert.deepEqual(report.results.map(r=>r.target),['ES5','ES2015']);
for(const result of report.results){
 assert.deepEqual(result.web.rows,expected);assert.deepEqual(result.node,result.web);assert.equal(result.mutations,1);assert.equal(result.rejectionGuards,4);
 for(const check of result.typechecks){assert.equal(check.guards,4);assert.deepEqual(check.diagnostics,[]);}
 assert.equal(result.artifacts.subject.generatedSources.length,3);
 if(process.argv.includes('--check-current'))for(const input of [...result.bundleInputs,...result.typechecks.flatMap(c=>c.inputs)])assert.equal(hash(fs.readFileSync(input.file)),input.sha256,input.file);
}
console.log(JSON.stringify({airRows:11,targets:2,realms:2,typeErrors:0,guardsPerTarget:4,mutationsPerTarget:1}));

assert.equal(report.guardsSha256,hash(fs.readFileSync(path.join(__dirname,"guards.cjs"))));
const regressionBytes=fs.readFileSync(path.join(__dirname,'regressions.json.gz'));assert.equal(hash(regressionBytes),require('./regressions-pin.json').sha256);
const regressions=JSON.parse(zlib.gunzipSync(regressionBytes));
for(const key of ['publication','literal']){const r=regressions[key];assert.deepEqual(r.results.map(t=>t.target),['ES5','ES2015']);for(const result of r.results){assert.deepEqual(result.node,result.web);assert.equal(result.node.rows.length,key==='publication'?16:26);for(const check of result.typechecks)assert.deepEqual(check.diagnostics,[]);if(process.argv.includes('--check-current'))for(const input of [...(result.inputs||result.bundleInputs),...result.typechecks.flatMap(c=>c.inputs)])assert.equal(hash(fs.readFileSync(input.file)),input.sha256,input.file);}}
