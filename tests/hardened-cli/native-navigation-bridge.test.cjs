"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const air = process.env.HARDENED_FIXTURE_AIR_SDK;
const laya = process.env.HARDENED_FIXTURE_LAYA;
const ffdec = process.env.HARDENED_FIXTURE_FFDEC;

test("native navigateToURL uses the authenticated LayaAir function", { skip: !air || !laya || !ffdec }, t => {
    const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "native-navigation-")));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const source = path.join(directory, "source");
    fs.mkdirSync(source);
    const program = target => `package {
        import flash.net.URLRequest;
        import flash.net.navigateToURL;
        public class NavigationProbe {
            public function open():void { navigateToURL(new URLRequest("https://example.test/")${target ? `, ${target}` : ""}); }
        }
    }`;
    const sourcePath = path.join(source, "NavigationProbe.as");
    const run = (command, args) => spawnSync(command, args, { cwd: root, encoding: "utf8", timeout: 120000 });
    const profile = target => {
        fs.writeFileSync(sourcePath, program(target));
        const output = path.join(directory, "profile-" + (target ? target.replace(/\W/g, "") : "default"));
        const result = run("python3", ["-B", "tools/create-fixture-profile.py", "--source", source,
            "--entry", "NavigationProbe", "--air-sdk", air, "--laya", laya,
            "--ffdec-jar", ffdec, "--output", output]);
        assert.equal(result.status, 0, result.stdout + result.stderr);
        return output;
    };
    const compile = (operation, authority, output) => run(process.execPath, ["bin/as3-frontend", operation,
        source, output, "--source-census", path.join(authority, "census.json"),
        "--target-capabilities", path.join(laya, "docTool/architecture/authored-content-capabilities.json"),
        "--profile-lock", path.join(authority, "profile-lock.json")]);

    const validProfile = profile('"_blank"');
    const validOutput = path.join(directory, "valid");
    const valid = compile("transpile", validProfile, validOutput);
    assert.equal(valid.status, 0, valid.stdout + valid.stderr);
    const generated = fs.readFileSync(path.join(validOutput, "__as3_runtime/application/NavigationProbe.ts"), "utf8");
    assert.match(generated, /import \{ navigateToURL \} from "laya\/flash\/net\/URLRequest";/);
    assert.match(generated, /navigateToURL\(new \(__as3InitializeClass\(URLRequest, false\)\)/);
    assert.doesNotMatch(generated, /__as3InitializeClass\(navigateToURL/);

    const defaultProfile = profile(null);
    const defaultOutput = path.join(directory, "default");
    const defaultTarget = compile("transpile", defaultProfile, defaultOutput);
    assert.equal(defaultTarget.status, 0, defaultTarget.stdout + defaultTarget.stderr);
    const defaultGenerated = fs.readFileSync(path.join(defaultOutput, "__as3_runtime/application/NavigationProbe.ts"), "utf8");
    assert.match(defaultGenerated, /navigateToURL\(new \(__as3InitializeClass\(URLRequest, false\)\).*"_blank"\)/);

    const invalidProfile = profile('"_self"');
    const invalidOutput = path.join(directory, "invalid");
    const invalid = compile("qualify", invalidProfile, invalidOutput);
    assert.equal(invalid.status, 0, invalid.stdout + invalid.stderr);
    const row = JSON.parse(fs.readFileSync(path.join(invalidOutput, "manifest.json"), "utf8")).files[0];
    assert.equal(row.status, "held");
    assert.equal(row.code, "HARDENED_NAVIGATION_ARGUMENT");
});
