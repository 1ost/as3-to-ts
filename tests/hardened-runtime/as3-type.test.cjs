"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = fs.mkdtempSync(path.join(os.tmpdir(), "as3-type-runtime-"));
const CONFIG = path.join(OUTPUT, "tsconfig.json");
fs.writeFileSync(CONFIG, JSON.stringify({
    compilerOptions: {
        target: "ES2022", module: "CommonJS", moduleResolution: "Node", strict: true,
        skipLibCheck: true, rootDir: path.join(ROOT, "src"), outDir: OUTPUT,
    },
    files: [path.join(ROOT, "src/hardened-runtime/AS3Type.ts")],
}), "utf8");
childProcess.execFileSync(process.execPath,
    [path.join(ROOT, "node_modules/typescript-4-9/bin/tsc"), "-p", CONFIG], { cwd: ROOT, stdio: "inherit" });
const runtime = require(path.join(OUTPUT, "hardened-runtime/AS3Type.js"));
const { AS3Types, as3As, as3ClassType, as3InterfaceType, as3Is, as3RegisterInterfaces } = runtime;

test.after(() => fs.rmSync(OUTPUT, { recursive: true, force: true }));

test("primitive AS3 runtime tests distinguish int, uint, Number, and references", () => {
    assert.equal(as3Is(1, AS3Types.int), true);
    assert.equal(as3Is(0xffffffff, AS3Types.int), false);
    assert.equal(as3Is(0xffffffff, AS3Types.uint), true);
    assert.equal(as3Is(1.5, AS3Types.Number), true);
    assert.equal(as3Is(1.5, AS3Types.int), false);
    assert.equal(as3Is("x", AS3Types.String), true);
    assert.equal(as3Is(null, AS3Types.Object), false);
    assert.equal(as3As(1, AS3Types.String), null);
    assert.equal(as3As(null, AS3Types.String), null);
});

test("class tests use the canonical prototype chain and failed as returns null", () => {
    class Base {}
    class Child extends Base {}
    const baseType = as3ClassType("test.Base", Base);
    const child = new Child();
    assert.equal(as3Is(child, baseType), true);
    assert.equal(as3As(child, baseType), child);
    assert.equal(as3As({}, baseType), null);
    assert.equal(as3ClassType("test.Base", Base), baseType);
    assert.throws(() => as3ClassType("other.Base", Base), /different identity/);
});

test("interfaces are nominal registrations inherited through classes", () => {
    class Base {}
    class Child extends Base {}
    const runnable = as3InterfaceType("test.IRunnable");
    assert.equal(as3InterfaceType("test.IRunnable"), runnable, "interface identity is stable by authenticated name");
    as3RegisterInterfaces(Base, [runnable]);
    assert.equal(as3Is(new Base(), runnable), true);
    assert.equal(as3Is(new Child(), runnable), true);
    assert.equal(as3Is({}, runnable), false);
});

test("forged runtime type tokens fail closed", () => {
    const forged = Object.freeze({ name: "forged", test: () => true });
    assert.throws(() => as3Is({}, forged), /authenticated token/);
    assert.throws(() => as3As({}, forged), /authenticated token/);
    assert.throws(() => as3RegisterInterfaces(class Example {}, [forged]), /authenticated token/);
});
