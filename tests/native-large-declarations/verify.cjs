const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto'),{gunzipSync}=require('node:zlib');
const hash=v=>createHash('sha256').update(v).digest('hex'),root=path.resolve(__dirname,'../..'),pin=JSON.parse(fs.readFileSync(path.join(__dirname,'pin.json'))),bytes=fs.readFileSync(path.join(__dirname,'report.json.gz'));assert.equal(hash(bytes),pin.sha256);
const report=JSON.parse(gunzipSync(bytes));assert.deepEqual(report.compactByteStable,[1,32,511]);
assert.deepEqual(report.typechecks.map(t=>t.name),['baseline','current']);const baseline=report.typechecks[0].diagnostics;assert.equal(baseline.length,1401);assert.equal(baseline.filter(d=>d.code===2563).length,1);assert.equal(baseline.filter(d=>d.code===7006).length,1400);assert.deepEqual(report.typechecks[1].diagnostics,[]);
assert.deepEqual(report.results.map(r=>r.target),['ES5','ES2015']);
for(const result of report.results){assert.deepEqual(result.node,result.web);assert.equal(result.node.classes,1400);assert.equal(result.node.checks.length,6);assert.equal(result.mutations,1);assert.deepEqual(result.errors,[]);}
for(const item of pin.compilerInputs)assert.equal(hash(fs.readFileSync(path.join(root,item.file),'utf8').replace(/\r\n/g,'\n')),item.sha256,item.file);
assert.equal(hash(fs.readFileSync(path.join(__dirname,'run.cjs'))),report.runnerSha256);
if(process.argv.includes('--check-current'))for(const item of [...report.typechecks.flatMap(t=>t.inputs),...report.results.flatMap(r=>r.inputs)])assert.equal(hash(fs.readFileSync(item.file)),item.sha256,item.file);
console.log(JSON.stringify({baselineDiagnostics:1401,currentDiagnostics:0,classes:1400,targets:2,realms:2,runtimeChecksPerTarget:6,mutationsPerTarget:1,compactByteStable:[1,32,511]}));
