const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),z=require('node:zlib'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
if(process.argv[2]==='--retain'){
 assert.equal(process.argv.length,4,'Pass completed baseline report.json');
 const bytes=z.gzipSync(fs.readFileSync(process.argv[3]),{level:9});fs.writeFileSync(path.join(__dirname,'baseline.json.gz'),bytes);
 fs.writeFileSync(path.join(__dirname,'baseline-pin.json'),JSON.stringify({sha256:hash(bytes)},null,2)+'\n');
}
const bytes=fs.readFileSync(path.join(__dirname,'baseline.json.gz'));assert.equal(hash(bytes),require('./baseline-pin.json').sha256);
const report=JSON.parse(z.gunzipSync(bytes)),original=require('./oracle/verify.cjs');
assert.equal(report.baseline,'d1fcd69ed579ec86a351ec88b091ed4d85b2e7d1');assert.equal(report.engineCommit,'0d177fba3c05c932b87a8b0c5e553c63ee6f1020');assert.equal(report.originalRows,original.length);assert.equal(original.length,28);
assert.equal(Object.keys(report.sources).length,7);for(const [q,sha]of Object.entries(report.sources))assert.equal(hash(fs.readFileSync(path.join(__dirname,'oracle/source/cases',q.split('.').pop()+'.as'))),sha,q);
assert.deepEqual(report.results.map(r=>[r.target,r.name,r.sourceClasses]),['ES5','ES2015'].flatMap(t=>[[t,'complete',7],[t,'getter-ancestry',3],[t,'setter-ancestry',2]]));
for(const r of report.results){const subject={complete:'PairChild','getter-ancestry':'ReadChild','setter-ancestry':'WriteChild'}[r.name],reason=r.name==='complete'?'inherited collision/partial override requires authority':'duplicate or incompatible public declaration';assert.equal(r.message,'AS3_GENERATED_TRAITS_UNSUPPORTED: '+reason+': cases.'+subject+':value');}
if(process.argv.includes('--check-current'))for(const [file,sha]of Object.entries(report.inputs))assert.equal(hash(fs.readFileSync(path.join(root,file))),sha,file);
console.log(JSON.stringify({status:'baseline-verified',originalRows:28,classes:7,targets:2,rejections:6}));module.exports=report;
