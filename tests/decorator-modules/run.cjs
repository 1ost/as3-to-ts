const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const parse = require('../../lib/parse');
const emit = require('../../lib/emit');
const classes = require('../../lib/emit/classlist').default;
const source = `package nested.deep { public class Callback {
  public var value:Number = 4;
  public function next():Number { this.value += 1; return this.value; }
} }`;
const base = {lineSeparator:'\n', customVisitors:[]};
const cache = path.resolve(__dirname, '../../.cache');
fs.mkdirSync(cache, {recursive:true});
const out = fs.mkdtempSync(path.join(cache, 'decorator-modules-'));
for (const scanning of [true, false]) {
  for (const target of [ts.ScriptTarget.ES5, ts.ScriptTarget.ES2015]) {
    const root = path.join(out, scanning + '-' + target);
    const directory = path.join(root, 'scope/nested/deep');
    const helpers = path.join(root, 'scope/shared helpers');
    fs.mkdirSync(directory, {recursive:true}); fs.mkdirSync(helpers, {recursive:true});
    for (const name of ['bound', 'classBound'])
      fs.copyFileSync(path.join(__dirname, '../../utils', name + '.ts'), path.join(helpers, name + '.ts'));
    const decoratorModules = Object.fromEntries(['bound', 'classBound'].map(name => [name,
      path.relative(directory, path.join(helpers, name)).split(path.sep).join('/')]));
    classes.classList = []; classes.currentClassRecord = undefined; classes.isScanning = true;
    if (!scanning) {
      emit(parse('Callback.as', source), source, {...base, decoratorModules});
      classes.optimize(); classes.isScanning = false;
    }
    const generated = emit(parse('Callback.as', source), source, {...base, decoratorModules});
    assert.ok(!generated.includes('undefinedbound') && !generated.includes('undefinedclassBound'));
    const file = path.join(directory, 'Callback.ts'); fs.writeFileSync(file, generated);
    const compilerOptions = {module:ts.ModuleKind.CommonJS, moduleResolution:ts.ModuleResolutionKind.NodeJs,
      target, experimentalDecorators:true};
    const ast = ts.createSourceFile(file, generated, ts.ScriptTarget.Latest, true);
    for (const statement of ast.statements.filter(node => node.kind === ts.SyntaxKind.ImportDeclaration)) {
      const resolved = ts.resolveModuleName(statement.moduleSpecifier.text, file.split(path.sep).join('/'), compilerOptions, ts.sys).resolvedModule;
      assert.ok(resolved, statement.moduleSpecifier.text);
      assert.strictEqual(path.resolve(path.dirname(resolved.resolvedFileName)), helpers);
    }
    for (const input of [file, ...['bound', 'classBound'].map(name => path.join(helpers, name + '.ts'))]) {
      const result = ts.transpileModule(fs.readFileSync(input, 'utf8'), {compilerOptions, reportDiagnostics:true});
      assert.deepStrictEqual(result.diagnostics, []);
      fs.writeFileSync(input.replace(/\.ts$/, '.js'), result.outputText);
    }
    const {Callback} = require(file.replace(/\.ts$/, '.js'));
    const first = new Callback(), second = new Callback(), callback = first.next;
    assert.strictEqual(callback(), 5);
    assert.strictEqual(callback, first.next);
    assert.strictEqual(second.value, 4);
    assert.strictEqual(callback.call(second), 6);
    assert.strictEqual(first.value, 6);
  }
}
for (const value of [null, [], {}, {bound:'./bound'}, {bound:'', classBound:'./classBound'},
  {bound:'./bound', classBound:'bad"path'}, {bound:'./bound', classBound:'bad\\path'},
  {bound:'./bound', classBound:'bad\npath'}, {bound:'./bound', classBound:'./classBound', extra:'bad'}])
  assert.throws(() => emit(parse('Callback.as', source), source, {...base, decoratorModules:value}), /AS3_DECORATOR_MODULES/);
console.log('Decorator module resolution and real helper execution pass in scan/emission modes on ES5/ES2015; 9 invalid configurations rejected.');
