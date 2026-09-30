const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const expected=require('./verify.cjs'),root=path.resolve(__dirname,'../..'),sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const pin=JSON.parse(fs.readFileSync(path.join(__dirname,'native-pin.json'))),bytes=fs.readFileSync(path.join(__dirname,'native.json.gz'));
assert.equal(sha(bytes),pin.reportSha256);const report=JSON.parse(zlib.gunzipSync(bytes));
assert.equal(report.runnerSha256,sha(fs.readFileSync(path.join(__dirname,'run.cjs'))));assert.equal(report.observerSha256,sha(fs.readFileSync(path.join(__dirname,'observer.ts'))));
assert.deepEqual(report.results.map(r=>r.target),['ES5','ES2015']);
for(const [qname,source]of Object.entries(report.cohorts.parent))assert.equal(sha(fs.readFileSync(path.join(__dirname,'source',qname.replaceAll('.','/')+'.as'))),source.sourceSha256,qname);
assert.equal(Object.keys(report.cohorts.parent).length,4);
for(const result of report.results){
 assert.deepEqual(result.node.rows,expected);assert.deepEqual(result.web,result.node);assert.equal(result.rejectionGuards,7);
 assert.deepEqual(result.mutations,['omit-reference-check','omit-argument-count','omit-int-return','omit-int-fallthrough','reject-zero-extra']);
 assert.equal(result.artifacts.parent.generatedSources.length,5);assert.equal(result.typechecks.length,1);assert.deepEqual(result.typechecks[0].diagnostics,[]);
 if(process.argv.includes('--check-current'))for(const item of [...result.inputs,...result.typechecks.flatMap(c=>c.inputs)])assert.equal(sha(fs.readFileSync(item.file)),item.sha256,item.file);
}
for(const item of report.compilerInputs)assert.equal(sha(fs.readFileSync(path.join(root,item.file),'utf8').replace(/\r\n/g,'\n')),item.sha256,item.file);
console.log(JSON.stringify({airRows:29,classes:4,targets:2,realms:2,rejectionGuards:7,appliedMutationsPerTarget:5,typeErrors:0}));
