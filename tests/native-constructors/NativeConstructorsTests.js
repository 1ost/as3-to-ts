const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');
const parse = require('../../lib/parse');
const emit = require('../../lib/emit');

for (const target of [ts.ScriptTarget.ES5, ts.ScriptTarget.ES2015]) {
  const context = vm.createContext({});
  const modules = new Map();
  function load(source, name, isAS3 = false) {
    const output = isAS3 ? emit(parse(name + '.as', source), source,
      { lineSeparator: '\n', definitionsByNamespace: {}, customVisitors: [] }) : source;
    const result = ts.transpileModule(output, { compilerOptions: {
      target, module: ts.ModuleKind.CommonJS, experimentalDecorators: true
    }, reportDiagnostics: true });
    assert.deepStrictEqual(result.diagnostics, [], output);
    const exports = {};
    const requireModule = request => {
      const key = request.endsWith('classBound') ? 'classBound'
        : request.endsWith('bound') ? 'bound' : request.split('/').pop();
      assert.ok(modules.has(key), 'unexpected dependency: ' + request);
      return modules.get(key);
    };
    vm.runInContext('(function(exports, require) {\n' + result.outputText + '\n})', context)(exports, requireModule);
    modules.set(name, exports);
    return { exports, output };
  }
  for (const helper of ['bound', 'classBound']) {
    load(fs.readFileSync(path.resolve(__dirname, '../../utils', helper + '.ts'), 'utf8'), helper);
  }

  const base = load(`package constructors {
   public class Base {
    public var events:Array;
    public var captured:Function;
    public function Base(events:Array, value:Number = 0) {
     super();
     this.events = events;
     events.push("base:" + value);
     this.captured = this.describe;
    }
    public function describe():String { return "base"; }
    public function baseOnly():String { return this.events[0]; }
   }
  }`, 'Base', true);
  assert.doesNotMatch(base.output, /\bsuper\s*\(/, 'implicit Object call cannot survive into native TS');
  const { exports: { Base } } = base;
  const plainEvents = [];
  const plain = new Base(plainEvents, 4);
  assert.deepStrictEqual(plainEvents, ['base:4']);
  assert.strictEqual(plain.captured(), 'base');
  assert.strictEqual(plain.baseOnly.call(null), 'base:4');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(plain, 'baseOnly'), true);

  const derived = load(`package constructors {
   import constructors.Base;
   public class Derived extends Base {
    public var capturedAfter:Function;
    public function Derived(events:Array) {
     events.push("before");
     super(events, events.push("argument"));
     events.push("derived");
     this.capturedAfter = this.describe;
    }
    override public function describe():String { return "derived"; }
    public function superDescribe():String { return super.describe(); }
   }
  }`, 'Derived', true);
  assert.strictEqual((derived.output.match(/\bsuper\s*\(/g) || []).length, 1, 'no duplicated implicit super before an explicit call');
  const Derived = derived.exports.Derived;
  const events = [];
  const instance = new Derived(events);
  assert.deepStrictEqual(events, ['before', 'argument', 'base:2', 'derived']);
  assert.ok(instance instanceof Derived);
  assert.ok(instance instanceof Base);
  assert.strictEqual(instance.captured, instance.capturedAfter, 'constructor-time and later extraction share the override closure');
  assert.strictEqual(instance.captured.call({}), 'derived');
  assert.strictEqual(instance.superDescribe(), 'base');
  assert.strictEqual(instance.describe(), 'derived', 'super access cannot replace the override');
  assert.strictEqual(instance.baseOnly.call(null), 'before', 'inherited methods bind to the derived instance');

  const native = load(`import { bound } from './bound';
   import { classBound } from './classBound';
   export const key = Symbol('method');
   export const staticKey = Symbol('static');
   @classBound
   export class SymbolBase {
    captured: Function;
    observedTarget: Function;
    constructor() { this.captured = this[key]; this.observedTarget = new.target; }
    @bound [key]() { return 'base'; }
   }
   @classBound
   export class SymbolDerived extends SymbolBase {
    static [staticKey] = 7;
    static get current() { return this[staticKey]; }
    @bound [key]() { return 'derived'; }
    @bound superValue() { return super[key](); }
   }`, 'Symbols');
  const { SymbolBase, SymbolDerived, key, staticKey } = native.exports;
  const symbolInstance = new SymbolDerived();
  assert.strictEqual(symbolInstance.captured(), 'derived');
  assert.strictEqual(symbolInstance[key], symbolInstance.captured);
  assert.strictEqual(symbolInstance.superValue(), 'base');
  assert.strictEqual(symbolInstance[key](), 'derived');
  assert.ok(symbolInstance instanceof SymbolBase);
  assert.ok(symbolInstance instanceof SymbolDerived);
  // TypeScript 2.4's ES5 new.target lowering uses this.constructor; the native
  // target verifies actual [[Construct]] forwarding through decorated bases.
  if (target === ts.ScriptTarget.ES2015) assert.strictEqual(symbolInstance.observedTarget, SymbolDerived);
  assert.strictEqual(SymbolDerived.current, 7);
  SymbolDerived[staticKey] = 9;
  assert.strictEqual(SymbolDerived.current, 9);
  assert.strictEqual(typeof Object.getOwnPropertyDescriptor(SymbolDerived, 'current').get, 'function');
  assert.strictEqual(SymbolDerived.name, 'SymbolDerived');
  assert.strictEqual(Object.getPrototypeOf(symbolInstance), SymbolDerived.prototype);

  assert.throws(() => load('package p { public class Invalid { public function Invalid() { super(sideEffect()); } } }',
    'Invalid', true), /AS3_IMPLICIT_OBJECT_SUPER_UNSUPPORTED/);
  console.log('native constructor and decorated inheritance tests passed for ' + ts.ScriptTarget[target]);
}
