const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const root = __dirname;
const evidence = path.join(root, 'evidence');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const receiptBytes = fs.readFileSync(path.join(evidence, 'receipt.json'));
const pin = JSON.parse(fs.readFileSync(path.join(root, 'evidence-pin.json')));
assert.strictEqual(hash(receiptBytes), pin.receiptSha256);
const receipt = JSON.parse(receiptBytes);
assert.strictEqual(receipt.status, 'passed');
assert.strictEqual(receipt.capture.runs, 2);
assert.strictEqual(receipt.capture.identical, true);
assert.strictEqual(receipt.capture.observationCount, 96);
for (const [relative, expected] of Object.entries(receipt.artifacts)) {
  const artifact = path.resolve(evidence, relative);
  assert.ok(artifact.startsWith(evidence + path.sep));
  assert.strictEqual(hash(fs.readFileSync(artifact)), expected, relative);
  if (relative.startsWith('source/')) {
    assert.strictEqual(hash(fs.readFileSync(path.join(root, relative))), expected, 'current ' + relative);
  }
}
const first = fs.readFileSync(path.join(evidence, 'run-1/capture.json'));
assert.deepStrictEqual(first, fs.readFileSync(path.join(evidence, 'run-2/capture.json')));
const capture = JSON.parse(first);
assert.strictEqual(capture.runtime.playerType, 'Desktop');
assert.strictEqual(capture.state.ready, true);
assert.strictEqual(capture.state.failure, '');
assert.strictEqual(new Set(capture.state.observations.map(row => row.id)).size, 96);
module.exports = capture.state.observations;
if (require.main === module) console.log('Authenticated 96 repeated native AIR namespace-update observations.');
