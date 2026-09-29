const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,p)));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const receipt=read('flash/receipt.json'),dir=path.join(__dirname,'flash');
assert.equal(sha(path.join(dir,'receipt.json')),read('evidence-pin.json'));
assert.equal(receipt.status,'passed');assert.equal(receipt.capture.runs,2);assert.equal(receipt.attachDisplayFixture,false);
for(const [name,digest] of Object.entries(receipt.artifacts)){
 const target=path.resolve(dir,name);assert.ok(target.startsWith(dir+path.sep));assert.equal(sha(target),digest,name);
 if(name.startsWith('source/'))assert.equal(sha(path.join(__dirname,name)),digest,name);
}
const first=read('flash/run-1/capture.json');assert.deepEqual(first,read('flash/run-2/capture.json'));
assert.equal(first.runtime.playerType,'PlugIn');assert.equal(first.state.ready,true);assert.equal(first.state.failure,'');
const expected=read('expected.json');assert.equal(expected.length,11);assert.deepEqual(first.state.observations,expected);
module.exports=expected;
if(require.main===module)console.log('11 repeated browser Flash chained generated reference enumeration observations authenticated.');
