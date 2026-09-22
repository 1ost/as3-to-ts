'use strict';

const assert = require('node:assert/strict');
const ts = require('typescript');
const parse = require('../../lib/parse');
const emit = require('../../lib/emit');

const separator = String.fromCharCode(0x2028);
const source = 'package p { public class X { public function value():String { return "'
  + separator + '"; } } }';
const output = emit(parse('X.as', source), source, {});
assert.match(output, /return "\\u2028"/);
const result = ts.transpileModule(output, {
  compilerOptions: {target: ts.ScriptTarget.ES2015, module: ts.ModuleKind.CommonJS},
  reportDiagnostics: true
});
assert.deepEqual(result.diagnostics, []);
console.log(JSON.stringify({status: 'pass', checks: 2}));
