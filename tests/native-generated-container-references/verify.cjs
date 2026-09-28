const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = __dirname, evidence = path.join(root, 'evidence');
const json = file => JSON.parse(fs.readFileSync(file));
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.equal(sha(path.join(evidence, 'receipt.json')), json(path.join(root, 'evidence-pin.json')).receiptSha256);
const receipt = json(path.join(evidence, 'receipt.json'));
assert.equal(receipt.status, 'passed');
assert.equal(receipt.entry, 'ContainerReferenceProbe');
assert.equal(receipt.capture.status, 'passed');
assert.equal(receipt.capture.runs, 2);
assert.equal(receipt.capture.identical, true);
assert.equal(receipt.capture.observationCount, 48);
for (const [relative, expected] of Object.entries(receipt.artifacts)) {
    const file = path.resolve(evidence, relative);
    assert.ok(file.startsWith(evidence + path.sep));
    assert.equal(sha(file), expected, relative);
    if (relative.startsWith('source/')) assert.equal(sha(path.join(root, relative)), expected, relative);
}
const first = json(path.join(evidence, 'run-1/capture.json'));
assert.deepEqual(first, json(path.join(evidence, 'run-2/capture.json')));
assert.equal(first.runtime.playerType, 'PlugIn');
assert.equal(first.runtime.version, 'WIN 26,0,0,131');
assert.equal(first.state.ready, true);
assert.equal(first.state.failure, '');
const rows = first.state.observations;
assert.equal(rows.length, 48);
assert.deepEqual(rows, json(path.join(root, 'expected.json')));
if(require.main===module)console.log(JSON.stringify({rows:rows.length}));
module.exports=rows;
