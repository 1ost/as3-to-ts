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

test.after(() => fs.rmSync(OUTPUT, { recursive: true, force: true }));

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
