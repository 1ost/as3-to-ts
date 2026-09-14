const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');
const parse = require('../../lib/parse');
const emit = require('../../lib/emit');
const NodeKind = require('../../lib/syntax/nodeKind').default;

const uri = 'http://ns.adobe.com/textLayout/internal/2008';
const options = { lineSeparator: '\n', customVisitors: [], definitionsByNamespace: {},
  namespaceUris: { 'flashx.textLayout.tlf_internal': uri, 'alias.same': uri, 'alias.other': 'urn:other' } };
function generate(source, extra = {}) {
  return emit(parse('NamespaceFixture.as', source), source, { ...options, ...extra });
}
const context = vm.createContext({ exports: {} });
context.require = name => {
  assert.strictEqual(name, './bound');
  return context.exports;
};
const target = process.argv.includes('--es5') ? ts.ScriptTarget.ES5 : ts.ScriptTarget.ES2015;
function executeTypescript(source) {
  const result = ts.transpileModule(source, {
    compilerOptions: { target, module: ts.ModuleKind.CommonJS, experimentalDecorators: true },
    reportDiagnostics: true
  });
  assert.deepStrictEqual(result.diagnostics, [], source);
  vm.runInContext('(function(exports) {\n' + result.outputText + '\n})(exports);', context);
}
// Execute the actual compiler-distributed decorators, including Symbol-keyed
// method closures, against both native-class and ES5 output targets.
for (const helper of ['bound', 'classBound']) {
  executeTypescript(fs.readFileSync(path.resolve(__dirname, '../../utils', helper + '.ts'), 'utf8'));
  context[helper] = context.exports[helper];
}
function executeClass(source, name) {
  const output = generate(source);
  executeTypescript(output.replace(/^\s*import [^\r\n]+/gm, ''));
  return { Subject: context.exports[name], output };
}

{
  const source = `package example {
    public namespace first = "urn:shared";
    public namespace alias = first;
    public namespace other = "urn:other";
  }`;
  executeTypescript(generate(source));
  assert.strictEqual(context.exports.first, context.exports.alias);
  assert.notStrictEqual(context.exports.first, context.exports.other);
  assert.strictEqual(Symbol.keyFor(context.exports.first), 'as3.namespace.uri@1:urn:shared');
}

const source = `package example {
  import flashx.textLayout.tlf_internal;
  import alias.same;
  import alias.other;
  public class NamespaceFixture {
    public var value:Number = 50;
    tlf_internal var value:Number = 3;
    other var value:Number = 9;
    tlf_internal static var count:Number = 11;
    tlf_internal function add(amount:Number):Number {
      this.tlf_internal::value += amount;
      return this.tlf_internal::value;
    }
    public function run(amount:Number):Array {
      this.same::value = this.same::add(amount);
      NamespaceFixture.same::count += 2;
      return [this.same::value, this.other::value, this.value, tlf_internal::count];
    }
    public function take():Function { return this.same::add; }
    public function qualified(otherBox:NamespaceFixture):Number { return otherBox.same::value; }
  }
}`;
const ast = parse('NamespaceFixture.as', source);
let namespaceNodes = 0;
(function walk(node) {
  if (!node) return;
  if (node.kind === NodeKind.NAMESPACE_ACCESS) namespaceNodes++;
  node.children.forEach(walk);
})(ast);
assert.strictEqual(namespaceNodes, 10, 'namespace access must remain distinct from ordinary dot access');
const { Subject, output } = executeClass(source, 'NamespaceFixture');
assert.doesNotMatch(output, /tlf_internal::|same::|other::|\/\*tlf_internal\*\//);
const first = new Subject();
assert.deepStrictEqual(Array.from(first.run(4)), [7, 9, 50, 13]);
assert.strictEqual(first.qualified(first), 7);
const detached = first.take();
assert.strictEqual(detached.call({ value: 1000 }, 2), 9, 'extracted namespace method retains its instance receiver');
const second = new Subject();
assert.deepStrictEqual(Array.from(second.run(1)), [4, 9, 50, 15]);
assert.strictEqual(first.value, 50, 'public property does not alias the namespace property');
assert.strictEqual(Object.getOwnPropertySymbols(first).length, 3, 'two fields plus a bound method');
assert.strictEqual(first[Symbol.for('as3.namespace.member@1:' + JSON.stringify([uri, 'value']))], 9);

// Reduced executable source preserves ImportExportConfiguration's exact three
// fields and six selectors. Omit its unrelated super()/FlowElementInfo imports
// so this is namespace compiler evidence, not admission of the recovered TLF.
const configurationSource = `package flashx.textLayout.conversion {
 import flashx.textLayout.tlf_internal;
 use namespace tlf_internal;
 public class ImportExportConfiguration {
  tlf_internal var flowElementInfoList:Object = {};
  tlf_internal var flowElementClassList:Object = {};
  tlf_internal var classToNameMap:Object = {};
  public function add(name:String, className:String, info:Object):void {
   this.tlf_internal::flowElementInfoList[name] = info;
   this.tlf_internal::flowElementClassList[className] = info;
   this.tlf_internal::classToNameMap[className] = name;
  }
  public function lookup(name:String):Object { return this.tlf_internal::flowElementInfoList[name]; }
  public function lookupByClass(name:String):Object { return this.tlf_internal::flowElementClassList[name]; }
  public function lookupName(name:String):String { return this.tlf_internal::classToNameMap[name]; }
 }
}`;
const { Subject: Configuration } = executeClass(configurationSource, 'ImportExportConfiguration');
const config = new Configuration();
const info = { marker: 42 };
config.add('paragraph', 'ParagraphElement', info);
assert.strictEqual(config.lookup('paragraph'), info);
assert.strictEqual(config.lookupByClass('ParagraphElement'), info);
assert.strictEqual(config.lookupName('ParagraphElement'), 'paragraph');
assert.strictEqual(config.flowElementInfoList, undefined);
assert.strictEqual(Object.getOwnPropertySymbols(config).length, 3);
assert.strictEqual(new Configuration().lookup('paragraph'), undefined);
assert.strictEqual(first.qualified(first), 9, 'a second generated module cannot change the first module\'s keys');

const { Subject: AliasConsumer } = executeClass(`package example {
 import alias.same;
 public class AliasConsumer {
  same var value:Number = 0;
  public function read():Number { return this.same::value; }
 }
}`, 'AliasConsumer');
assert.strictEqual(AliasConsumer.prototype.read.call(first), 9, 'independently emitted URI alias reaches the same member');

const { Subject: IntegerSubject } = executeClass(`package example {
 import alias.same;
 public class IntegerSubject {
  same var signed:int = 0;
  same var unsigned:uint = 0;
  public function set(value:Number):Array {
   this.same::signed = value;
   same::unsigned = value;
   this.same::unsigned += 2;
   return [this.same::signed, this.same::unsigned];
  }
  public function setOther(other:IntegerSubject, value:Number):Number {
   other.same::unsigned = value;
   other.same::unsigned += 2;
   return other.same::unsigned;
  }
 }
}`, 'IntegerSubject');
assert.deepStrictEqual(Array.from(new IntegerSubject().set(-1.75)), [-1, 1]);
assert.strictEqual(new IntegerSubject().setOther(new IntegerSubject(), -1.75), 1);

// Parentheses retain references, including mutation policy and destination type.
for (const depth of [0, 1, 3]) {
  const group = value => '('.repeat(depth) + value + ')'.repeat(depth);
  const { Subject: Grouped } = executeClass(`package example {
   import alias.same;
   public class Grouped {
    same var signed:int = 0;
    same var unsigned:uint = 0;
    same var object:Object = { value: 3 };
    public function set(other:Grouped, value:Number):Array {
     ${group('this.same::signed')} = value;
     ${group('same::unsigned')} = value;
     ${group('other.same::unsigned')} = value;
     var assigned:Number = (${group('this.same::unsigned')} += 2);
     ${group('other.same::unsigned')} += 2;
     ${group('this.same::object')}.value++;
     return [${group('this.same::signed')}, ${group('same::unsigned')}, other.same::unsigned, assigned,
       ${group('this.same::object')}.value, (0, this.same::signed)];
    }
   }
  }`, 'Grouped');
  assert.deepStrictEqual(Array.from(new Grouped().set(new Grouped(), -1.75)), [-1, 1, 1, 1, 4, -1]);
  assert.deepStrictEqual(Array.from(new Grouped().set(new Grouped(), 4294967295)), [-1, 1, 1, 1, 4, -1]);
  for (const expression of [
    `delete ${group('this.same::unsigned')}`,
    `${group('this.same::unsigned')}++`, `${group('this.same::unsigned')}--`,
    `++${group('this.same::unsigned')}`, `--${group('this.same::unsigned')}`,
    `${group('this.same::method')} = null`, `${group('this.same::method')} += null`
  ]) {
    assert.throws(() => generate(`package example {
     import alias.same;
     public class Grouped {
      same var unsigned:uint = 4294967295;
      same function method():void {}
      public function run():void { ${expression}; }
     }
    }`), /AS3_NAMESPACE_UNSUPPORTED/, expression);
  }
}

for (const invalid of [
  'package p { public namespace n; }',
  'package p { public namespace n = ""; }',
  'package p { public namespace n = factory(); }',
  'package p { public namespace a = b; public namespace b = a; }',
  'package p { public class C { missing var value:Object; } }',
  'package p { public namespace n = "urn:n"; public class C { n var x:Object, y:Object; } }',
  'package p { public namespace n = "urn:n"; public class C { n const x:int = 1; } }',
  'package p { public namespace n = "urn:n"; public class C { n function get x():Object { return null; } } }',
  'package p { public namespace n = "urn:n"; public class C { n var x:Object; public function f():Object { return x; } } }',
  'package p { public namespace n = "urn:n"; public class C { public function f():Object { return n; } } }',
  'package p { public namespace n = "urn:n"; public class C { public function f():Object { return n::missing; } } }',
  'package p { public namespace n = "urn:n"; public class C { public function f():Object { return this.n::missing; } } }',
  'package p { public namespace n = "urn:n"; public class C { public function f():Object { return n::*; } } }',
  'package p { public class C { namespace n = "urn:n"; } }',
  'package p { public class C { public function f():void { namespace n = "urn:n"; } } }',
  'package p { public class C { public function f():void { use namespace n; } } }',
  'package p { import alias.same; public class C { public function f():Object { return same; } } }',
  'package p { public namespace n = "urn:n"; public class C { public function f(n:Object):Object { return n::x; } } }',
  'package p { public namespace n = "urn:n"; use namespace n; public class C { n var x:Object; public function f():Object { return this.x; } } }',
  'package p { public namespace n = "urn:n"; public class C { public function f(xml:XML):Object { return xml.n::x; } } }',
  'package p { public namespace n = "urn:n"; public class C { n static function f():void { } } }',
  'package p { public namespace n = "urn:n"; public class C extends Base { n var x:Object; } }',
  'package p { public namespace n = "urn:n"; public class C { n var x:Object = <value/>; } }',
  'package p { public namespace n = "urn:n"; public class C { n var x:Object; public function f():void { delete this.n::x; } } }',
  'package p { public namespace n = "urn:n"; public class C { n var x:uint; public function f():void { this.n::x++; } } }',
  'package p { public namespace n = "urn:n"; public class C { n function f():void {} public function g():void { this.n::f = null; } } }'
]) assert.throws(() => generate(invalid), /AS3_NAMESPACE_UNSUPPORTED/, invalid);
assert.throws(() => generate('package p { public namespace n = "urn:source"; }', {
  namespaceUris: { 'p.n': 'urn:stale' }
}), /configured URI disagrees/);

console.log('native namespace declarations, aliases, selectors, Symbol method binding, TLF slice and fail-closed cases passed');
