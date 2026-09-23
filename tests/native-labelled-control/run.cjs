'use strict';

const assert = require('node:assert/strict');
const ts = require('typescript');
const parse = require('../../lib/parse');
const emit = require('../../lib/emit');

const source = 'package p { public class X { public function f(a:Array):void { outer: for each (var x:* in a) { inner: while (true) { continue outer; } break outer; } } } }';
const output = emit(parse('X.as', source), source);

assert.match(output, /outer: for\s*\(/);
assert.match(output, /inner: while\s*\(true\)\s*\{ continue outer; \}/);
assert.match(output, /break outer;/);
assert.doesNotMatch(output, /this\.outer|this\.inner/);
assert.deepEqual(ts.transpileModule(output, {
  compilerOptions: {target: ts.ScriptTarget.ES2015},
  reportDiagnostics: true
}).diagnostics, []);
console.log(JSON.stringify({status: 'pass', checks: 5}));
