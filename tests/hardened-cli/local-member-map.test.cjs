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

test("current local authority preserves the two inherited case-folded field collisions", () => {
    const document = JSON.parse(fs.readFileSync(path.join(ROOT, "config/local-member-map.json"), "utf8"));
    const byQName = new Map(document.entries.map(item => [item.qname, item]));
    const baseQName = "Processors.Game.Lobby.Activity.HDActivity.TProcessorHDSingleWindowBase";
    const cases = [
        ["Processors.Game.Lobby.Activity.HDBleachJigsaw.TProcessorWindowBleachJigsawOld", "FBtn_close", "FBtn_Close"],
        ["Processors.Game.Lobby.Activity.HDPrivilegeLease.TprocessorHDWindowsPrivilegeLease", "FUiPage", "FUIPage"],
    ];
    const base = byQName.get(baseQName);
    assert.equal(base.status, "complete");
    for (const [derivedQName, derivedName, baseName] of cases) {
        const derived = byQName.get(derivedQName);
        assert.equal(derived.status, "complete", derivedQName);
        assert.deepEqual(derived.declaration.baseQNames, [baseQName]);
        const derivedField = derived.declaration.members.find(member => member.kind === "field" && member.name === derivedName);
        const baseField = base.declaration.members.find(member => member.kind === "field" && member.name === baseName);
        assert.ok(derivedField && baseField, derivedQName);
        assert.equal(derivedField.modifiers.includes("protected"), true);
        assert.equal(baseField.modifiers.includes("protected"), true);
        assert.equal(derivedName.toLowerCase(), baseName.toLowerCase());
    }
});

test("local member map is deterministic and resolves authenticated inheritance signatures", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "local-member-map-"));
    try {
        const baseSource = "package p { import flash.display.*; import flash.geom.*; public class Base { public var bounds:Rectangle; public function Base(value:int = 0){} protected function run(value:Vector.<int>):String{return null;} } }";
        const childSource = "package p { public class Child extends Base { public function Child(){super();} override protected function run(value:Vector.<int>):String{return null;} } }";
        const packageSource = "package p { public const Shared:Base = new Base(); }";
        const namespaceSource = "package p { public namespace InternalSpace; }";
        const initializerSource = "package p { public class Initializer { public static var state:Object = {}; Initializer.initialize(); public static function initialize():void {} } }";
        const sources = [
            ["game-client/tapplication_main/src/p/Base.as", baseSource],
            ["game-client/tapplication_main/src/p/Child.as", childSource],
            ["game-client/tapplication_main/src/p/Shared.as", packageSource],
            ["game-client/tapplication_main/src/p/InternalSpace.as", namespaceSource],
            ["game-client/tapplication_main/src/p/Initializer.as", initializerSource],
        ];
        sources.forEach(([portable, source]) => {
            const target = path.join(root, ...portable.split("/"));
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, source, "utf8");
        });
        const entries = [
            entry("p.Base", "0000000000000001", sources[0][0], baseSource, []),
            entry("p.Child", "0000000000000002", sources[1][0], childSource, ["0000000000000001"]),
            entry("p.Shared", "0000000000000003", sources[2][0], packageSource, ["0000000000000001"], "package"),
            entry("p.InternalSpace", "0000000000000004", sources[3][0], namespaceSource, [], "package"),
            entry("p.Initializer", "0000000000000005", sources[4][0], initializerSource, []),
        ];
        const map = {
            dependencyGraphRawSha256: "2".repeat(64), dependencyGraphSemanticSha256: "3".repeat(64),
            entries, entryCount: entries.length, schema: "bleach-local-as3-type-map@2",
            sourceManifestSha256: "4".repeat(64),
        };
        const mapPath = path.join(root, "local-types.json");
        const censusPath = path.join(root, "source-census.json");
        const census = {
            as3SourceCapabilities: { apis: [{ qname: "flash.geom.Rectangle", roles: ["wildcard-resolution"] }] },
            schema: "swf-capability-census@1",
        };
        const censusText = `${canonical(census)}\n`;
        fs.writeFileSync(censusPath, censusText, "utf8");
        const censusSha256 = sha256(censusText);
        const first = path.join(root, "members-a.json");
        const second = path.join(root, "members-b.json");
        fs.writeFileSync(mapPath, `${canonical(map)}\n`, "utf8");
        for (const output of [first, second]) {
            childProcess.execFileSync(process.execPath,
                [GENERATOR, mapPath, output, root, WORKER, censusPath, censusSha256],
                { cwd: ROOT, stdio: "pipe", timeout: 15000 });
        }
        assert.equal(fs.readFileSync(first).compare(fs.readFileSync(second)), 0);
        const value = JSON.parse(fs.readFileSync(first, "utf8"));
        assert.equal(value.schema, "bleach-local-as3-member-map@2");
        assert.equal(value.entryCount, 5);
        assert.equal(value.completeCount, 5);
        assert.equal(value.heldCount, 0);
        assert.equal(value.sourceCensusSha256, censusSha256);
        const base = value.entries.find(item => item.qname === "p.Base");
        const child = value.entries.find(item => item.qname === "p.Child");
        assert.deepEqual(child.declaration.baseQNames, ["p.Base"]);
        assert.equal(base.declaration.members.find(member => member.name === "run").parameters[0].type,
            "Vector.<int>");
        assert.equal(base.declaration.members.find(member => member.name === "bounds").fieldType,
            "flash.geom.Rectangle");
        assert.equal(child.declaration.members.find(member => member.name === "run").modifiers.includes("override"), true);
        assert.equal(value.entries.find(item => item.qname === "p.Shared").declaration.members[0].fieldType, "p.Base");
        assert.deepEqual(value.entries.find(item => item.qname === "p.Shared").declaration.packageInitializer,
            { kind: "new", targetQName: "p.Base", argumentCount: 0 });
        assert.equal(value.entries.find(item => item.qname === "p.InternalSpace").declaration.members[0].kind,
            "namespace");
        assert.deepEqual(value.entries.find(item => item.qname === "p.Initializer").declaration.classInitializer,
            { kind: "same-class-static-void-call", ownerQName: "p.Initializer", methodName: "initialize", argumentCount: 0 });

        const ambiguousCensus = {
            as3SourceCapabilities: { apis: [
                { qname: "flash.display.Rectangle", roles: ["wildcard-resolution"] },
                { qname: "flash.geom.Rectangle", roles: ["wildcard-resolution"] },
            ] },
            schema: "swf-capability-census@1",
        };
        const ambiguousText = `${canonical(ambiguousCensus)}\n`;
        fs.writeFileSync(censusPath, ambiguousText, "utf8");
        const ambiguousOutput = path.join(root, "members-ambiguous.json");
        childProcess.execFileSync(process.execPath, [GENERATOR, mapPath, ambiguousOutput, root, WORKER,
            censusPath, sha256(ambiguousText)], { cwd: ROOT, stdio: "pipe", timeout: 15000 });
        const ambiguous = JSON.parse(fs.readFileSync(ambiguousOutput, "utf8"));
        assert.equal(ambiguous.entries.find(item => item.qname === "p.Base").holdCode,
            "LOCAL_MEMBER_TYPE_RESOLUTION");

        const nonTypeSource = baseSource.replace("import flash.geom.*;",
            "import flash.geom.*; import flash.utils.*;").replace(
            "public var bounds:Rectangle;", "public var bounds:Rectangle; public var bad:getDefinitionByName;");
        fs.writeFileSync(path.join(root, ...sources[0][0].split("/")), nonTypeSource, "utf8");
        const nonTypeMap = JSON.parse(JSON.stringify(map));
        nonTypeMap.entries.find(item => item.qname === "p.Base").sourceContentSha256 = sha256(nonTypeSource);
        fs.writeFileSync(mapPath, `${canonical(nonTypeMap)}\n`, "utf8");
        const packageFunctionCensus = {
            as3SourceCapabilities: { apis: [
                { qname: "flash.geom.Rectangle", roles: ["wildcard-resolution"] },
                { qname: "flash.utils.getDefinitionByName", roles: ["package-function", "wildcard-resolution"] },
            ] },
            schema: "swf-capability-census@1",
        };
        const packageFunctionText = `${canonical(packageFunctionCensus)}\n`;
        fs.writeFileSync(censusPath, packageFunctionText, "utf8");
        const packageFunctionOutput = path.join(root, "members-package-function.json");
        childProcess.execFileSync(process.execPath, [GENERATOR, mapPath, packageFunctionOutput, root, WORKER,
            censusPath, sha256(packageFunctionText)], { cwd: ROOT, stdio: "pipe", timeout: 15000 });
        assert.equal(JSON.parse(fs.readFileSync(packageFunctionOutput, "utf8")).entries
            .find(item => item.qname === "p.Base").holdCode, "LOCAL_MEMBER_TYPE_RESOLUTION");

        fs.writeFileSync(path.join(root, ...sources[0][0].split("/")), baseSource, "utf8");
        fs.writeFileSync(mapPath, `${canonical(map)}\n`, "utf8");
        const missingWildcardRoleCensus = {
            as3SourceCapabilities: { apis: [{ qname: "flash.geom.Rectangle", roles: ["constructor"] }] },
            schema: "swf-capability-census@1",
        };
        const missingWildcardRoleText = `${canonical(missingWildcardRoleCensus)}\n`;
        fs.writeFileSync(censusPath, missingWildcardRoleText, "utf8");
        const missingWildcardRoleOutput = path.join(root, "members-missing-wildcard-role.json");
        childProcess.execFileSync(process.execPath, [GENERATOR, mapPath, missingWildcardRoleOutput, root, WORKER,
            censusPath, sha256(missingWildcardRoleText)], { cwd: ROOT, stdio: "pipe", timeout: 15000 });
        assert.equal(JSON.parse(fs.readFileSync(missingWildcardRoleOutput, "utf8")).entries
            .find(item => item.qname === "p.Base").holdCode, "LOCAL_MEMBER_TYPE_RESOLUTION");
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
