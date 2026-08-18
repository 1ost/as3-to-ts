"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repository = path.resolve(__dirname, "../..");
const sourceCensus = process.env.HARDENED_SOURCE_CAPABILITY_CENSUS
    || "C:/Users/admin/Desktop/GITHUB REPO/bleach-services/as3-to-layaair-porting-kit/generated/reports/swf-capability-census.json";
const targetCapabilities = process.env.HARDENED_TARGET_CAPABILITIES
    || "C:/Users/admin/Desktop/GITHUB REPO/LayaAir/docTool/architecture/authored-content-capabilities.json";

function canonicalJson(value) {
    if (value === null || typeof value === "boolean" || typeof value === "string" || typeof value === "number") {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

function sha256(value) {
    return crypto.createHash("sha256").update(value).digest("hex");
}

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
    assert.equal(typeMappings.length, 24);
    assert.equal(memberMappings.length, 106);
    assert.equal(memberMappings.filter(item => item.targetMember.kind === "constructor").length, 9);
    assert.equal(memberMappings.filter(item => ["getBounds", "getRect", "scrollRect"]
        .includes(item.sourceMember.name)).length, 0);
    assert.equal(memberMappings.filter(item => item.sourceQName === "flash.geom.Point").length, 6);
    assert.equal(memberMappings.filter(item => item.sourceQName === "flash.geom.Rectangle").length, 18);
    assert.equal(memberMappings.some(item => item.sourceQName === "flash.text.TextField"
        && item.sourceMember.name === "autoSize" && item.sourceMember.access === "write"), false);
    assert.equal(memberMappings.some(item => item.sourceQName !== "flash.geom.Point"
        && item.sourceQName !== "flash.geom.Rectangle" && item.sourceMember.access !== "call"), false);
    for (const qname of ["flash.display.Bitmap", "flash.display.BitmapData",
        "flash.display.BitmapDataChannel", "flash.display.PixelSnapping"]) {
        assert.equal(typeMappings.some(item => item.sourceQName === qname), true, qname);
        assert.equal(memberMappings.some(item => item.sourceQName === qname), false, qname);
    }
    assert.equal(memberMappings.some(item => ["draw", "applyFilter"].includes(item.sourceMember.name)), false);
    for (const item of document.mappings) {
        assert.match(item.targetModule, /^src\/layaAir\/flash\//);
        assert.doesNotMatch(item.targetExport, /^_/);
        if (item.targetMember) assert.doesNotMatch(item.targetMember.name, /^_/);
    }
});

test("geometry generation fails closed on forged types, ambiguous targets, cross-runtime properties, and bounds lookalikes", t => {
    const output = fs.mkdtempSync(path.join(os.tmpdir(), "as3-capability-map-adversarial-"));
    t.after(() => fs.rmSync(output, { recursive: true, force: true }));
    const alteredTarget = JSON.parse(fs.readFileSync(targetCapabilities, "utf8"));
    const geometry = alteredTarget.capabilities.find(item => item.id === "api.flash.geom");
    const point = geometry.obligations.find(item => item.export === "Point");
    point.members.find(item => item.name === "x").signature = "number | null";
    const rectangle = geometry.obligations.find(item => item.export === "Rectangle");
    rectangle.members.push({ ...rectangle.members.find(item => item.name === "clone") });
    rectangle.members.find(item => item.name === "width").signature = "string";
    rectangle.members.find(item => item.name === "intersection").signature = "(toIntersect: Rectangle) => Rectangle | null";
    const text = alteredTarget.capabilities.find(item => item.id === "api.flash.text");
    const textField = text.obligations.find(item => item.export === "TextField");
    textField.members.find(item => item.name === "autoSize").signature = "string";
    for (const capability of alteredTarget.capabilities) {
        for (const obligation of capability.obligations || []) {
            for (const member of obligation.members || []) {
                if (member.name === "getBounds") {
                    member.signature = "(targetCoordinateSpace: DisplayObject) => Rectangle";
                }
            }
        }
    }
    const target = path.join(output, "target.json");
    fs.writeFileSync(target, JSON.stringify(alteredTarget), "utf8");
    const mapping = path.join(output, "capability-map.json");
    const lock = path.join(output, "authority-lock.json");
    const result = spawnSync(process.execPath, [
        path.join(repository, "tools", "generate-capability-map.cjs"),
        sourceCensus, target, mapping, lock,
    ], { cwd: os.tmpdir(), encoding: "utf8", timeout: 20_000, windowsHide: true });
    assert.equal(result.status, 0, result.stderr);
    const document = JSON.parse(fs.readFileSync(mapping, "utf8"));
    assert.equal(document.mappings.some(item => item.sourceQName === "flash.geom.Point"
        && item.sourceMember?.name === "x"), false);
    assert.equal(document.mappings.some(item => item.sourceQName === "flash.geom.Rectangle"
        && item.sourceMember?.name === "clone"), false);
    assert.equal(document.mappings.some(item => item.sourceQName === "flash.geom.Rectangle"
        && item.sourceMember?.name === "width"), false);
    assert.equal(document.mappings.some(item => item.sourceQName === "flash.geom.Rectangle"
        && item.sourceMember?.name === "intersection"
        && item.targetMember?.signature.endsWith("Rectangle | null")), true);
    for (const member of ["autoSize", "filters", "graphics", "parent"]) {
        assert.equal(document.mappings.some(item => item.sourceQName !== "flash.geom.Point"
            && item.sourceQName !== "flash.geom.Rectangle" && item.sourceMember?.name === member
            && item.sourceMember?.access !== "call"), false, member);
    }
    assert.equal(document.mappings.some(item => ["getBounds", "getRect", "scrollRect"]
        .includes(item.sourceMember?.name)), false);
});

test("capability loader rejects a forged bitmap member row held by the geometry slice", t => {
    const output = fs.mkdtempSync(path.join(os.tmpdir(), "as3-capability-ledger-bitmap-"));
    t.after(() => fs.rmSync(output, { recursive: true, force: true }));
    const bundle = path.join(output, "ledger.cjs");
    require("esbuild").buildSync({
        entryPoints: [path.join(repository, "src", "hardened", "ledger.ts")],
        outfile: bundle,
        bundle: true,
        platform: "node",
        format: "cjs",
        logLevel: "silent",
    });
    const { loadCapabilityAuthority } = require(bundle);
    const normalized = file => fs.readFileSync(file, "utf8").replace(/\r\n?/g, "\n");
    const sourceJson = normalized(sourceCensus);
    const targetJson = normalized(targetCapabilities);
    const source = JSON.parse(sourceJson);
    const target = JSON.parse(targetJson);
    const mapping = JSON.parse(normalized(path.join(repository, "config", "capability-map.json")));
    const type = mapping.mappings.find(item => item.sourceQName === "flash.display.BitmapData"
        && item.sourceMember === null);
    const use = source.as3SourceCapabilities.memberUses.find(item => item.qname === "flash.display.BitmapData"
        && item.member === "clone" && item.access === "call");
    const signature = use.signatures[0];
    const capability = target.capabilities.find(item => item.id === type.targetCapabilityId);
    const obligation = capability.obligations.find(item => item.module === type.targetModule
        && item.export === type.targetExport);
    const member = obligation.members.find(item => item.name === "clone" && item.kind === "method");
    mapping.mappings.push({
        ...type,
        sourceRoles: [use.context],
        sourceMember: {
            name: use.member,
            access: use.access,
            minArgs: signature.minArgs,
            maxArgs: signature.maxArgs,
            signature: signature.signature,
        },
        targetMember: {
            name: member.name,
            kind: member.kind,
            scope: member.scope,
            signature: member.signature,
        },
    });
    const key = item => [item.sourceQName, item.sourceMember ? item.sourceMember.access : "",
        item.sourceMember ? item.sourceMember.name : "", item.sourceMember ? item.sourceMember.signature : ""].join("\u0000");
    mapping.mappings.sort((left, right) => key(left).localeCompare(key(right)));
    const mappingJson = `${canonicalJson(mapping)}\n`;
    assert.throws(() => loadCapabilityAuthority({
        sourceCensusJson: sourceJson,
        sourceCensusSha256: sha256(sourceJson),
        targetCapabilitiesJson: targetJson,
        targetCapabilitiesSha256: sha256(targetJson),
        mappingJson,
        mappingSha256: sha256(mappingJson),
    }, sha256), error => error && error.code === "HARDENED_CAPABILITY_MEMBER_BEHAVIOR");
});
