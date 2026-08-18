"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const WORKER = path.join(ROOT, "lib/declaration-worker.js");

function sha256(bytes) {
    return crypto.createHash("sha256").update(bytes).digest("hex");
}

function run(request) {
    return new Promise((resolve, reject) => {
        const child = childProcess.fork(WORKER, [], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe", "ipc"] });
        let stdout = Buffer.alloc(0);
        let stderr = Buffer.alloc(0);
        child.stdout.on("data", chunk => { stdout = Buffer.concat([stdout, chunk]); });
        child.stderr.on("data", chunk => { stderr = Buffer.concat([stderr, chunk]); });
        const timer = setTimeout(() => {
            child.kill();
            reject(new Error("declaration worker timed out"));
        }, 2500);
        child.once("message", message => resolve({ message, child, stdout, stderr, timer }));
        child.once("error", reject);
        child.send(request);
    }).then(({ message, child, stdout, stderr, timer }) => new Promise((resolve, reject) => {
        child.once("exit", code => {
            clearTimeout(timer);
            try {
                assert.equal(code, 0);
                assert.equal(stdout.length, 0);
                assert.equal(stderr.length, 0);
                resolve(message);
            } catch (error) { reject(error); }
        });
    }));
}

function request(content, maxResultBytes = 1024 * 1024) {
    return {
        sourcePath: "fixtures/Worker.as",
        content,
        maxResultBytes,
        workerSha256: sha256(fs.readFileSync(WORKER)),
    };
}

test("declaration worker emits one closed parser-derived header document", async () => {
    const response = await run(request([
        "package p {",
        " import q.Base; import q.IReady;",
        " public class Worker extends Base implements IReady {",
        "  private var values:Vector.<int>;",
        "  public function Worker(index:int = -1) { super(); }",
        "  override protected function run(value:String,...rest):Object { return null; }",
        " }",
        "}",
    ].join("\n")));
    assert.equal(response.ok, true);
    assert.equal(response.workerSha256, request("").workerSha256);
    assert.equal(Buffer.byteLength(response.json), response.byteLength);
    const value = JSON.parse(response.json);
    assert.equal(value.schema, "as3-local-declaration-extract@1");
    assert.equal(value.qualifiedName, "p.Worker");
    assert.deepEqual(value.extendsNames, ["Base"]);
    assert.deepEqual(value.implementsNames, ["IReady"]);
    assert.equal(value.members[0].fieldType, "Vector.<int>");
    assert.deepEqual(value.members[1].parameters[0], { name: "index", type: "int", optional: true, rest: false });
    assert.equal(value.members[2].modifiers.includes("override"), true);
    assert.equal(value.members[2].parameters[1].rest, true);
});

test("declaration worker authenticates package constants and namespaces", async () => {
    const constant = await run(request("package p { public const SCore:TCore = new TCore(); }"));
    assert.equal(constant.ok, true);
    const constantValue = JSON.parse(constant.json);
    assert.equal(constantValue.declarationKind, "package");
    assert.equal(constantValue.qualifiedName, "p.SCore");
    assert.deepEqual(constantValue.members, [{
        kind: "field", name: "SCore", modifiers: ["public"], namespaceName: null,
        parameters: [], returnType: null, fieldType: "TCore", readonly: true,
    }]);
    const namespace = await run(request("package p { public namespace InternalSpace; }"));
    assert.equal(namespace.ok, true);
    const namespaceValue = JSON.parse(namespace.json);
    assert.equal(namespaceValue.declarationKind, "package");
    assert.equal(namespaceValue.qualifiedName, "p.InternalSpace");
    assert.equal(namespaceValue.members[0].kind, "namespace");
    assert.deepEqual(namespaceValue.members[0].modifiers, ["public"]);
});

test("declaration worker fails closed on unsupported package declarations and output caps", async () => {
    const unsupported = await run(request("package p { public function helper():void {} }"));
    assert.equal(unsupported.ok, false);
    assert.match(unsupported.error, /HARDENED_LOCAL_DECLARATION_CONTENT/);
    const capped = await run(request("package p { public class Worker {} }", 1));
    assert.equal(capped.ok, false);
    assert.equal(capped.resourceLimit, true);
    const malformed = await run({ bad: true });
    assert.equal(malformed.ok, false);
    assert.equal(malformed.error, "invalid declaration request");
});
