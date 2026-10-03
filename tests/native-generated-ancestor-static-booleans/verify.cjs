const fs=require('fs'),path=require('path'),z=require('zlib'),crypto=require('crypto'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const bytes=fs.readFileSync(path.join(__dirname,'report.json.gz'));assert.equal(hash(bytes),JSON.parse(fs.readFileSync(path.join(__dirname,'pin.json'))).sha256);
const document=JSON.parse(z.gunzipSync(bytes)),engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||document.engine);
const expected=require('./oracle/verify.cjs');
assert.equal(document.engineCommit,'9bc1976d7504bc3904a5e575e1403105dfe14e5d');
assert.equal(document.baseline.commit,'3e14ebd829dbf0e8b2d86a327ebd2a6a22a0e75d');
assert.equal(document.baseline.status,'baseline-rejected');
for(const emitted of document.reports.ancestor.emitted)assert.equal(emitted.sourceSha256,document.baseline.sources[emitted.qname]);
const evidence={ancestor:expected,booleans:require(path.join(engine,'tests/nativeFlashOracle/generated-protected-static-booleans/verify.cjs')),strings:require(path.join(engine,'tests/nativeFlashOracle/generated-protected-static-strings/verify.cjs')),constants:require(path.join(engine,'tests/nativeFlashOracle/generated-protected-constants/verify.cjs'))};
for(const [name,rows] of Object.entries(evidence)){
 const report=document.reports[name];assert.equal(report.combined,true);assert.equal(report.results.length,2);assert.deepEqual(report.typecheck.diagnostics,[]);
 assert.deepEqual(report.results.map(result=>result.target),[1,2]);
 for(const result of report.results){assert.deepEqual(result.node,rows);assert.deepEqual(result.web,rows);
  if(name==='ancestor'){assert.deepEqual(result.appliedReceiverControls,['Grand','Leaf']);assert.equal(result.domainIsolationChecks,3);}}
 assert.equal(report.rejectionGuards,{ancestor:16,booleans:12,strings:4,constants:16}[name]);
 if(process.argv.includes('--check-current'))for(const input of report.providerGraph)assert.equal(hash(fs.readFileSync(path.join(engine,input.file))),input.sha256,input.file);
}
const vectorRows=require(path.join(engine,'tests/nativeFlashOracle/static-vector-storage/verify.cjs')).map(row=>row.id.startsWith('metadata-')?{...row,value:row.value.replace(/>\s+</g,'><')}:row);
const vectors=document.reports.vectors;assert.equal(vectors.results.length,2);
for(const result of vectors.results){assert.deepEqual(result.node,result.web);assert.deepEqual(result.node.rows,vectorRows);if(process.argv.includes('--check-current'))for(const input of result.inputs){const file=path.resolve(root,input.file);if(file.startsWith(engine+path.sep))assert.equal(hash(fs.readFileSync(file)),input.sha256,input.file);}for(const check of result.typechecks)assert.deepEqual(check.diagnostics,[]);assert.equal(result.rejectionGuards,4);assert.equal(result.mutations,2);}
if(process.argv.includes('--check-current'))for(const input of document.inputs)assert.equal(hash(fs.readFileSync(path.join(root,input.file))),input.sha256,input.file);
console.log(JSON.stringify({status:'passed',ancestorRows:26,regressionRows:72,targets:2,realms:2,compilerGuards:16,appliedControls:2,domainChecks:3}));
module.exports=document;
