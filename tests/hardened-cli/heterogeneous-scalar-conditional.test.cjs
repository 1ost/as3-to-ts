"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const AIR = process.env.HARDENED_FIXTURE_AIR_SDK;
const LAYA = process.env.HARDENED_FIXTURE_LAYA;
const FFDEC = process.env.HARDENED_FIXTURE_FFDEC;

test("heterogeneous scalar conditionals preserve the selected value before explicit coercion",
    { skip: !(AIR && LAYA && FFDEC) }, t => {
        const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "scalar-conditional-")));
        t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
        const source = path.join(temporary, "source");
        const profile = path.join(temporary, "profile");
        fs.mkdirSync(source);
        const original = `package {
 public final class ConditionalProbe {
  public function render(flag:Boolean, item:int):String { return String(flag ? item : ""); }
  public function raw(flag:Boolean, item:int):* { return flag ? item : ""; }
 }
}\n`;
        fs.writeFileSync(path.join(source, "ConditionalProbe.as"), original);
        const run = (command, args, timeout = 120000) => {
            const result = childProcess.spawnSync(command, args, { cwd: ROOT, encoding: "utf8", timeout });
            assert.equal(result.status, 0, result.stdout + result.stderr);
            return result;
        };
        const makeProfile = () => run("python3", ["-B", "tools/create-fixture-profile.py",
            "--source", source, "--entry", "ConditionalProbe", "--air-sdk", AIR, "--laya", LAYA,
            "--ffdec-jar", FFDEC, "--output", profile]);
        const compile = (operation, name) => run(process.execPath, ["bin/as3-frontend", operation,
            source, path.join(temporary, name), "--source-census", path.join(profile, "census.json"),
            "--target-capabilities", path.join(LAYA, "docTool/architecture/authored-content-capabilities.json"),
            "--profile-lock", path.join(profile, "profile-lock.json")]);
        makeProfile();
        compile("transpile", "positive");
        const entry = require(path.join(temporary, "positive/__as3_runtime/ApplicationEntry.generated.js"));
        const Probe = entry.AS3_APPLICATION_MODULES.find(module => module.ConditionalProbe).ConditionalProbe;
        const probe = new Probe();
        assert.equal(probe.render(true, 17), "17");
        assert.equal(probe.render(false, 17), "");
        assert.equal(probe.raw(true, 17), 17);
        assert.equal(probe.raw(false, 17), "");
        const code = fs.readFileSync(path.join(temporary,
            "positive/__as3_runtime/application/ConditionalProbe.ts"), "utf8");
        assert.match(code, /String\(flag \? item : ""\)/);

        fs.writeFileSync(path.join(source, "BadReference.as"),
            `package { import flash.display.Sprite; public final class BadReference {
 public function run(flag:Boolean):* { return flag ? new Sprite() : ""; } } }\n`);
        fs.writeFileSync(path.join(source, "BadArray.as"),
            `package { public final class BadArray {
 public function run(flag:Boolean):* { return flag ? [1] : ""; } } }\n`);
        fs.rmSync(profile, { recursive: true, force: true });
        makeProfile();
        compile("qualify", "negative");
        const rows = JSON.parse(fs.readFileSync(path.join(temporary, "negative/manifest.json"), "utf8")).files;
        assert.equal(rows.find(row => row.sourcePath === "ConditionalProbe.as").status, "admitted");
        for (const name of ["BadReference.as", "BadArray.as"]) {
            const row = rows.find(candidate => candidate.sourcePath === name);
            assert.equal(row.status, "held", JSON.stringify(row));
            assert.equal(row.code, "HARDENED_CONDITIONAL_TYPE", JSON.stringify(row));
        }
        assert.equal(fs.readFileSync(path.join(source, "ConditionalProbe.as"), "utf8"), original);
    });
