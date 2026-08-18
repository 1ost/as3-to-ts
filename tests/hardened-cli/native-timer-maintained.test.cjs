"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const SOURCE_REPOSITORY = path.resolve(process.env.HARDENED_SOURCE_REPO
    || "C:/Users/admin/Desktop/GITHUB REPO/bleach-services");
const CENSUS_PATH = path.resolve(process.env.HARDENED_SOURCE_CAPABILITY_CENSUS
    || path.join(SOURCE_REPOSITORY,
        "as3-to-layaair-porting-kit/generated/reports/swf-capability-census.json"));

function sha256(text) {
    return crypto.createHash("sha256").update(text.replace(/\r\n?/g, "\n"), "utf8").digest("hex");
}

function actionScriptFiles(root) {
    const result = [];
    const pending = [root];
    while (pending.length > 0) {
        const directory = pending.pop();
        const entries = fs.readdirSync(directory, { withFileTypes: true })
            .sort((left, right) => Buffer.compare(Buffer.from(left.name), Buffer.from(right.name)));
        for (const entry of entries) {
            const target = path.join(directory, entry.name);
            if (entry.isDirectory()) pending.push(target);
            else if (entry.isFile() && entry.name.endsWith(".as")) result.push(target);
        }
    }
    return result.sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
}

test("native timer authority authenticates exact source and full maintained use census", () => {
    const receiptText = fs.readFileSync(path.join(ROOT, "config/native-timer-authority.json"), "utf8")
        .replace(/\r\n?/g, "\n");
    const receipt = JSON.parse(receiptText);
    assert.equal(receipt.schema, "bleach-native-timer-authority@1");
    assert.equal(receipt.module, "@bleach/as3-runtime/AS3Timer");
    assert.equal(receipt.sourcePath, "src/hardened-runtime/AS3Timer.ts");
    const runtimeSource = fs.readFileSync(path.join(ROOT, ...receipt.sourcePath.split("/")), "utf8");
    assert.equal(sha256(runtimeSource), receipt.sourceSha256,
        "receipt source hash must authenticate the actual native target source");
    assert.deepEqual(receipt.exports, [
        { name: "clearTimeout", signature: "(id: number) => void" },
        { name: "setTimeout", signature: "(closure: Function, delay: number, ...args: unknown[]) => number" },
    ]);
    assert.doesNotMatch(runtimeSource, /export\s+(?:class|interface|type)\b/,
        "public timer source must expose only the two authenticated functions");

    const census = JSON.parse(fs.readFileSync(CENSUS_PATH, "utf8"));
    const expected = {
        setTimeout: { calls: 56, files: 27, explicitImports: 15 },
        clearTimeout: { calls: 13, files: 6, explicitImports: 2 },
    };
    const files = [
        ...actionScriptFiles(path.join(SOURCE_REPOSITORY, "game-client/tapplication_main/src")),
        ...actionScriptFiles(path.join(SOURCE_REPOSITORY, "game-client/tmain/src")),
    ];
    for (const [name, counts] of Object.entries(expected)) {
        const qname = `flash.utils.${name}`;
        const api = census.as3SourceCapabilities.apis.find(item => item.qname === qname);
        assert.ok(api, `${qname} must exist in the source census`);
        assert.equal(api.classification, "layaair-flash-api-bridge");
        assert.deepEqual(api.roles, ["import", "package-function", "wildcard-resolution"]);
        assert.equal(api.occurrenceCount, counts.files);
        const uses = census.as3SourceCapabilities.memberUses.filter(item => item.qname === qname
            && item.member === "<call>" && item.access === "call" && item.context === "package-function");
        assert.equal(uses.reduce((sum, item) => sum + item.count, 0), counts.calls);

        let sourceCalls = 0;
        let sourceFiles = 0;
        let explicitImports = 0;
        for (const file of files) {
            const source = fs.readFileSync(file, "utf8");
            const calls = source.match(new RegExp(`\\b${name}\\s*\\(`, "g")) || [];
            if (calls.length > 0) sourceFiles++;
            sourceCalls += calls.length;
            explicitImports += (source.match(new RegExp(`import\\s+flash\\.utils\\.${name}\\s*;`, "g")) || []).length;
        }
        assert.deepEqual({ calls: sourceCalls, files: sourceFiles, explicitImports }, counts,
            `${qname} maintained roots must remain synchronized with the checked census`);
    }
});

test("timer lane contains no AVM, QName, reflection, or dynamic loading seam", () => {
    const paths = [
        "src/hardened-runtime/AS3Timer.ts",
        "src/hardened-runtime/internal/AS3TimerRuntime.ts",
        "src/hardened-runtime/AS3MethodClosure.ts",
    ];
    for (const relative of paths) {
        const source = fs.readFileSync(path.join(ROOT, ...relative.split("/")), "utf8");
        assert.doesNotMatch(source, /\b(?:avm2?|ABC|QName|eval|Function\s*\(|import\s*\()/i, relative);
    }
});
