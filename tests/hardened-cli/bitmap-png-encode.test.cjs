'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const cp = require('node:child_process');
const {createHash} = require('node:crypto');
const {inflateSync} = require('node:zlib');
const {buildSync} = require('esbuild');
const root = path.resolve(__dirname, '../..');
const laya = process.env.HARDENED_FIXTURE_LAYA, air = process.env.HARDENED_FIXTURE_AIR_SDK,
    ffdec = process.env.HARDENED_FIXTURE_FFDEC, playwright = process.env.PLAYWRIGHT_MODULE;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

test('unchanged AS3 BitmapData.encode calls emit and execute through the real PNG bridge',
    {skip: !laya && !air && !ffdec && !playwright}, async t => {
    assert.ok(laya && air && ffdec && playwright, 'AIR, Laya, FFDec and Playwright paths required');
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'as3-png-encode-')));
    t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
    const source = path.join(dir, 'source'), profile = path.join(dir, 'profile'), out = path.join(dir, 'output');
    fs.mkdirSync(source);
    const original = `package {
        import flash.display.BitmapData;
        import flash.display.PNGEncoderOptions;
        import flash.utils.ByteArray;
        public class PNGCallProbe {
            public function capture(bitmap:BitmapData):ByteArray {
                return bitmap.encode(bitmap.rect, new PNGEncoderOptions());
            }
            public function captureInto(bitmap:BitmapData, output:ByteArray):ByteArray {
                return bitmap.encode(bitmap.rect, new PNGEncoderOptions(true), output);
            }
        }
    }`;
    fs.writeFileSync(path.join(source, 'PNGCallProbe.as'), original);
    const run = (command, args) => {
        const r = cp.spawnSync(command, args, {cwd: root, encoding: 'utf8', timeout: 120000});
        assert.equal(r.status, 0, r.error?.message ?? r.stdout + r.stderr);
    };
    const make = output => run('python3', ['-B', 'tools/create-fixture-profile.py', '--source', source,
        '--entry', 'PNGCallProbe', '--air-sdk', air, '--laya', laya, '--ffdec-jar', ffdec, '--output', output]);
    const compile = (operation, output, authority = profile) => run(process.execPath, ['bin/as3-frontend',
        operation, source, output, '--source-census', path.join(authority, 'census.json'),
        '--target-capabilities', path.join(laya, 'docTool/architecture/authored-content-capabilities.json'),
        '--profile-lock', path.join(authority, 'profile-lock.json')]);
    make(profile);
    compile('transpile', out);
    const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json')));
    assert.equal(manifest.files.length, 1);
    assert.equal(manifest.files[0].sourceSha256, sha(original));
    const code = fs.readFileSync(path.join(out, manifest.files[0].typescriptPath), 'utf8');
    assert.match(code, /bitmap!\.encode\(bitmap!\.rect!/);
    assert.equal(fs.readFileSync(path.join(source, 'PNGCallProbe.as'), 'utf8'), original);
    fs.mkdirSync(path.join(out, 'node_modules/@laya'), {recursive: true});
    fs.symlinkSync(path.join(out, '__as3_runtime'), path.join(out, 'node_modules/@laya/as3-runtime'), 'dir');
    const bundle = path.join(out, 'browser.js');
    buildSync({stdin: {contents: `
        const {startAS3Application} = require('./__as3_runtime/ApplicationEntry.generated.js');
        const {BitmapData} = require('laya/flash/display/BitmapData');
        const {ByteArray} = require('laya/flash/utils/ByteArray');
        const probe = startAS3Application(new AbortController().signal);
        const bitmap = new BitmapData(2, 1, true, 0);
        bitmap.setPixel32(0, 0, 0xffff0000); bitmap.setPixel32(1, 0, 0xff123456);
        const fresh = probe.capture(bitmap), target = new ByteArray();
        for (let i = 0; i < 256; i++) target.writeByte(0x5a);
        target.position = 3;
        const supplied = probe.captureInto(bitmap, target);
        const bytes = value => {const p=value.position;value.position=0;const b=[];while(value.bytesAvailable)b.push(value.readUnsignedByte());value.position=p;return b;};
        globalThis.pngCallResult = {fresh:bytes(fresh), freshPosition:fresh.position,
            supplied:bytes(supplied), suppliedPosition:supplied.position, same:supplied===target};
        bitmap.dispose();`, resolveDir: out, sourcefile: 'browser-entry.js'}, outfile: bundle,
        bundle: true, platform: 'browser', format: 'iife', alias: {laya: path.join(laya, 'src/layaAir')},
        loader: {'.vs': 'text', '.fs': 'text', '.glsl': 'text'}, logLevel: 'silent'});
    const {chromium} = require(playwright);
    const browser = await chromium.launch({headless: true});
    t.after(() => browser.close());
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addScriptTag({path: bundle});
    assert.deepEqual(errors, []);
    const result = await page.evaluate(() => globalThis.pngCallResult);
    const png = Buffer.from(result.fresh), chunks = [];
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    for (let p = 8; p < png.length;) {
        const length = png.readUInt32BE(p), type = png.toString('ascii', p + 4, p + 8);
        if (type === 'IHDR') {assert.equal(png.readUInt32BE(p + 8), 2);assert.equal(png.readUInt32BE(p + 12), 1);}
        if (type === 'IDAT') chunks.push(png.subarray(p + 8, p + 8 + length));
        p += length + 12;
    }
    assert.deepEqual([...inflateSync(Buffer.concat(chunks))], [0, 255, 0, 0, 255, 18, 52, 86, 255]);
    assert.equal(result.freshPosition, png.length);
    assert.equal(result.same, true);
    assert.equal(result.suppliedPosition, png.length + 3);
    assert.deepEqual(result.supplied.slice(0, 3), [90, 90, 90]);
    assert.deepEqual(result.supplied.slice(3, 3 + png.length), result.fresh);
    assert.deepEqual(result.supplied.slice(3 + png.length), Array(256 - 3 - png.length).fill(90));

    for (const [name, args] of Object.entries({Missing: 'b.rect', Extra: 'b.rect,new PNGEncoderOptions(),null,null',
        WrongRect: '1,new PNGEncoderOptions()', WrongBuffer: 'b.rect,new PNGEncoderOptions(),1'})) {
        fs.writeFileSync(path.join(source, name + '.as'), `package {import flash.display.BitmapData;
            import flash.display.PNGEncoderOptions; public class ${name} {
            public function run(b:BitmapData):void {b.encode(${args});}}}`);
    }
    const negativeProfile = path.join(dir, 'negative-profile'), negative = path.join(dir, 'negative');
    make(negativeProfile); compile('qualify', negative, negativeProfile);
    const rows = JSON.parse(fs.readFileSync(path.join(negative, 'manifest.json'))).files;
    for (const name of ['Missing', 'Extra', 'WrongRect', 'WrongBuffer']) {
        const row = rows.find(row => row.sourcePath === name + '.as');
        assert.equal(row?.status, 'held', JSON.stringify(row));
        assert.match(row.code, /^HARDENED_(CAPABILITY_CALL_ARITY|CAPABILITY_CALL_TYPE|ASSIGNMENT_TYPE)$/);
    }
});
