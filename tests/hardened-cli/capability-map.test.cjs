"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repository = path.resolve(__dirname, "../..");
const sourceCensus = process.env.HARDENED_SOURCE_CAPABILITY_CENSUS
    || "C:/Users/admin/Desktop/GITHUB REPO/bleach-services/as3-to-layaair-porting-kit/generated/reports/swf-capability-census.json";
const targetCapabilities = process.env.HARDENED_TARGET_CAPABILITIES
    || "C:/Users/admin/Desktop/GITHUB REPO/LayaAir/docTool/architecture/authored-content-capabilities.json";

test("capability map regenerates byte-identically from both authorities", t => {
    const output = fs.mkdtempSync(path.join(os.tmpdir(), "as3-capability-map-"));
    t.after(() => fs.rmSync(output, { recursive: true, force: true }));
    const mapping = path.join(output, "capability-map.json");
    const lock = path.join(output, "authority-lock.json");
    const result = spawnSync(process.execPath, [
        path.join(repository, "tools", "generate-capability-map.cjs"),
        sourceCensus,
        targetCapabilities,
        mapping,
        lock,
    ], { cwd: os.tmpdir(), encoding: "utf8", timeout: 20_000, windowsHide: true });
    assert.equal(result.status, 0, result.stderr);
    const canonical = value => value.replace(/\r\n?/g, "\n");
    assert.equal(canonical(fs.readFileSync(mapping, "utf8")),
        canonical(fs.readFileSync(path.join(repository, "config", "capability-map.json"), "utf8")));
    assert.equal(canonical(fs.readFileSync(lock, "utf8")),
        canonical(fs.readFileSync(path.join(repository, "config", "authority-lock.json"), "utf8")));
    const document = JSON.parse(fs.readFileSync(mapping, "utf8"));
    const typeMappings = document.mappings.filter(item => item.sourceMember === null);
    const memberMappings = document.mappings.filter(item => item.sourceMember !== null);
    assert.equal(typeMappings.length, 12);
    assert.equal(memberMappings.length, 73);
    assert.equal(memberMappings.filter(item => item.targetMember.kind === "constructor").length, 5);
    for (const item of document.mappings) {
        assert.match(item.targetModule, /^src\/layaAir\/flash\//);
        assert.doesNotMatch(item.targetExport, /^_/);
        if (item.targetMember) assert.doesNotMatch(item.targetMember.name, /^_/);
    }
});
