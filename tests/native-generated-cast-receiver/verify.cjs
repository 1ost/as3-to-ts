const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const hash=b=>createHash('sha256').update(b).digest('hex'),root=path.join(__dirname,'oracle'),bytes=fs.readFileSync(path.join(root,'receipt.json'));
assert.equal(hash(bytes),require('./oracle-pin.json').sha256);const receipt=JSON.parse(bytes);
assert.equal(receipt.status,'passed');assert.equal(receipt.entry,'CastProbe');assert.equal(receipt.capture.runs,2);assert.equal(receipt.capture.identical,true);assert.equal(receipt.capture.observationCount,14);
for(const [name,sha]of Object.entries(receipt.artifacts)){const file=path.resolve(root,name);assert(file.startsWith(root+path.sep));assert.equal(hash(fs.readFileSync(file)),sha,file);if(name.startsWith('source/'))assert.equal(hash(fs.readFileSync(path.join(__dirname,name))),sha,name);}
const a=JSON.parse(fs.readFileSync(path.join(root,'run-1/capture.json'))),b=JSON.parse(fs.readFileSync(path.join(root,'run-2/capture.json')));
assert.deepEqual(a,b);assert.equal(a.runtime.playerType,'Desktop');assert.equal(a.state.ready,true);assert.equal(a.state.failure,'');assert.deepEqual(a.state.observations,require('./expected.json'));
module.exports=a.state.observations;
