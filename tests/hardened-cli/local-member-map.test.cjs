"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const GENERATOR = path.join(ROOT, "tools/generate-local-member-map.cjs");
const WORKER = path.join(ROOT, "lib/declaration-worker.js");

function sha256(bytes) {
    return crypto.createHash("sha256").update(bytes).digest("hex");
}

function canonical(value) {
    if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
}

function entry(qname, nodeId, sourcePath, source, prerequisites, typeKind = "class") {
    return {
        componentId: "scc-00001", graphSourceSha256: "1".repeat(64), importable: true,
        module: "application", nodeId, prerequisites, qname,
        sourceContentSha256: sha256(source.replace(/\r\n?/g, "\n")), sourcePath,
        targetPath: `game-client/layaair/src/application/${sourcePath.slice("game-client/tapplication_main/src/".length, -3)}.ts`,
        topologicalLevel: prerequisites.length, typeKind,
    };
}

test("local member map is deterministic and resolves authenticated inheritance signatures", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "local-member-map-"));
    try {
        const baseSource = "package p { public class Base { public function Base(value:int = 0){} protected function run(value:Vector.<int>):String{return null;} } }";
        const childSource = "package p { public class Child extends Base { public function Child(){super();} override protected function run(value:Vector.<int>):String{return null;} } }";
        const packageSource = "package p { public const Shared:int = 1; }";
        const namespaceSource = "package p { public namespace InternalSpace; }";
        const sources = [
            ["game-client/tapplication_main/src/p/Base.as", baseSource],
            ["game-client/tapplication_main/src/p/Child.as", childSource],
            ["game-client/tapplication_main/src/p/Shared.as", packageSource],
            ["game-client/tapplication_main/src/p/InternalSpace.as", namespaceSource],
        ];
        sources.forEach(([portable, source]) => {
            const target = path.join(root, ...portable.split("/"));
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, source, "utf8");
        });
        const entries = [
            entry("p.Base", "0000000000000001", sources[0][0], baseSource, []),
            entry("p.Child", "0000000000000002", sources[1][0], childSource, ["0000000000000001"]),
            entry("p.Shared", "0000000000000003", sources[2][0], packageSource, [], "package"),
            entry("p.InternalSpace", "0000000000000004", sources[3][0], namespaceSource, [], "package"),
        ];
        const map = {
            dependencyGraphRawSha256: "2".repeat(64), dependencyGraphSemanticSha256: "3".repeat(64),
            entries, entryCount: entries.length, schema: "bleach-local-as3-type-map@2",
            sourceManifestSha256: "4".repeat(64),
        };
        const mapPath = path.join(root, "local-types.json");
        const first = path.join(root, "members-a.json");
        const second = path.join(root, "members-b.json");
        fs.writeFileSync(mapPath, `${canonical(map)}\n`, "utf8");
        for (const output of [first, second]) {
            childProcess.execFileSync(process.execPath, [GENERATOR, mapPath, output, root, WORKER],
                { cwd: ROOT, stdio: "pipe", timeout: 15000 });
        }
        assert.equal(fs.readFileSync(first).compare(fs.readFileSync(second)), 0);
        const value = JSON.parse(fs.readFileSync(first, "utf8"));
        assert.equal(value.schema, "bleach-local-as3-member-map@1");
        assert.equal(value.entryCount, 4);
        assert.equal(value.completeCount, 4);
        assert.equal(value.heldCount, 0);
        const base = value.entries.find(item => item.qname === "p.Base");
        const child = value.entries.find(item => item.qname === "p.Child");
        assert.deepEqual(child.declaration.baseQNames, ["p.Base"]);
        assert.equal(base.declaration.members.find(member => member.name === "run").parameters[0].type,
            "Vector.<int>");
        assert.equal(child.declaration.members.find(member => member.name === "run").modifiers.includes("override"), true);
        assert.equal(value.entries.find(item => item.qname === "p.Shared").declaration.members[0].fieldType, "int");
        assert.equal(value.entries.find(item => item.qname === "p.InternalSpace").declaration.members[0].kind,
            "namespace");
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
