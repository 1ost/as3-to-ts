'use strict';

const assert = require('node:assert/strict');
const parse = require('../../lib/parse');
const emit = require('../../lib/emit');
const ts = require('typescript');

const source = `package p {
  public namespace n = "urn:inherited-static";
  public class Base { n static var value:int = 6; }
}
import p.Base;
import p.n;
use namespace n;
class Child extends Base {
  public function read():int { return n::value; }
}`;

const output = emit(parse('Child.as', source), source, {
  lineSeparator: '\n',
  useNamespaces: false,
  customVisitors: []
});
assert.match(output, /__as3_namespace_member_/);
const result = ts.transpileModule(output, {
  compilerOptions: {target: ts.ScriptTarget.ES2015},
  reportDiagnostics: true
});
assert.deepEqual(result.diagnostics, []);
console.log(JSON.stringify({status: 'pass', checks: 2}));
