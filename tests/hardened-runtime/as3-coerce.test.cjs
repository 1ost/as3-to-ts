"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = fs.mkdtempSync(path.join(os.tmpdir(), "as3-coerce-runtime-"));
const CONFIG = path.join(OUTPUT, "tsconfig.json");
fs.writeFileSync(CONFIG, JSON.stringify({
    compilerOptions: { target: "ES2022", module: "CommonJS", strict: true, rootDir: path.join(ROOT, "src"), outDir: OUTPUT },
    files: [path.join(ROOT, "src/hardened-runtime/AS3Coerce.ts"), path.join(ROOT, "src/hardened-runtime/AS3Object.ts")],
}), "utf8");
childProcess.execFileSync(process.execPath,
    [path.join(ROOT, "node_modules/typescript-4-9/bin/tsc"), "-p", CONFIG], { cwd: ROOT, stdio: "inherit" });
const { as3Boolean, as3Int, as3Number, as3String, as3Uint, as3Object } =
    require(path.join(OUTPUT, "hardened-runtime/AS3Coerce.js"));

const { as3ObjectLiteral } = require(path.join(OUTPUT, "hardened-runtime/AS3Object.js"));
const metadata={schema:"as3-runtime-type-authority@1",qnames:[],entries:[]};
require(path.join(OUTPUT,"hardened-runtime/internal/AS3TypeRegistry.js")).installAS3TypeAuthority({
    schema:metadata.schema,sha256:require("node:crypto").createHash("sha256").update(JSON.stringify(metadata)).digest("hex"),
    qnames:metadata.qnames,entries:metadata.entries});

test.after(() => fs.rmSync(OUTPUT, { recursive: true, force: true }));

test("global isNaN retains native Number conversion and missing-argument behavior", () => {
    const {as3IsNaN}=require(path.join(OUTPUT,"hardened-runtime/AS3Coerce.js"));
    assert.equal(as3IsNaN(),true);
    for(const value of [undefined,NaN,"NaN","1x",[1,2],{}]) assert.equal(as3IsNaN(value),true);
    for(const value of [null,true,false,Infinity,-Infinity,""," ","12","0x10",[],[1]])
        assert.equal(as3IsNaN(value),false);
    const calls=[];
    assert.equal(as3IsNaN({valueOf(){calls.push("number");return NaN;}}),true);
    assert.deepEqual(calls,["number"]);
    calls.length=0;
    assert.equal(as3IsNaN({valueOf(){calls.push("number");return {};},toString(){calls.push("text");return "7";}}),false);
    assert.deepEqual(calls,["number","text"]);
    const failure=new Error("conversion");
    assert.throws(()=>as3IsNaN({valueOf(){throw failure;}}),error=>error===failure);
});

test("String split retains Flash empty and nullish argument behavior", () => {
    const {as3StringSplit}=require(path.join(OUTPUT,"hardened-runtime/AS3Coerce.js"));
    assert.deepEqual(as3StringSplit("",[""]),[""]);
    assert.deepEqual(as3StringSplit("aundefinedb",[undefined]),["a","b"]);
    assert.deepEqual(as3StringSplit("a,b,",[",",null]),["a","b",""]);
    assert.deepEqual(as3StringSplit("a,b,",[",",undefined]),["a","b",""]);
    assert.deepEqual(as3StringSplit("a,b,",[",",NaN]),[]);
    assert.deepEqual(as3StringSplit("a,b,",[",",4294967296]),[]);
    assert.deepEqual(as3StringSplit("a,b",[]),["a,b"]);
});

test("String split runs limit conversion first and skips unused delimiter hooks", () => {
    const {as3StringSplit}=require(path.join(OUTPUT,"hardened-runtime/AS3Coerce.js"));
    const calls=[];
    const separator={toString(){calls.push("separator");return ",";}};
    const limit={valueOf(){calls.push("limit");return 2;}};
    assert.deepEqual(as3StringSplit("a,b,c",[separator,limit]),["a","b"]);
    assert.deepEqual(calls,["limit","separator"]);
    calls.length=0;
    assert.deepEqual(as3StringSplit("a,b",[separator,0]),[]);
    assert.deepEqual(as3StringSplit("",[separator]),[""]);
    assert.throws(()=>as3StringSplit(null,[separator,limit]),error=>error.errorID===1009);
    assert.deepEqual(calls,[]);
});

test("dynamic string split uses the shared native operation", () => {
    const {as3ObjectCall}=require(path.join(OUTPUT,"hardened-runtime/AS3ObjectDispatch.js"));
    assert.deepEqual(as3ObjectCall("1|2||","split",["|"]),["1","2","",""]);
    const {as3StringSplit}=require(path.join(OUTPUT,"hardened-runtime/AS3Coerce.js"));
    assert.throws(()=>as3StringSplit("a,b",[/,/]),/Unregistered Object receiver/);
    assert.throws(()=>as3StringSplit("a,b",[",",1,2]),/at most two arguments/);
});

test("int and uint preserve AVM-compatible 32-bit coercion", () => {
    assert.equal(as3Int(), 0);
    assert.equal(as3Int(0xffffffff), -1);
    assert.equal(as3Int(1.9), 1);
    assert.equal(as3Int(Number.NaN), 0);
    assert.equal(as3Int(Number.POSITIVE_INFINITY), 0);
    assert.equal(as3Uint(), 0);
    assert.equal(as3Uint(-1), 0xffffffff);
    assert.equal(as3Uint(0x100000000), 0);
});

test("Number, Boolean, and String retain call-form conversion behavior", () => {
    assert.equal(as3Number(), 0);
    assert.ok(Number.isNaN(as3Number("not-a-number")));
    assert.equal(as3Boolean(), false);
    assert.equal(as3Boolean(""), false);
    assert.equal(as3Boolean("false"), true);
    assert.equal(as3String(), "");
    assert.equal(as3String(null), "null");
    assert.equal(as3String(undefined), "undefined");
});

test("Object slot conversion normalizes undefined while preserving value identity", () => {
    assert.equal(as3Object(undefined), null);
    for (const value of [null, false, 0, 7, "", "text", {}, [], () => {}])
        assert.equal(as3Object(value), value);
});

// Native AIR ObjectValuesProbe retains the source-order side effects and first
// duplicate value. Special public names must remain enumerable data properties.
test("AVM object literals preserve duplicate evaluation and special keys", () => {
    let calls = 0;
    const value = as3ObjectLiteral([["__proto__", "data"], ["constructor", "ctor"],
        ["prototype", "proto"], ["stage", ++calls], ["stage", ++calls]]);
    assert.equal(calls, 2);
    assert.equal(value.stage, 1);
    assert.equal(Object.getPrototypeOf(value), Object.prototype);
    const roundtrip = JSON.parse(JSON.stringify(value));
    for (const [key, expected] of [["__proto__", "data"], ["constructor", "ctor"], ["prototype", "proto"]]) {
        assert.equal(Object.hasOwn(value, key), true);
        assert.equal(roundtrip[key], expected);
        assert.equal(delete value[key], true);
    }
    assert.equal(value.toString(), "[object Object]");
});

const {as3StringLength,as3ErrorToString}=require(path.join(OUTPUT,'hardened-runtime/AS3Coerce.js'));
test('String and Error primitive members retain null errors and reject unsupported receivers',()=>{
 assert.equal(as3StringLength('a😀b'),4);
 assert.throws(()=>as3StringLength(null),{name:'TypeError',errorID:1009,
  message:'Error #1009: Cannot access a property or method of a null object reference.'});
 assert.throws(()=>as3ErrorToString(null),{name:'TypeError',errorID:1009});
 assert.throws(()=>as3StringLength({length:4}),{name:'AS3ObjectDispatchUnavailable'});
 const error=new Error('message');error.toString=()=> 'custom';
 assert.throws(()=>as3ErrorToString(error),{name:'AS3ObjectDispatchUnavailable'});
});

const {as3ObjectConversion}=require(path.join(OUTPUT,"hardened-runtime/AS3Coerce.js"));
test("explicit Object conversion preserves values and allocates fresh nullish objects", () => {
    const a=as3ObjectConversion(null), b=as3ObjectConversion(undefined);
    assert.deepEqual(a,{}); assert.deepEqual(b,{}); assert.notEqual(a,b);
    for (const value of [7,"text",false,[],{},NaN]) assert.equal(as3ObjectConversion(value),value);
    assert.equal(as3Object(undefined),null);
});

test("native Error IDs default to zero and retain explicit runtime IDs without invoking accessors",()=>{
    const {as3ErrorID}=require(path.join(OUTPUT,"hardened-runtime/AS3Coerce.js"));
    assert.equal(as3ErrorID(new Error()),0);
    assert.equal(as3ErrorID(new Error("message")),0);
    const error=new TypeError("null");Object.defineProperty(error,"errorID",{value:1009});
    assert.equal(as3ErrorID(error),1009);
    const getter=new Error();Object.defineProperty(getter,"errorID",{get(){throw new Error("must not run");}});
    assert.throws(()=>as3ErrorID(getter),/integer native error slot/);
    assert.throws(()=>as3ErrorID(null),error=>error.errorID === 1009);
});


test("ArgumentError retains raw messages, native IDs and lazy string conversion",()=>{
    const {AS3ArgumentError}=require(path.join(OUTPUT,"hardened-runtime/AS3Error.js"));
    const {as3ErrorToString,as3ErrorID}=require(path.join(OUTPUT,"hardened-runtime/AS3Coerce.js"));
    const empty=new AS3ArgumentError();
    assert.equal(empty.message,"");assert.equal(as3ErrorToString(empty),"ArgumentError");
    for(const message of ["", "Missing three-state UI skin: button", null, undefined, 37]) {
        const error=new AS3ArgumentError(message);
        assert.ok(error instanceof Error);
        assert.equal(error.message,message);
        assert.equal(as3ErrorID(error),0);
        const expected=message === "" ? "ArgumentError" : "ArgumentError: "+String(message);
        assert.equal(as3ErrorToString(error),expected);assert.equal(as3String(error),expected);
    }
    assert.equal(as3ErrorID(new AS3ArgumentError("identified",-7)),-7);
    assert.equal(as3ErrorID(new AS3ArgumentError("wrapped",4294967295)),-1);
    let conversions=0;
    const message={toString(){conversions++;return "deferred";}};
    const error=new AS3ArgumentError(message);
    assert.equal(error.message,message);assert.equal(conversions,0);
    assert.throws(()=>new AS3ArgumentError("message","id"),/proven numeric/);
    class Unproved extends AS3ArgumentError {}
    assert.throws(()=>as3ErrorToString(new Unproved()),/canonical native Error/);
});
