"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = fs.mkdtempSync(path.join(os.tmpdir(), "as3-vector-runtime-"));
const CONFIG = path.join(OUTPUT, "tsconfig.json");
fs.writeFileSync(CONFIG, JSON.stringify({
    compilerOptions: {
        target: "ES2022", module: "CommonJS", moduleResolution: "Node", strict: true,
        skipLibCheck: true, rootDir: path.join(ROOT, "src"), outDir: OUTPUT,
    },
    files: [path.join(ROOT, "src/hardened-runtime/AS3Vector.ts")],
}), "utf8");
childProcess.execFileSync(process.execPath,
    [path.join(ROOT, "node_modules/typescript-4-9/bin/tsc"), "-p", CONFIG], { cwd: ROOT, stdio: "inherit" });
const runtime = require(path.join(OUTPUT, "hardened-runtime/AS3Vector.js"));
const { AS3Vector, AS3VectorPolicies, as3VectorReference, as3VectorType } = runtime;
const { as3As, as3Is } = require(path.join(OUTPUT, "hardened-runtime/AS3Type.js"));

test.after(() => fs.rmSync(OUTPUT, { recursive: true, force: true }));

test("typed defaults, coercion, bounds, iteration, and stable method closures", () => {
    const vector = new AS3Vector(AS3VectorPolicies.int, 3);
    assert.deepEqual([...vector], [0, 0, 0]);
    vector[0] = 4.9;
    vector[1] = -1;
    assert.deepEqual([...vector], [4, -1, 0]);
    assert.equal(vector.push, vector.push);
    assert.throws(() => vector[3], RangeError);
    assert.throws(() => { vector[3] = 1; }, RangeError);
    assert.equal(0 in vector, true);
    assert.equal(3 in vector, false);
});

test("fixed vectors reject every length mutation without partial coercion", () => {
    const vector = new AS3Vector(AS3VectorPolicies.uint, 2, true);
    vector[0] = -1;
    assert.equal(vector[0], 0xffffffff);
    assert.throws(() => vector.push(1), /fixed Vector/);
    assert.throws(() => vector.pop(), /fixed Vector/);
    assert.throws(() => { vector.length = 1; }, /fixed Vector/);
    assert.deepEqual([...vector], [0xffffffff, 0]);
    vector.fixed = false;
    assert.equal(vector.push(2), 3);
});

test("conversion and mutators preserve the element policy", () => {
    const vector = AS3Vector.from(AS3VectorPolicies.int, [1.9, 2.1, 3.8]);
    const removed = vector.splice(1, 1, 7.7, 8.8);
    assert.deepEqual([...vector], [1, 7, 8, 3]);
    assert.deepEqual([...removed], [2]);
    assert.deepEqual([...vector.slice(1, 3)], [7, 8]);
    assert.deepEqual([...vector.concat([9.4])], [1, 7, 8, 3, 9]);
    assert.equal(vector.join("|"), "1|7|8|3");
});

test("reference policies default to null and fail closed on incompatible writes", () => {
    class Item { constructor(readonly) { this.value = readonly; } }
    const policy = as3VectorReference("Item", Item);
    const vector = new AS3Vector(policy, 1);
    assert.equal(vector[0], null);
    const item = new Item(1);
    vector[0] = item;
    assert.equal(vector[0], item);
    assert.throws(() => { vector[0] = {}; }, /incompatible/);
    assert.equal(vector[0], item);
});

test("callback APIs expose the proxied vector identity", () => {
    const vector = AS3Vector.from(AS3VectorPolicies.int, [1, 2, 3]);
    const seen = [];
    vector.forEach((value, index, owner) => seen.push([value, index, owner === vector]));
    assert.deepEqual(seen, [[1, 0, true], [2, 1, true], [3, 2, true]]);
    assert.deepEqual([...vector.filter(value => value > 1)], [2, 3]);
    assert.deepEqual([...vector.map(value => value * 2)], [2, 4, 6]);
    assert.equal(vector.every(value => value > 0), true);
    assert.equal(vector.some(value => value === 2), true);
});

test("specialized Vector runtime types preserve element policy identity", () => {
    const ints = AS3Vector.from(AS3VectorPolicies.int, [1, 2]);
    const uints = AS3Vector.from(AS3VectorPolicies.uint, [1, 2]);
    const intType = as3VectorType(AS3VectorPolicies.int);
    assert.equal(as3Is(ints, intType), true);
    assert.equal(as3Is(uints, intType), false);
    assert.equal(as3As(ints, intType), ints);
    assert.equal(as3As([], intType), null);
});
