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
