"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const AIR = process.env.HARDENED_FIXTURE_AIR_SDK;
const LAYA = process.env.HARDENED_FIXTURE_LAYA && fs.realpathSync.native(process.env.HARDENED_FIXTURE_LAYA);
const LAYA_REVISION = "a3f690b422043c744e1146e7aaf88f1620f2d4e3";
const sha256 = bytes => crypto.createHash("sha256").update(bytes).digest("hex");

function run(command, args, timeout = 180_000) {
    const result = spawnSync(command, args, { cwd:ROOT, encoding:"utf8", timeout });
    assert.equal(result.status, 0, result.stdout + result.stderr);
}

test("AIR-proven apostrophe escape decodes with parity while broader escapes remain held", { skip:!AIR || !LAYA }, t => {
    const ancestry = spawnSync("git", ["-C", LAYA, "merge-base", "--is-ancestor", LAYA_REVISION, "HEAD"],
        { encoding:"utf8" });
    assert.equal(ancestry.status, 0, ancestry.stdout + ancestry.stderr);
    const fixture = path.join(LAYA, "tests/nativeFlashOracle/string-literal-apostrophe");
    const retained = JSON.parse(fs.readFileSync(path.join(fixture, "native-air.json"), "utf8"));
    const retainedSource = fs.readFileSync(path.join(fixture, "StringLiteralApostropheProbe.as"));
    assert.equal(sha256(retainedSource), "809d4e2784ba6a01d6edbeb8b602708269077970d4a73e9d5f90383c5365553d");
    assert.equal(retained.sourceFiles["StringLiteralApostropheProbe.as"], sha256(retainedSource));
    assert.equal(retained.capture.runtime.version, "MAC 51,3,3,2");
    assert.deepEqual(retained.capture.state.observations.map(row => [row.id, row.value, row.utf16]), [
        ["exact-config-load-manager-use", "Failed to resolve static class 'ConfigOwner': boom",
            [70,97,105,108,101,100,32,116,111,32,114,101,115,111,108,118,101,32,115,116,97,116,105,99,32,99,108,97,115,115,32,39,67,111,110,102,105,103,79,119,110,101,114,39,58,32,98,111,111,109]],
        ["plain-apostrophe-control", "left'right", [108,101,102,116,39,114,105,103,104,116]],
        ["even-two-backslashes", "left\\'right", [108,101,102,116,92,39,114,105,103,104,116]],
        ["odd-three-backslashes", "left\\'right", [108,101,102,116,92,39,114,105,103,104,116]],
        ["even-four-backslashes", "left\\\\'right", [108,101,102,116,92,92,39,114,105,103,104,116]],
    ]);

    const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "as3-apostrophe-literal-")));
    let completed = false;
    t.after(() => completed ? fs.rmSync(temporary, { recursive:true, force:true })
        : t.diagnostic("Retained failure: " + temporary));
    const source = path.join(temporary, "source");
    const profile = path.join(temporary, "profile");
    const output = path.join(temporary, "output");
    fs.mkdirSync(source);
    const admitted = String.raw`package { public class ApostropheLiteralProbe {
        public function exact(owner:String,message:String):String { return "Failed to resolve static class \'" + owner + "\': " + message; }
        public function plain():String { return "left'right"; }
        public function evenTwo():String { return "left\\'right"; }
        public function oddThree():String { return "left\\\'right"; }
        public function evenFour():String { return "left\\\\'right"; }
        public function jsonControl():String { return "quote:\" slash:\\ newline:\n unicode:\u0027"; }
    } }
`;
    fs.writeFileSync(path.join(source, "ApostropheLiteralProbe.as"), admitted);
    const held = {
        HeldVertical:String.raw`\v`,
        HeldHex:String.raw`\x27`,
        HeldZero:String.raw`\0`,
        HeldNonEscape:String.raw`\q`,
    };
    for (const [name, escape] of Object.entries(held))
        fs.writeFileSync(path.join(source, name + ".as"),
            `package { public class ${name} { public function run():String { return "left${escape}right"; } } }\n`);

    const profileArgs = ["-B", "tools/create-fixture-profile.py", "--source", source,
        "--entry", "ApostropheLiteralProbe", "--air-sdk", AIR, "--laya", LAYA, "--output", profile];
    run("python3", profileArgs);
    const authorityArgs = ["--source-census", path.join(profile, "census.json"),
        "--target-capabilities", path.join(LAYA, "docTool/architecture/authored-content-capabilities.json"),
        "--profile-lock", path.join(profile, "profile-lock.json")];
    run(process.execPath, ["bin/as3-frontend", "qualify", source, output, ...authorityArgs]);
    const rows = JSON.parse(fs.readFileSync(path.join(output, "manifest.json"), "utf8")).files;
    assert.equal(rows.find(row => row.sourcePath === "ApostropheLiteralProbe.as")?.status, "admitted");
    for (const name of Object.keys(held)) {
        const row = rows.find(value => value.sourcePath === name + ".as");
        assert.equal(row?.status, "held", JSON.stringify(row));
        assert.equal(row.code, "HARDENED_LITERAL_STRING", JSON.stringify(row));
        assert.match(row.message, /outside the admitted AS3 escape subset/);
    }

    for (const name of Object.keys(held)) fs.rmSync(path.join(source, name + ".as"));
    fs.rmSync(profile, { recursive:true });
    fs.rmSync(output, { recursive:true });
    run("python3", profileArgs);
    run(process.execPath, ["bin/as3-frontend", "transpile", source, output, ...authorityArgs]);
    const manifest = JSON.parse(fs.readFileSync(path.join(output, "manifest.json"), "utf8"));
    const row = manifest.files.find(value => value.sourcePath === "ApostropheLiteralProbe.as");
    assert.equal(typeof row?.typescriptPath, "string", JSON.stringify(row));
    const typescript = fs.readFileSync(path.join(output, row.typescriptPath), "utf8");
    assert.match(typescript, /return "Failed to resolve static class '" \+ owner \+ "': " \+ message;/);
    const runtimeRoot = path.join(output, "__as3_runtime");
    const javascript = fs.readFileSync(path.join(runtimeRoot, "application", "ApostropheLiteralProbe.js"), "utf8");
    const moduleValue = { exports:{} };
    Function("require", "module", "exports", javascript)(specifier => {
        if (specifier.endsWith("/AS3ClassInitialization"))
            return { as3DefineClassInitialization(){}, as3InitializeClass(){} };
        if (specifier.endsWith("/AS3Type")) return {};
        if (specifier.endsWith("/AS3Function")) return {
            as3CheckMethodArity(){},
            as3FunctionArgument(value){ return value; },
            as3DefineMethodLength(){},
        };
        throw new Error("Unexpected generated import: " + specifier);
    }, moduleValue, moduleValue.exports);
    const generated = moduleValue.exports;
    const instance = Object.create(generated.ApostropheLiteralProbe.prototype);
    assert.equal(instance.exact("ConfigOwner", "boom"), "Failed to resolve static class 'ConfigOwner': boom");
    assert.equal(instance.plain(), "left'right");
    assert.equal(instance.evenTwo(), "left\\'right");
    assert.equal(instance.oddThree(), "left\\'right");
    assert.equal(instance.evenFour(), "left\\\\'right");
    assert.equal(instance.jsonControl(), "quote:\" slash:\\ newline:\n unicode:'");
    completed = true;
});
