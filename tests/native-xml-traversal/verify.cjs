const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=__dirname,hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const bytes=fs.readFileSync(path.join(root,'evidence/receipt.json')),pin=require('./evidence-pin.json');
assert.equal(hash(bytes),pin.sha256);
const receipt=JSON.parse(bytes);assert.equal(receipt.entry,'TraversalOracle');assert.equal(receipt.status,'passed');
assert.equal(receipt.capture.runs,2);assert.equal(receipt.capture.identical,true);assert.equal(receipt.capture.observationCount,16);
for(const [relative,sha256]of Object.entries(receipt.artifacts)){
 const file=path.resolve(root,'evidence',relative);assert(file.startsWith(path.join(root,'evidence')+path.sep));
 assert.equal(hash(fs.readFileSync(file)),sha256,file);
 if(relative.startsWith('source/'))assert.equal(hash(fs.readFileSync(path.join(root,relative))),sha256,relative);
}
const a=JSON.parse(fs.readFileSync(path.join(root,'evidence/run-1/capture.json'))),b=JSON.parse(fs.readFileSync(path.join(root,'evidence/run-2/capture.json')));
assert.deepEqual(a,b);assert.equal(a.runtime.playerType,'Desktop');assert.equal(a.state.ready,true);assert.equal(a.state.failure,'');
assert.deepEqual(a.state.observations,require('./expected.json'));
module.exports=a.state.observations;

