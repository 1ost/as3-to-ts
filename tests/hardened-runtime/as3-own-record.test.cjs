"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = fs.mkdtempSync(path.join(os.tmpdir(), "as3-own-record-runtime-"));
const CONFIG = path.join(OUTPUT, "tsconfig.json");
fs.writeFileSync(CONFIG, JSON.stringify({
    compilerOptions: {
        target: "ES2022", module: "CommonJS", moduleResolution: "Node", strict: true,
        skipLibCheck: true, rootDir: path.join(ROOT, "src"), outDir: OUTPUT,
    },
    files: [path.join(ROOT, "src/hardened-runtime/AS3OwnRecord.ts")],
}), "utf8");
childProcess.execFileSync(process.execPath,
    [path.join(ROOT, "node_modules/typescript-4-9/bin/tsc"), "-p", CONFIG], { cwd: ROOT, stdio: "inherit" });
const { as3CreateOwnRecord, as3OwnRecordGet, as3OwnRecordSet } =
    require(path.join(OUTPUT, "hardened-runtime/AS3OwnRecord.js"));

test.after(() => fs.rmSync(OUTPUT, { recursive: true, force: true }));

test("local own records preserve missing-null and exact value identity", () => {
    const record = as3CreateOwnRecord();
    const value = { id: 1 };
    assert.equal(Object.getPrototypeOf(record), null);
    assert.equal(as3OwnRecordGet(record, "missing"), null);
    assert.equal(as3OwnRecordSet(record, "leaf", value), value);
    assert.equal(as3OwnRecordGet(record, "leaf"), value);
});

test("prototype-spelled keys remain inert own data descriptors", () => {
    const record = as3CreateOwnRecord();
    for (const key of ["__proto__", "constructor", "prototype", "toString"]) {
        const value = { key };
        as3OwnRecordSet(record, key, value);
        assert.equal(as3OwnRecordGet(record, key), value);
        const descriptor = Object.getOwnPropertyDescriptor(record, key);
        assert.deepEqual({ configurable: descriptor.configurable, enumerable: descriptor.enumerable,
            value: descriptor.value, writable: descriptor.writable },
        { configurable: true, enumerable: true, value, writable: true });
        assert.equal(descriptor.get, undefined);
        assert.equal(descriptor.set, undefined);
    }
    assert.equal(Object.getPrototypeOf(record), null);
});

test("forged ordinary and null-prototype objects fail the private record boundary", () => {
    for (const forged of [{}, Object.create(null)]) {
        assert.throws(() => as3OwnRecordGet(forged, "key"), TypeError);
        assert.throws(() => as3OwnRecordSet(forged, "key", {}), TypeError);
    }
    const record = as3CreateOwnRecord();
    const nullKeyValue = { key: "null" };
    as3OwnRecordSet(record, null, nullKeyValue);
    assert.equal(as3OwnRecordGet(record, "null"), nullKeyValue);
    assert.throws(() => as3OwnRecordSet(record, "rejected", null), TypeError);
    assert.equal(as3OwnRecordGet(record, "rejected"), null);
});

test("hostile proxies are rejected by identity without invoking traps", () => {
    const record = as3CreateOwnRecord();
    let traps = 0;
    const handler = new Proxy({}, {
        get(_target, _name) {
            traps += 1;
            return () => {
                traps += 1;
                throw new Error("proxy trap must not run");
            };
        },
    });
    const first = new Proxy(record, handler);
    const second = new Proxy(first, handler);
    for (const forged of [first, second]) {
        assert.throws(() => as3OwnRecordGet(forged, "key"), TypeError);
        assert.throws(() => as3OwnRecordSet(forged, "key", {}), TypeError);
    }
    assert.equal(traps, 0);
    assert.equal(as3OwnRecordSet(record, "key", record), record);
    assert.equal(as3OwnRecordGet(record, "key"), record);
});
