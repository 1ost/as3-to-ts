const assert = require('node:assert/strict');
const test = require('node:test');
const {readFileSync} = require('node:fs');
const {resolve} = require('node:path');
const {transformSync} = require('esbuild');
const code = transformSync(readFileSync(resolve(__dirname, '../../src/hardened-runtime/AS3Embed.ts'), 'utf8'),
    {loader:'ts', format:'cjs', target:'es2022'}).code;
function runtime() { const module = {exports:{}}; new Function('module','exports',code)(module,module.exports); return module.exports; }

test('embedded constructors remain synchronous and require a preinstalled resource host', () => {
    const api = runtime();
    assert.throws(() => api.as3EmbeddedBitmapData('example.Asset'), /prepared/);
    assert.throws(() => api.installAS3EmbeddedBitmapDataHost({}), /callable/);
    const calls = [];
    api.installAS3EmbeddedBitmapDataHost(id => { calls.push(id); return {id}; });
    assert.notEqual(api.as3EmbeddedBitmapData('example.Asset'), api.as3EmbeddedBitmapData('example.Asset'));
    assert.deepEqual(calls, ['example.Asset','example.Asset']);
    assert.throws(() => api.installAS3EmbeddedBitmapDataHost(() => ({})), /already installed/);
});

test('missing resources propagate failure without substituting an image', () => {
    const api = runtime();
    api.installAS3EmbeddedBitmapDataHost(id => { if (id === 'bad') return null; throw new Error('Missing ' + id); });
    assert.throws(() => api.as3EmbeddedBitmapData('bad'), /no bitmap data/);
    assert.throws(() => api.as3EmbeddedBitmapData('absent'), /Missing absent/);
});
