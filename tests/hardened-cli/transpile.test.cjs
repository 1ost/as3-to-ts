"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repository = path.resolve(__dirname, "../..");
const executable = path.join(repository, "bin", "as3-frontend");
const sourceCensus = process.env.HARDENED_SOURCE_CAPABILITY_CENSUS
    || "C:/Users/admin/Desktop/GITHUB REPO/bleach-services/as3-to-layaair-porting-kit/generated/reports/swf-capability-census.json";
const targetCapabilities = process.env.HARDENED_TARGET_CAPABILITIES
    || "C:/Users/admin/Desktop/GITHUB REPO/LayaAir/docTool/architecture/authored-content-capabilities.json";
const layaRoot = process.env.HARDENED_TARGET_REPO
    || "C:/Users/admin/Desktop/GITHUB REPO/LayaAir";

function temporaryDirectory(t) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "as3-transpile-test-"));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    return directory;
}

function write(directory, relativePath, content) {
    const target = path.join(directory, ...relativePath.split("/"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, "utf8");
}

function invoke(source, output, cwd) {
    return spawnSync(process.execPath, [executable, "transpile", source, output,
        "--source-census", sourceCensus, "--target-capabilities", targetCapabilities], {
        cwd,
        encoding: "utf8",
        timeout: 20_000,
        windowsHide: true,
    });
}

const admittedSource = [
    "package lobby.ui {",
    "    import flash.display.Sprite;",
    "    import flash.events.Event;",
    "    public class Demo extends Sprite {",
    "        private var label:String = \"ok\";",
    "        public function Demo() { super(); addEventListener(\"ready\", onEvent); }",
    "        public function onEvent(event:Event):void { label = \"changed\"; return; }",
    "    }",
    "}",
    "",
].join("\n");

test("transpiles the double-pinned structural subset deterministically", t => {
    const root = temporaryDirectory(t);
    const source = path.join(root, "source");
    const first = path.join(root, "first");
    const second = path.join(root, "second");
    fs.mkdirSync(source);
    write(source, "Demo.as", admittedSource);
    const firstRun = invoke(source, first, root);
    const secondRun = invoke(source, second, os.tmpdir());
    assert.equal(firstRun.status, 0, firstRun.stderr);
    assert.equal(secondRun.status, 0, secondRun.stderr);
    const modulePath = path.join("lobby", "ui", "Demo.ts");
    const firstCode = fs.readFileSync(path.join(first, modulePath), "utf8");
    const secondCode = fs.readFileSync(path.join(second, modulePath), "utf8");
    assert.equal(firstCode, secondCode);
    assert.match(firstCode, /import \{ Sprite \} from "laya\/flash\/display\/Sprite";/);
    assert.match(firstCode, /export class Demo extends Sprite/);
    assert.match(firstCode, /constructor\(\) \{\n\s+super\(\);/);
    assert.match(firstCode, /super\(\);\n\s+this\.onEvent = this\.onEvent\.bind\(this\);\n\s+this\.addEventListener\("ready", this\.onEvent\);/);
    assert.match(firstCode, /this\.label = "changed";/);
    const manifest = JSON.parse(fs.readFileSync(path.join(first, "manifest.json"), "utf8"));
    assert.equal(manifest.schema, "bleach.as3.transpile-manifest.v1");
    assert.equal(manifest.typeScriptVersion, "4.9.5");
    assert.equal(manifest.classification, "capability-authenticated-typescript-proposal");
    assert.equal(manifest.files[0].typescriptPath, "lobby/ui/Demo.ts");
    assert.equal(manifest.files[0].normalizedFingerprintSha256.length, 64);

    const tsconfig = path.join(root, "tsconfig.json");
    const bridgeTypes = path.join(root, "bridge-types.d.ts");
    fs.writeFileSync(bridgeTypes, [
        "declare module \"laya/flash/display/Sprite\" { export class Sprite { addEventListener(type: string, listener: Function): void; } }",
        "declare module \"laya/flash/events/Event\" { export class Event {} }",
        "",
    ].join("\n"), "utf8");
    fs.writeFileSync(tsconfig, JSON.stringify({
        compilerOptions: {
            target: "ES2020",
            module: "CommonJS",
            moduleResolution: "node",
            strict: true,
            skipLibCheck: true,
            noEmit: true,
            types: [],
            lib: ["ES2020"],
        },
        files: [bridgeTypes, path.join(first, modulePath)],
    }), "utf8");
    const compile = spawnSync(process.execPath,
        [path.join(layaRoot, "node_modules/typescript/bin/tsc"), "-p", tsconfig, "--pretty", "false"], {
            cwd: root, encoding: "utf8", timeout: 30_000, windowsHide: true,
        });
    assert.equal(compile.status, 0, `${compile.stdout}${compile.stderr}`);
});

test("unsupported syntax fails closed without publishing", t => {
    const root = temporaryDirectory(t);
    const source = path.join(root, "source");
    const output = path.join(root, "output");
    fs.mkdirSync(source);
    write(source, "Unsupported.as",
        "package p { public class Unsupported { public function f():void { while (true) {} } } }\n");
    const result = invoke(source, output, root);
    assert.equal(result.status, 4, result.stderr);
    assert.match(result.stderr, /PARSER_NORMALIZER_UNSUPPORTED_KIND/);
    assert.equal(fs.existsSync(output), false);
});

test("authority byte drift fails before output reservation", t => {
    const root = temporaryDirectory(t);
    const source = path.join(root, "source");
    const output = path.join(root, "output");
    const changedTarget = path.join(root, "target.json");
    fs.mkdirSync(source);
    write(source, "Demo.as", admittedSource);
    fs.writeFileSync(changedTarget, `${fs.readFileSync(targetCapabilities, "utf8")} `, "utf8");
    const result = spawnSync(process.execPath, [executable, "transpile", source, output,
        "--source-census", sourceCensus, "--target-capabilities", changedTarget], {
        cwd: root, encoding: "utf8", timeout: 20_000, windowsHide: true,
    });
    assert.equal(result.status, 6, result.stderr);
    assert.match(result.stderr, /capability authority rejected/);
    assert.equal(fs.existsSync(output), false);
});

test("qualification records holds without materializing TypeScript", t => {
    const root = temporaryDirectory(t);
    const source = path.join(root, "source");
    const output = path.join(root, "qualification");
    fs.mkdirSync(source);
    write(source, "Demo.as", admittedSource);
    write(source, "Unsupported.as",
        "package p { public class Unsupported { public function f():void { while (true) {} } } }\n");
    const result = spawnSync(process.execPath, [executable, "qualify", source, output,
        "--source-census", sourceCensus, "--target-capabilities", targetCapabilities], {
        cwd: root, encoding: "utf8", timeout: 20_000, windowsHide: true,
    });
    assert.equal(result.status, 0, result.stderr);
    const files = fs.readdirSync(output);
    assert.deepEqual(files, ["manifest.json"]);
    const report = JSON.parse(fs.readFileSync(path.join(output, "manifest.json"), "utf8"));
    assert.equal(report.schema, "bleach.as3.qualification-report.v1");
    assert.equal(report.generatedTypeScriptMaterialized, false);
    assert.equal(report.counts.admitted, 1);
    assert.equal(report.counts.PARSER_NORMALIZER_UNSUPPORTED_KIND, 1);
    assert.deepEqual(report.files.map(item => item.status), ["admitted", "held"]);
});
