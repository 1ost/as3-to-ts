const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const oracle = path.join(__dirname, 'oracle');
exports.verify = function () {
    const raw = fs.readFileSync(path.join(oracle, 'receipt.json'));
    assert.equal(hash(raw), 'cbde7dc0fb6ab67105f89e95d760c745edb8012e9ee2d6e94837c1b81869ecf4', 'Changed/unreviewed Flash initialization receipt');
    const receipt = JSON.parse(raw); assert.equal(receipt.schema, 1);
    assert.equal(hash(fs.readFileSync(path.join(__dirname, 'RetainOracleEvidence.js'))), receipt.retentionScriptSHA256);
    for (const entry of receipt.files) assert.equal(hash(fs.readFileSync(path.join(oracle, entry.path))), entry.sha256, entry.path);
};
