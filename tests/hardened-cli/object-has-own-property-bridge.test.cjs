"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const AIR = process.env.HARDENED_FIXTURE_AIR_SDK;
const LAYA = process.env.HARDENED_FIXTURE_LAYA;
const FFDEC = process.env.HARDENED_FIXTURE_FFDEC;
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const canonical = value => value === null || typeof value !== "object" ? JSON.stringify(value)
    : Array.isArray(value) ? `[${value.map(canonical).join(",")}]`
        : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;

test("mapped Flash receivers use the authenticated shared Object.hasOwnProperty provider",
    { skip: !(AIR && LAYA && FFDEC) }, t => {
        const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "object-has-own-")));
        t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
        const source = path.join(temporary, "source");
        const profile = path.join(temporary, "profile");
        fs.mkdirSync(path.join(source, "view"), { recursive: true });
        fs.writeFileSync(path.join(source, "view/LoadingView.as"), `package view {
 import flash.display.Sprite;
 public dynamic class LoadingView extends Sprite { public var count:int = 3; }
}\n`);
        fs.writeFileSync(path.join(source, "ObjectHasOwnProbe.as"), `package {
 import flash.display.Sprite;
 import view.LoadingView;
 public final class ObjectHasOwnProbe {
  public function mapped(value:Sprite):Boolean { return value.hasOwnProperty("count"); }
  public function local(value:LoadingView):Boolean { return value.hasOwnProperty("count"); }
 }
}\n`);
        const run = (command, args, timeout = 120000) => {
            const result = childProcess.spawnSync(command, args, { cwd: ROOT, encoding: "utf8", timeout });
            assert.equal(result.status, 0, result.stdout + result.stderr);
            return result;
        };
        run("python3", ["-B", "tools/create-fixture-profile.py", "--source", source,
            "--entry", "ObjectHasOwnProbe", "--air-sdk", AIR, "--laya", LAYA,
            "--ffdec-jar", FFDEC, "--shared-object-has-own-property", "--output", profile]);
        const args = output => [source, output, "--source-census", path.join(profile, "census.json"),
            "--target-capabilities", path.join(LAYA, "docTool/architecture/authored-content-capabilities.json"),
            "--profile-lock", path.join(profile, "profile-lock.json")];
        const output = path.join(temporary, "output");
        run(process.execPath, ["bin/as3-frontend", "transpile", ...args(output)]);
        const code = fs.readFileSync(path.join(output,
            "__as3_runtime/application/ObjectHasOwnProbe.ts"), "utf8");
        assert.match(code, /laya\/flash\/utils\/AS3Property/);
        assert.equal((code.match(/__as3SharedHasOwnProperty/g) || []).length, 3);
        assert.doesNotMatch(code, /__as3ObjectCall\([^\n]*hasOwnProperty/);

        const manifest = JSON.parse(fs.readFileSync(path.join(output, "manifest.json"), "utf8"));
        const files = manifest.files.map(row => path.join(output, row.typescriptPath));
        const stubs = path.join(temporary, "laya-stubs");
        fs.mkdirSync(stubs);
        fs.writeFileSync(path.join(stubs,"Sprite.d.ts"), "export declare class Sprite {}\n");
        fs.writeFileSync(path.join(stubs,"AS3Property.d.ts"),
            "export declare function as3HasOwnProperty(target: unknown, key: unknown): boolean;\n");
        const typeConfig = path.join(temporary, "generated-tsconfig.json");
        fs.writeFileSync(typeConfig, JSON.stringify({compilerOptions:{target:"ES2020",module:"CommonJS",
            moduleResolution:"node",strict:true,strictNullChecks:true,strictPropertyInitialization:true,
            experimentalDecorators:true,resolveJsonModule:true,allowSyntheticDefaultImports:true,skipLibCheck:true,
            noEmit:true,types:[],lib:["ES2020","DOM","DOM.Iterable"],baseUrl:ROOT,
            paths:{"@laya/as3-runtime/*":["src/hardened-runtime/*"],
                "laya/flash/display/Sprite":[path.join(stubs,"Sprite.d.ts")],
                "laya/flash/utils/AS3Property":[path.join(stubs,"AS3Property.d.ts")]}},files}));
        run(process.execPath, [path.join(ROOT,"node_modules/typescript-4-9/bin/tsc"),"-p",typeConfig,"--pretty","false"]);

        const lockPath = path.join(profile, "profile-lock.json");
        const savedLock = fs.readFileSync(lockPath);
        const saved = JSON.parse(savedLock);
        try {
            delete saved.files.objectHasOwnPropertyProvider;
            fs.writeFileSync(lockPath, canonical(saved) + "\n");
            run(process.execPath, ["bin/as3-frontend", "qualify", ...args(path.join(temporary,"without-provider"))]);
            const row = JSON.parse(fs.readFileSync(path.join(temporary,"without-provider/manifest.json"),"utf8"))
                .files.find(item => item.sourcePath === "ObjectHasOwnProbe.as");
            assert.equal(row.status, "held");
            assert.equal(row.code, "HARDENED_MAPPED_NATIVE_DYNAMIC_LITERAL_TARGET_AUTHORITY");
        } finally {
            fs.writeFileSync(lockPath, savedLock);
        }

        const positiveLock = JSON.parse(savedLock);
        const providerPath = path.join(profile, positiveLock.files.objectHasOwnPropertyProvider.path);
        const savedProvider = fs.readFileSync(providerPath);
        try {
            const forged = JSON.parse(savedProvider);
            forged.targetSources["src/layaAir/flash/utils/AS3Property.ts"] = "0".repeat(64);
            fs.writeFileSync(providerPath, canonical(forged) + "\n");
            const changed = JSON.parse(savedLock);
            changed.files.objectHasOwnPropertyProvider.sha256 = hash(fs.readFileSync(providerPath));
            fs.writeFileSync(lockPath, canonical(changed) + "\n");
            const rejected = childProcess.spawnSync(process.execPath,
                ["bin/as3-frontend", "qualify", ...args(path.join(temporary,"forged-provider"))],
                {cwd:ROOT,encoding:"utf8",timeout:120000});
            assert.equal(rejected.status, 6);
            assert.match(rejected.stderr, /Object hasOwnProperty provider/);
        } finally {
            fs.writeFileSync(providerPath, savedProvider);
            fs.writeFileSync(lockPath, savedLock);
        }

        const boundaries = {
            HasOwnZero: ["return value.hasOwnProperty();", "HARDENED_OBJECT_CALL_ARITY"],
            HasOwnTwo: ["return value.hasOwnProperty(\"a\",\"b\");", "HARDENED_OBJECT_CALL_ARITY"],
            HasOwnTypedKey: ["return value.hasOwnProperty(value);", "HARDENED_OBJECT_KEY"],
        };
        for (const [name, [statement]] of Object.entries(boundaries)) fs.writeFileSync(path.join(source,name+".as"),
            `package { import flash.display.Sprite; public final class ${name} { public function test(value:Sprite):Boolean { ${statement} } } }\n`);
        const boundaryProfile = path.join(temporary,"boundary-profile");
        run("python3", ["-B", "tools/create-fixture-profile.py", "--source", source,
            "--entry", "ObjectHasOwnProbe", "--air-sdk", AIR, "--laya", LAYA,
            "--ffdec-jar", FFDEC, "--shared-object-has-own-property", "--output", boundaryProfile]);
        run(process.execPath, ["bin/as3-frontend", "qualify", source, path.join(temporary,"boundary-output"),
            "--source-census", path.join(boundaryProfile,"census.json"), "--target-capabilities",
            path.join(LAYA,"docTool/architecture/authored-content-capabilities.json"), "--profile-lock",
            path.join(boundaryProfile,"profile-lock.json")]);
        const rows = JSON.parse(fs.readFileSync(path.join(temporary,"boundary-output/manifest.json"),"utf8")).files;
        for (const [name, [, code]] of Object.entries(boundaries)) {
            const row = rows.find(item => item.sourcePath === name + ".as");
            assert.equal(row.status, "held", name);
            assert.equal(row.code, code, name);
        }
    });
