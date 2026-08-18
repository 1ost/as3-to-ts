"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
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
assert.deepEqual(Object.keys(publicTimer).sort(),
    ["clearInterval", "clearTimeout", "getTimer", "setInterval", "setTimeout"]);
assert.equal(publicTimer.AS3TimerRuntime, undefined);
const { setTimeout: as3SetTimeout, clearTimeout: as3ClearTimeout,
    setInterval: as3SetInterval, clearInterval: as3ClearInterval, getTimer: as3GetTimer } = publicTimer;
const { AS3TimerRuntime } = require(path.join(OUTPUT, "hardened-runtime/internal/AS3TimerRuntime.js"));
const { as3BindMethod } = require(path.join(OUTPUT, "hardened-runtime/AS3MethodClosure.js"));

test.after(() => fs.rmSync(OUTPUT, { recursive: true, force: true }));

test("module load isolates missing, throwing, and nonfinite startup clocks from scheduling", () => {
    const probe = path.join(OUTPUT, "startup-clock-probe.cjs");
    fs.writeFileSync(probe, `"use strict";
const assert=require("node:assert/strict");
const scenario=process.argv[2];
let clockReads=0;
if(scenario==="missing")Object.defineProperty(globalThis,"performance",{configurable:true,value:undefined});
else if(scenario==="throwing")Object.defineProperty(globalThis,"performance",{configurable:true,get(){clockReads++;throw new Error("clock trap");}});
else {const reading=scenario==="nan"?NaN:scenario==="positive-infinity"?Infinity:-Infinity;Object.defineProperty(globalThis,"performance",{configurable:true,value:{now(){clockReads++;return reading;}}});}
const scheduled=[];const cancelled=[];
globalThis.setTimeout=(callback,delay)=>{const handle={kind:"timeout",sequence:scheduled.length+1};scheduled.push({callback,delay,handle});return handle;};
globalThis.clearTimeout=handle=>cancelled.push(handle);
globalThis.setInterval=(callback,delay)=>{const handle={kind:"interval",sequence:scheduled.length+1};scheduled.push({callback,delay,handle});return handle;};
globalThis.clearInterval=handle=>cancelled.push(handle);
const timer=require(process.env.AS3_TIMER_MODULE);
assert.deepEqual(Object.keys(timer).sort(),["clearInterval","clearTimeout","getTimer","setInterval","setTimeout"]);
const timeout=timer.setTimeout(()=>{},1);const interval=timer.setInterval(()=>{},2);
assert.deepEqual([timeout,interval],[1,2]);timer.clearInterval(timeout);timer.clearTimeout(interval);
assert.deepEqual(cancelled.map(handle=>handle.kind),["timeout","interval"]);
assert.throws(()=>timer.getTimer(),/captured epoch and monotonic clock/);
assert.equal(clockReads,scenario==="missing"?0:1,"getTimer must not replace a rejected startup epoch");
`, "utf8");
    const modulePath = path.join(OUTPUT, "hardened-runtime/AS3Timer.js");
    for (const scenario of ["missing", "throwing", "nan", "positive-infinity", "negative-infinity"]) {
        childProcess.execFileSync(process.execPath, [probe, scenario], {
            cwd: OUTPUT, env: { ...process.env, AS3_TIMER_MODULE: modulePath }, stdio: "inherit",
        });
    }
});

function fakeHost() {
    const scheduled = [];
    const cancelled = [];
    let current = 100;
    const host = {
        scheduled,
        cancelled,
        setNow(value) { current = value; },
        now() { return current; },
        scheduleTimeout(callback, delay) {
            const handle = Object.freeze({ sequence: scheduled.length + 1 });
            scheduled.push({ callback, delay, handle, kind: "timeout" });
            return handle;
        },
        cancelTimeout(handle) { cancelled.push({ handle, kind: "timeout" }); },
        scheduleInterval(callback, delay) {
            const handle = Object.freeze({ sequence: scheduled.length + 1 });
            scheduled.push({ callback, delay, handle, kind: "interval" });
            return handle;
        },
        cancelInterval(handle) { cancelled.push({ handle, kind: "interval" }); },
    };
    return host;
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
    assert.deepEqual(host.cancelled, [{ handle: host.scheduled[0].handle, kind: "timeout" }]);
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
    const failingHost = fakeHost();
    failingHost.scheduleTimeout = () => { throw scheduleError; };
    const failing = new AS3TimerRuntime(failingHost, 1);
    assert.throws(() => failing.setTimeout(() => {}, 0), error => error === scheduleError);

    const intervalScheduleError = new Error("interval schedule");
    const failingIntervalHost = fakeHost();
    failingIntervalHost.scheduleInterval = () => { throw intervalScheduleError; };
    const failingInterval = new AS3TimerRuntime(failingIntervalHost, 1);
    assert.throws(() => failingInterval.setInterval(() => {}, 0), error => error === intervalScheduleError);
    assert.equal(failingInterval.setTimeout(() => {}, 0), 1,
        "failed interval scheduling releases its shared uint id");
});

test("allocation fails closed when the configured uint space is live", () => {
    const host = fakeHost();
    const timers = new AS3TimerRuntime(host, 2);
    timers.setTimeout(() => {}, 0);
    timers.setTimeout(() => {}, 0);
    assert.throws(() => timers.setTimeout(() => {}, 0), /id space is exhausted/);
});

test("getTimer uses one monotonic epoch and exact signed-int32 millisecond wrapping", () => {
    const host = fakeHost();
    host.setNow(0);
    const timers = new AS3TimerRuntime(host, 5, 0);
    assert.equal(timers.getTimer(), 0);
    host.setNow(0.999);
    assert.equal(timers.getTimer(), 0, "fractional elapsed milliseconds truncate toward zero");
    host.setNow(0x7fffffff + 0.999);
    assert.equal(timers.getTimer(), 0x7fffffff);
    host.setNow(0x80000000);
    assert.equal(timers.getTimer(), -0x80000000);
    host.setNow(0xffffffff);
    assert.equal(timers.getTimer(), -1);
    host.setNow(0x100000000);
    assert.equal(timers.getTimer(), 0);
    host.setNow(0x100000001);
    assert.equal(timers.getTimer(), 1);
    host.setNow(1);
    assert.throws(() => timers.getTimer(), /nondecreasing monotonic clock/);
    host.setNow(Infinity);
    assert.throws(() => timers.getTimer(), /nondecreasing monotonic clock/);
    assert.throws(() => new AS3TimerRuntime(fakeHost(), 5, NaN), /finite monotonic reading/);
});

test("timeout-only scheduling does not require a clock until getTimer is called", () => {
    const base = fakeHost();
    const schedulerOnly = {
        scheduleTimeout: base.scheduleTimeout.bind(base), cancelTimeout: base.cancelTimeout.bind(base),
        scheduleInterval: base.scheduleInterval.bind(base), cancelInterval: base.cancelInterval.bind(base),
    };
    const timers = new AS3TimerRuntime(schedulerOnly);
    const id = timers.setTimeout(() => {}, 0);
    assert.equal(id, 1);
    assert.throws(() => timers.getTimer(), /captured epoch and monotonic clock/);
});

test("Pepper-proven cross-clearing shares one id and cancellation domain", () => {
    const evidenceRoot = path.join(ROOT, "tests/flash-oracle/native-timer");
    const golden = fs.readFileSync(path.join(evidenceRoot, "pepper-flash-26.txt"), "utf8");
    const provenance = JSON.parse(fs.readFileSync(path.join(evidenceRoot, "pepper-flash-26.json"), "utf8"));
    assert.equal(golden, "cross=0,0\ncontrol=2:alpha:2\nidsDistinct=true\ngetTimer=true:true\n");
    assert.deepEqual({
        schema: provenance.schema,
        fixture: provenance.fixture,
        captureScript: provenance.captureScript,
        captureScriptSha256: provenance.captureScriptSha256,
        compilerSha256: provenance.compilerSha256,
        playerglobalSha256: provenance.playerglobalSha256,
        pepperPluginSha256: provenance.pepperPluginSha256,
        swfSha256: provenance.swfSha256,
    }, {
        schema: "bleach-native-timer-pepper-oracle@1",
        fixture: "native-timer/RunMain.as",
        captureScript: "as3-to-layaair-porting-kit/tests/native-runtime/capture_flash_semantics.cjs",
        captureScriptSha256: "90b6758802d9d3e04ae999cca0c69e17e9a5effc7a0ca2f487648e4efaf62754",
        compilerSha256: "cc07d749e376715e650271a9875289e49d94234902fff5e5fae287c478c8557b",
        playerglobalSha256: "0e450154692d044b1758064825e072476421560c43f6a026b12df4cfda82e295",
        pepperPluginSha256: "be8016c4abbb7f2a5abcbd23ac18ba6f535d728ba1c8cfe332a70757b36c1b35",
        swfSha256: "b4850f287db9c150c0739caa8bb1cec3bb9c0c6fd1bec1b5e4890debd18f8306",
    });
    assert.equal(path.isAbsolute(provenance.fixture), false);
    assert.equal(/^[A-Za-z]:[\\/]/.test(provenance.fixture), false);
    assert.equal(crypto.createHash("sha256").update(golden).digest("hex"), provenance.resultSha256);
    assert.equal(crypto.createHash("sha256").update(fs.readFileSync(path.join(evidenceRoot, "RunMain.as")))
        .digest("hex"), provenance.fixtureSha256);

    const host = fakeHost();
    const timers = new AS3TimerRuntime(host, 3);
    const timeoutId = timers.setTimeout(() => {}, 10);
    const intervalId = timers.setInterval(() => {}, 10);
    assert.deepEqual([timeoutId, intervalId], [1, 2]);
    timers.clearInterval(timeoutId);
    timers.clearTimeout(intervalId);
    assert.deepEqual(host.cancelled, [
        { handle: host.scheduled[0].handle, kind: "timeout" },
        { handle: host.scheduled[1].handle, kind: "interval" },
    ]);
    host.scheduled.forEach(item => item.callback());
});

test("both clear functions uint-coerce ids and remain cross-kind idempotent", () => {
    const host = fakeHost();
    const timers = new AS3TimerRuntime(host, 2);
    const timeoutId = timers.setTimeout(() => {}, 1);
    timers.clearInterval(0x100000000 + timeoutId);
    timers.clearTimeout(timeoutId);
    const intervalId = timers.setInterval(() => {}, 1);
    timers.clearTimeout(0x100000000 + intervalId);
    timers.clearInterval(intervalId);
    timers.clearInterval(NaN);
    assert.deepEqual(host.cancelled, [
        { handle: host.scheduled[0].handle, kind: "timeout" },
        { handle: host.scheduled[1].handle, kind: "interval" },
    ]);
});

test("interval callbacks persist after throws and self-clear safely during reentrant id reuse", () => {
    const host = fakeHost();
    const timers = new AS3TimerRuntime(host, 1);
    const expected = new Error("interval callback");
    timers.setInterval(() => { throw expected; }, 1);
    assert.throws(() => host.scheduled[0].callback(), error => error === expected);
    assert.throws(() => host.scheduled[0].callback(), error => error === expected,
        "an uncaught callback error does not silently remove a repeating interval");
    timers.clearInterval(1);

    let calls = 0;
    let replacement = 0;
    const original = timers.setInterval(() => {
        calls++;
        timers.clearInterval(original);
        replacement = timers.setInterval(() => { calls += 10; }, 1);
    }, 1);
    assert.equal(original, 1);
    const stale = host.scheduled[1].callback;
    stale();
    assert.equal(replacement, 1, "released shared id may be reused during the callback");
    stale();
    assert.equal(calls, 1, "stale wrapper cannot target the replacement entry with the same id");
    host.scheduled[2].callback();
    assert.equal(calls, 11);
});

test("intervals preserve method closure receiver, arguments, registration order, and shared exhaustion", () => {
    const host = fakeHost();
    const timers = new AS3TimerRuntime(host, 2);
    class Owner {
        constructor() { this.values = []; this.callback = as3BindMethod(this, this.callback); }
        callback(...values) { this.values.push(values); }
    }
    const owner = new Owner();
    const intervalId = timers.setInterval(owner.callback, 4, "a", 2);
    const timeoutId = timers.setTimeout(() => owner.values.push(["timeout"]), 4);
    assert.deepEqual([intervalId, timeoutId], [1, 2]);
    assert.throws(() => timers.setInterval(() => {}, 4), /id space is exhausted/);
    host.scheduled[0].callback();
    host.scheduled[1].callback();
    host.scheduled[0].callback();
    assert.deepEqual(owner.values, [["a", 2], ["timeout"], ["a", 2]]);
});

test("default native host returns uint ids, invokes args, and cancels in real Node", async () => {
    const firstClock = as3GetTimer();
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
    assert.equal(as3GetTimer() >= firstClock, true);

    let intervalCalls = 0;
    await new Promise((resolve, reject) => {
        const watchdog = globalThis.setTimeout(() => reject(new Error("native interval callback timed out")), 1_000);
        const id = as3SetInterval((value) => {
            assert.equal(value, "native-interval");
            intervalCalls++;
            if (intervalCalls === 2) {
                as3ClearInterval(id);
                globalThis.clearTimeout(watchdog);
                resolve();
            }
        }, 1, "native-interval");
    });
    assert.equal(intervalCalls, 2);
});
