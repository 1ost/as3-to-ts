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

function rawSha256(bytes) {
    return crypto.createHash("sha256").update(bytes).digest("hex");
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
        { name: "clearInterval", signature: "(id: number) => void" },
        { name: "clearTimeout", signature: "(id: number) => void" },
        { name: "getTimer", signature: "() => number" },
        { name: "setInterval", signature: "(closure: Function, delay: number, ...args: unknown[]) => number" },
        { name: "setTimeout", signature: "(closure: Function, delay: number, ...args: unknown[]) => number" },
    ]);
    assert.doesNotMatch(runtimeSource, /export\s+(?:class|interface|type)\b/,
        "public timer source must expose only the five authenticated functions");

    const census = JSON.parse(fs.readFileSync(CENSUS_PATH, "utf8"));
    const expected = {
        clearInterval: { calls: 7, files: 4, explicitImports: 1,
            roles: ["import", "package-function", "wildcard-resolution"] },
        clearTimeout: { calls: 13, files: 6, explicitImports: 2,
            roles: ["import", "package-function", "wildcard-resolution"] },
        getTimer: { calls: 8, files: 5, explicitImports: 5,
            roles: ["import", "package-function"] },
        setInterval: { calls: 6, files: 4, explicitImports: 1,
            roles: ["import", "package-function", "wildcard-resolution"] },
        setTimeout: { calls: 56, files: 27, explicitImports: 15,
            roles: ["import", "package-function", "wildcard-resolution"] },
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
        assert.deepEqual(api.roles, counts.roles);
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
        assert.deepEqual({ calls: sourceCalls, files: sourceFiles, explicitImports },
            { calls: counts.calls, files: counts.files, explicitImports: counts.explicitImports },
            `${qname} maintained roots must remain synchronized with the checked census`);
    }
});

test("retained Pepper timer oracle is portable and binds cross-clear behavior to exact native inputs", () => {
    const evidenceRoot = path.join(ROOT, "tests/flash-oracle/native-timer");
    const fixture = fs.readFileSync(path.join(evidenceRoot, "RunMain.as"));
    const golden = fs.readFileSync(path.join(evidenceRoot, "pepper-flash-26.txt"));
    const provenance = JSON.parse(fs.readFileSync(path.join(evidenceRoot, "pepper-flash-26.json"), "utf8"));
    assert.equal(provenance.schema, "bleach-native-timer-pepper-oracle@1");
    assert.equal(provenance.fixture, "native-timer/RunMain.as");
    assert.equal(path.isAbsolute(provenance.fixture), false);
    assert.equal(/^[A-Za-z]:[\\/]/.test(provenance.fixture), false);
    assert.equal(rawSha256(fixture), provenance.fixtureSha256);
    assert.equal(rawSha256(golden), provenance.resultSha256);
    assert.equal(golden.toString("utf8"),
        "cross=0,0\ncontrol=2:alpha:2\nidsDistinct=true\ngetTimer=true:true\n");
    assert.equal(rawSha256(fs.readFileSync(path.join(SOURCE_REPOSITORY,
        ...provenance.captureScript.split("/")))), provenance.captureScriptSha256);
    assert.equal(rawSha256(fs.readFileSync(path.join(SOURCE_REPOSITORY,
        ...provenance.pepperPlugin.split("/")))), provenance.pepperPluginSha256);
    assert.deepEqual({
        compiler: provenance.compiler,
        compilerSha256: provenance.compilerSha256,
        oracle: provenance.oracle,
        playerglobal: provenance.playerglobal,
        playerglobalSha256: provenance.playerglobalSha256,
        swfVersion: provenance.swfVersion,
    }, {
        compiler: "Apache Flex mxmlc 4.16.1",
        compilerSha256: "cc07d749e376715e650271a9875289e49d94234902fff5e5fae287c478c8557b",
        oracle: "Pepper Flash 26.0.0.131",
        playerglobal: "Flash Player 26.0",
        playerglobalSha256: "0e450154692d044b1758064825e072476421560c43f6a026b12df4cfda82e295",
        swfVersion: 37,
    });
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
