const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');
const parse = require('../../lib/parse');
const emit = require('../../lib/emit');
const ClassList = require('../../lib/emit/classlist').default;
const expected = require('./verify-evidence.cjs');
const source = fs.readFileSync(path.join(__dirname, 'source/updatecases/NamespaceUpdatesProbe.as'), 'utf8');
const options = {lineSeparator:'\n', customVisitors:[], definitionsByNamespace:{},
  namespaceUris:{'updatecases.slot':'urn:as3-to-ts:namespace-updates'}};
function generate(text) {
  ClassList.classList = []; ClassList.isScanning = true;
  emit(parse('NamespaceUpdatesProbe.as', text), text, options);
  ClassList.optimize(); ClassList.isScanning = false;
  return emit(parse('NamespaceUpdatesProbe.as', text), text, options);
}
const generated = generate(source);
const grouped = generate(source.replace(/(this\.(?:slot::)?(?:signed|unsigned)|receiver\(\)\.slot::(?:signedAccessor|unsignedAccessor|signed|unsigned))(?=\+\+|--)/g, '((($1)))')
  .replace(/(\+\+|--)(this\.(?:slot::)?(?:signed|unsigned)|receiver\(\)\.slot::(?:signedAccessor|unsignedAccessor|signed|unsigned))/g, '$1((($2)))'));
for (const target of [ts.ScriptTarget.ES5, ts.ScriptTarget.ES2015]) {
  const modules = {};
  const context = vm.createContext({});
  context.require = name => {
    const key = name.split('/').pop();
    assert.ok(Object.hasOwn(modules, key), 'unexpected dependency ' + name);
    return modules[key];
  };
  function load(name, text) {
    const result = ts.transpileModule(text, {compilerOptions:{target,
      module:ts.ModuleKind.CommonJS, experimentalDecorators:true}, reportDiagnostics:true});
    assert.deepStrictEqual(result.diagnostics, [], text);
    context.exports = {};
    vm.runInContext('(function(exports, require) {\n' + result.outputText + '\n})(exports, require);', context);
    modules[name] = context.exports;
  }
  for (const helper of ['bound', 'classBound'])
    load(helper, fs.readFileSync(path.join(__dirname, '../../utils', helper + '.ts'), 'utf8'));
  for (const output of [generated, grouped]) {
    load('NamespaceUpdatesProbe', output);
    const state = new modules.NamespaceUpdatesProbe.NamespaceUpdatesProbe().snapshot();
    assert.strictEqual(state.ready, true);
    assert.strictEqual(state.failure, '');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(state.observations)), expected);
  }
  console.log('96 native AIR namespace integer updates match on ' + ts.ScriptTarget[target]);
}

function rejected(declaration, expression, reason, extra = '') {
  const input = `package updatecases { use namespace slot;
    public class Guard { ${declaration} public function run():* { return ${expression}; } } ${extra} }`;
  assert.throws(() => generate(input), reason, input);
}
rejected('slot const n:int = 1;', '++this.slot::n', /mutable integer member/);
rejected('slot function n():int { return 1; }', 'this.slot::n++', /mutable integer member/);
rejected('slot var n:Number = 1;', '++this.slot::n', /unshadowed int or uint/);
rejected('slot static var n:int = 1;', '++Guard.slot::n', /own instance integer/);
rejected('slot function get n():int { return 1; }', '++this.slot::n', /both accessor halves/);
rejected('slot function set n(value:int):void {}', '++this.slot::n', /both accessor halves/);
rejected('slot var n:int = 1;', '++slot::n', /implicit\/super/);
rejected('slot var n:int = 1;', '++n', /implicit open namespace update/);
rejected('slot var n:int = 1;', 'delete this.slot::n', /delete\/update/);
for (const body of [
  'public function run(receiver:Function):* { return ++receiver().slot::n; }',
  'public function run():* { var receiver:Function; return ++receiver().slot::n; }',
  'public function run():* { function receiver():* { return null; } return ++receiver().slot::n; }'
]) assert.throws(() => generate(`package updatecases { public class Guard {
  slot var n:int = 1; private function receiver():Guard { return this; } ${body} } }`), /complex namespace receiver/, body);
assert.throws(() => generate(`package updatecases { public class Base { slot var n:int = 1; }
  public class Guard extends Base { public function run():* { return ++this.slot::n; } } }`), /own instance integer/);
console.log('13 namespace update boundaries retain explicit compiler errors.');
