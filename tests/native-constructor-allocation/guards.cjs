const assert = require('node:assert/strict');

// Synthetic allocator fault injection only; no Flash semantic claims here.
module.exports = function guards(c) {
    let count = 0;
    const rejects = (body, pattern = e => e.errorID === 1006) => { assert.throws(body, pattern); count++; };
    const make = allocate => {
        function Native() {}
        function Source() {}
        Source.prototype = Object.create(Native.prototype);
        const adapter = {constructor:Native, prepareInstance() {}, initializeInstance() {}};
        if (allocate !== undefined) adapter.allocateInstance = allocate;
        c.registerNativeBase(Native, Object.freeze(adapter)); c.register(Source, Native);
        return Source;
    };
    let called = 0;
    const body = function() { called++; };
    for (const value of [null, 1, 'receiver', () => {}]) {
        const Source = make(() => value);
        rejects(() => c.invokeNativeConstructor(Object.create(Source.prototype), Source, [], body));
    }
    const Wrong = make(() => ({}));
    rejects(() => c.invokeNativeConstructor(Object.create(Wrong.prototype), Wrong, [], body));
    let placeholder;
    const Same = make(() => placeholder); placeholder = Object.create(Same.prototype);
    rejects(() => c.invokeNativeConstructor(placeholder, Same, [], body));
    let saved;
    const Reuse = make(ctor => saved || (saved = Object.create(ctor.prototype)));
    assert.equal(c.invokeNativeConstructor(Object.create(Reuse.prototype), Reuse, [], body), saved);
    rejects(() => c.invokeNativeConstructor(Object.create(Reuse.prototype), Reuse, [], body));
    assert.equal(called, 1);
    let attempts = 0;
    const Throws = make(() => { attempts++; throw Error('allocation failure'); });
    const original = Object.create(Throws.prototype);
    rejects(() => c.invokeNativeConstructor(original, Throws, [], body), /allocation failure/);
    rejects(() => c.invokeNativeConstructor(original, Throws, [], body));
    assert.equal(attempts, 1);
    const Entered = make(ctor => { const receiver = Object.create(ctor.prototype); c.enter(receiver, ctor); return receiver; });
    rejects(() => c.invokeNativeConstructor(Object.create(Entered.prototype), Entered, [], body));
    const Plain = make(), receiver = Object.create(Plain.prototype);
    const args = {0:'a', 1:7, length:2};
    assert.equal(c.invokeNativeConstructor(receiver, Plain, args, function(a, b) {
        assert.equal(this, receiver); assert.equal(a, 'a'); assert.equal(b, 7); return 42;
    }), 42);
    count++;
    c.enter(receiver, Plain);
    rejects(() => c.invokeNativeConstructor(receiver, Plain, [], body));
    c.leave(receiver, Plain, false);
    rejects(() => c.invokeNativeConstructor(receiver, Plain, [], body));
    rejects(() => c.invokeNativeConstructor(null, Plain, [], body));
    rejects(() => c.invokeNativeConstructor({}, function Unknown() {}, [], body));
    let getterCalls = 0;
    function BadNative() {}
    const bad = {constructor:BadNative, prepareInstance() {}, initializeInstance() {}};
    Object.defineProperty(bad, 'allocateInstance', {get() { getterCalls++; return body; }});
    rejects(() => c.registerNativeBase(BadNative, Object.freeze(bad)), /allocation entry authority/);
    assert.equal(getterCalls, 0);
    for (const allocateInstance of [null, 3]) {
        function Bad() {}
        rejects(() => c.registerNativeBase(Bad, Object.freeze({constructor:Bad, prepareInstance() {}, initializeInstance() {}, allocateInstance})), /allocation entry authority/);
    }
    return count;
};
