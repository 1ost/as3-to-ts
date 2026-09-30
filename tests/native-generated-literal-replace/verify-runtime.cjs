const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2-literal-replace-review'),evidence=path.join(engine,'tests/nativeFlashOracle/literal-string-replace');
const expected=require(path.join(evidence,'verify.cjs')),root=path.resolve(__dirname,'../..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const bytes=fs.readFileSync(path.join(__dirname,'runtime.json.gz'));assert.equal(hash(bytes),require('./runtime-pin.json').sha256);const report=JSON.parse(zlib.gunzipSync(bytes));
assert.equal(report.runnerSha256,hash(fs.readFileSync(path.join(__dirname,'run.cjs'))));assert.equal(report.observerSha256,hash(fs.readFileSync(path.join(__dirname,'observer.ts'))));
for(const item of report.compilerInputs)assert.equal(hash(fs.readFileSync(path.join(root,item.file),'utf8').replace(/\r\n/g,'\n')),item.sha256,item.file);
for(const [q,source]of Object.entries(report.cohorts.subject))assert.equal(hash(fs.readFileSync(path.join(evidence,'source',q.replaceAll('.','/')+'.as'))),source.sourceSha256);
assert.deepEqual(report.results.map(r=>r.target),['ES5','ES2015']);
for(const result of report.results){
 assert.deepEqual(result.web.rows,expected);assert.deepEqual(result.node,result.web);assert.equal(result.mutations,3);assert.equal(result.rejectionGuards,3);
 for(const check of result.typechecks){assert.equal(check.guards,3);assert.deepEqual(check.diagnostics,[]);}
 assert.equal(result.artifacts.subject.generatedSources.length,2);
 if(process.argv.includes('--check-current'))for(const input of [...result.bundleInputs,...result.typechecks.flatMap(c=>c.inputs)])assert.equal(hash(fs.readFileSync(input.file)),input.sha256,input.file);
}
console.log(JSON.stringify({airRows:26,targets:2,realms:2,typeErrors:0,guardsPerTarget:3,mutationsPerTarget:3}));

const regressionBytes=fs.readFileSync(path.join(__dirname,'regressions.json.gz'));assert.equal(hash(regressionBytes),require('./regressions-pin.json').sha256);
const regressions=JSON.parse(zlib.gunzipSync(regressionBytes));assert.equal(regressions.split.results.length,2);assert.equal(regressions.dynamic.status,'passed');
for(const result of regressions.split.results){assert.equal(result.web.rows.length,30);assert.deepEqual(result.node,result.web);for(const check of result.typechecks)assert.deepEqual(check.diagnostics,[]);}
for(const result of regressions.dynamic.results){assert.equal(result.node.length,14);assert.deepEqual(result.node,result.web);assert.deepEqual(result.mismatches,[]);}
assert.deepEqual(regressions.dynamic.typecheck.diagnostics,[]);
