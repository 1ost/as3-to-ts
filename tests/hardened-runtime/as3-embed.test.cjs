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


test('embedded host lease is immutable, owned and reinstallable without stale release', () => {
    const api = runtime();
    const first = id => ({owner:'first',id});
    const second = id => ({owner:'second',id});
    const lease = api.installAS3EmbeddedBitmapDataHost(first);
    assert.ok(Object.isFrozen(lease));
    assert.equal(lease.active,true); assert.equal(lease.disposed,false);
    const data = api.as3EmbeddedBitmapData('asset');
    assert.throws(() => api.installAS3EmbeddedBitmapDataHost(second), /already installed/);
    lease.dispose(); lease.dispose();
    assert.equal(lease.active,false); assert.equal(lease.disposed,true);
    assert.deepEqual(data,{owner:'first',id:'asset'});
    assert.throws(() => api.as3EmbeddedBitmapData('asset'), /prepared/);
    const sameHost = api.installAS3EmbeddedBitmapDataHost(first);
    lease.dispose();
    assert.equal(sameHost.active,true);
    assert.deepEqual(api.as3EmbeddedBitmapData('asset'),{owner:'first',id:'asset'});
    sameHost.dispose();
    const successor = api.installAS3EmbeddedBitmapDataHost(second);
    lease.dispose(); sameHost.dispose();
    assert.deepEqual(api.as3EmbeddedBitmapData('asset'),{owner:'second',id:'asset'});
    successor.dispose();
});

test('failed installation and resource lookup cannot replace the current owner', () => {
    const api = runtime();
    assert.throws(() => api.installAS3EmbeddedBitmapDataHost(null), /callable/);
    const lease = api.installAS3EmbeddedBitmapDataHost(() => {throw new Error('missing original artwork');});
    assert.throws(() => api.as3EmbeddedBitmapData('asset'), /missing original artwork/);
    assert.equal(lease.active,true);
    assert.throws(() => api.installAS3EmbeddedBitmapDataHost(() => ({})), /already installed/);
    lease.dispose();
    assert.throws(() => api.as3EmbeddedBitmapData('asset'), /prepared/);
});

test('release during synchronous creation does not cancel returned data or clear a successor', () => {
    const api = runtime();
    let lease;
    let next;
    lease = api.installAS3EmbeddedBitmapDataHost(id => {
        lease.dispose();
        next = api.installAS3EmbeddedBitmapDataHost(value => ({owner:'next',id:value}));
        return {owner:'original',id};
    });
    assert.deepEqual(api.as3EmbeddedBitmapData('asset'),{owner:'original',id:'asset'});
    lease.dispose();
    assert.deepEqual(api.as3EmbeddedBitmapData('asset'),{owner:'next',id:'asset'});
    next.dispose();
});
