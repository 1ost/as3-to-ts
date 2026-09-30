const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../..'),engine=path.resolve(root,process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2-source-namespace-review');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const pin=JSON.parse(fs.readFileSync(path.join(__dirname,'evidence-pin.json'))),bytes=fs.readFileSync(path.join(__dirname,'evidence/report.json.gz'));
assert.equal(sha(bytes),pin.reportSha256);const report=JSON.parse(zlib.gunzipSync(bytes));
assert.equal(report.qualification,pin.qualification);assert.deepEqual(report.results.map(result=>result.target),['ES5','ES2015']);
const oracle=require(path.join(engine,'tests/nativeFlashOracle/source-namespace-publication/verify.cjs'));
function subset(actual,expected){if(actual!==null&&typeof actual==='object'&&!Array.isArray(actual)){
 for(const [key,value]of Object.entries(actual)){assert(Object.hasOwn(expected,key),key);subset(value,expected[key]);}
}else assert.deepEqual(actual,expected);}
for(const result of report.results){
 assert.equal(result.node.rows.length,16);assert.equal(result.node.checks.length,11);assert.deepEqual(result.web,result.node);
 assert.equal(result.guards,8);assert.deepEqual(result.negatives,['missing-namespace-selection']);
 for(const row of result.node.rows){const original=oracle.find(item=>item.id===row.id);assert(original,row.id);subset(row,original);}
 for(const check of result.typechecks)assert.deepEqual(check.diagnostics,[]);
 for(const [cohort,sources]of Object.entries(report.cohorts))for(const [qname,input]of Object.entries(sources)){
  assert.equal(sha(input.source),input.sourceSha256);assert.equal(result.artifacts[cohort].sourceHashes[qname],input.sourceSha256);
 }
}
if(process.argv.includes('--check-current')){
 assert.equal(cp.execFileSync('git',['rev-parse','HEAD'],{cwd:engine,encoding:'utf8'}).trim(),pin.engineCommit);
 cp.execFileSync('git',['diff','--exit-code','HEAD','--','src'],{cwd:engine,stdio:'pipe'});
 for(const input of pin.compilerInputs){const file=path.resolve(root,input.file);assert(file.startsWith(root+path.sep));
  assert.equal(sha(fs.readFileSync(file,'utf8').replaceAll('\r\n','\n')),input.sha256,input.file);}
 for(const [qname,input]of Object.entries(report.cohorts.only))assert.equal(
  sha(fs.readFileSync(path.join(engine,'tests/nativeFlashOracle/source-namespace-publication/source',qname.replaceAll('.','/')+'.as'))),input.sourceSha256);
}
console.log(JSON.stringify({status:'passed',targets:2,realms:2,originalProjectedRows:16,checks:11,compilerGuards:8,compilerInputs:pin.compilerInputs.length,engine:pin.engineCommit}));
