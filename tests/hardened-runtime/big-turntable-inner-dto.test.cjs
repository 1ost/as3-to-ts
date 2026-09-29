"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = fs.mkdtempSync(path.join(os.tmpdir(), "big-turntable-inner-dto-"));
const CONFIG = path.join(OUTPUT, "tsconfig.json");
fs.writeFileSync(CONFIG, JSON.stringify({
    compilerOptions: {
        target: "ES2022", module: "CommonJS", moduleResolution: "Node", strict: true,
        skipLibCheck: true, rootDir: path.join(ROOT, "src"), outDir: OUTPUT,
    },
    files: [path.join(ROOT, "src/hardened-runtime/AS3BigTurnTableInnerDto.ts")],
}), "utf8");
childProcess.execFileSync(process.execPath,
    [path.join(ROOT, "node_modules/typescript-4-9/bin/tsc"), "-p", CONFIG], { cwd: ROOT, stdio: "inherit" });
const runtime = require(path.join(OUTPUT, "hardened-runtime/AS3BigTurnTableInnerDto.js"));

test.after(() => fs.rmSync(OUTPUT, { recursive: true, force: true }));

function fixture() {
    return [{
        index: 105, getType: 1, costChip: [{ index: 2, value: 150 }], award: [21401498],
        des: "Spend %0 Gold Value to draw once", flag: [1, 0, 0, 1, 1, 0],
    }];
}

function decode(value = fixture()) {
    return runtime.as3DecodeBigTurnTableInnerConfig(JSON.stringify(value));
}

test("the producer decoder creates one private config identity and immutable typed snapshot", () => {
    const input = decode();
    const entry = runtime.as3BigTurnTableInnerEntry(input, 0);
    assert.equal(runtime.BIG_TURN_TABLE_INNER_SCHEMA, "bleach-big-turn-table-inner-config@1");
    assert.deepEqual(entry, fixture()[0]);
    assert.ok(Object.isFrozen(entry));
    assert.ok(Object.isFrozen(entry.costChip));
    assert.ok(Object.isFrozen(entry.costChip[0]));
    assert.ok(Object.isFrozen(entry.award));
    assert.ok(Object.isFrozen(entry.flag));
    input[0].costChip[0].value = 999;
    input[0].flag[0] = 9;
    assert.equal(entry.costChip[0].value, 150);
    assert.equal(entry.flag[0], 1);
    assert.strictEqual(runtime.as3BigTurnTableInnerEntry(input, 0), entry);
});

test("Gold and Lucky payloads share one decoder-owned branded projection", () => {
    const luckyValue = fixture();
    luckyValue[0].index = 100;
    luckyValue[0].costChip[0].value = 100;
    luckyValue[0].des = "Spend %0 Lucky Value to draw once";
    const gold = decode();
    const lucky = decode(luckyValue);
    const goldEntry = runtime.as3BigTurnTableInnerEntry(gold, 0);
    const luckyEntry = runtime.as3BigTurnTableInnerEntry(lucky, 0);
    assert.equal(goldEntry.index, 105);
    assert.equal(luckyEntry.index, 100);
    assert.notStrictEqual(goldEntry, luckyEntry);
    assert.strictEqual(runtime.as3BigTurnTableInnerEntry(gold, 0), goldEntry);
    assert.strictEqual(runtime.as3BigTurnTableInnerEntry(lucky, 0), luckyEntry);
    assert.deepEqual(Reflect.ownKeys(goldEntry).sort(), Reflect.ownKeys(luckyEntry).sort());
});

test("arbitrary objects and proxies are rejected before any target reflection", () => {
    for (const input of [fixture(), {}, [], Object.create(null)]) {
        assert.throws(() => runtime.as3BigTurnTableInnerEntry(input, 0), TypeError);
    }
    const valid = decode();
    let traps = 0;
    const handler = {
        get() { traps += 1; throw new Error("get trap"); },
        getPrototypeOf() { traps += 1; throw new Error("prototype trap"); },
        ownKeys() { traps += 1; throw new Error("ownKeys trap"); },
        getOwnPropertyDescriptor() { traps += 1; throw new Error("descriptor trap"); },
    };
    const plainProxy = new Proxy(fixture(), handler);
    const validProxy = new Proxy(valid, handler);
    assert.throws(() => runtime.as3BigTurnTableInnerEntry(plainProxy, 0), TypeError);
    assert.throws(() => runtime.as3BigTurnTableInnerEntry(validProxy, 0), TypeError);
    assert.equal(traps, 0);
    assert.throws(() => runtime.as3BigTurnTableInnerEntry(valid, 1), TypeError);
});

test("strict source JSON rejects ambiguity, malformed text, and unbounded input", () => {
    const valid = JSON.stringify(fixture());
    const rejected = [
        "", "\ufeff" + valid, valid + "\0", valid + "\r", valid + " trailing",
        '[{"award":[1],"costChip":[{"index":2,"value":3}],"des":"x","flag":[1,2,3,4,5,6],"getType":1,"index":1,"index":2}]',
        '[{"award":[1],"costChip":[{"index":2,"value":3}],"des":"\\ud800","flag":[1,2,3,4,5,6],"getType":1,"index":1}]',
        "[".repeat(34) + "0" + "]".repeat(34),
        " ".repeat(0x10001),
    ];
    for (const raw of rejected) {
        assert.throws(() => runtime.as3DecodeBigTurnTableInnerConfig(raw), TypeError);
    }
});

test("decoded root and nested collections must match the exact dense tracked shape", () => {
    const cases = [];
    cases.push(null, {}, [], [fixture()[0], fixture()[0]]);
    const emptyRoot = fixture(); emptyRoot.length = 0; cases.push(emptyRoot);
    const extraEntry = fixture(); extraEntry[0].extra = true; cases.push(extraEntry);
    const missingAward = fixture(); delete missingAward[0].award; cases.push(missingAward);
    const emptyCost = fixture(); emptyCost[0].costChip = []; cases.push(emptyCost);
    const extraCost = fixture(); extraCost[0].costChip[0].extra = 1; cases.push(extraCost);
    const shortFlag = fixture(); shortFlag[0].flag.pop(); cases.push(shortFlag);
    for (const value of cases) {
        assert.throws(() => decode(value), TypeError);
    }
});

test("all numeric and textual leaves are validated without coercion", () => {
    const rawCases = [
        value => { value[0].index = 1.5; },
        value => { value[0].getType = null; },
        value => { value[0].costChip[0].value = 0x80000000; },
        value => { value[0].award[0] = "21401498"; },
        value => { value[0].flag[2] = "1"; },
        value => { value[0].des = null; },
    ];
    for (const mutate of rawCases) {
        const value = fixture(); mutate(value);
        assert.throws(() => decode(value), TypeError);
    }
    const valid = JSON.stringify(fixture());
    assert.throws(() => runtime.as3DecodeBigTurnTableInnerConfig(valid.replace('"index":105', '"index":-0')), TypeError);
    assert.throws(() => runtime.as3DecodeBigTurnTableInnerConfig(valid.replace('"index":105', '"index":1e999')), TypeError);
    for (const lossyLexeme of ["2147483647.0000001", "1.00000000000000001", "1e-400"]) {
        assert.throws(() => runtime.as3DecodeBigTurnTableInnerConfig(
            valid.replace('"index":105', `"index":${lossyLexeme}`)), TypeError);
    }
    for (const outOfRange of ["2147483648", "-2147483649", "999999999999999999999999999999999999"]) {
        assert.throws(() => runtime.as3DecodeBigTurnTableInnerConfig(
            valid.replace('"index":105', `"index":${outOfRange}`)), TypeError);
    }
    for (const boundary of ["2147483647", "-2147483648"]) {
        const decoded = runtime.as3DecodeBigTurnTableInnerConfig(
            valid.replace('"index":105', `"index":${boundary}`));
        assert.equal(runtime.as3BigTurnTableInnerEntry(decoded, 0).index, Number(boundary));
    }
});
