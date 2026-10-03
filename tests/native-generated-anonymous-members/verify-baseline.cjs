const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const [file,sha] of Object.entries(require('./baseline-pin.json').files))assert.equal(hash(fs.readFileSync(path.join(__dirname,file))),sha,file);
const baseline=require('./baseline.json');assert.equal(baseline.commit,'577d2e105a1bb71d4cc77b0266c19c7fd6e077bd');assert.deepEqual(baseline.results.map(r=>r.target),['ES5','ES2015']);
for(const r of baseline.results)assert.equal(r.message,'AS3_GENERATED_LEXICAL_UNSUPPORTED: anonymous callable receiver/member lookup held');
assert(baseline.compilerInputs.length>0);assert(baseline.libInputs.length>0);const rows=require('./oracle/verify.cjs');assert.equal(rows.length,7);
console.log(JSON.stringify({originalRows:7,baselineTargets:2,implementationQualified:false}));
