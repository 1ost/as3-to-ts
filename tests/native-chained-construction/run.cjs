'use strict';

const assert = require('node:assert/strict');
const ts = require('typescript');
const parse = require('../../lib/parse');
const emit = require('../../lib/emit');

const cases = [
  ['Date', 'package p { public class X { public function f():Number { return new Date().getTime(); } } }', /new Date\(\)\.getTime\(\)/],
  ['source class', 'package p { public class X { public function f():String { return new Foo(1).toString(); } } }', /new Foo\(1\)\.toString\(\)/]
];
let checks = 0;
for (const [name, source, expected] of cases) {
  const output = emit(parse(name + '.as', source), source);
  assert.match(output, expected);
  assert.doesNotMatch(output, /<Date>|<Foo>/);
  assert.deepEqual(ts.transpileModule(output, {
    compilerOptions: {target: ts.ScriptTarget.ES2015},
    reportDiagnostics: true
  }).diagnostics, []);
  checks += 3;
}
console.log(JSON.stringify({status: 'pass', checks}));
