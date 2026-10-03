const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=__dirname,evidence=path.join(root,'evidence');
const json=file=>JSON.parse(fs.readFileSync(file)),sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.equal(sha(path.join(evidence,'receipt.json')),json(path.join(root,'evidence-pin.json')).receiptSha256);
const receipt=json(path.join(evidence,'receipt.json'));
assert.equal(receipt.status,'passed');assert.equal(receipt.entry,'UnaryOracle');
assert.equal(receipt.capture.status,'passed');assert.equal(receipt.capture.runs,2);assert.equal(receipt.capture.identical,true);
assert.equal(receipt.capture.observationCount,2);
for(const [relative,expected] of Object.entries(receipt.artifacts)){
 const file=path.resolve(evidence,relative);assert.ok(file.startsWith(evidence+path.sep));assert.equal(sha(file),expected,relative);
 if(relative.startsWith('source/'))assert.equal(sha(path.join(root,relative)),expected,relative);
}
const first=json(path.join(evidence,'run-1/capture.json'));assert.deepEqual(first,json(path.join(evidence,'run-2/capture.json')));
assert.equal(first.runtime.playerType,'Desktop');assert.equal(first.runtime.version,'WIN 51,3,4,2');
assert.equal(first.state.ready,true);assert.equal(first.state.failure,'');
const rows=first.state.observations,byId=new Map(rows.map(row=>[row.id,row.value]));
const expected=json(path.join(root,'expected.json'));assert.equal(expected.length,2);assert.deepEqual(rows,expected);
module.exports=rows;
