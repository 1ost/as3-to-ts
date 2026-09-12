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
const { AS3Dictionary, as3DictionarySlot } = require(path.join(OUTPUT, "hardened-runtime/AS3Dictionary.js"));

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

test("strong dictionaries preserve primitive and object key identity", () => {
    const dictionary = new AS3Dictionary();
    const first = {};
    const second = {};
    assert.equal(dictionary.set(first, "first"), "first");
    dictionary.set(second, "second");
    dictionary.set("1", "string");
    dictionary.set(1, "number");
    assert.equal(dictionary.get(first), "first");
    assert.equal(dictionary.get(second), "second");
    assert.equal(dictionary.get("1"), "string");
    assert.equal(dictionary.get(1), "number");
    assert.deepEqual([...dictionary.keys()], [first, second, "1", 1]);
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
