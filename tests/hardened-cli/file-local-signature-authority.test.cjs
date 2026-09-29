"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const test = require("node:test");
const ts = require("typescript-4-9");
const ROOT = path.resolve(__dirname, "../..");
const sha256 = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(",")}]`
    : value !== null && typeof value === "object"
        ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`
        : JSON.stringify(value);
const bytes = value => `${canonical(value)}\n`;
const modules = new Map();
function load(file) {
    if (modules.has(file)) return modules.get(file);
    const value = { exports: {} };
    modules.set(file, value.exports);
    const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: {
        target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS,
    } }).outputText;
    Function("require", "module", "exports", code)(name => name.startsWith(".")
        ? load(path.resolve(path.dirname(file), `${name}.ts`)) : require(name), value, value.exports);
    return value.exports;
}
const { loadLocalTypeAuthority } = load(path.join(ROOT, "src/hardened/local-types.ts"));
const { loadLocalMemberAuthority, localFileSignature } = load(path.join(ROOT, "src/hardened/local-members.ts"));

test("private signature authority derives distinct field, parameter and return types from each original owner", t => {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "file-local-authority-")));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    // Equal basenames have equal reflective namespace strings, but distinct source owners.
    const entries = ["first", "second"].map((packageName, index) => {
        const sourcePath = `game-client/tapplication_main/src/${packageName}/Owner.as`;
        const source = `package ${packageName} { public class Owner { public var item:Item; public function give():Item { return item; } public function take(value:Item):Boolean { return value===item; } } }
class Item { public var count:int; public function Item() { super(); } }`;
        fs.mkdirSync(path.dirname(path.join(root, sourcePath)), { recursive: true });
        fs.writeFileSync(path.join(root, sourcePath), source);
        return {
            componentId: "scc-00001", graphSourceSha256: sha256(source), importable: true,
            module: "application", nodeId: String(index + 1).padStart(16, "0"), prerequisites: [],
            qname: `${packageName}.Owner`, sourceContentSha256: sha256(source), sourcePath,
            targetPath: `game-client/layaair/src/application/${packageName}/Owner.ts`,
            topologicalLevel: 0, typeKind: "class",
        };
    });
    const typeMap = {
        schema: "bleach-local-as3-type-map@2", entries, entryCount: entries.length,
        dependencyGraphRawSha256: "1".repeat(64), dependencyGraphSemanticSha256: "2".repeat(64),
        sourceManifestSha256: "3".repeat(64),
    };
    const typeBytes = bytes(typeMap);
    const censusBytes = bytes({ schema: "swf-capability-census@1", as3SourceCapabilities: { apis: [] } });
    const worker = path.join(ROOT, "lib/declaration-worker.js");
    const workerSha = sha256(fs.readFileSync(worker));
    fs.writeFileSync(path.join(root, "types.json"), typeBytes);
    fs.writeFileSync(path.join(root, "census.json"), censusBytes);
    const outputs = ["first.json", "second.json"].map(name => {
        const output = path.join(root, name);
        execFileSync(process.execPath, [path.join(ROOT, "tools/generate-local-member-map.cjs"),
            path.join(root, "types.json"), output, root, worker, path.join(root, "census.json"), sha256(censusBytes)],
        { cwd: ROOT, timeout: 15000, stdio: "pipe" });
        return fs.readFileSync(output, "utf8");
    });
    assert.equal(outputs[0], outputs[1]);
    const document = JSON.parse(outputs[0]);
    assert.equal(document.completeCount, 2);
    assert.equal(document.heldCount, 0);
    assert.deepEqual(document.entries.map(entry => entry.qname), ["first.Owner", "second.Owner"]);
    const types = loadLocalTypeAuthority({ json: typeBytes, sha256: sha256(typeBytes), expectedEntryCount: 2,
        expectedDependencyGraphRawSha256: typeMap.dependencyGraphRawSha256,
        expectedDependencyGraphSemanticSha256: typeMap.dependencyGraphSemanticSha256,
        expectedSourceManifestSha256: typeMap.sourceManifestSha256 }, sha256);
    function admit(value) {
        const json = bytes(value);
        return loadLocalMemberAuthority({ json, sha256: sha256(json), expectedEntryCount: 2,
            expectedCompleteCount: 2, expectedHeldCount: 0, expectedLocalTypeMapSha256: sha256(typeBytes),
            expectedDeclarationWorkerSha256: workerSha, expectedSourceCensusSha256: sha256(censusBytes) }, sha256, types);
    }
    const loaded = admit(document);
    for (const [index, entry] of loaded.entries.entries()) {
        const helper = entry.declaration.fileLocalClasses[0];
        assert.equal(helper.ownerQualifiedName, entries[index].qname);
        assert.equal(helper.namespaceUri, "FilePrivateNS:Owner");
        assert.equal(helper.name, "Item");
        assert.equal(Object.isFrozen(helper.members), true);
        assert.equal(entry.sourceContentSha256, sha256(fs.readFileSync(path.join(root, entries[index].sourcePath))));
    }
    const privateKeys = entries.map(entry => `FilePrivate(application:${entry.sourcePath})::Item`);
    assert.notEqual(privateKeys[0], privateKeys[1]);
    for(const [index,entry] of loaded.entries.entries()) {
        assert.equal(entry.declaration.members.find(member=>member.name==='item').fieldType,privateKeys[index]);
        assert.equal(entry.declaration.members.find(member=>member.name==='give').returnType,privateKeys[index]);
        assert.equal(entry.declaration.members.find(member=>member.name==='take').parameters[0].type,privateKeys[index]);
        const derived=localFileSignature(loaded,'application',privateKeys[index]);
        assert.equal(derived.owner,types.entriesByIdentity[`application\0${entry.qname}`]);
        assert.equal(derived.type.sourceContentSha256,entry.sourceContentSha256);
        assert.equal(derived.type.importable,false);
        assert.match(derived.type.targetPath,/Owner\.file-local\/Item\.ts$/);
        assert.equal(derived.member.declaration.members.find(member=>member.name==='count').fieldType,'int');
        assert.equal(localFileSignature(loaded,'application',privateKeys[index]),derived);
    }
    assert.equal(localFileSignature(loaded,'application','Item'),undefined);
    assert.equal(localFileSignature(loaded,'bootstrap',privateKeys[0]),undefined);
    assert.throws(()=>localFileSignature({...loaded},'application',privateKeys[0]),/immutable loaded/);
    for(const name of [privateKeys[1],'FilePrivate(application:forged.as)::Item']) {
        const forged=structuredClone(document);
        forged.entries[0].declaration.members.find(member=>member.name==='item').fieldType=name;
        assert.throws(()=>admit(forged),error=>error.code==='HARDENED_LOCAL_MEMBER_SIGNATURE');
    }
    const missingOwnerHeader=structuredClone(document);
    delete missingOwnerHeader.entries[0].declaration.fileLocalClasses;
    assert.throws(()=>admit(missingOwnerHeader),error=>error.code==='HARDENED_LOCAL_MEMBER_SIGNATURE');
    assert.equal(loaded.entriesByIdentity["application\0Item"], undefined);
    for (const mutate of [
        helper => { helper.ownerQualifiedName = "second.Owner"; },
        helper => { helper.namespaceUri = "FilePrivateNS:Other"; },
        helper => { helper.sourceNodeId = "synthetic"; },
        helper => { helper.modifiers = ["public"]; },
        helper => { helper.imports = ["node:fs"]; },
        helper => { helper.extendsNames = ["Base", "Other"]; },
        helper => { helper.members.find(member => member.kind === "constructor").name = "Other"; },
        helper => { helper.extra = true; },
    ]) {
        const drift = structuredClone(document);
        mutate(drift.entries[0].declaration.fileLocalClasses[0]);
        assert.throws(() => admit(drift), error => error.code === "HARDENED_LOCAL_FILE_DECLARATION");
    }
    const invalidMember = structuredClone(document);
    invalidMember.entries[0].declaration.fileLocalClasses[0].members[0].fieldType = "node:fs";
    assert.throws(() => admit(invalidMember), error => error.code === "HARDENED_LOCAL_MEMBER_SIGNATURE");
    for (const helpers of [null, [], [document.entries[0].declaration.fileLocalClasses[0],
        document.entries[0].declaration.fileLocalClasses[0]]]) {
        const drift = structuredClone(document);
        drift.entries[0].declaration.fileLocalClasses = helpers;
        assert.throws(() => admit(drift), error => error.code === "HARDENED_LOCAL_FILE_DECLARATION");
    }
});
