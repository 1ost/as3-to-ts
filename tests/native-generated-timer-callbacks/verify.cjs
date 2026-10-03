const fs=require('fs'),path=require('path'),assert=require('assert/strict'),z=require('zlib');
const {hash,sources}=require('./compile.cjs'),expected=require('./oracle/verify.cjs'),pin=require('./pin.json');
const bytes=fs.readFileSync(path.join(__dirname,'report.json.gz'));assert.equal(hash(bytes),pin.sha256);
const report=JSON.parse(z.gunzipSync(bytes));assert.deepEqual(report.runs.map(r=>r.target),['ES5','ES2015']);assert.equal(expected.length,8);
for(const r of report.runs){assert.deepEqual(r.sources,sources);assert.deepEqual(r.node,expected);assert.deepEqual(r.web,expected);assert.deepEqual(r.diagnostics,[]);}
if(process.argv.includes('--check-current'))for(const row of [report.runner,...pin.inputs,...report.compilerInputs,...report.runs.flatMap(r=>r.inputs)])assert.equal(hash(fs.readFileSync(row.file)),row.sha256,row.file);
console.log(JSON.stringify({rows:8,targets:2,realms:2,typeErrors:0,wholeClientQualified:false}));
