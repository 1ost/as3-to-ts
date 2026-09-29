"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = fs.mkdtempSync(path.join(os.tmpdir(), "as3-dictionary-runtime-"));
const CONFIG = path.join(OUTPUT, "tsconfig.json");
fs.writeFileSync(CONFIG, JSON.stringify({
    compilerOptions: {
        target: "ES2022", module: "CommonJS", moduleResolution: "Node", strict: true,
        skipLibCheck: true, rootDir: path.join(ROOT, "src"), outDir: OUTPUT,
    },
    files: [path.join(ROOT, "src/hardened-runtime/AS3Dictionary.ts")],
}), "utf8");
childProcess.execFileSync(process.execPath,
    [path.join(ROOT, "node_modules/typescript-4-9/bin/tsc"), "-p", CONFIG], { cwd: ROOT, stdio: "inherit" });
const { AS3Dictionary, as3DictionarySlot, as3DictionaryValues, as3DictionaryIn } = require(path.join(OUTPUT, "hardened-runtime/AS3Dictionary.js"));

test.after(() => fs.rmSync(OUTPUT, { recursive: true, force: true }));

test("typed Dictionary slots preserve nominal identity and reject conversion hooks", () => {
    const value = new AS3Dictionary(true);
    assert.equal(as3DictionarySlot(value), value);
    assert.equal(as3DictionarySlot(null), null);
    assert.equal(as3DictionarySlot(undefined), null);
    let conversions = 0;
    const fake = { valueOf() { conversions++; return value; }, toString() { conversions++; return "Dictionary"; } };
    for (const input of [fake, {}, [], 7, "bad", Object.create(AS3Dictionary.prototype)])
        assert.throws(() => as3DictionarySlot(input), error => error instanceof TypeError && error.errorID === 1034);
    assert.equal(conversions, 0);
});

test("strong dictionaries retain object identity and native primitive property keys", () => {
    const dictionary = new AS3Dictionary();
    const first = {};
    const second = {};
    assert.equal(dictionary.set(first, "first"), "first");
    dictionary.set(second, "second");
    dictionary.set("1", "string");
    dictionary.set(1, "number");
    assert.equal(dictionary.get(first), "first");
    assert.equal(dictionary.get(second), "second");
    assert.equal(dictionary.get("1"), "number");
    assert.equal(dictionary.get(1), "number");
    assert.deepEqual([...dictionary.keys()], [first, second, "1"]);
    assert.equal(dictionary.delete(first), true);
    assert.equal(dictionary.delete(first), false);
});

test("weak dictionaries do not retain object keys through their iterable registry", () => {
    const dictionary = new AS3Dictionary(true);
    const objectKey = {};
    dictionary.set(objectKey, 7);
    dictionary.set("primitive", 8);
    assert.equal(dictionary.weakKeys, true);
    assert.equal(dictionary.get(objectKey), 7);
    assert.equal(dictionary.has(objectKey), true);
    assert.deepEqual([...dictionary.values()].sort(), [7, 8]);
    assert.equal(dictionary.delete(objectKey), true);
    assert.deepEqual([...dictionary.keys()], ["primitive"]);
    assert.throws(() => new AS3Dictionary(1), /weakKeys must be Boolean/);
});

test("native value enumeration skips null and retains slot conversion and callback identity", () => {
    assert.deepEqual([...as3DictionaryValues(null,"int")], []);
    assert.deepEqual([...as3DictionaryValues(undefined,"int")], []);
    for (const weak of [false,true]) {
        const dictionary=new AS3Dictionary(weak);
        const first={}, second={};
        dictionary.set(first,7);dictionary.set(second,"8");dictionary.set("primitive",3);
        const values=[...as3DictionaryValues(dictionary,"int")];
        assert.equal(values.length,3);assert.equal(values.reduce((a,b)=>a+b,0),18);
    }
    const dictionary=new AS3Dictionary(true), callback=()=>{};
    dictionary.set(callback,callback);
    assert.deepEqual([...as3DictionaryValues(dictionary,"Function")],[callback]);
    assert.throws(()=>[...as3DictionaryValues({},"*")], error=>error.errorID === 1034);
});

test("call and apply retain bound receivers, results and native null errors", () => {
    const {as3FunctionCall,as3FunctionApply}=require(path.join(OUTPUT,"hardened-runtime/AS3Function.js"));
    const owner={value:10}, alternate={value:100};
    const method=function(value=7){return this.value+value;}.bind(owner);
    assert.equal(as3FunctionCall(method,null,[]),17);
    assert.equal(as3FunctionCall(method,alternate,[8]),18);
    assert.equal(as3FunctionApply(method,alternate,[8]),18);
    for (const invoke of [as3FunctionCall,as3FunctionApply])
        assert.throws(()=>invoke(null,null,[]),error=>error instanceof TypeError && error.errorID === 1009);
    const overridden=function(){};
    overridden.call=()=>{throw new Error("must not execute");};
    assert.throws(()=>as3FunctionCall(overridden,null,[]),/Function.call needs a callable/);
});

test("native Dictionary membership includes inherited names without exposing host internals", () => {
    for (const weak of [false,true]) {
        const dictionary=new AS3Dictionary(weak), first={toString(){throw new Error("must not convert");}}, other={};
        dictionary.set(first,undefined);
        assert.equal(as3DictionaryIn(first,dictionary),true);
        assert.equal(as3DictionaryIn(other,dictionary),false);
        assert.equal(as3DictionaryIn("[object Object]",dictionary),false);
        for (const value of [1,true,null,undefined,NaN,-0,Infinity,1e21,1e-7]) {
            dictionary.set(value,undefined);
            assert.equal(as3DictionaryIn(String(value),dictionary),true);
            assert.equal(as3DictionaryIn(value,dictionary),true);
        }
        for (const key of ["constructor","toString","toLocaleString","valueOf","hasOwnProperty",
            "isPrototypeOf","propertyIsEnumerable","setPropertyIsEnumerable"])
            assert.equal(as3DictionaryIn(key,dictionary),true,key);
        for (const key of ["weakKeys","get","has","delete","keys","prototype","__proto__"])
            assert.equal(as3DictionaryIn(key,dictionary),false,key);
        dictionary.set("toString",undefined);
        assert.equal(dictionary.delete("toString"),true);
        assert.equal(as3DictionaryIn("toString",dictionary),true);
    }
    assert.throws(()=>as3DictionaryIn("key",null),error=>error.errorID===1009);
    for (const value of [{has(){return true;}},Object.create(AS3Dictionary.prototype)])
        assert.throws(()=>as3DictionaryIn("key",value),error=>error.errorID===1034);
    for (const key of [Symbol("key"),1n])
        assert.throws(()=>as3DictionaryIn(key,new AS3Dictionary()),/Host-only primitives/);
});
