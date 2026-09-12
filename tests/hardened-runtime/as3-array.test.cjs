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
