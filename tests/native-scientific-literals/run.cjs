'use strict';

const assert = require('node:assert/strict');
const parse = require('../../lib/parse');
const emit = require('../../lib/emit');
const ts = require('typescript');

const literals = ['2e-10', '2E-10', '1e3', '5e+2', '.5e2'];
const outputs = literals.map(literal => {
  const source = `package { public class T { public function f(x:Number=${literal}):Number { return x <= ${literal} ? x : 0; } } }`;
  const output = emit(parse('T.as', source), source, {});
  assert.match(output, new RegExp(`f\\(x:number=${literal.replace(/[+]/g, '\\+')}\\)`));
  const result = ts.transpileModule(output, {
    compilerOptions: {target: ts.ScriptTarget.ES2015},
    reportDiagnostics: true
  });
  assert.deepEqual(result.diagnostics, []);
  return output;
});

assert.equal(outputs.length, literals.length);
console.log(JSON.stringify({status: 'pass', checks: literals.length * 2}));
