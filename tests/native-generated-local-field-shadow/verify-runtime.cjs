const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const expected=require('./verify.cjs'),root=path.resolve(__dirname,'../..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const bytes=fs.readFileSync(path.join(__dirname,'runtime.json.gz'));assert.equal(hash(bytes),require('./runtime-pin.json').sha256);const report=JSON.parse(zlib.gunzipSync(bytes));
assert.equal(report.runnerSha256,hash(fs.readFileSync(path.join(__dirname,'run.cjs'))));assert.equal(report.observerSha256,hash(fs.readFileSync(path.join(__dirname,'observer.ts'))));
for(const item of report.compilerInputs)assert.equal(hash(fs.readFileSync(path.join(root,item.file),'utf8').replace(/\r\n/g,'\n')),item.sha256,item.file);
for(const [q,source]of Object.entries(report.cohorts.subject))assert.equal(hash(fs.readFileSync(path.join(__dirname,'source',q.replaceAll('.','/')+'.as'))),source.sourceSha256);
assert.deepEqual(report.results.map(r=>r.target),['ES5','ES2015']);
for(const result of report.results){
 assert.deepEqual(result.web.rows,expected);assert.deepEqual(result.node,result.web);assert.equal(result.mutations,1);assert.equal(result.rejectionGuards,5);
 assert.equal(result.controls.length,1);for(const c of result.controls){assert.deepEqual(c.node,c.web);assert.ok(Array.isArray(c.node.rows));assert.notDeepEqual(c.node.rows,expected);}
 for(const check of result.typechecks){assert.equal(check.guards,5);assert.deepEqual(check.diagnostics,[]);}
 assert.equal(result.artifacts.subject.generatedSources.length,3);
 if(process.argv.includes('--check-current'))for(const input of [...result.bundleInputs,...result.typechecks.flatMap(c=>c.inputs)])assert.equal(hash(fs.readFileSync(input.file)),input.sha256,input.file);
}
console.log(JSON.stringify({airRows:7,targets:2,realms:2,typeErrors:0,guardsPerTarget:5,mutationsPerTarget:1}));
