"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = fs.mkdtempSync(path.join(os.tmpdir(), "as3-timer-runtime-"));
const CONFIG = path.join(OUTPUT, "tsconfig.json");
fs.writeFileSync(CONFIG, JSON.stringify({
    compilerOptions: {
        target: "ES2022", module: "CommonJS", moduleResolution: "Node", strict: true,
        skipLibCheck: true, rootDir: path.join(ROOT, "src"), outDir: OUTPUT,
    },
    files: [
        path.join(ROOT, "src/hardened-runtime/AS3MethodClosure.ts"),
        path.join(ROOT, "src/hardened-runtime/AS3Timer.ts"),
        path.join(ROOT, "src/hardened-runtime/internal/AS3TimerRuntime.ts"),
    ],
}), "utf8");
childProcess.execFileSync(process.execPath,
    [path.join(ROOT, "node_modules/typescript-4-9/bin/tsc"), "-p", CONFIG], { cwd: ROOT, stdio: "inherit" });
const publicTimer = require(path.join(OUTPUT, "hardened-runtime/AS3Timer.js"));
assert.deepEqual(Object.keys(publicTimer).sort(), ["clearTimeout", "setTimeout"]);
assert.equal(publicTimer.AS3TimerRuntime, undefined);
const { setTimeout: as3SetTimeout, clearTimeout: as3ClearTimeout } = publicTimer;
const { AS3TimerRuntime } = require(path.join(OUTPUT, "hardened-runtime/internal/AS3TimerRuntime.js"));
const { as3BindMethod } = require(path.join(OUTPUT, "hardened-runtime/AS3MethodClosure.js"));

test.after(() => fs.rmSync(OUTPUT, { recursive: true, force: true }));

function fakeHost() {
    const scheduled = [];
    const cancelled = [];
    return {
        scheduled,
        cancelled,
        schedule(callback, delay) {
            const handle = Object.freeze({ sequence: scheduled.length + 1 });
            scheduled.push({ callback, delay, handle });
            return handle;
        },
        cancel(handle) { cancelled.push(handle); },
    };
}

test("uint ids, callback order, and args do not leak host timer handles", () => {
    const host = fakeHost();
    const timers = new AS3TimerRuntime(host, 3);
    const calls = [];
    const first = timers.setTimeout(function (...args) { calls.push(args); }, 10, "a", 2);
    const second = timers.setTimeout(() => calls.push(["second"]), 5);
    assert.deepEqual([first, second], [1, 2]);
    host.scheduled[1].callback();
    host.scheduled[0].callback();
    assert.deepEqual(calls, [["second"], ["a", 2]]);
    assert.equal(timers.setTimeout(() => {}, 0), 3);
    assert.equal(timers.setTimeout(() => {}, 0), 1, "completed one-shots release ids across wrap");
});

test("maintained this.method timer callback keeps receiver and stable identity", () => {
    const host = fakeHost();
    const timers = new AS3TimerRuntime(host);
    class Owner {
        constructor() {
            this.prefix = "owner";
            this.callback = as3BindMethod(this, this.callback);
        }
        callback(value) { this.result = `${this.prefix}:${value}`; }
    }
    const owner = new Owner();
    const callback = owner.callback;
    timers.setTimeout(owner.callback, 0, "timer");
    host.scheduled[0].callback();
    assert.equal(owner.result, "owner:timer");
    assert.equal(owner.callback, callback);
});

test("clearTimeout is idempotent and prevents a stale host callback", () => {
    const host = fakeHost();
    const timers = new AS3TimerRuntime(host);
    let called = false;
    const id = timers.setTimeout(() => { called = true; }, 20);
    timers.clearTimeout(id);
    timers.clearTimeout(id);
    timers.clearTimeout(0xffffffff + id);
    assert.deepEqual(host.cancelled, [host.scheduled[0].handle]);
    host.scheduled[0].callback();
    assert.equal(called, false);
});

test("delay normalization is deterministic and bounded before host admission", () => {
    const host = fakeHost();
    const timers = new AS3TimerRuntime(host);
    timers.setTimeout(() => {}, NaN);
    timers.setTimeout(() => {}, -1);
    timers.setTimeout(() => {}, 1.5);
    timers.setTimeout(() => {}, Infinity);
    assert.deepEqual(host.scheduled.map(item => item.delay), [0, 0, 1.5, 0x7fffffff]);
});

test("callback and scheduling errors escape without leaking live ids", () => {
    const host = fakeHost();
    const timers = new AS3TimerRuntime(host, 1);
    const expected = new Error("callback");
    timers.setTimeout(() => { throw expected; }, 0);
    assert.throws(() => host.scheduled[0].callback(), error => error === expected);
    assert.equal(timers.setTimeout(() => {}, 0), 1);

    const scheduleError = new Error("schedule");
    const failing = new AS3TimerRuntime({ schedule() { throw scheduleError; }, cancel() {} }, 1);
    assert.throws(() => failing.setTimeout(() => {}, 0), error => error === scheduleError);
});

test("allocation fails closed when the configured uint space is live", () => {
    const host = fakeHost();
    const timers = new AS3TimerRuntime(host, 2);
    timers.setTimeout(() => {}, 0);
    timers.setTimeout(() => {}, 0);
    assert.throws(() => timers.setTimeout(() => {}, 0), /id space is exhausted/);
});

test("default native host returns uint ids, invokes args, and cancels in real Node", async () => {
    const result = await new Promise((resolve, reject) => {
        const watchdog = globalThis.setTimeout(() => reject(new Error("native timer callback timed out")), 1_000);
        const id = as3SetTimeout((value) => {
            globalThis.clearTimeout(watchdog);
            resolve({ id, value });
        }, 0, "native");
        assert.equal(Number.isInteger(id) && id > 0 && id <= 0xffffffff, true);
    });
    assert.equal(result.value, "native");

    let cancelled = false;
    const cancelledId = as3SetTimeout(() => { cancelled = true; }, 5);
    as3ClearTimeout(cancelledId);
    as3ClearTimeout(cancelledId);
    await new Promise(resolve => globalThis.setTimeout(resolve, 25));
    assert.equal(cancelled, false);
});
