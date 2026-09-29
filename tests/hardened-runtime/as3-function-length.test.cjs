'use strict';
const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'as3-function-length-'));
require('esbuild').buildSync({stdin:{contents:`export * from './src/hardened-runtime/internal/AS3FunctionLength'; export * from './src/hardened-runtime/AS3MethodClosure';`,resolveDir:root},outfile:path.join(dir,'runtime.cjs'),bundle:true,platform:'node',format:'cjs',logLevel:'silent'});
const runtime=require(path.join(dir,'runtime.cjs'));
test.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
test('source length counts optional parameters and excludes rest independently of JS length',()=>{
 const optional=(a,b=4)=>a+b,rest=(a,...items)=>items.length;
 runtime.defineFunctionLength(optional,2);runtime.defineFunctionLength(rest,1);
 assert.equal(optional.length,1);assert.equal(runtime.as3FunctionLength(optional),2);
 assert.equal(runtime.as3FunctionLength(rest),1);assert.equal(optional(3),7);
 assert.throws(()=>runtime.defineFunctionLength(optional,1),/cannot change/);
});
test('cached method closures preserve source arity, receiver and identity',()=>{
 const owner={base:5,method(a,b=2){return this.base+a+b;}};
 runtime.as3DefineMethodLength(owner,'method',2);
 const bound=runtime.as3BindMethod(owner,owner.method);
 assert.equal(runtime.as3FunctionLength(bound),2);assert.equal(bound(3),10);
 assert.equal(runtime.as3BindMethod(owner,owner.method),bound);
 assert.equal(runtime.as3BindMethod(owner,bound),bound);
});
test('length metadata never invokes a host length getter or a method getter',()=>{
 let reads=0;const foreign=()=>{};
 Object.defineProperty(foreign,'length',{get(){reads++;return 9;}});
 assert.throws(()=>runtime.as3FunctionLength(foreign),/retained source arity/);
 assert.equal(reads,0);
 const owner={get method(){reads++;return foreign;}};
 assert.throws(()=>runtime.as3DefineMethodLength(owner,'method',1),/own method descriptor/);
 assert.equal(reads,0);
});
test('null Function receiver preserves native TypeError 1009',()=>{
 assert.throws(()=>runtime.as3FunctionLength(null),e=>e instanceof TypeError&&e.errorID===1009);
 assert.throws(()=>runtime.as3FunctionLength(7),/retained source arity/);
});
