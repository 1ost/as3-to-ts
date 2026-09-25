'use strict';
const assert = require('node:assert/strict'), test = require('node:test'), fs = require('node:fs'),
    path = require('node:path'), os = require('node:os'), cp = require('node:child_process'),
    {createHash} = require('node:crypto');
const root = path.resolve(__dirname, '../..'), sha = bytes => createHash('sha256').update(bytes).digest('hex');
const laya = process.env.HARDENED_FIXTURE_LAYA, air = process.env.HARDENED_FIXTURE_AIR_SDK,
    ffdec = process.env.HARDENED_FIXTURE_FFDEC;

test('discarded identifier reads retain native getter effects and lexical binding',
    {skip: !laya && !air && !ffdec}, t => {
    assert.ok(laya && air && ffdec, 'Laya, AIR and FFDec paths required');
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'discarded-identifier-')));
    t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
    const fixture = path.join(laya, 'tests/nativeFlashOracle/discarded-identifier');
    const native = JSON.parse(fs.readFileSync(path.join(fixture, 'native-air.json')));
    const scenarioBytes = fs.readFileSync(path.join(fixture, 'scenario.json'));
    assert.equal(sha(scenarioBytes), native.scenarioSha256);
    const scenario = JSON.parse(scenarioBytes);
    assert.equal(scenario.steps.length, 8);
    assert.deepEqual(scenario.steps.map(step => step.id), native.capture.state.observations.map(row => row.id));
    const source = path.join(dir, 'source'), profile = path.join(dir, 'profile'), out = path.join(dir, 'output');
    fs.mkdirSync(source);
    for (const [name, hash] of Object.entries(native.sourceFiles)) {
        const bytes = fs.readFileSync(path.join(fixture, name));
        assert.equal(sha(bytes), hash); fs.writeFileSync(path.join(source, name), bytes);
    }
    const run = (command, args) => {
        const r = cp.spawnSync(command, args, {cwd: root, encoding: 'utf8', timeout: 120000});
        assert.equal(r.status, 0, r.error?.message ?? r.stdout + r.stderr);
    };
    const make = output => run('python3', ['-B', 'tools/create-fixture-profile.py', '--source', source,
        '--entry', 'DiscardedIdentifierProbe', '--air-sdk', air, '--laya', laya, '--ffdec-jar', ffdec, '--output', output]);
    const compile = (operation, output, authority) => run(process.execPath, ['bin/as3-frontend', operation,
        source, output, '--source-census', path.join(authority, 'census.json'), '--target-capabilities',
        path.join(laya, 'docTool/architecture/authored-content-capabilities.json'),
        '--profile-lock', path.join(authority, 'profile-lock.json')]);
    make(profile); compile('transpile', out, profile);
    const rows = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'))).files;
    assert.equal(rows.length, 2);
    for (const row of rows) assert.equal(row.sourceSha256, native.sourceFiles[row.sourcePath]);
    fs.mkdirSync(path.join(out, 'node_modules/@laya'), {recursive: true});
    fs.symlinkSync(path.join(out, '__as3_runtime'), path.join(out, 'node_modules/@laya/as3-runtime'), 'dir');
    const bundle = path.join(out, 'runner.cjs');
    require('esbuild').buildSync({stdin: {contents: 'exports.entry=require("./__as3_runtime/ApplicationEntry.generated.js");',
        resolveDir: out, sourcefile: 'runner.js'}, outfile: bundle, bundle: true, platform: 'node', format: 'cjs',
        alias: {laya: path.join(laya, 'src/layaAir')}, loader: {'.vs': 'text', '.fs': 'text', '.glsl': 'text'}, logLevel: 'silent'});
    const probe = require(bundle).entry.startAS3Application(new AbortController().signal);
    for (const step of scenario.steps) {
        for (const call of step.calls) probe[call.method](...call.args);
        assert.deepEqual(probe.result, native.capture.state.observations.find(row => row.id === step.id).result, step.id);
    }
    for (const [name, body] of Object.entries({
        UnknownRead: 'public function run():void {unprovenName;}',
        SetterRead: 'public function set value(v:int):void {} public function run():void {value;}',
        StaticInstanceRead: 'private var value:int=1; public static function run():void {value;}',
    })) fs.writeFileSync(path.join(source, name + '.as'), `package {public class ${name} {${body}}}`);
    const negatives = path.join(dir, 'negative-profile'); make(negatives);
    compile('qualify', path.join(dir, 'negative'), negatives);
    const held = JSON.parse(fs.readFileSync(path.join(dir, 'negative/manifest.json'))).files;
    for (const name of ['UnknownRead', 'SetterRead', 'StaticInstanceRead']) {
        const row = held.find(row => row.sourcePath === name + '.as');
        assert.equal(row?.status, 'held', JSON.stringify(row));
        assert.match(row.code, /^HARDENED_/);
        assert.notEqual(row.code, 'HARDENED_STATEMENT_UNSUPPORTED');
    }
    for (const [name, hash] of Object.entries(native.sourceFiles)) assert.equal(sha(fs.readFileSync(path.join(source, name))), hash);
});
