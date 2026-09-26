const assert = require('node:assert/strict');
const test = require('node:test');
const {spawnSync} = require('node:child_process');
const fs = require('node:fs');
const {tmpdir} = require('node:os');
const {join, resolve} = require('node:path');
const {createHash} = require('node:crypto');
const ROOT = resolve(__dirname, '../..');
const sdk = process.env.HARDENED_FIXTURE_AIR_SDK, laya = process.env.HARDENED_FIXTURE_LAYA,
    ffdec = process.env.HARDENED_FIXTURE_FFDEC_JAR;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

test('original Embed declaration emits deterministic bitmap resources and rejects unsafe inputs', {skip: !sdk || !laya || !ffdec}, t => {
    const directory = fs.realpathSync(fs.mkdtempSync(join(tmpdir(), 'as3-embed-profile-')));
    t.after(() => fs.rmSync(directory, {recursive: true, force: true}));
    const source = join(directory, 'source'); fs.mkdirSync(source);
    const original = `package { import flash.display.Bitmap; public class Probe {
[Embed(source="image.png")] private static const Asset:Class;
private static const LABEL:String = "unchanged";
public var image:Bitmap;
public function Probe() { image = new Asset() as Bitmap; }
} }`;
    fs.writeFileSync(join(source, 'Probe.as'), original);
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a+8sAAAAASUVORK5CYII=', 'base64');
    fs.writeFileSync(join(source, 'image.png'), png);
    const profile = join(directory, 'profile');
    const generated = spawnSync('python3', [join(ROOT, 'tools/create-fixture-profile.py'), '--source', source,
        '--entry', 'Probe', '--laya', laya, '--air-sdk', sdk, '--ffdec-jar', ffdec, '--output', profile],
        {encoding: 'utf8', timeout: 60000});
    assert.equal(generated.status, 0, generated.stdout + generated.stderr);
    function emit(name) {
        const output = join(directory, name);
        const result = spawnSync(process.execPath, [join(ROOT, 'bin/as3-frontend'), 'transpile', source, output,
            '--source-census', join(profile, 'census.json'), '--profile-lock', join(profile, 'profile-lock.json'),
            '--target-capabilities', join(laya, 'docTool/architecture/authored-content-capabilities.json')],
            {encoding: 'utf8', timeout: 30000});
        return {output, result};
    }
    const first = emit('first'), second = emit('second');
    assert.equal(first.result.status, 0, first.result.stderr);
    assert.equal(second.result.status, 0, second.result.stderr);
    const a = JSON.parse(fs.readFileSync(join(first.output, 'manifest.json')));
    const b = JSON.parse(fs.readFileSync(join(second.output, 'manifest.json')));
    assert.equal(a.files[0].sourceSha256, hash(original));
    assert.equal(a.files[0].typescriptSha256, b.files[0].typescriptSha256);
    assert.deepEqual(a.embeddedResources, b.embeddedResources);
    assert.equal(a.embeddedResources.length, 1);
    assert.equal(a.embeddedResources[0].sha256, hash(png));
    assert.deepEqual(fs.readFileSync(join(first.output, a.embeddedResources[0].path)), png);
    const code = fs.readFileSync(join(first.output, a.files[0].typescriptPath), 'utf8');
    assert.match(code, /private static readonly Asset/);
    assert.match(code, /extends __as3EmbeddedBitmap/);
    assert.equal(fs.readFileSync(join(source, 'Probe.as'), 'utf8'), original);
    fs.writeFileSync(join(source, 'image.png'), 'not an image');
    assert.notEqual(emit('bad-image').result.status, 0);
    fs.unlinkSync(join(source, 'image.png'));
    const outside = join(directory, 'outside.png'); fs.writeFileSync(outside, png);
    fs.symlinkSync(outside, join(source, 'image.png'));
    assert.notEqual(emit('symlink').result.status, 0);
});
