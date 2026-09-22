const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=__dirname,evidence=path.join(root,'evidence');
const json=file=>JSON.parse(fs.readFileSync(file)),sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.equal(sha(path.join(evidence,'receipt.json')),json(path.join(root,'evidence-pin.json')).receiptSha256);
const receipt=json(path.join(evidence,'receipt.json'));
assert.equal(receipt.status,'passed');assert.equal(receipt.entry,'GeneratedClassLocalProbe');
assert.deepEqual(receipt.capture.status,'passed');assert.equal(receipt.capture.runs,2);assert.equal(receipt.capture.identical,true);
for(const [relative,expected] of Object.entries(receipt.artifacts)){
 const file=path.resolve(evidence,relative);assert.ok(file.startsWith(evidence+path.sep));assert.equal(sha(file),expected,relative);
 if(relative.startsWith('source/')){
  assert.equal(sha(path.join(root,relative)),expected,relative);
  if(!relative.endsWith('GeneratedClassLocalProbe.as'))assert.equal(sha(path.join(root,'../native-foreign-typed-locals/capture-c/sources/original',relative.slice(7))),expected,'Unchanged original: '+relative);
 }
}
const first=json(path.join(evidence,'run-1/capture.json'));assert.deepEqual(first,json(path.join(evidence,'run-2/capture.json')));
assert.equal(first.runtime.playerType,'Desktop');assert.equal(first.runtime.version,'WIN 51,3,4,2');
const captured=first.state.observations[0].value;
assert.equal(captured.rows.length,41);assert.equal(captured.initializationRows.length,7);assert.equal(captured.errorRows.length,9);
const pepper=json(path.join(root,'../native-foreign-typed-locals/capture-c/flash.json'));
assert.deepEqual(captured.rows,pepper.rows);assert.deepEqual(captured.initializationRows,pepper.initializationRows);
const errors=structuredClone(pepper.errorRows);
for(const row of errors)if(['fields','wildcard','readonly','rethrow','snapshot'].includes(row.id))row.value=[row.value[0],typeof row.value[1],row.value[1]===null,row.value[2]];
assert.deepEqual(captured.errorRows,errors);
module.exports=captured;
if(require.main===module)console.log('Authenticated 12 unchanged classes and 57 repeated AIR observations; error message text is excluded.');
