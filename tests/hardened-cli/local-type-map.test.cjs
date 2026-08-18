"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { stringify } = require("../../tools/hardened-corpus/canonical");

const repository = path.resolve(__dirname, "../..");
const generator = path.join(repository, "tools", "generate-local-type-map.cjs");
const graph = process.env.HARDENED_DEPENDENCY_GRAPH
    || "C:/Users/admin/Desktop/GITHUB REPO/bleach-services/as3-to-layaair-porting-kit/generated/dependency-graph/bleach-as3-dependency-graph.json";
const sourceRepository = process.env.HARDENED_SOURCE_REPO
    || path.resolve(path.dirname(graph), "../../..");

function sha256(bytes) {
    return crypto.createHash("sha256").update(bytes).digest("hex");
}

test("derives the complete local type map deterministically from the authenticated dependency graph", t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "as3-local-types-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const first = path.join(root, "first.json");
    const second = path.join(root, "second.json");
    childProcess.execFileSync(process.execPath, [generator, graph, first, sourceRepository],
        { cwd: repository, stdio: "pipe" });
    childProcess.execFileSync(process.execPath, [generator, graph, second, sourceRepository],
        { cwd: os.tmpdir(), stdio: "pipe" });
    const firstBytes = fs.readFileSync(first);
    assert.equal(firstBytes.compare(fs.readFileSync(second)), 0);
    const checkedBytes = Buffer.from(fs.readFileSync(path.join(repository, "config", "local-type-map.json"), "utf8")
        .replace(/\r\n?/g, "\n"), "utf8");
    assert.equal(firstBytes.compare(checkedBytes), 0,
        "checked local type authority is exactly regenerated from the authenticated graph");
    const value = JSON.parse(firstBytes.toString("utf8"));
    assert.equal(value.schema, "bleach-local-as3-type-map@2");
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
            "componentId", "graphSourceSha256", "importable", "module", "nodeId", "prerequisites", "qname",
            "sourceContentSha256", "sourcePath", "targetPath", "topologicalLevel", "typeKind",
        ]);
        assert.match(entry.graphSourceSha256, /^[0-9a-f]{64}$/);
        assert.match(entry.sourceContentSha256, /^[0-9a-f]{64}$/);
        assert.ok(entry.module === "application" || entry.module === "bootstrap");
        assert.ok(entry.typeKind === "class" || entry.typeKind === "interface" || entry.typeKind === "package");
    });
    assert.equal(value.entries.filter(entry => !entry.importable).length, 2,
        "script-private identities remain authenticated but cannot be imported");
    const comboBox = value.entries.find(entry => entry.qname === "Components.ComboBox.TComboBox");
    assert.ok(comboBox);
    assert.notEqual(comboBox.graphSourceSha256, comboBox.sourceContentSha256,
        "graph evidence digest and canonical source-byte digest remain distinct authorities");
    const comboBoxBytes = fs.readFileSync(path.join(sourceRepository, comboBox.sourcePath));
    const parserVisibleComboBox = new TextDecoder("utf-8", { fatal: true }).decode(comboBoxBytes).replace(/\r\n?/g, "\n");
    assert.equal(comboBox.sourceContentSha256, sha256(parserVisibleComboBox),
        "source content authority exactly matches the parser-visible BOM and newline policy");

    const bundle = path.join(root, "local-types.cjs");
    esbuild.buildSync({
        absWorkingDir: repository,
        entryPoints: ["src/hardened/local-types.ts"],
        outfile: bundle,
        bundle: true,
        platform: "node",
        format: "cjs",
        target: "node24",
        logLevel: "silent",
    });
    const api = require(bundle);
    const expected = {
        expectedDependencyGraphRawSha256: value.dependencyGraphRawSha256,
        expectedDependencyGraphSemanticSha256: value.dependencyGraphSemanticSha256,
        expectedEntryCount: 2923,
        expectedSourceManifestSha256: value.sourceManifestSha256,
    };
    function load(text) {
        return api.loadLocalTypeAuthority({ ...expected, json: text, sha256: sha256(text) }, sha256);
    }
    const loaded = load(firstBytes.toString("utf8"));
    assert.equal(loaded.entries.length, 2923);
    assert.ok(Object.isFrozen(loaded));
    assert.ok(Object.isFrozen(loaded.entries[0].prerequisites));
    assert.throws(() => api.assertLoadedLocalTypeAuthority({ ...loaded }),
        error => error && error.code === "HARDENED_LOCAL_AUTHORITY_INSTANCE");

    function mutated(change) {
        const copy = JSON.parse(firstBytes.toString("utf8"));
        change(copy);
        return `${stringify(copy)}\n`;
    }
    [
        document => { document.extra = true; },
        document => { document.entryCount -= 1; },
        document => { document.entries[0].graphSourceSha256 = "not-a-sha"; },
        document => { document.entries[0].sourceContentSha256 = "not-a-sha"; },
        document => { document.entries[0].topologicalLevel = -1; },
        document => { document.entries[0].importable = !document.entries[0].importable; },
        document => { document.entries[1].qname = document.entries[0].qname; document.entries[1].module = document.entries[0].module; },
        document => { document.entries[0].prerequisites = ["ffffffffffffffff", "0000000000000000"]; },
        document => { document.entries[0].sourcePath = "game-client/tapplication_main/src/../escape.as"; },
    ].forEach(change => assert.throws(() => load(mutated(change)),
        error => error && /^HARDENED_LOCAL_AUTHORITY_/.test(error.code)));
});
