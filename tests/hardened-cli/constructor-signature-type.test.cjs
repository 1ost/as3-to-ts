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
const sha256 = bytes => crypto.createHash("sha256").update(bytes).digest("hex");

test("local constructor parameters derive their types from the authenticated owner signature",
    { skip: !(AIR && LAYA && FFDEC) }, t => {
        const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "constructor-signature-")));
        t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
        const source = path.join(temporary, "source");
        const profile = path.join(temporary, "profile");
        fs.mkdirSync(path.join(source, "api"), { recursive: true });
        const files = {
            "api/SignatureType.as": `package api {
 public final class SignatureType { public var marker:int = 41; }
}\n`,
            "api/Holder.as": `package api {
 public final class Holder { public static var value:SignatureType = new SignatureType(); }
}\n`,
            "api/Factory.as": `package api {
 public final class Factory {
  public var value:SignatureType;
  public function Factory(value:SignatureType) { this.value = value; }
 }
}\n`,
            "ConstructorSignatureProbe.as": `package {
 import api.Factory;
 import api.Holder;
 public final class ConstructorSignatureProbe {
  public function build():Factory { return new Factory(Holder.value); }
 }
}\n`,
        };
        const hashes = new Map();
        for (const [name, content] of Object.entries(files)) {
            const file = path.join(source, name);
            fs.mkdirSync(path.dirname(file), { recursive: true });
            fs.writeFileSync(file, content);
            hashes.set(name, sha256(content));
        }
        const run = (command, args, timeout = 120000) => {
            const result = childProcess.spawnSync(command, args, { cwd: ROOT, encoding: "utf8", timeout });
            assert.equal(result.status, 0, result.stdout + result.stderr);
            return result;
        };
        run("python3", ["-B", "tools/create-fixture-profile.py", "--source", source,
            "--entry", "ConstructorSignatureProbe", "--air-sdk", AIR, "--laya", LAYA,
            "--ffdec-jar", FFDEC, "--omit-direct-edge",
            "ConstructorSignatureProbe:api.SignatureType", "--output", profile]);

        const types = JSON.parse(fs.readFileSync(path.join(profile, "local-types.json"), "utf8")).entries;
        const byQName = new Map(types.map(row => [row.qname, row]));
        const signatureNode = byQName.get("api.SignatureType").nodeId;
        assert.ok(!byQName.get("ConstructorSignatureProbe").prerequisites.includes(signatureNode));
        assert.ok(byQName.get("api.Factory").prerequisites.includes(signatureNode));
        assert.ok(byQName.get("api.Holder").prerequisites.includes(signatureNode));

        const output = path.join(temporary, "output");
        run(process.execPath, ["bin/as3-frontend", "transpile", source, output,
            "--source-census", path.join(profile, "census.json"), "--target-capabilities",
            path.join(LAYA, "docTool/architecture/authored-content-capabilities.json"),
            "--profile-lock", path.join(profile, "profile-lock.json")]);
        const manifest = JSON.parse(fs.readFileSync(path.join(output, "manifest.json"), "utf8"));
        for (const row of manifest.files) {
            assert.equal(row.sourceSha256, hashes.get(row.sourcePath));
        }
        const code = fs.readFileSync(path.join(output,
            "__as3_runtime/application/ConstructorSignatureProbe.ts"), "utf8");
        assert.match(code, /SignatureType as __as3Signature[0-9]+/);

        const entry = require(path.join(output, "__as3_runtime/ApplicationEntry.generated.js"));
        const find = name => entry.AS3_APPLICATION_MODULES.find(module => module[name])[name];
        const Probe = find("ConstructorSignatureProbe");
        const Holder = find("Holder");
        const built = new Probe().build();
        assert.equal(built.value, Holder.value);
        assert.equal(built.value.marker, 41);
    });
