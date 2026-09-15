const assert = require('node:assert/strict');
const test = require('node:test');
const {readFileSync} = require('node:fs');
const {resolve} = require('node:path');
const {transformSync} = require('esbuild');

function runtime(source, intrinsics = {}) {
    const code = transformSync(readFileSync(resolve(__dirname, `../../src/hardened-runtime/${source}`), 'utf8'),
        {loader:'ts', format:'cjs', target:'es2022'}).code;
    const module = {exports:{}};
    new Function('module','exports','Object','WeakMap',code)(module,module.exports,
        intrinsics.Object || Object,intrinsics.WeakMap || WeakMap);
    return module.exports;
}

test('embedded bitmap preparation is nominal, abortable and publishes only at commit', () => {
    const api = runtime('AS3Embed.ts');
    const first = id => ({owner:'first',id});
    const preparation = api.prepareAS3EmbeddedBitmapDataHost(first);
    assert.ok(Object.isFrozen(preparation));
    assert.throws(() => api.as3EmbeddedBitmapData('asset'), /prepared/);
    assert.throws(() => api.prepareAS3EmbeddedBitmapDataHost(first), /installed or reserved/);
    assert.throws(() => api.commitAS3EmbeddedBitmapDataHost(Object.freeze({})), /not issued/);
    assert.throws(() => api.abortAS3EmbeddedBitmapDataHost(Object.freeze({})), /not issued/);
    api.abortAS3EmbeddedBitmapDataHost(preparation);
    api.abortAS3EmbeddedBitmapDataHost(preparation);
    assert.throws(() => api.commitAS3EmbeddedBitmapDataHost(preparation), /not active/);

    const committed = api.prepareAS3EmbeddedBitmapDataHost(first);
    const lease = api.commitAS3EmbeddedBitmapDataHost(committed);
    assert.deepEqual(api.as3EmbeddedBitmapData('asset'),{owner:'first',id:'asset'});
    Object.freeze({active:true,disposed:false,dispose(){}}).dispose();
    assert.deepEqual(api.as3EmbeddedBitmapData('asset'),{owner:'first',id:'asset'},
        'a structurally forged lease has no authority over the registered host');
    assert.throws(() => api.commitAS3EmbeddedBitmapDataHost(committed), /not active/);
    assert.throws(() => api.abortAS3EmbeddedBitmapDataHost(committed), /after commit/);
    lease.dispose(); lease.dispose();
    assert.equal(lease.active,false); assert.equal(lease.disposed,true);
    assert.throws(() => api.as3EmbeddedBitmapData('asset'), /prepared/);
});

test('timer capture preparation is nominal, abortable and revoked only by its lease', () => {
    const api = runtime('AS3TimerExecution.ts');
    const first = callback => () => { first.calls++; callback(); };
    first.calls = 0;
    const preparation = api.prepareAS3TimerExecutionCapture(first);
    assert.ok(Object.isFrozen(preparation));
    assert.throws(() => api.prepareAS3TimerExecutionCapture(first), /installed or reserved/);
    assert.equal(api.captureAS3TimerExecution(() => 17)(),17);
    assert.throws(() => api.commitAS3TimerExecutionCapture(Object.freeze({})), /not issued/);
    assert.throws(() => api.abortAS3TimerExecutionCapture(Object.freeze({})), /not issued/);
    api.abortAS3TimerExecutionCapture(preparation);
    api.abortAS3TimerExecutionCapture(preparation);
    assert.throws(() => api.commitAS3TimerExecutionCapture(preparation), /not active/);

    const committed = api.prepareAS3TimerExecutionCapture(first);
    const lease = api.commitAS3TimerExecutionCapture(committed);
    let callbacks = 0;
    api.captureAS3TimerExecution(() => { callbacks++; })();
    assert.equal(first.calls,1); assert.equal(callbacks,1);
    Object.freeze({disposed:false,dispose(){}}).dispose();
    api.captureAS3TimerExecution(() => { callbacks++; })();
    assert.equal(first.calls,2); assert.equal(callbacks,2);
    assert.throws(() => api.commitAS3TimerExecutionCapture(committed), /not active/);
    assert.throws(() => api.abortAS3TimerExecutionCapture(committed), /after commit/);
    lease.dispose(); lease.dispose(); assert.equal(lease.disposed,true);
    api.captureAS3TimerExecution(() => { callbacks++; })();
    assert.equal(first.calls,2); assert.equal(callbacks,3);
});

for (const [source,install,probe] of [
    ['AS3Embed.ts','installAS3EmbeddedBitmapDataHost',api => api.as3EmbeddedBitmapData('asset')],
    ['AS3TimerExecution.ts','installAS3TimerExecutionCapture',api => api.captureAS3TimerExecution(() => 'direct')()],
]) {
    test(`${source} leaves no reservation when caller-visible capability construction fails`, () => {
        for (const failAt of [1,2]) {
            let freezes = 0;
            const failure = {source,failAt};
            const hostileObject = Object.create(Object);
            hostileObject.freeze = function freeze(value) {
                freezes++;
                if (freezes === failAt) throw failure;
                return Object.freeze(value);
            };
            const api = runtime(source,{Object:hostileObject});
            const host = source === 'AS3Embed.ts' ? id => ({id}) : callback => callback;
            assert.throws(() => api[install](host), value => value === failure);
            const lease = api[install](host);
            assert.ok(probe(api));
            lease.dispose();
        }
    });
}

for (const [source,install,probe] of [
    ['AS3Embed.ts','installAS3EmbeddedBitmapDataHost',api => api.as3EmbeddedBitmapData('asset')],
    ['AS3TimerExecution.ts','installAS3TimerExecutionCapture',api => api.captureAS3TimerExecution(() => 'direct')()],
]) {
    test(`${source} compatibility install aborts a reservation when commit lookup faults`, () => {
        const failure = {source,stage:'commit'};
        let failNextLookup = true;
        class FaultingWeakMap extends WeakMap {
            get(key) {
                const value = super.get(key);
                if (failNextLookup) { failNextLookup = false; throw failure; }
                return value;
            }
        }
        const api = runtime(source,{WeakMap:FaultingWeakMap});
        const host = source === 'AS3Embed.ts' ? id => ({id}) : callback => callback;
        assert.throws(() => api[install](host), value => value === failure);
        const lease = api[install](host);
        assert.ok(probe(api));
        lease.dispose();
    });
}

test('preparation capabilities cannot cross runtime or installer boundaries', () => {
    const embedA = runtime('AS3Embed.ts'), embedB = runtime('AS3Embed.ts');
    const timer = runtime('AS3TimerExecution.ts');
    const embedPreparation = embedA.prepareAS3EmbeddedBitmapDataHost(id => ({id}));
    const timerPreparation = timer.prepareAS3TimerExecutionCapture(callback => callback);
    assert.throws(() => embedB.commitAS3EmbeddedBitmapDataHost(embedPreparation), /not issued/);
    assert.throws(() => timer.commitAS3TimerExecutionCapture(embedPreparation), /not issued/);
    assert.throws(() => embedA.commitAS3EmbeddedBitmapDataHost(timerPreparation), /not issued/);
    embedA.abortAS3EmbeddedBitmapDataHost(embedPreparation);
    timer.abortAS3TimerExecutionCapture(timerPreparation);
});
