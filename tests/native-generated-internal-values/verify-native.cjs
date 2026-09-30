const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const expected=require('./verify.cjs'),root=path.resolve(__dirname,'../..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const pin=JSON.parse(fs.readFileSync(path.join(__dirname,'native-pin.json')));assert.equal(pin.reports.length,2);
for(const [index,item] of pin.reports.entries()){
 const bytes=fs.readFileSync(path.join(__dirname,item.file));assert.equal(sha(bytes),item.sha256);const report=JSON.parse(zlib.gunzipSync(bytes));
 assert.equal(report.combined,index===0);assert.equal(report.runnerSha256,sha(fs.readFileSync(path.join(__dirname,'run.cjs'))));
 assert.equal(report.observer.sha256,sha(fs.readFileSync(path.join(__dirname,'runtime-driver.js'))));
 assert.equal(report.emitted.length,5);assert.equal(report.outputs.length,6);assert.equal(report.rejectionGuards,19);assert.equal(report.comparisonNegativeControls,3);assert.deepEqual(report.typecheck.diagnostics,[]);
 for(const output of report.outputs)assert.equal(sha(output.source),output.sha256,output.file);
 for(const emitted of report.emitted){assert.equal(sha(fs.readFileSync(path.join(__dirname,'source',emitted.qname.replaceAll('.','/')+'.as'))),emitted.sourceSha256);assert.equal(report.outputs.find(o=>o.file===path.basename(emitted.file)).sha256,emitted.outputSha256);}
 assert.deepEqual(report.results.map(r=>r.target),[1,2]);
 for(const result of report.results){assert.equal(result.appliedMutations,3);assert.deepEqual(result.node,expected);assert.deepEqual(result.web,expected);}
 for(const input of report.compilerInputs)assert.equal(sha(fs.readFileSync(path.join(root,input.file),'utf8').replace(/\r\n/g,'\n')),input.sha256,input.file);
 if(process.argv.includes('--check-current'))for(const input of report.typecheck.inputs)assert.equal(sha(fs.readFileSync(input.file)),input.sha256,input.file);
}
console.log(JSON.stringify({airRows:30,classes:5,modes:2,targets:2,realms:2,rejectionGuards:19,appliedMutationsPerTarget:3,typeErrors:0}));
