const fs=require('fs'),path=require('path'),assert=require('assert/strict'),z=require('zlib');
const {sources,hash}=require('../native-generated-anonymous-members/compile.cjs');
const pin=require('./pin.json'),bytes=fs.readFileSync(path.join(__dirname,'report.json.gz'));
assert.equal(hash(bytes),pin.sha256);assert.equal(hash(fs.readFileSync(path.join(__dirname,'baseline.json'))),pin.baselineSha256);
const report=JSON.parse(z.gunzipSync(bytes)),expected=require('../native-generated-anonymous-members/oracle/verify.cjs');
assert.equal(expected.length,7);assert.equal(report.checks.length,5);assert.equal(report.runs.length,10);
for(const c of report.checks){assert.equal(c.actual.length,1);assert.equal(c.actual[0].start,c.expectedStart);assert.equal(c.actual[0].end,c.expectedStart+c.comment.length);assert.equal(c.actual[0].text,c.comment);}
assert.deepEqual(report.runs.map(r=>[r.target,r.variant]),['ES5','ES2015'].flatMap(t=>[0,1,2,3,4].map(v=>[t,v])));
for(const r of report.runs){assert.deepEqual(r.node,expected);assert.deepEqual(r.web,expected);assert.deepEqual(r.diagnostics,[]);
for(const [q,s]of Object.entries(sources)){assert.equal(r.sources[q].source,s.source.replace('public class',r.comment+'\npublic class'));assert.equal(r.sources[q].sourceSha256,hash(r.sources[q].source));}}
const baseline=require('./baseline.json');assert.equal(baseline.failures.length,2);for(const f of baseline.failures)assert.match(f.error,/intermediate native syntax/);
if(process.argv.includes('--check-current'))for(const row of [report.runner,...report.compilerInputs,...report.runs.flatMap(r=>r.inputs)])assert.equal(hash(fs.readFileSync(row.file)),row.sha256,row.file);
console.log(JSON.stringify({variants:5,rows:7,targets:2,realms:2,typeErrors:0,wholeClientQualified:false}));
