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
const fixture=path.join(process.env.HARDENED_FIXTURE_LAYA || path.resolve(root,'../LayaAir'),'tests/nativeFlashOracle/array-index-of');
const receipt=JSON.parse(fs.readFileSync(path.join(fixture,'native-air.json'),'utf8'));
const native=new Map(receipt.capture.state.observations.map(row=>[row.id,row.result]));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
test('retained native evidence binds exact input source and scenario',()=>{
 assert.equal(hash(path.join(fixture,'ArrayIndexOfProbe.as')),receipt.sourceSha256);
 assert.equal(hash(path.join(fixture,'scenario.json')),receipt.scenarioSha256);
 assert.equal(native.size,36);
});
function compare(id,values,search,start,omit=false){
 const events=['receiver','search'];if(!omit)events.push('start');
 if(typeof start==='function')start=start(values,events);
 let result;
 try{result=['return',call(values,'indexOf',omit?[search]:[search,start])];}
 catch(error){result=[error.name,error.errorID,error.message];}
 const keys=Array.from({length:values.length},(_,i)=>Object.hasOwn(values,String(i))?'1':'0').join('');
 result.push(events,values.length,keys);assert.deepEqual(result,native.get(id),id);
}
test('native strict equality does not coerce search elements',()=>{
 compare('omitted-start',['a','b','a'],'a',undefined,true);
 compare('number-string-strict',[1,'1',true,null,undefined,NaN,0],'1',0);
 compare('boolean-strict',[1,'1',true],true,0);
 compare('null-undefined',[null,undefined],undefined,0);
 compare('null-search',[null,undefined],null,0);
 compare('nan',[NaN],NaN,0);compare('signed-zero',[-0],0,0);
 const item={};compare('object-identity',[{},item,{}],item,0);compare('different-object',[{}],{},0);
 let calls=0;compare('no-search-coercion',['a','b','a'],{valueOf(){calls++;return 1;},toString(){calls++;return 'a';}},0);assert.equal(calls,0);
});
test('native holes match undefined without materializing storage',()=>{
 const a=new Array(4);a[3]=undefined;compare('hole-before-undefined',a,undefined,0);
 compare('all-holes',new Array(4),undefined,0);
 const b=[undefined,undefined];delete b[0];compare('deleted-slot',b,undefined,0);
 const c=new Array(100);c[90]=undefined;compare('sparse-undefined',c,undefined,0);
 const d=['a'];d.length=100;d.length=2;compare('truncate-grow-holes',d,undefined,0);
});
test('native fromIndex is signed int32 rather than JavaScript integer-or-infinity',()=>{
 for(const [id,start] of [['positive-start',1],['negative-start',-1],['negative-clamp',-99],['positive-fraction',1.9],['negative-fraction',-1.9],['nan-start',NaN],['positive-infinity',Infinity],['negative-infinity',-Infinity],['uint-overflow',4294967297],['int-overflow',2147483648],['string-start','1.9'],['undefined-start',undefined],['null-start',null],['negative-overflow',-4294967295]])compare(id,['a','b','a'],'a',start);
});
test('conversion precedes length observation and can change the search result',()=>{
 compare('start-hook',['a','b','a'],'a',(v,e)=>({valueOf(){e.push('convert');return 1;}}));
 compare('start-mutate-element',['a','b','a'],'a',(v,e)=>({valueOf(){e.push('convert');v[0]='changed';return 0;}}));
 compare('start-append',['b'],'a',(v,e)=>({valueOf(){e.push('convert');v.push('a');return 0;}}));
 compare('start-shrink',['a','b','a'],'a',(v,e)=>({valueOf(){e.push('convert');v.length=0;return 0;}}));
 compare('empty-throwing-start',[],'a',(v,e)=>({valueOf(){e.push('convert');const error=new Error('index-start');Object.defineProperty(error,'errorID',{value:0});throw error;}}));
 compare('conversion-fallback',['a','b','a'],'a',(v,e)=>({valueOf(){e.push('valueOf');return {};},toString(){e.push('toString');return '1';}}));
});
test('null receiver retains native failure after argument evaluation',()=>{
 const events=[];let result;
 function receiver(){events.push('receiver');return null;}
 function search(){events.push('search');return 'a';}
 function start(){events.push('start');return 0;}
 try{call(receiver(),'indexOf',[search(),start()]);}catch(error){result=[error.name,error.errorID,error.message,events,3,'111'];}
 assert.deepEqual(result,native.get('null-receiver'));
});
test('unproved receiver, method, arity and accessor paths fail without invoking hooks',()=>{
 for(const args of [[],[1,0,2]])assert.throws(()=>call([],'indexOf',args),Unavailable);
 let hooks=0;const overridden=[];Object.defineProperty(overridden,'indexOf',{get(){hooks++;return Array.prototype.indexOf;}});
 assert.throws(()=>call(overridden,'indexOf',[1]),Unavailable);
 const accessor=[];Object.defineProperty(accessor,'0',{get(){hooks++;return 1;},configurable:true});
 assert.throws(()=>call(accessor,'indexOf',[1]),Unavailable);
 class Foreign extends Array {}assert.throws(()=>call(new Foreign(),'indexOf',[1]),Unavailable);
 assert.equal(hooks,0);
});
test('indexOf leaves native Array allocation history available to splice',()=>{
 const withSearch=literal(['a','b','c']),control=literal(['a','b','c']);
 runtime.as3ArrayLengthWrite(withSearch,10);runtime.as3ArrayLengthWrite(control,10);
 assert.equal(call(withSearch,'indexOf',[undefined]),3);
 const removed=call(withSearch,'splice',[1,4]),expected=call(control,'splice',[1,4]);
 assert.deepEqual(removed,expected);assert.deepEqual(withSearch,control);
});
