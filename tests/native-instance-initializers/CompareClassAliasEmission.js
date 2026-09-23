const assert = require('assert'), fs = require('fs'), path = require('path');
const ts = require('typescript');
const {fixture} = require('./callable-fixture');
require('./verify-evidence');
const input = path.join(__dirname, 'class-alias-original');
const sources = Object.fromEntries(['Subject', 'Probe'].map(name =>
    ['entryreview.' + name, fs.readFileSync(path.join(input, 'entryreview', name + '.as'), 'utf8')]));
const expected = JSON.parse(fs.readFileSync(path.join(input, 'flash.json')));
const reports = [];
for (const target of [ts.ScriptTarget.ES5, ts.ScriptTarget.ES2015]) {
    const native = fixture(target, sources), Subject = native.get('Subject'), Probe = native.get('Probe');
    const rows = [];
    for (const name of ['bindNew', 'freshPrototype', 'aliasCoerce']) {
        Subject.count = 0;
        try {
            const value = Probe[name]();
            rows.push([name, 'ok', value.n, value instanceof Subject, Subject.count]);
        } catch (error) {
            rows.push([name, 'error', error.errorID === undefined ? null : error.errorID, Subject.count]);
        }
    }
    const differences = rows.flatMap((row, index) => {
        try { assert.deepStrictEqual(row, expected[index]); return []; }
        catch (_) { return [{expected: expected[index], actual: row}]; }
    });
    reports.push({target: target === ts.ScriptTarget.ES5 ? 'ES5' : 'ES2015', differences, runtimeAdmission: false});
}
console.log(JSON.stringify(reports, null, 2));
if (process.argv[2]) fs.writeFileSync(path.resolve(process.argv[2]), JSON.stringify(reports, null, 2) + '\n');
process.exitCode = reports.some(report => report.differences.length) ? 1 : 0;
