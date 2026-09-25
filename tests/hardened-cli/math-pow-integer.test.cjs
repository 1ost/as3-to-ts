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

test("the shared Math.pow subset requires two statically integral operands",
    { skip: !(AIR && LAYA && FFDEC) }, t => {
        const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "math-pow-integer-")));
        t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
        const source = path.join(temporary, "source");
        const profile = path.join(temporary, "profile");
        fs.mkdirSync(source);
        fs.writeFileSync(path.join(source, "IntegerPowProbe.as"), `package {
 public final class IntegerPowProbe {
  public function value(base:int, exponent:int):Number { return Math.pow(base, exponent); }
  public function powerOfTwo(exponent:int):Number { return Math.pow(2, exponent); }
 }
}\n`);
        const run = (command, args, timeout = 120000) => {
            const result = childProcess.spawnSync(command, args, { cwd: ROOT, encoding: "utf8", timeout });
            assert.equal(result.status, 0, result.stdout + result.stderr);
            return result;
        };
        const makeProfile = () => run("python3", ["-B", "tools/create-fixture-profile.py",
            "--source", source, "--entry", "IntegerPowProbe", "--air-sdk", AIR,
            "--laya", LAYA, "--ffdec-jar", FFDEC, "--output", profile]);
        const compile = (operation, name) => run(process.execPath, ["bin/as3-frontend", operation,
            source, path.join(temporary, name), "--source-census", path.join(profile, "census.json"),
            "--target-capabilities", path.join(LAYA, "docTool/architecture/authored-content-capabilities.json"),
            "--profile-lock", path.join(profile, "profile-lock.json")]);
        assert.match(fs.readFileSync(path.join(LAYA,
            "tests/nativeFlashOracle/math-floor-bridge/sdk-Math.as.txt"), "utf8"),
            /public static native function pow\(param1:Number, param2:Number\) : Number;/);
        makeProfile();
        compile("transpile", "positive");
        const output = path.join(temporary, "positive");
        const code = fs.readFileSync(path.join(output,
            "__as3_runtime/application/IntegerPowProbe.ts"), "utf8");
        assert.match(code, /Math\.pow\(base, exponent\)/);
        const entry = require(path.join(output, "__as3_runtime/ApplicationEntry.generated.js"));
        const Probe = entry.AS3_APPLICATION_MODULES.find(module => module.IntegerPowProbe).IntegerPowProbe;
        const probe = new Probe();
        assert.deepEqual([[2, 0], [2, 4], [-2, 3], [4, -2]].map(values => probe.value(...values)),
            [1, 16, -8, 0.0625]);
        assert.equal(probe.powerOfTwo(4), 16);

        const hostiles = {
            PowNoArgs: "public function value():Number { return Math.pow(); }",
            PowOneArg: "public function value():Number { return Math.pow(2); }",
            PowExtraArg: "public function value():Number { return Math.pow(2, 3, 4); }",
            PowNumberBase: "public function value(base:Number):Number { return Math.pow(base, 2); }",
            PowNumberExponent: "public function value(exponent:Number):Number { return Math.pow(2, exponent); }",
            PowFractionLiteral: "public function value(exponent:int):Number { return Math.pow(2.5, exponent); }",
            PowString: 'public function value():Number { return Math.pow("2", 3); }',
        };
        for (const [name, body] of Object.entries(hostiles))
            fs.writeFileSync(path.join(source, `${name}.as`), `package { public final class ${name} { ${body} } }\n`);
        fs.rmSync(profile, { recursive: true, force: true });
        makeProfile();
        compile("qualify", "negative");
        const rows = JSON.parse(fs.readFileSync(path.join(temporary, "negative/manifest.json"), "utf8")).files;
        for (const name of Object.keys(hostiles)) {
            const row = rows.find(candidate => candidate.sourcePath === `${name}.as`);
            assert.equal(row.status, "held", JSON.stringify(row));
            assert.equal(row.code, name === "PowNoArgs" || name === "PowOneArg" || name === "PowExtraArg"
                ? "HARDENED_MATH_ARITY" : "HARDENED_MATH_ARGUMENT", JSON.stringify(row));
        }
    });
