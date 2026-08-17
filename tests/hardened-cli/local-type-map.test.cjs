"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repository = path.resolve(__dirname, "../..");
const generator = path.join(repository, "tools", "generate-local-type-map.cjs");
const graph = process.env.HARDENED_DEPENDENCY_GRAPH
    || "C:/Users/admin/Desktop/GITHUB REPO/bleach-services/as3-to-layaair-porting-kit/generated/dependency-graph/bleach-as3-dependency-graph.json";

function sha256(bytes) {
    return crypto.createHash("sha256").update(bytes).digest("hex");
}

test("derives the complete local type map deterministically from the authenticated dependency graph", t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "as3-local-types-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const first = path.join(root, "first.json");
    const second = path.join(root, "second.json");
    childProcess.execFileSync(process.execPath, [generator, graph, first], { cwd: repository, stdio: "pipe" });
    childProcess.execFileSync(process.execPath, [generator, graph, second], { cwd: os.tmpdir(), stdio: "pipe" });
    const firstBytes = fs.readFileSync(first);
    assert.equal(firstBytes.compare(fs.readFileSync(second)), 0);
    assert.equal(firstBytes.compare(fs.readFileSync(path.join(repository, "config", "local-type-map.json"))), 0,
        "checked local type authority is exactly regenerated from the authenticated graph");
    const value = JSON.parse(firstBytes.toString("utf8"));
    assert.equal(value.schema, "bleach-local-as3-type-map@1");
    assert.equal(value.entryCount, 2923);
    assert.equal(value.entries.length, 2923);
    assert.equal(value.dependencyGraphSemanticSha256,
        "3d0d7e0717708e2931bb9cf81de913aa21f5fe4b24babb2703edd9abdcb8f593");
    assert.match(value.dependencyGraphRawSha256, /^[0-9a-f]{64}$/);
    assert.match(value.sourceManifestSha256, /^[0-9a-f]{64}$/);
    const identities = value.entries.map(entry => `${entry.module}\u0000${entry.qname}`);
    assert.deepEqual(identities,
        identities.slice().sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b))));
    assert.equal(new Set(identities).size, 2923);
    assert.equal(value.entries.filter(entry => entry.qname === "Logics.Agent.TParametersCore").length, 2,
        "application/bootstrap duplicate qnames remain distinct authenticated module identities");
    value.entries.forEach(entry => {
        assert.deepEqual(Object.keys(entry).sort(), [
            "componentId", "importable", "module", "nodeId", "prerequisites", "qname", "sourcePath", "sourceSha256",
            "targetPath", "topologicalLevel", "typeKind",
        ]);
        assert.match(entry.sourceSha256, /^[0-9a-f]{64}$/);
        assert.ok(entry.module === "application" || entry.module === "bootstrap");
        assert.ok(entry.typeKind === "class" || entry.typeKind === "interface" || entry.typeKind === "package");
    });
    assert.equal(value.entries.filter(entry => !entry.importable).length, 2,
        "script-private identities remain authenticated but cannot be imported");
    assert.equal(sha256(firstBytes), "031826165af0ad5ed20ba8de28f487fe3cf0b283729ec875b4b9615f80d5bbdb");
});
