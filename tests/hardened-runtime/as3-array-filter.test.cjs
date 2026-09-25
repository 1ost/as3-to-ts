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
const fixture=path.join(process.env.HARDENED_FIXTURE_LAYA || path.resolve(root,'../LayaAir'),'tests/nativeFlashOracle/array-filter-source-controls');
const receipt=JSON.parse(fs.readFileSync(path.join(fixture,'native-air.json'),'utf8'));
const native=new Map(receipt.capture.state.observations.map(row=>[row.id,row.result]));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
test('retained native evidence binds exact input source and scenario',()=>{
 assert.equal(hash(path.join(fixture,'ArrayFilterSourceProbe.as')),receipt.sourceSha256);
 assert.equal(hash(path.join(fixture,'scenario.json')),receipt.scenarioSha256);
 assert.equal(native.size,21);
});

const {as3BindMethod}=load(path.join(root,'src/hardened-runtime/AS3MethodClosure.ts'));
const scenario=JSON.parse(fs.readFileSync(path.join(fixture,'scenario.json')));
test('all 21 native filter controls retain exact state and errors',()=>{
 for(const [mode,step] of scenario.steps.entries()){
  const events=[];let source=[10,20,30];
  const label=value=>value===undefined?'undefined':value===null?'null':String(value);
  if(mode===0)source=[10,null,undefined,20];
  if(mode===1){source=new Array(4);source[3]=undefined;}
  if(mode===2)source=new Array(3);
  if(mode===3)source=[];
  if(mode===8){source=new Array(3);source[0]=10;source[2]=30;}
  const owner={};
  const isNotNull=as3BindMethod(owner,function(value,index,array){events.push([index,label(value),array===source]);return value!=null;});
  const control=as3BindMethod(owner,function(value,index,array){
   events.push([index,label(value),array===source]);
   if(index===0){
    if(mode===4)array.push(40);
    if(mode===5)delete array[1];
    if(mode===6)array[1]=99;
    if(mode===7)array.length=1;
    if(mode===8)array[1]=20;
    if(mode===9){array.length=1;array.length=3;array[2]=30;}
    if(mode===19){const error=new Error('filter-callback');error.errorID=0;throw error;}
   }
   return true;
  });
  const context={marker:'context'};let args=[control];
  if(mode<=2)args=[isNotNull];
  if(mode===10)args=[isNotNull,context];
  if(mode===11)args=[function(){events.push(this===context);return true;},context];
  if(mode===12||mode===13)args=[null];
  if(mode===13)source=[];
  if(mode===14)args=[17];
  if(mode===15)args=[(v,i)=>i===0?1:0];
  if(mode===16)args=[(v,i)=>i===0?'yes':''];
  if(mode===17)args=[()=>({})];
  if(mode===18)args=[isNotNull,null];
  if(mode===20)source=null;
  let result;
  try{const output=call(source,'filter',args);result=['return',output.map(label),output===source];}
  catch(error){result=[error.name,error.errorID,error.message];}
  let keys='';const values=[];
  if(source)for(let i=0;i<source.length;i++){keys+=Object.hasOwn(source,String(i))?'1':'0';values.push(label(source[i]));}
  result.push(events,keys,values);assert.deepEqual(result,native.get(step.id),step.id);
 }
});
test('unqualified Array dispatch remains unavailable',()=>{
 class Derived extends Array {}
 const overridden=[];overridden.filter=()=>[];
 for(const value of [new Derived(),overridden])assert.throws(()=>call(value,'filter',[()=>true]),Unavailable);
 assert.throws(()=>call([],'filter',[]),Unavailable);
 assert.throws(()=>call([],'filter',[null,null,null]),Unavailable);
});
