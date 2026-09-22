'use strict';

const assert = require('node:assert/strict');
const parse = require('../../lib/parse');
const emit = require('../../lib/emit');
const ts = require('typescript');

const source = 'package p { public class X { public function f(a:int=-1,b:Number=2.5,c:uint=0,d:Number=NaN):void{} } }';
const output = emit(parse('X.as', source), source, {
  nativeNumericMethodParametersModule: './AS3Coercion'
});
const interfaceSource = 'package p { public interface I { function f(a:int=-1,b:Number=2.5):void; } }';
const interfaceOutput = emit(parse('I.as', interfaceSource), interfaceSource, {
  nativeNumericMethodParametersModule: './AS3Coercion'
});

assert.match(output, /f\(a\?:number,b\?:number,c\?:number,d\?:number\):void/);
assert.doesNotMatch(output, /number-1/);
assert.match(output, /as3CoerceInt\(-1\)/);
assert.match(output, /as3CoerceNumber\(2\.5\)/);
assert.match(output, /as3CoerceNumber\(NaN\)/);
assert.match(interfaceOutput, /f\(a\?:number,b\?:number\):void/);
assert.doesNotMatch(interfaceOutput, /number-1/);
for (const generated of [output, interfaceOutput]) {
  const result = ts.transpileModule(generated, {
    compilerOptions: {experimentalDecorators: true, target: ts.ScriptTarget.ES2015},
    reportDiagnostics: true
  });
  assert.deepEqual(result.diagnostics, []);
}
console.log(JSON.stringify({status: 'pass', checks: 9}));
