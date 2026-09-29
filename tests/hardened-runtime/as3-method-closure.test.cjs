"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = fs.mkdtempSync(path.join(os.tmpdir(), "as3-method-closure-"));
const CONFIG = path.join(OUTPUT, "tsconfig.json");
fs.writeFileSync(CONFIG, JSON.stringify({
    compilerOptions: {
        target: "ES2022", module: "CommonJS", moduleResolution: "Node", strict: true,
        skipLibCheck: true, rootDir: path.join(ROOT, "src"), outDir: OUTPUT,
    },
    files: [path.join(ROOT, "src/hardened-runtime/AS3MethodClosure.ts")],
}), "utf8");
childProcess.execFileSync(process.execPath,
    [path.join(ROOT, "node_modules/typescript-4-9/bin/tsc"), "-p", CONFIG], { cwd: ROOT, stdio: "inherit" });
const { as3BindMethod } = require(path.join(OUTPUT, "hardened-runtime/AS3MethodClosure.js"));

test.after(() => fs.rmSync(OUTPUT, { recursive: true, force: true }));

test("base and derived constructor admission preserves one virtual method closure", () => {
    const registeredTimers = [];
    const registeredListeners = new Set();

    class Base {
        constructor() {
            this.callback = as3BindMethod(this, this.callback);
            registeredTimers.push(this.callback);
            registeredListeners.add(this.callback);
        }
        callback(value) { return `base:${value}`; }
    }

    class Derived extends Base {
        constructor() {
            super();
            const baseRegistered = this.callback;
            this.callback = as3BindMethod(this, this.callback);
            assert.equal(this.callback, baseRegistered,
                "derived admission must not rebind the closure registered by base construction");
        }
        callback(value) { return `${this.prefix}:${value}`; }
    }

    const instance = new Derived();
    instance.prefix = "derived";
    assert.equal(registeredTimers[0]("timer"), "derived:timer", "method closure keeps its receiver");
    assert.equal(instance.callback, registeredTimers[0], "repeated method access keeps stable identity");
    assert.equal(registeredListeners.delete(instance.callback), true,
        "listener removal sees the same closure registered by the base constructor");
});

test("different receivers and methods never alias", () => {
    const left = { value: "left", read() { return this.value; } };
    const right = { value: "right", read: left.read };
    const leftRead = as3BindMethod(left, left.read);
    const rightRead = as3BindMethod(right, right.read);
    assert.notEqual(leftRead, rightRead);
    assert.equal(leftRead(), "left");
    assert.equal(rightRead(), "right");
    assert.equal(as3BindMethod(left, leftRead), leftRead, "admitting an already-bound closure is idempotent");
});

test("invalid receiver and target fail closed", () => {
    assert.throws(() => as3BindMethod(null, function () {}), TypeError);
    assert.throws(() => as3BindMethod({}, null), TypeError);
});
