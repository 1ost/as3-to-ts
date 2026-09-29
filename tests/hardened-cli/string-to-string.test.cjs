'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const cp = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const air = process.env.HARDENED_FIXTURE_AIR_SDK;
const laya = process.env.HARDENED_FIXTURE_LAYA;

test('authenticated String.toString admits only the zero-argument native call', {skip: !air || !laya}, t => {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'string-to-string-')));
    t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
    const source = path.join(dir, 'source');
    const profile = path.join(dir, 'profile');
    const output = path.join(dir, 'emitted');
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, 'StringToStringProbe.as'),
        'package {public class StringToStringProbe {' +
        'private function name():String{return "treasure";}' +
        'public function direct(value:String):String{return value.toString();}' +
        'public function fromCall():String{return this.name().toString();}' +
        '}}');
    const run = (command, args) => {
        const result = cp.spawnSync(command, args, {cwd: root, encoding: 'utf8', timeout: 180000});
        assert.equal(result.status, 0, result.stdout + result.stderr);
    };
    run('python3', ['-B', 'tools/create-fixture-profile.py', '--source', source, '--entry', 'StringToStringProbe',
        '--air-sdk', air, '--laya', laya, '--output', profile]);
    const compile = (operation, target) => run(process.execPath, ['bin/as3-frontend', operation, source, target,
        '--source-census', path.join(profile, 'census.json'),
        '--target-capabilities', path.join(laya, 'docTool/architecture/authored-content-capabilities.json'),
        '--profile-lock', path.join(profile, 'profile-lock.json')]);
    compile('transpile', output);
    const rows = JSON.parse(fs.readFileSync(path.join(output, 'manifest.json'))).files;
    const positive = rows.find(row => row.sourcePath === 'StringToStringProbe.as');
    assert.ok(positive.typescriptPath, JSON.stringify(positive));
    const generated = fs.readFileSync(path.join(output, positive.typescriptPath), 'utf8');
    assert.match(generated, /value!\.toString\(\)/);
    assert.match(generated, /\.name\(\)!\.toString\(\)/);

    fs.writeFileSync(path.join(source, 'TooMany.as'),
        'package {public class TooMany {public function run(value:String):String{return value.toString(1);}}}');
    fs.rmSync(profile, {recursive: true, force: true});
    run('python3', ['-B', 'tools/create-fixture-profile.py', '--source', source, '--entry', 'StringToStringProbe',
        '--air-sdk', air, '--laya', laya, '--output', profile]);
    const negativeOutput = path.join(dir, 'qualification');
    compile('qualify', negativeOutput);
    const negative = JSON.parse(fs.readFileSync(path.join(negativeOutput, 'manifest.json'))).files
        .find(row => row.sourcePath === 'TooMany.as');
    assert.equal(negative.status, 'held', JSON.stringify(negative));
    assert.equal(negative.code, 'HARDENED_STRING_ARITY', JSON.stringify(negative));
});
