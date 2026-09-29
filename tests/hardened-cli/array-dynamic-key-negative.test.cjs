"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const cp = require("node:child_process");
const crypto = require("node:crypto");

// Coordinator heavy lane: use the frozen compiler with this patch and updated runtime hashes.
const root = process.env.HARDENED_ARRAY_KEY_COMPILER;
const laya = process.env.HARDENED_FIXTURE_LAYA;
const air = process.env.HARDENED_AIR_SDK;
const ffdec = process.env.HARDENED_FFDEC_JAR;
const operations = {
  DynamicWrite: "values[key] = 1;",
  DynamicCompound: "values[key] += 1;",
  DynamicPostIncrement: "values[key]++;",
  DynamicPreIncrement: "++values[key];",
  DynamicPostDecrement: "values[key]--;",
  DynamicPreDecrement: "--values[key];",
  DynamicDelete: "delete values[key];",
};

test("actual CLI admits wildcard Array reads but holds unproved dynamic mutations", {
  skip: !root && !laya && !air && !ffdec,
}, () => {
  assert.ok(root && laya && air && ffdec, "Supply all frozen compiler/Laya/SDK/FFDec inputs");
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "array-dynamic-key-cli-")));
  console.log("Retained Array key CLI evidence:", directory);
  const source = path.join(directory, "source");
  const profile = path.join(directory, "profile");
  const output = path.join(directory, "qualified");
  fs.mkdirSync(source);
  const sourceHashes = {};
  for (const [name, operation] of Object.entries(operations)) {
    const text = `package { public class ${name} { public static function run(values:Array, key:*):void { ${operation} } } }`;
    fs.writeFileSync(path.join(source, name + ".as"), text);
    sourceHashes[name + ".as"] = crypto.createHash("sha256").update(text).digest("hex");
  }
  const control = "package { public class ReadControl { public static function run(values:Array, key:*):* { return values[key]; } } }";
  fs.writeFileSync(path.join(source, "ReadControl.as"), control);
  sourceHashes["ReadControl.as"] = crypto.createHash("sha256").update(control).digest("hex");
  fs.writeFileSync(path.join(directory, "source-hashes.json"), JSON.stringify(sourceHashes, null, 2));
  function run(command, args) {
    const result = cp.spawnSync(command, args, {cwd: root, encoding: "utf8", timeout: 180000});
    fs.appendFileSync(path.join(directory, "commands.log"), JSON.stringify([command, ...args]) + "\n" + result.stdout + result.stderr);
    assert.equal(result.status, 0, result.stdout + result.stderr);
  }
  run("python3", ["-B", "tools/create-fixture-profile.py", "--source", source, "--entry", "ReadControl",
    "--air-sdk", air, "--laya", laya, "--ffdec-jar", ffdec, "--output", profile]);
  run(process.execPath, ["bin/as3-frontend", "qualify", source, output,
    "--source-census", path.join(profile, "census.json"),
    "--target-capabilities", path.join(laya, "docTool/architecture/authored-content-capabilities.json"),
    "--profile-lock", path.join(profile, "profile-lock.json")]);
  const rows = JSON.parse(fs.readFileSync(path.join(output, "manifest.json"))).files;
  assert.equal(rows.length, 8);
  for (const name of Object.keys(operations)) {
    const row = rows.find(item => item.sourcePath === name + ".as");
    assert.ok(row, name);
    assert.equal(row.status, "held", name);
    assert.equal(row.code, "HARDENED_ARRAY_INDEX_TYPE", name);
    assert.equal(row.sourceSha256, sourceHashes[name + ".as"]);
  }
  assert.equal(rows.find(row => row.sourcePath === "ReadControl.as").status, "admitted");
  for (const [name, hash] of Object.entries(sourceHashes)) {
    assert.equal(crypto.createHash("sha256").update(fs.readFileSync(path.join(source, name))).digest("hex"), hash);
  }
});
