const fs=require('fs'),path=require('path'),z=require('zlib'),crypto=require('crypto'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../..'),engine=path.resolve(root,'../LayaAir-op2');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),sourceHash=b=>hash(b.toString('utf8').replace(/\r\n/g,'\n'));
const bytes=fs.readFileSync(path.join(__dirname,'runtime.json.gz'));assert.equal(hash(bytes),require('./runtime-pin.json').sha256);
const report=JSON.parse(z.gunzipSync(bytes));
const expected=require(path.join(engine,'tests/nativeFlashOracle/embedded-bytearray/verify.cjs'));
const initialized=require(path.join(engine,'tests/nativeFlashOracle/embedded-class-initialization/verify.cjs'));
assert.deepEqual(report.results.map(r=>r.target),['ES5','ES2015']);
for(const result of report.results){
 assert.deepEqual(result.node.rows,expected);assert.deepEqual(result.node.initialization,initialized);assert.deepEqual(result.web,result.node);
 assert.deepEqual(result.node.domainChecks,[true,true,true]);assert.equal(result.guards,22);assert.equal(result.mutations,2);
 assert.deepEqual(result.diagnostics,[]);assert.deepEqual(result.errors,[]);assert.equal(result.artifact.generatedSources.length,3);
 for(const input of result.providerGraph)if(!input.file.replaceAll('\\','/').includes('.cache/'))
  assert.equal(sourceHash(fs.readFileSync(path.resolve(root,input.file))),input.sha256,input.file);
}
for(const input of report.compilerGraph)assert.equal(sourceHash(fs.readFileSync(path.join(root,input.file))),input.sha256,input.file);
for(const [file,key]of [['run.cjs','runnerSha256'],['observer.ts','observerSha256']])assert.equal(sourceHash(fs.readFileSync(path.join(__dirname,file))),report[key]);
for(const record of Object.values(report.sources)){
 assert.equal(hash(record.source),record.sourceSha256);
 for(const asset of Object.values(record.embeddedBinary))assert.equal(hash(Buffer.from(asset.payload)),asset.sourceSha256);
}
console.log(JSON.stringify({status:'passed',rows:34,guards:22,domainChecks:3,mutations:2,targets:2,runtimes:['Node','Chromium']}));
