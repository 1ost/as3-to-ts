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
    const unsupported = await run(request("package p { public function helper():void {} public class Worker {} }"));
    assert.equal(unsupported.ok, false);
    assert.match(unsupported.error, /HARDENED_LOCAL_DECLARATION_CONTENT/);
    const capped = await run(request("package p { public class Worker {} }", 1));
    assert.equal(capped.ok, false);
    assert.equal(capped.resourceLimit, true);
    const malformed = await run({ bad: true });
    assert.equal(malformed.ok, false);
    assert.equal(malformed.error, "invalid declaration request");
});

test("file-local classes retain original signatures, source ownership and separate import scope", async () => {
    for (const [owner, sourcePath] of [["First", "fixtures/First.as"], ["Second", "C:\\fixtures\\Second.as"]]) {
        const content = `package p { import packageScope.Visible; public class ${owner} {} }
import fileScope.Base;
import fileScope.*;
final class Item extends Base implements IReady {
    public var delayfrm:int;
    public var fn:Function;
    public var params:Array;
    public var isRepeat:Boolean;
    public function Item() { super(); }
}`;
        const response = await run({ ...request(content), sourcePath });
        assert.equal(response.ok, true, response.error);
        const value = JSON.parse(response.json);
        assert.equal(value.sourceSha256, sha256(content));
        assert.deepEqual(value.imports, ["packageScope.Visible"]);
        assert.equal(value.fileLocalClasses.length, 1);
        const helper = value.fileLocalClasses[0];
        assert.equal(helper.schema, "as3-file-local-class-declaration@1");
        assert.equal(helper.ownerQualifiedName, `p.${owner}`);
        assert.equal(helper.namespaceUri, `FilePrivateNS:${owner}`);
        assert.equal(helper.name, "Item");
        assert.match(helper.sourceNodeId, /^n[0-9]+$/);
        assert.deepEqual(helper.modifiers, ["final"]);
        assert.deepEqual(helper.imports, ["fileScope.Base", "fileScope.*"]);
        assert.deepEqual(helper.extendsNames, ["Base"]);
        assert.deepEqual(helper.implementsNames, ["IReady"]);
        assert.deepEqual(helper.members.map(member => [member.kind, member.name, member.fieldType]), [
            ["field", "delayfrm", "int"], ["field", "fn", "Function"],
            ["field", "params", "Array"], ["field", "isRepeat", "Boolean"],
            ["constructor", "Item", null],
        ]);
    }
});

test("file-local declaration extraction rejects malformed or unsupported file scope", async () => {
    for (const [suffix, code] of [
        ["class Item {} class Item {}", "HARDENED_LOCAL_FILE_CLASS"],
        ["public class Item {}", "HARDENED_LOCAL_FILE_CLASS"],
        ["import q.Base; import q.Base; class Item {}", "HARDENED_LOCAL_DECLARATION_IMPORT"],
        ["function helper():void {}", "HARDENED_LOCAL_FILE_CONTENT"],
    ]) {
        const response = await run(request(`package p { public class Worker {} } ${suffix}`));
        assert.equal(response.ok, false, suffix);
        assert.match(response.error, new RegExp(code));
    }
    const invalidPath = await run({ ...request("package p { public class Worker {} } class Item {}"), sourcePath: "invalid-name.as" });
    assert.equal(invalidPath.ok, false);
    assert.match(invalidPath.error, /HARDENED_LOCAL_FILE_SOURCE/);
    const ordinary = await run(request("package p { public class Worker {} }"));
    assert.equal(ordinary.ok, true);
    assert.equal(Object.hasOwn(JSON.parse(ordinary.json), "fileLocalClasses"), false);
});


test("XML literal bodies retain source-bound declarations without claiming body support", async () => {
    const source = 'package p {\n import flash.display.DisplayObjectContainer;\n public class Markup {\n private static var owner:DisplayObjectContainer;\n public static function setBase(value:DisplayObjectContainer):void { owner=value; }\n public function markup():* {\n var result:*;\n result = <root>\n<icon iconUrl="miniStar"/>\n</root>;\n return result;\n }\n }\n}\n';
    const first = await run(request(source));
    assert.equal(first.ok, true, first.error);
    const second = await run(request(source));
    assert.equal(first.json, second.json);
    const value = JSON.parse(first.json);
    assert.equal(value.sourceSha256, sha256(source));
    const method = value.members.find(member => member.name === "setBase");
    assert.ok(method);
    assert.deepEqual(method.modifiers, ["public", "static"]);
    assert.equal(method.parameters[0].type, "DisplayObjectContainer");
    assert.equal(method.returnType, "void");
    assert.notEqual((await run(request(source.replace('miniStar', 'otherStar')))).json, first.json);
});
