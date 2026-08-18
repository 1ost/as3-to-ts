"use strict";

const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repository = path.resolve(__dirname, "../..");
const executable = path.join(repository, "bin", "as3-frontend");

function temporaryDirectory(t) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "as3-frontend-test-"));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    return directory;
}

function write(directory, relativePath, content) {
    const target = path.join(directory, ...relativePath.split("/"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, "utf8");
}

function invoke(args, cwd = repository, timeout = 10_000) {
    return spawnSync(process.execPath, [executable, ...args], {
        cwd,
        encoding: "utf8",
        timeout,
        windowsHide: true,
    });
}

function invokeAsync(args, cwd = repository) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [executable, ...args], {
            cwd,
            windowsHide: true,
            stdio: ["ignore", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";
        child.stdout.setEncoding("utf8").on("data", chunk => { stdout += chunk; });
        child.stderr.setEncoding("utf8").on("data", chunk => { stderr += chunk; });
        child.once("error", reject);
        child.once("exit", status => resolve({ status, stdout, stderr }));
    });
}

function snapshot(directory, prefix = "", result = new Map()) {
    const entries = fs.readdirSync(path.join(directory, prefix), { withFileTypes: true })
        .sort((left, right) => Buffer.compare(Buffer.from(left.name), Buffer.from(right.name)));
    for (const entry of entries) {
        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
            snapshot(directory, relativePath, result);
        } else {
            result.set(relativePath, fs.readFileSync(path.join(directory, ...relativePath.split("/"))));
        }
    }
    return result;
}

function publicationDebris(directory) {
    return fs.readdirSync(directory).filter(name =>
        name.includes(".staging-") || name.startsWith(".as3-frontend-publish-"));
}

const validA = "package example.a { public class A { public function A() {} } }\n";
const validB = "package example.b { public class B { public function B() {} } }\n";

test("publishes sorted deterministic artifacts across working directories", t => {
    const root = temporaryDirectory(t);
    const source = path.join(root, "source");
    const first = path.join(root, "first");
    const second = path.join(root, "second");
    fs.mkdirSync(source);
    write(source, "z/B.as", validB);
    write(source, "a/A.as", validA);

    const firstRun = invoke([source, first], root);
    const secondRun = invoke([source, second], os.tmpdir());
    assert.equal(firstRun.status, 0, firstRun.stderr);
    assert.equal(secondRun.status, 0, secondRun.stderr);

    const firstSnapshot = snapshot(first);
    const secondSnapshot = snapshot(second);
    assert.deepEqual([...firstSnapshot.keys()], [...secondSnapshot.keys()]);
    for (const [name, bytes] of firstSnapshot) {
        assert.deepEqual(bytes, secondSnapshot.get(name), name);
    }
    const manifest = JSON.parse(fs.readFileSync(path.join(first, "manifest.json"), "utf8"));
    assert.deepEqual(manifest.files.map(file => file.sourcePath), ["a/A.as", "z/B.as"]);
    assert.deepEqual([...firstSnapshot.keys()], ["ast/a/A.ast.json", "ast/z/B.ast.json", "manifest.json"]);
});

test("rejects unknown, plugin, visitor, abbreviated, and duplicate options before filesystem access", () => {
    for (const option of ["-x", "--unknown", "--plugin=x", "--plugins=x", "--visitor=x", "--visitors=x", "--commonjs", "--time=1"]) {
        const result = invoke(["missing-source", "missing-output", option]);
        assert.equal(result.status, 2, `${option}: ${result.stderr}`);
        assert.match(result.stderr, /unknown option/);
        assert.doesNotMatch(result.stderr, /source directory/);
    }
    const duplicate = invoke(["missing-source", "missing-output", "--max-files=1", "--max-files=2"]);
    assert.equal(duplicate.status, 2);
    assert.match(duplicate.stderr, /duplicate option/);
});

test("rejects invalid and over-ceiling resource limits", () => {
    for (const value of ["0", "-1", "1.5", "NaN", "100001"]) {
        const result = invoke(["missing-source", "missing-output", `--max-files=${value}`]);
        assert.equal(result.status, 2, `${value}: ${result.stderr}`);
    }
});

test("help and version do not inspect roots", () => {
    const help = invoke(["--help"], path.parse(repository).root);
    const version = invoke(["--version"], path.parse(repository).root);
    assert.equal(help.status, 0, help.stderr);
    assert.match(help.stdout, /as3-frontend parse/);
    assert.equal(version.status, 0, version.stderr);
    assert.equal(version.stdout, "0.1.0\n");
});

test("rejects non-NFC source paths and collision keys cover case and NFC", t => {
    const { portableCollisionKey } = require(path.join(repository, "lib", "command.js"));
    assert.equal(portableCollisionKey("Folder/Foo.as"), portableCollisionKey("folder/foo.AS"));
    assert.equal(portableCollisionKey("caf\u00e9.as"), portableCollisionKey("cafe\u0301.as"));
    assert.equal(portableCollisionKey("Stra\u00dfe.as"), portableCollisionKey("STRASSE.as"));
    assert.equal(portableCollisionKey("Stra\u00dfe.as"), portableCollisionKey("STRA\u1e9eE.as"));

    const root = temporaryDirectory(t);
    const source = path.join(root, "source");
    fs.mkdirSync(source);
    write(source, "cafe\u0301.as", validA);
    const result = invoke([source, path.join(root, "output")]);
    assert.equal(result.status, 3, result.stderr);
    assert.match(result.stderr, /non-NFC path/);
});

test("rejects ambiguous Unicode casing, hardlinks, and empty trees", t => {
    const root = temporaryDirectory(t);

    const colliding = path.join(root, "colliding");
    fs.mkdirSync(colliding);
    write(colliding, "Stra\u00dfe.as", validA);
    write(colliding, "STRA\u1e9eE.as", validB);
    const collisionResult = invoke([colliding, path.join(root, "collision-output")]);
    assert.equal(collisionResult.status, 3, collisionResult.stderr);
    assert.match(collisionResult.stderr, /non-ASCII cased source path/);

    const linked = path.join(root, "hardlinks");
    fs.mkdirSync(linked);
    write(linked, "A.as", validA);
    fs.linkSync(path.join(linked, "A.as"), path.join(linked, "B.as"));
    const hardlinkResult = invoke([linked, path.join(root, "hardlink-output")]);
    assert.equal(hardlinkResult.status, 3, hardlinkResult.stderr);
    assert.match(hardlinkResult.stderr, /hard-linked source aliases/);

    const empty = path.join(root, "empty");
    fs.mkdirSync(empty);
    const emptyResult = invoke([empty, path.join(root, "empty-output")]);
    assert.equal(emptyResult.status, 3, emptyResult.stderr);
    assert.match(emptyResult.stderr, /contains no ActionScript files/);
});

test("rejects source symlinks or junctions without publishing", t => {
    const root = temporaryDirectory(t);
    const source = path.join(root, "source");
    const outside = path.join(root, "outside");
    fs.mkdirSync(source);
    fs.mkdirSync(outside);
    write(outside, "Outside.as", validA);
    try {
        fs.symlinkSync(outside, path.join(source, "linked"), process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
        if (error && (error.code === "EPERM" || error.code === "EACCES")) {
            t.skip(`symlink creation unavailable: ${error.code}`);
            return;
        }
        throw error;
    }
    const output = path.join(root, "output");
    const result = invoke([source, output]);
    assert.equal(result.status, 3, result.stderr);
    assert.match(result.stderr, /symlink or junction/);
    assert.equal(fs.existsSync(output), false);
});

test("rejects symlink or junction components in source and output roots", t => {
    const root = temporaryDirectory(t);
    const realSource = path.join(root, "real-source");
    const realOutputParent = path.join(root, "real-output-parent");
    fs.mkdirSync(realSource);
    fs.mkdirSync(realOutputParent);
    write(realSource, "A.as", validA);
    const sourceLink = path.join(root, "source-link");
    const outputParentLink = path.join(root, "output-parent-link");
    try {
        const linkType = process.platform === "win32" ? "junction" : "dir";
        fs.symlinkSync(realSource, sourceLink, linkType);
        fs.symlinkSync(realOutputParent, outputParentLink, linkType);
    } catch (error) {
        if (error && (error.code === "EPERM" || error.code === "EACCES")) {
            t.skip(`symlink creation unavailable: ${error.code}`);
            return;
        }
        throw error;
    }

    const sourceResult = invoke([sourceLink, path.join(root, "source-output")]);
    assert.equal(sourceResult.status, 3, sourceResult.stderr);
    assert.match(sourceResult.stderr, /symlink or junction component/);

    const outputResult = invoke([realSource, path.join(outputParentLink, "output")]);
    assert.equal(outputResult.status, 3, outputResult.stderr);
    assert.match(outputResult.stderr, /symlink or junction component/);
    assert.equal(fs.existsSync(path.join(realOutputParent, "output")), false);
});

test("rejects source/output overlap and an existing output without modifying it", t => {
    const root = temporaryDirectory(t);
    const source = path.join(root, "source");
    fs.mkdirSync(source);
    write(source, "A.as", validA);

    const overlap = invoke([source, path.join(source, "generated")]);
    assert.equal(overlap.status, 3, overlap.stderr);
    assert.match(overlap.stderr, /must not overlap/);

    const output = path.join(root, "output");
    fs.mkdirSync(output);
    write(output, "sentinel.txt", "preserve");
    const existing = invoke([source, output]);
    assert.equal(existing.status, 3, existing.stderr);
    assert.equal(fs.readFileSync(path.join(output, "sentinel.txt"), "utf8"), "preserve");
});

test("serializes concurrent portable-case-equivalent output reservations", async t => {
    const root = temporaryDirectory(t);
    const source = path.join(root, "source");
    fs.mkdirSync(source);
    write(source, "Hang.as", "package p { public class Hang extends Base /* comment */ {} }\n");

    const [first, second] = await Promise.all([
        invokeAsync([source, path.join(root, "PortableOutput"), "--timeout-ms=1500"], root),
        invokeAsync([source, path.join(root, "portableoutput"), "--timeout-ms=1500"], root),
    ]);
    assert.deepEqual([first.status, second.status].sort((left, right) => left - right), [0, 6]);
    assert.match(`${first.stderr}${second.stderr}`, /reserve output publication/);
    assert.equal(fs.existsSync(path.join(root, "PortableOutput")), true);
    assert.deepEqual(publicationDebris(root), []);
});

test("enforces file caps before parser work", t => {
    const root = temporaryDirectory(t);
    const source = path.join(root, "source");
    fs.mkdirSync(source);
    write(source, "A.as", validA);
    const output = path.join(root, "output");
    const result = invoke([source, output, "--max-file-bytes=1"]);
    assert.equal(result.status, 5, result.stderr);
    assert.match(result.stderr, /max-file-bytes/);
    assert.equal(fs.existsSync(output), false);
});

test("enforces discovery depth and complete-output caps", t => {
    const root = temporaryDirectory(t);
    const source = path.join(root, "source");
    fs.mkdirSync(source);
    write(source, "nested/A.as", validA);

    const depthOutput = path.join(root, "depth-output");
    const depthResult = invoke([source, depthOutput, "--max-depth=1"]);
    assert.equal(depthResult.status, 5, depthResult.stderr);
    assert.match(depthResult.stderr, /max-depth/);
    assert.equal(fs.existsSync(depthOutput), false);

    const entriesSource = path.join(root, "entries-source");
    fs.mkdirSync(entriesSource);
    write(entriesSource, "one.txt", "1");
    write(entriesSource, "two.txt", "2");
    write(entriesSource, "three.txt", "3");
    const entriesOutput = path.join(root, "entries-output");
    const entriesResult = invoke([entriesSource, entriesOutput, "--max-entries=2"]);
    assert.equal(entriesResult.status, 5, entriesResult.stderr);
    assert.match(entriesResult.stderr, /max-entries/);
    assert.equal(fs.existsSync(entriesOutput), false);

    const baseline = path.join(root, "baseline");
    const baselineResult = invoke([source, baseline]);
    assert.equal(baselineResult.status, 0, baselineResult.stderr);
    const totalOutputBytes = [...snapshot(baseline).values()]
        .reduce((total, bytes) => total + bytes.byteLength, 0);
    const cappedOutput = path.join(root, "capped-output");
    const cappedResult = invoke([
        source,
        cappedOutput,
        `--max-total-output-bytes=${totalOutputBytes - 1}`,
    ]);
    assert.equal(cappedResult.status, 5, cappedResult.stderr);
    assert.match(cappedResult.stderr, /complete output exceeds/);
    assert.equal(fs.existsSync(cappedOutput), false);
    assert.deepEqual(publicationDebris(root), []);
});

test("contains fatal low-memory parser failures in the child process", t => {
    const root = temporaryDirectory(t);
    const source = path.join(root, "source");
    fs.mkdirSync(source);
    write(source, "A.as", validA);
    const output = path.join(root, "output");
    const result = invoke([source, output, "--max-old-space-mb=1"], root, 10_000);
    assert.equal(result.status, 5, result.stderr);
    assert.match(result.stderr, /resource limit/);
    assert.equal(fs.existsSync(output), false);
    assert.deepEqual(publicationDebris(root), []);
});

test("parses a comment after extends without the historical parser hang", t => {
    const root = temporaryDirectory(t);
    const source = path.join(root, "source");
    fs.mkdirSync(source);
    write(source, "Hang.as", "package p { public class Hang extends Base /* comment */ {} }\n");
    const output = path.join(root, "output");
    const result = invoke([source, output, "--timeout-ms=300"], root, 5_000);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(output), true);
    assert.deepEqual(publicationDebris(root), []);
});

test("parses a trailing line comment without the historical scanner hang", t => {
    const root = temporaryDirectory(t);
    const source = path.join(root, "source");
    fs.mkdirSync(source);
    write(source, "Hang.as", "package p { public class Hang {} } // no final newline");
    const output = path.join(root, "output");
    const result = invoke([source, output, "--timeout-ms=300"], root, 5_000);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(output), true);
    assert.deepEqual(publicationDebris(root), []);
});

test("parse failure cannot expose a partial output tree", t => {
    const root = temporaryDirectory(t);
    const source = path.join(root, "source");
    fs.mkdirSync(source);
    write(source, "A.as", validA);
    write(source, "B.as", "package p { public class B { public function broken(:void {} } }\n");
    const output = path.join(root, "output");
    const result = invoke([source, output]);
    assert.equal(result.status, 4, result.stderr);
    assert.match(result.stderr, /parse failed for B\.as/);
    assert.equal(fs.existsSync(output), false);
    assert.deepEqual(publicationDebris(root), []);
});

test("production bundles exclude legacy emitter, visitors, wrappers, and runtime dependencies", () => {
    const command = fs.readFileSync(path.join(repository, "lib", "command.js"), "utf8");
    const worker = fs.readFileSync(path.join(repository, "lib", "parser-worker.js"), "utf8");
    for (const forbidden of ["custom-visitors", "ConversionUtils", "readline-sync", "minimist", "fs-extra", "emit/emitter"]) {
        assert.equal(command.includes(forbidden), false, forbidden);
        assert.equal(worker.includes(forbidden), false, forbidden);
    }
    const packageJson = JSON.parse(fs.readFileSync(path.join(repository, "package.json"), "utf8"));
    assert.equal(packageJson.private, true);
    assert.equal(packageJson.license, "Apache-2.0");
    assert.deepEqual(packageJson.dependencies || {}, {});
    assert.equal(packageJson.scripts.postversion, undefined);

    assert.deepEqual(packageJson.files, [
        "bin/as3-frontend",
        "lib/command.js",
        "lib/parser-worker.js",
        "lib/declaration-worker.js",
        "config/authority-lock.json",
        "config/capability-map.json",
        "config/local-type-map.json",
        "config/local-member-map.json",
        "config/runtime-type-authority-lock.json",
        "config/runtime-type-predicates.json",
        "src/hardened-runtime/**/*.ts",
        "src/hardened-cli/THIRD_PARTY_NOTICES.md",
    ]);

    const commandInputs = Object.keys(JSON.parse(
        fs.readFileSync(path.join(repository, "lib", "command.meta.json"), "utf8"),
    ).inputs);
    assert.equal(commandInputs.every(input =>
        input === "src/command.ts" || input.startsWith("src/hardened-cli/")
        || input.startsWith("src/hardened/") || input.includes("node_modules/typescript-4-9/")), true);

    const workerInputs = Object.keys(JSON.parse(
        fs.readFileSync(path.join(repository, "lib", "parser-worker.meta.json"), "utf8"),
    ).inputs);
    for (const input of workerInputs) {
        assert.equal(
            input.startsWith("src/hardened-cli/") ||
            input === "src/hardened/parser-normalizer.ts" ||
            input === "src/hardened/contracts.ts" ||
            input === "src/hardened/ledger.ts" ||
            input.startsWith("src/parse/") ||
            input.startsWith("src/syntax/") ||
            input.startsWith("src/reports/") ||
            input === "src/config.ts" ||
            input === "src/string.ts" ||
            input.includes("node_modules/sax/") ||
            input.includes("node_modules/object-assign/"),
            true,
            `unexpected parser bundle input: ${input}`,
        );
    }
});
