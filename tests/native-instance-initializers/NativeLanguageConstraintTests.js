const assert = require('assert');
// Host-language constraints, not an implementation or a substitute for AS3.
class Base {
    constructor(log) { log.push(this.value); }
}
class PreSuper extends Base {
    constructor(log) { this.value = 7; super(log); }
}
const preSuper = [];
assert.throws(() => new PreSuper(preSuper), ReferenceError);
assert.deepEqual(preSuper, []);
class AfterSuper extends Base {
    constructor(log) { super(log); this.value = 7; }
}
const afterSuper = [];
assert.equal(new AfterSuper(afterSuper).value, 7);
assert.deepEqual(afterSuper, [undefined]);
assert.throws(() => Reflect.apply(Base, {}, [[]]), TypeError,
    'Native class constructors cannot initialize a separately allocated receiver using call/apply');
console.log('Three native-language constraints reproduced; no AS3 fidelity admission');
