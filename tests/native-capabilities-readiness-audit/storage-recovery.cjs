// Verify the storage checkpoint; restore the archived generated report only
// when explicitly invoked with --restore and adequate writable space exists.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = 'C:/Users/admin/Desktop/GITHUB REPO/op2-html5';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const expected = {
    'error-event-type-tests': 'd4fb373fa7eb760a7cdf02cc08724cabb63d80a543ea3bda92776efd39a0e696',
    'shape-return': '1e14db0ce7f19621484e16890c1623d429985be7a37403698886dd6adc2ea287',
    initializer: 'cf764ad4c1b0c83829b5f9b771b91cd0bf1ebb638b15bdcc9cc6d71b19671fcb'
};
const results = [];
for (const [name, sha256] of Object.entries(expected)) {
    const archive = path.join(root, 'game-client-laya/tests/startup-prompt-text-review', name + '-candidate.json.gz');
    const bytes = fs.readFileSync(archive);
    const pin = JSON.parse(fs.readFileSync(archive.replace('.json.gz', '-pin.json')));
    assert.equal(hash(bytes), pin.sha256, archive);
    const packet = JSON.parse(zlib.gunzipSync(bytes));
    const entry = packet.files.find(item => item.file === packet.reportFile);
    assert.ok(entry);
    const content = Buffer.from(entry.base64, 'base64');
    assert.equal(hash(content), sha256);
    assert.equal(entry.sha256, sha256);
    const report = path.resolve(packet.reportFile);
    const allowed = path.join(root, '.local/native-startup-proxy') + path.sep;
    assert.ok(report.startsWith(allowed));
    let present = fs.existsSync(report);
    if (!present && name === 'initializer' && process.argv.includes('--restore')) {
        // Fail before opening the destination if the volume remains full.
        const stats = fs.statfsSync(path.dirname(report));
        const required = content.length + 8 * 1024 * 1024;
        assert.ok(stats.bavail * stats.bsize >= required,
            'Restoration needs at least ' + required + ' free bytes on C:');
        fs.writeFileSync(report, content, {flag: 'wx'});
        present = true;
    }
    if (present) assert.equal(hash(fs.readFileSync(report)), sha256, report);
    else assert.equal(name, 'initializer', 'An active replay report is missing');
    results.push({name, report, archive, bytes: content.length, sha256, state: present ? 'live-and-archived' : 'archived-restoration-pending'});
}
console.log(JSON.stringify({verified: true, reports: results}, null, 2));
