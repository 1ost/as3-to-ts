'use strict';
const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),ts=require(path.join(root,'node_modules/typescript-4-9'));
// In-memory CommonJS loader: cache partial exports before loading cyclic runtime imports.
const cache=new Map();
function load(file){
 file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;
 const mod={exports:{}};cache.set(file,mod);
 const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 Function('require','module','exports',js)(id=>id.startsWith('.')?load(path.resolve(path.dirname(file),id+'.ts')):require(id),mod,mod.exports);
 return mod.exports;
}
const runtime=load(path.join(root,'src/hardened-runtime/AS3Array.ts'));
const {as3ArrayCall:call,as3ArrayLiteral:literal,AS3ArrayOperationUnavailable:Unavailable}=runtime;
const metadata={schema:'as3-runtime-type-authority@1',qnames:[],entries:[]};
load(path.join(root,'src/hardened-runtime/internal/AS3TypeRegistry.ts')).installAS3TypeAuthority({schema:metadata.schema,sha256:crypto.createHash('sha256').update(JSON.stringify(metadata)).digest('hex'),qnames:[],entries:[]});
const laya=process.env.HARDENED_FIXTURE_LAYA||path.resolve(root,'../LayaAir');
const {sourceArraySome}=load(path.join(laya,'src/layaAir/flash/utils/AS3ArraySome.ts'));
const some=(value,args)=>runtime.as3ArraySome(value,args,sourceArraySome);
test('Array.some does not admit an overridden method or host Array subclass',()=>{
 class Derived extends Array {};
 let calls=0;const overridden=[];overridden.some=()=>{calls++;return true;};
 for(const value of [overridden,new Derived(),{}])assert.throws(()=>some(value,[()=>true]),Unavailable);
 assert.equal(calls,0);
});
test('Array.some rejects sparse or accessor argument transport without invoking accessors',()=>{
 let reads=0;const accessor=[];Object.defineProperty(accessor,'0',{get(){reads++;return ()=>true;},configurable:true});
 for(const args of [[],[null,null,null],new Array(1),accessor])assert.throws(()=>some([],args),Unavailable);
 assert.equal(reads,0);
});
test('shared some requires its ordinary native Array representation',()=>{
 class Derived extends Array {};
 assert.throws(()=>sourceArraySome(new Derived(),null,null,()=>undefined),/AS3_ARRAY_SOME_UNSUPPORTED/);
 assert.throws(()=>sourceArraySome([],17,null,()=>undefined),/AS3_ARRAY_SOME_UNSUPPORTED/);
});
