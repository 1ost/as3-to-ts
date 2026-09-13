"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = fs.mkdtempSync(path.join(os.tmpdir(), "as3-array-runtime-"));
const CONFIG = path.join(OUTPUT, "tsconfig.json");
fs.writeFileSync(CONFIG, JSON.stringify({
    compilerOptions: {
        target: "ES2022", module: "CommonJS", moduleResolution: "Node", strict: true,
        skipLibCheck: true, rootDir: path.join(ROOT, "src"), outDir: OUTPUT,
    },
    files: [path.join(ROOT, "src/hardened-runtime/AS3Array.ts")],
}), "utf8");
childProcess.execFileSync(process.execPath,
    [path.join(ROOT, "node_modules/typescript-4-9/bin/tsc"), "-p", CONFIG], { cwd: ROOT, stdio: "inherit" });
const { AS3_ARRAY_MAX_INDEX, as3ArrayIndex } = require(path.join(OUTPUT, "hardened-runtime/AS3Array.js"));

test.after(() => fs.rmSync(OUTPUT, { recursive: true, force: true }));

test("numeric Array reads retain native hole and missing-index semantics", () => {
    const values = [];
    values[1] = "present";
    assert.equal(values[as3ArrayIndex(0)], undefined);
    assert.equal(values[as3ArrayIndex(1)], "present");
    assert.equal(values[as3ArrayIndex(2)], undefined);
    assert.equal(values[as3ArrayIndex(1000)], undefined);
    assert.equal(values.length, 2);
});

test("the read seam admits exactly native AS3 Array index identities", () => {
    assert.equal(as3ArrayIndex(0), 0);
    assert.equal(as3ArrayIndex(AS3_ARRAY_MAX_INDEX), 0xfffffffe);
    for (const rejected of [-1, -0.5, 1.5, Number.NaN, Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY, 0xffffffff, Number.MAX_SAFE_INTEGER]) {
        assert.throws(() => as3ArrayIndex(rejected), RangeError, String(rejected));
    }
});

const {as3ArrayCall,AS3ArrayOperationUnavailable} = require(path.join(OUTPUT,"hardened-runtime/AS3Array.js"));
test('Array parameter slots retain native identity, diagnostics and rejection without conversion hooks',()=>{
 const {as3FunctionArgument}=require(path.join(OUTPUT,'hardened-runtime/AS3Function.js'));
 const folder=path.join(process.env.HARDENED_FIXTURE_LAYA,'tests/nativeFlashOracle/array-slot');
 const native=JSON.parse(fs.readFileSync(path.join(folder,'native-air.json')));
 const rows=new Map(native.capture.state.observations.map(row=>[row.id,row]));
 const values=[];assert.equal(as3FunctionArgument(values,'Array'),values);
 assert.equal(as3FunctionArgument(null,'Array'),null);assert.equal(as3FunctionArgument(undefined,'Array'),null);
 for(const [id,value] of [['number-rejection',7],['string-rejection','bad'],['boolean-rejection',true]]){
  assert.throws(()=>as3FunctionArgument(value,'Array'),{name:'TypeError',errorID:1034,message:rows.get(id).message});
 }
 const controls=rows.get('diagnostic-control-characters');
 assert.throws(()=>as3FunctionArgument(controls.inputText,'Array'),{name:'TypeError',errorID:1034,message:controls.message});
 let calls=0;const object={valueOf(){calls++;return [];},toString(){calls++;return 'array';}};
 assert.throws(()=>as3FunctionArgument(object,'Array'),{name:'TypeError',errorID:1034});assert.equal(calls,0);
 assert.throws(()=>as3FunctionArgument(new(class extends Array {})(),'Array'),AS3ArrayOperationUnavailable);
});
test('Array mutations preserve values, identity, ordering and empty results',()=>{
 const values=[],item={};
 assert.equal(as3ArrayCall(values,'push',[]),0);
 assert.equal(as3ArrayCall(values,'push',[undefined,null,item]),3);
 assert.equal(as3ArrayCall(values,'pop',[]),item);
 assert.equal(as3ArrayCall(values,'pop',[]),null);
 assert.equal(as3ArrayCall(values,'pop',[]),undefined);
 assert.equal(as3ArrayCall(values,'pop',[]),undefined);
 assert.equal(as3ArrayCall(values,'unshift',['a','b']),2);
 assert.equal(as3ArrayCall(values,'shift',[]),'a');
 assert.equal(as3ArrayCall(values,'shift',[]),'b');
 assert.equal(as3ArrayCall(values,'shift',[]),undefined);
});
test('null mutation retains native error and unproved operations remain explicit',()=>{
 assert.throws(()=>as3ArrayCall(null,'push',[1]),{name:'TypeError',errorID:1009,
  message:'Error #1009: Cannot access a property or method of a null object reference.'});
 const overridden=[];overridden.push=()=>1;
 assert.throws(()=>as3ArrayCall(overridden,'push',[1]),AS3ArrayOperationUnavailable);
 const full=[];full.length=0xffffffff;
 assert.throws(()=>as3ArrayCall(full,'push',[1]),AS3ArrayOperationUnavailable);
 assert.equal(full.length,0xffffffff);
 assert.throws(()=>as3ArrayCall([],'pop',[1]),AS3ArrayOperationUnavailable);
});


const {as3ArrayValues}=require(path.join(OUTPUT,"hardened-runtime/AS3Array.js"));
test('Array enumeration refuses unproved sparse, named, hidden, accessor and subclass values',()=>{
 const named=[1];named.extra=2;
 const hidden=[1];Object.defineProperty(hidden,'0',{enumerable:false});
 const getter=[1];Object.defineProperty(getter,'0',{get(){throw new Error('must not invoke unproved getter');}});
 const subclass=new (class extends Array {})(1,2);
 for (const value of [new Array(2),named,hidden,getter,subclass,{}])
  assert.throws(()=>[...as3ArrayValues(value,'*')],AS3ArrayOperationUnavailable);
});
test('Array enumeration keeps receiver identity and coerces each current typed slot',()=>{
 const values=['7.9',undefined,null,-2.9],seen=[];
 for (const value of as3ArrayValues(values,'int')) seen.push(value);
 assert.deepEqual(seen,[7,0,0,-2]);
 assert.deepEqual([...as3ArrayValues(null,'*')],[]);
 const original=['a','b','c'];const iterator=as3ArrayValues(original,'*');
 assert.equal(iterator.next().value,'a');as3ArrayCall(original,'shift',[]);
 assert.equal(iterator.next().value,'c');assert.equal(iterator.next().done,true);
});

test('concat preserves native sparse ownership and ignores named fields and constructors',()=>{
 const crypto=require('node:crypto');
 const folder=path.join(process.env.HARDENED_FIXTURE_LAYA,'tests/nativeFlashOracle/array-concat-sparse');
 const native=JSON.parse(fs.readFileSync(path.join(folder,'native-air.json'),'utf8'));
 for(const [file,field] of [['ArrayConcatSparseProbe.as','sourceSha256'],['scenario.json','scenarioSha256']])
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(folder,file))).digest('hex'),native[field]);
 for(const row of native.capture.state.observations){
  const left=new Array(3);left[1]='middle';
  const right=new Array(2);right[1]=undefined;
  if(row.id==='named'){left.extra='ignore';right.extra='ignore';}
  if(row.id==='constructor')left.constructor=()=>{throw new Error('constructor called');};
  const joined=as3ArrayCall(left,'concat',row.id==='clone'?[]:[right,'last']);
  let keys='';for(let i=0;i<joined.length;i++)keys+=Object.hasOwn(joined,i)?'1':'0';
  assert.deepEqual({length:joined.length,result:String(joined),keys,source:String(left)+':'+String(right)},
   {length:row.length,result:row.result,keys:row.keys,source:row.source},row.id);
  assert.equal(Object.hasOwn(joined,'extra'),false);
  assert.equal(Object.hasOwn(joined,'constructor'),false);
  assert.notEqual(joined,left);
 }
});

test('concat flattens one Array level and preserves references without JS spreadability hooks',()=>{
 const item={},nested=['nested'],arrayLike={0:'not spread',length:1,[Symbol.isConcatSpreadable]:true};
 const source=[item,nested],joined=as3ArrayCall(source,'concat',[[nested,item],arrayLike,null,undefined]);
 assert.deepEqual(joined,[item,nested,nested,item,arrayLike,null,undefined]);
 assert.equal(joined[1],joined[2]);assert.equal(joined[0],joined[3]);
 source.push('source only');nested.push('shared');
 assert.equal(joined.length,7);assert.deepEqual(joined[1],['nested','shared']);
});

test('concat rejects unsupported Array receivers and accessors without invoking their values',()=>{
 let reads=0;
 const getter=[1];Object.defineProperty(getter,'0',{get(){reads++;return 1;}});
 const hidden=[1];Object.defineProperty(hidden,'0',{enumerable:false});
 const symbolic=[1];symbolic[Symbol.isConcatSpreadable]=false;
 for(const value of [getter,hidden,symbolic,new (class extends Array {})(1,2)])
  assert.throws(()=>as3ArrayCall([],'concat',[value]),AS3ArrayOperationUnavailable);
 assert.equal(reads,0);
 const overridden=[];overridden.concat=()=>['wrong'];
 assert.throws(()=>as3ArrayCall(overridden,'concat',[]),AS3ArrayOperationUnavailable);
 const full=[];full.length=0xffffffff;
 assert.throws(()=>as3ArrayCall(full,'concat',[1]),AS3ArrayOperationUnavailable);
 assert.equal(full.length,0xffffffff);
 assert.throws(()=>as3ArrayCall(null,'concat',[]),{name:'TypeError',errorID:1009});
});

test('numeric Array writes retain sparse ownership and reject host accessor effects',()=>{
 const {as3ArrayWrite}=require(path.join(OUTPUT,'hardened-runtime/AS3Array.js'));
 const values=[],item={};assert.equal(as3ArrayWrite(values,2,item),item);
 assert.equal(values.length,3);assert.equal(Object.hasOwn(values,0),false);assert.equal(values[2],item);
 assert.equal(as3ArrayWrite(values,AS3_ARRAY_MAX_INDEX,undefined),undefined);
 assert.equal(values.length,0xffffffff);assert.equal(Object.hasOwn(values,AS3_ARRAY_MAX_INDEX),true);
 assert.throws(()=>as3ArrayWrite(null,2,item),error=>error.errorID===1009);
 let invoked=false;const accessor=[];Object.defineProperty(accessor,'0',{set(){invoked=true;}});
 assert.throws(()=>as3ArrayWrite(accessor,0,item),AS3ArrayOperationUnavailable);assert.equal(invoked,false);
 const named=[];assert.equal(as3ArrayWrite(named,1.5,item),item);assert.equal(named.length,0);assert.equal(named["1.5"],item);
});

const {as3ArrayRead,as3ArrayWrite}=require(path.join(OUTPUT,'hardened-runtime/AS3Array.js'));
test('numeric Array keys preserve names, holes, max index and null failures',()=>{
 for(const [key,name] of [[-0,'0'],[-1,'-1'],[1.5,'1.5'],[4294967295,'4294967295'],[4294967296,'4294967296'],[1e21,'1e+21'],[1e-7,'1e-7'],[NaN,'NaN'],[Infinity,'Infinity'],[-Infinity,'-Infinity']]) {
  const array=[],item={};assert.equal(as3ArrayRead(array,key),undefined);
  assert.equal(as3ArrayWrite(array,key,item),item);assert.equal(as3ArrayRead(array,key),item);
  assert.equal(Object.getOwnPropertyDescriptor(array,name).value,item);
  assert.equal(array.length,Object.is(key,-0)?1:0);
 }
 const full=[];as3ArrayWrite(full,4294967294,'last');assert.equal(full.length,4294967295);
 assert.equal(as3ArrayRead(full,4294967293),undefined);
 for(const op of [as3ArrayRead,as3ArrayWrite]) {
  assert.throws(()=>op(null,0),{name:'TypeError',errorID:1009});
  assert.throws(()=>op(undefined,0),{name:'TypeError',errorID:1010});
  assert.throws(()=>op(new (class extends Array {})(),0),AS3ArrayOperationUnavailable);
 }
});
test('numeric Array access rejects unproved host properties without invoking getters',()=>{
 let calls=0;const value=[];Object.defineProperty(value,'1.5',{get(){calls++;return 4;}});
 assert.throws(()=>as3ArrayRead(value,1.5),AS3ArrayOperationUnavailable);
 assert.throws(()=>as3ArrayWrite(value,1.5,8),AS3ArrayOperationUnavailable);
 assert.equal(calls,0);
});


test('Array subclass constructor lengths retain native errors and foreign prototypes remain unavailable',()=>{
 const {as3ArrayConstructorArguments,as3ArrayRead}=require(path.join(OUTPUT,"hardened-runtime/AS3Array.js"));
 for(const value of [-1,1.5,NaN,Infinity,4294967296])
  assert.throws(()=>as3ArrayConstructorArguments([value]),{name:'RangeError',errorID:1005,
   message:`Error #1005: Array index is not a positive integer (${String(value)}).`});
 for(const args of [[],[0],[3],[4294967295],['frame'],[1,'frame']])
  assert.equal(as3ArrayConstructorArguments(args),args);
 const prototype=Object.create(Array.prototype);
 for(const value of [Object.setPrototypeOf([1],prototype),new (class extends Array {})(1,2)]) {
  assert.throws(()=>as3ArrayRead(value,0),AS3ArrayOperationUnavailable);
  assert.throws(()=>as3ArrayCall(value,'push',[3]),AS3ArrayOperationUnavailable);
 }
});

const {as3ArrayLiteral,as3NewArray,as3ArrayLengthWrite}=require(path.join(OUTPUT,"hardened-runtime/AS3Array.js"));
test('splice retains the native distinction between fresh holes and grown dense storage',()=>{
 const folder=path.join(process.env.HARDENED_FIXTURE_LAYA,'tests/nativeFlashOracle/array-splice');
 const native=JSON.parse(fs.readFileSync(path.join(folder,'native-air.json'),'utf8'));
 const hash=value=>require('node:crypto').createHash('sha256').update(value).digest('hex');
 assert.equal(hash(fs.readFileSync(path.join(folder,'ArraySpliceProbe.as'))),native.sourceSha256);
 assert.equal(hash(fs.readFileSync(path.join(folder,'scenario.json'))),native.scenarioSha256);
 const row=id=>native.capture.state.observations.find(item=>item.id===id).result;
 const snapshot=(array,removed)=>['',String(array),array.length,Array.from({length:array.length},(_,i)=>Object.hasOwn(array,i)?'1':'0').join(''),String(removed),removed.length,Array.from({length:removed.length},(_,i)=>Object.hasOwn(removed,i)?'1':'0').join('')];
 const fresh=as3NewArray([5]);assert.deepEqual(snapshot(fresh,as3ArrayCall(fresh,'splice',[1,2])),row('holes-shrink'));
 const grown=as3ArrayLiteral(['a']);as3ArrayLengthWrite(grown,5);
 assert.deepEqual(snapshot(grown,as3ArrayCall(grown,'splice',[1,2])),row('length-growth-history'));
 const sparse=as3NewArray([70]);as3ArrayWrite(sparse,0,'a');as3ArrayWrite(sparse,69,'z');
 as3ArrayLengthWrite(sparse,1);as3ArrayLengthWrite(sparse,3);
 assert.deepEqual(snapshot(sparse,as3ArrayCall(sparse,'splice',[1,1])),row('persistent-sparse-history'));
 const back=as3NewArray([20]);as3ArrayWrite(back,10,'x');as3ArrayWrite(back,9,'y');
 assert.deepEqual(snapshot(back,as3ArrayCall(back,'splice',[8,2])),row('backward-write-capacity'));
});
test('splice rejects foreign storage and overrides before array mutation',()=>{
 const foreign=new Array(3);foreign[1]='x';
 assert.throws(()=>as3ArrayCall(foreign,'splice',[0,1]),AS3ArrayOperationUnavailable);
 assert.equal(foreign.length,3);assert.equal(Object.hasOwn(foreign,0),false);
 const own=as3ArrayLiteral([1,2]);Object.defineProperty(own,'1',{get(){throw Error('getter must not run');}});
 assert.throws(()=>as3ArrayCall(own,'splice',[0,1]),AS3ArrayOperationUnavailable);assert.equal(own[0],1);
 const fixed=as3ArrayLiteral([1,2]);Object.freeze(fixed);
 assert.throws(()=>as3ArrayCall(fixed,'splice',[0,1]),AS3ArrayOperationUnavailable);assert.deepEqual(fixed,[1,2]);
 const overridden=as3ArrayLiteral([1,2]);overridden.splice=()=>{throw Error('override must not run');};
 assert.throws(()=>as3ArrayCall(overridden,'splice',[0,1]),AS3ArrayOperationUnavailable);assert.equal(overridden.length,2);
 const reentrant=as3ArrayLiteral([1,2]);
 assert.throws(()=>as3ArrayCall(reentrant,'splice',[{valueOf(){throw Error('unproved reentry');}},1]),AS3ArrayOperationUnavailable);
 assert.deepEqual(reentrant,[1,2]);
});
