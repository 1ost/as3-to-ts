const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto'),{gunzipSync}=require('node:zlib'),{execFileSync}=require('node:child_process');
const compiler=path.resolve(__dirname,'../..'),engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2-boolean-string-review'),hash=b=>createHash('sha256').update(b).digest('hex');
const pin=require('./validation-pin.json'),bytes=fs.readFileSync(path.join(__dirname,'validation.json.gz'));assert.equal(hash(bytes),pin.sha256);
for(const [file,sha] of Object.entries(pin.inputs))assert.equal(hash(fs.readFileSync(path.join(compiler,file))),sha,file);
assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:engine,encoding:'utf8'}).trim(),pin.engineCommit);
const {comparison,protocols}=JSON.parse(gunzipSync(bytes));assert.equal(hash(fs.readFileSync(path.join(comparison.baseline,'emit/native-generated-lexical.js'))),pin.baselineLexicalSha256);
let outputs=0,rejections=0;
for(const r of comparison.comparisons){assert.equal(r.baseline.code,0);assert.equal(r.current.code,0);assert.deepEqual(r.current.emissions,r.baseline.emissions);assert(r.current.resolutions<r.baseline.resolutions);outputs+=r.current.emissions.filter(e=>e.sha256).length;rejections+=r.current.emissions.filter(e=>e.error).length;}
assert.equal(outputs,8);assert.equal(rejections,28);
for(const [suite,report] of Object.entries(protocols)){
 const expected=require(suite==='native-generated-static-getter-receiver'?path.join(engine,'tests/nativeFlashOracle/static-getter-receiver/verify.cjs'):path.join(compiler,'tests',suite,'verify.cjs'));
 assert.equal(expected.length,suite==='native-generated-static-getter-receiver'?13:24);
 assert.equal(hash(fs.readFileSync(path.join(compiler,'tests',suite,'run.cjs'))),report.runnerSha256);assert.equal(hash(fs.readFileSync(path.join(compiler,'tests',suite,'observer.ts'))),report.observerSha256);
 assert.deepEqual(report.results.map(r=>r.target),['ES5','ES2015']);
 for(const r of report.results){assert.deepEqual(r.node.rows,expected);assert.deepEqual(r.web,r.node);assert.equal(r.rejectionGuards,7);if(suite==='native-generated-public-compound')assert.equal(r.mutations,4);
  for(const check of r.typechecks){assert.deepEqual(check.diagnostics,[]);for(const i of check.inputs)assert.equal(hash(fs.readFileSync(path.resolve(compiler,i.file))),i.sha256,i.file);}
  for(const i of r.bundleInputs||[])assert.equal(hash(fs.readFileSync(path.resolve(compiler,i.file))),i.sha256,i.file);
 }
}
console.log(JSON.stringify({identicalArtifacts:outputs,identicalRejections:rejections,staticGetterRows:13,compoundRows:24,targets:2,realms:2,typeErrors:0}));
