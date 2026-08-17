"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const EXPECTED_SOURCE_SHA256 = "2144b14090e51a1c0525ec3a35bfb8e532c6a19bb7ab355428ce70b4db7bde90";
const EXPECTED_TARGET_SHA256 = "c364d4a0fce5df16033980a3eba4e7a72d658993eef0f3675ea9771c9eba86d2";
const EXPECTED_SOURCE_HEAD = "a42bf2c73dce4ca0922bc603c5647a5ef0e515dd";
const EXPECTED_SOURCE_BLOB = "524d7e4143adff105799334f81b0fba1004a0cfd";
const EXPECTED_TARGET_HEAD = "4b9d9ae1b5cded82a2ea90ce97725c2682f514fe";
const EXPECTED_TARGET_BLOB = "4fb1c723f01ab54e953473d2943f25e6c33bf594";

function sha256(bytes) {
    return crypto.createHash("sha256").update(bytes, "utf8").digest("hex");
}

function requiredEnvironmentPath(name, expectedKind = "file") {
    const value = process.env[name];
    assert.ok(value, `${name} must identify the configured authority`);
    const resolved = path.resolve(value);
    const stats = fs.statSync(resolved);
    assert.ok(expectedKind === "directory" ? stats.isDirectory() : stats.isFile(),
        `${name} must identify an ordinary ${expectedKind}`);
    return resolved;
}

function loadModernTypeScript() {
    const root = requiredEnvironmentPath("HARDENED_TYPESCRIPT_PATH", "directory");
    const compiler = require(root);
    assert.equal(compiler.version, "4.9.5", "test gate pins the exact structural printer version");
    return compiler;
}

function git(repo, ...args) {
    return childProcess.execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" }).trim();
}

function compileHardenedSources(ts) {
    const output = fs.mkdtempSync(path.join(os.tmpdir(), "as3-semantic-ir-"));
    const sources = fs.readdirSync(path.join(ROOT, "src/hardened"))
        .filter((name) => name.endsWith(".ts"))
        .map((name) => path.join(ROOT, "src/hardened", name));
    const program = ts.createProgram(sources, {
        target: ts.ScriptTarget.ES2019,
        module: ts.ModuleKind.CommonJS,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        strict: true,
        noImplicitAny: true,
        skipLibCheck: true,
        rootDir: path.join(ROOT, "src"),
        outDir: output,
    });
    const emit = program.emit();
    const diagnostics = ts.getPreEmitDiagnostics(program).concat(emit.diagnostics);
    assert.deepEqual(diagnostics.map((item) => ts.flattenDiagnosticMessageText(item.messageText, "\n")), []);
    return { api: require(path.join(output, "hardened/index.js")), output };
}

function n(kind, text = null, children = []) {
    return { kind, text, children };
}

function mods(...values) {
    return n("MOD_LIST", null, values.map((value) => n("MODIFIER", value)));
}

function type(name) {
    return n("TYPE", name);
}

function dot(target, name) {
    return n("DOT", null, [target, n("LITERAL", name)]);
}

function call(target, args = []) {
    return n("CALL", null, [target, n("ARGUMENTS", null, args)]);
}

function parameter(name, typeName) {
    return n("PARAMETER", null, [n("NAME_TYPE_INIT", null, [n("NAME", name), type(typeName)])]);
}

function method(name, parameters, returnType, body, modifierValues = ["public"]) {
    return n("FUNCTION", "function", [
        mods(...modifierValues), n("NAME", name), n("PARAMETER_LIST", null, parameters), type(returnType), n("BLOCK", null, body),
    ]);
}

function constructor(body) {
    return n("FUNCTION", "function", [
        mods("public"), n("NAME", "Demo"), n("PARAMETER_LIST"), type(null), n("BLOCK", null, body),
    ]);
}

function buildTree(options = {}) {
    const superStatement = call(n("IDENTIFIER", "super"));
    const closureStatement = call(dot(n("IDENTIFIER", "this"), "addEventListener"), [
        n("LITERAL", '"ready"'), dot(n("IDENTIFIER", "this"), "onEvent"),
    ]);
    const body = options.badSuperOrder ? [closureStatement, superStatement] : [superStatement, closureStatement];
    if (options.unsupportedStatement) {
        body.push(n("WHILE"));
    }
    const field = n("VAR_LIST", null, [
        mods(...(options.fieldModifiers || ["private"])),
        n("NAME_TYPE_INIT", null, [n("NAME", "a"), type("Number"), n("INIT", null, [n("LITERAL", "1")])]),
        n("NAME_TYPE_INIT", null, [n("NAME", "b"), type("String"), n("INIT", null, [n("LITERAL", '"x"')])]),
    ]);
    const onEventBody = options.returnValue ? [n("RETURN", null, [n("LITERAL", "1")])] : [n("RETURN")];
    const members = [
        field,
        constructor(body),
        method("onEvent", [parameter("event", "Event")], "void",
            options.superInMethod ? [call(n("IDENTIFIER", "super"))] : onEventBody,
            options.staticMethod ? ["public", "static"] : ["public"]),
    ];
    if (options.noConstructor) {
        members.splice(1, 1);
    }
    const classChildren = [n("NAME", "Demo"), mods("public"), n("EXTENDS", "Sprite")];
    if (options.unsupportedChild) {
        classChildren.push(n("META_LIST"));
    }
    classChildren.push(n("CONTENT", null, members));
    return n("COMPILATION_UNIT", null, [
        n("PACKAGE", null, [
            n("NAME", "lobby.ui"),
            n("CONTENT", null, options.postClassImport ? [
                n("CLASS", null, classChildren),
                n("IMPORT", "flash.display.Sprite"),
                n("IMPORT", "flash.events.Event"),
            ] : [
                n("IMPORT", "flash.display.Sprite"),
                n("IMPORT", "flash.events.Event"),
                n("CLASS", null, classChildren),
            ]),
        ]),
        n("CONTENT"),
    ]);
}

function flatten(tree) {
    const nodes = [];
    let cursor = 0;
    function visit(node, parentId, order) {
        const id = `n${nodes.length}`;
        const text = node.text === undefined ? null : node.text;
        const width = typeof text === "string" && text.length > 0 ? text.length : 1;
        nodes.push({ id, parentId, order, kind: node.kind, span: { start: cursor, end: cursor + width }, text });
        cursor += width;
        node.children.forEach((child, index) => visit(child, id, index));
    }
    visit(tree, null, 0);
    const sourceText = " ".repeat(cursor);
    const ast = {
        schema: "authored-ui-as3-flat-ast@1",
        sourceSha256: sha256(sourceText),
        fingerprintSha256: sha256(JSON.stringify(nodes)),
        nodes,
    };
    return { ast, sourceText };
}

function adapt(api, tree, authority) {
    const normalized = flatten(tree);
    return api.adaptNormalizedParserAst(normalized.ast, authority, normalized.sourceText, sha256);
}

function mappingDocument() {
    return {
        schema: "as3-source-to-laya-capability-map@1",
        mappings: [
            {
                sourceQName: "flash.display.Sprite",
                sourceRoles: ["base-type", "import"],
                sourceMember: null,
                targetCapabilityId: "api.flash.display",
                targetModule: "src/layaAir/flash/display/Sprite.ts",
                targetExport: "Sprite",
                targetKind: "class",
                targetSignature: "typeof Sprite",
                targetMember: null,
            },
            {
                sourceQName: "flash.events.Event",
                sourceRoles: ["import"],
                sourceMember: null,
                targetCapabilityId: "api.flash.events",
                targetModule: "src/layaAir/flash/events/Event.ts",
                targetExport: "Event",
                targetKind: "class",
                targetSignature: "typeof Event",
                targetMember: null,
            },
            {
                sourceQName: "flash.display.Sprite",
                sourceRoles: ["instance-member"],
                sourceMember: {
                    access: "call",
                    name: "addEventListener",
                    minArgs: 2,
                    maxArgs: 5,
                    signature: "public native function addEventListener(param1:String, param2:Function, param3:Boolean = false, param4:int = 0, param5:Boolean = false) : void;",
                },
                targetCapabilityId: "api.flash.display",
                targetModule: "src/layaAir/flash/display/Sprite.ts",
                targetExport: "Sprite",
                targetKind: "class",
                targetSignature: "typeof Sprite",
                targetMember: {
                    name: "addEventListener",
                    kind: "method",
                    scope: "instance",
                    signature: "(type: string, listener: FlashEventListener, useCapture?: boolean, priority?: number, useWeakReference?: boolean) => void",
                },
            },
        ],
    };
}

function assertErrorCode(fn, code) {
    assert.throws(fn, (error) => error && error.code === code, code);
}

function main() {
    const ts = loadModernTypeScript();
    const compiled = compileHardenedSources(ts);
    const api = compiled.api;
    const sourceCensusJson = fs.readFileSync(requiredEnvironmentPath("HARDENED_SOURCE_CAPABILITY_CENSUS"), "utf8");
    const targetCapabilitiesJson = fs.readFileSync(requiredEnvironmentPath("HARDENED_TARGET_CAPABILITIES"), "utf8");
    const sourceRepo = requiredEnvironmentPath("HARDENED_SOURCE_REPO", "directory");
    const targetRepo = requiredEnvironmentPath("HARDENED_TARGET_REPO", "directory");
    assert.equal(git(sourceRepo, "rev-parse", "HEAD"), EXPECTED_SOURCE_HEAD);
    assert.equal(git(sourceRepo, "hash-object", requiredEnvironmentPath("HARDENED_SOURCE_CAPABILITY_CENSUS")), EXPECTED_SOURCE_BLOB);
    assert.equal(git(targetRepo, "rev-parse", "HEAD"), EXPECTED_TARGET_HEAD);
    assert.equal(git(targetRepo, "hash-object", requiredEnvironmentPath("HARDENED_TARGET_CAPABILITIES")), EXPECTED_TARGET_BLOB);
    assert.equal(sha256(sourceCensusJson), EXPECTED_SOURCE_SHA256);
    assert.equal(sha256(targetCapabilitiesJson), EXPECTED_TARGET_SHA256);
    const mappingJson = api.canonicalMappingJson(mappingDocument());
    const authority = api.loadCapabilityAuthority({
        sourceCensusJson,
        sourceCensusSha256: EXPECTED_SOURCE_SHA256,
        targetCapabilitiesJson,
        targetCapabilitiesSha256: EXPECTED_TARGET_SHA256,
        mappingJson,
        mappingSha256: sha256(mappingJson),
    }, sha256);

    const program = adapt(api, buildTree(), authority);
    assert.ok(Object.isFrozen(authority));
    assert.ok(Object.isFrozen(authority.typeMappingsBySource));
    assert.ok(Object.isFrozen(program));
    assert.ok(Object.isFrozen(program.declaration.members));
    assertErrorCode(
        () => adapt(api, buildTree(), { ...authority }),
        "HARDENED_CAPABILITY_AUTHORITY_INSTANCE",
    );
    assert.equal(program.schema, "as3-semantic-ir@1");
    assert.equal(program.packageName, "lobby.ui");
    assert.equal(program.outputModulePath, "lobby/ui/Demo.ts");
    assert.equal(program.sourceCapabilitySha256, EXPECTED_SOURCE_SHA256);
    assert.equal(program.targetCapabilitySha256, EXPECTED_TARGET_SHA256);
    const fields = program.declaration.members.filter((member) => member.kind === "field");
    assert.deepEqual(fields.map((field) => field.name), ["a", "b"]);
    assert.equal(fields[0].sharedDeclarationNodeId, fields[1].sharedDeclarationNodeId);
    assert.notEqual(fields[0].sourceNodeId, fields[1].sourceNodeId);

    const emitted = api.emitSemanticProgram(program, { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    const repeated = api.emitSemanticProgram(program, { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assertErrorCode(
        () => api.emitSemanticProgram({ ...program }, { compiler: ts, expectedTypeScriptVersion: "4.9.5" }),
        "HARDENED_SEMANTIC_IR_INSTANCE",
    );
    assert.deepEqual(emitted, repeated);
    assert.equal(emitted.modulePath, "lobby/ui/Demo.ts");
    assert.match(emitted.code, /import \{ Sprite \} from "laya\/flash\/display\/Sprite";/);
    assert.match(emitted.code, /import \{ Event \} from "laya\/flash\/events\/Event";/);
    assert.match(emitted.code, /private a: number = 1;/);
    assert.match(emitted.code, /private b: string = "x";/);
    assert.ok(emitted.code.indexOf("super();") < emitted.code.indexOf("this.addEventListener"));
    assert.match(emitted.code, /this\.onEvent = this\.onEvent\.bind\(this\);/);
    assert.match(emitted.code, /this\.addEventListener\("ready", this\.onEvent\);/);
    assert.equal((emitted.code.match(/this\.onEvent = this\.onEvent\.bind\(this\);/g) || []).length, 1);
    assert.doesNotMatch(emitted.code, /AVM|ABC|compat|wrapper/i);
    const runnable = ts.transpileModule(emitted.code, {
        compilerOptions: { target: ts.ScriptTarget.ES2019, module: ts.ModuleKind.CommonJS },
    }).outputText;
    class MockSprite {
        addEventListener(_type, listener) { this.listener = listener; }
    }
    const runtimeModule = { exports: {} };
    Function("require", "module", "exports", runnable)(
        (specifier) => specifier.endsWith("/Sprite") ? { Sprite: MockSprite } : { Event: class Event {} },
        runtimeModule,
        runtimeModule.exports,
    );
    const instance = new runtimeModule.exports.Demo();
    const firstClosure = instance.onEvent;
    assert.equal(instance.listener, firstClosure);
    assert.equal(instance.onEvent, firstClosure, "AS3 method closure identity must be stable per instance");
    const listeners = new Set([instance.listener]);
    assert.equal(listeners.delete(instance.onEvent), true, "the same closure identity must remove a listener");

    assertErrorCode(
        () => adapt(api, buildTree({ badSuperOrder: true }), authority),
        "HARDENED_SUPER_CONTEXT",
    );
    assertErrorCode(
        () => adapt(api, buildTree({ unsupportedStatement: true }), authority),
        "HARDENED_STATEMENT_UNSUPPORTED",
    );
    assertErrorCode(
        () => adapt(api, buildTree({ unsupportedChild: true }), authority),
        "HARDENED_UNSUPPORTED_CHILD",
    );
    assertErrorCode(
        () => adapt(api, buildTree({ returnValue: true }), authority),
        "HARDENED_RETURN_VALUE",
    );
    assertErrorCode(
        () => adapt(api, buildTree({ noConstructor: true }), authority),
        "HARDENED_DERIVED_CONSTRUCTOR",
    );
    assertErrorCode(
        () => adapt(api, buildTree({ superInMethod: true }), authority),
        "HARDENED_SUPER_CONTEXT",
    );
    assertErrorCode(
        () => adapt(api, buildTree({ staticMethod: true }), authority),
        "HARDENED_METHOD_CLOSURE_SCOPE",
    );
    assertErrorCode(
        () => adapt(api, buildTree({ postClassImport: true }), authority),
        "HARDENED_IMPORT_ORDER",
    );
    const extraRoot = flatten(buildTree());
    extraRoot.ast.extra = true;
    assertErrorCode(
        () => api.adaptNormalizedParserAst(extraRoot.ast, authority, extraRoot.sourceText, sha256),
        "HARDENED_NORMALIZED_AST",
    );
    const extraNode = flatten(buildTree());
    extraNode.ast.nodes[1].extra = true;
    extraNode.ast.fingerprintSha256 = sha256(JSON.stringify(extraNode.ast.nodes));
    assertErrorCode(
        () => api.adaptNormalizedParserAst(extraNode.ast, authority, extraNode.sourceText, sha256),
        "HARDENED_NORMALIZED_NODE",
    );
    const forgedFingerprint = flatten(buildTree());
    forgedFingerprint.ast.nodes[1].text = "different.package";
    assertErrorCode(
        () => api.adaptNormalizedParserAst(forgedFingerprint.ast, authority, forgedFingerprint.sourceText, sha256),
        "HARDENED_NORMALIZED_AST_HASH",
    );
    const forgedSource = flatten(buildTree());
    assertErrorCode(
        () => api.adaptNormalizedParserAst(forgedSource.ast, authority, forgedSource.sourceText + "x", sha256),
        "HARDENED_NORMALIZED_AST_HASH",
    );
    for (const badParentId of [["n0"], { value: "n0" }, 0, null]) {
        const wrongParentType = flatten(buildTree());
        wrongParentType.ast.nodes[1].parentId = badParentId;
        wrongParentType.ast.fingerprintSha256 = sha256(JSON.stringify(wrongParentType.ast.nodes));
        assertErrorCode(
            () => api.adaptNormalizedParserAst(wrongParentType.ast, authority, wrongParentType.sourceText, sha256),
            "HARDENED_NORMALIZED_PARENT",
        );
    }
    assertErrorCode(
        () => adapt(api, buildTree({ fieldModifiers: ["private", "protected"] }), authority),
        "HARDENED_MODIFIER_ACCESS",
    );
    assertErrorCode(
        () => adapt(api, buildTree({ fieldModifiers: ["static", "public"] }), authority),
        "HARDENED_MODIFIER_ORDER",
    );
    assertErrorCode(
        () => api.targetModuleSpecifier("src/layaAir/../../game.ts"),
        "HARDENED_TARGET_MODULE",
    );
    assertErrorCode(
        () => api.targetModuleSpecifier("src/layaAir/_internal/Thing.ts"),
        "HARDENED_TARGET_MODULE",
    );
    assertErrorCode(() => api.loadCapabilityAuthority({
        sourceCensusJson,
        sourceCensusSha256: "0".repeat(64),
        targetCapabilitiesJson,
        targetCapabilitiesSha256: EXPECTED_TARGET_SHA256,
        mappingJson,
        mappingSha256: sha256(mappingJson),
    }, sha256), "HARDENED_SOURCE_CENSUS_HASH");

    const internal = mappingDocument();
    internal.mappings.push({
        sourceQName: "flash.display.Sprite",
        sourceRoles: ["instance-member"],
        sourceMember: {
            access: "call",
            name: "addEventListener",
            minArgs: 2,
            maxArgs: 5,
            signature: "public native function addEventListener(param1:String, param2:Function, param3:Boolean = false, param4:int = 0, param5:Boolean = false) : void;",
        },
        targetCapabilityId: "api.flash.display",
        targetModule: "src/layaAir/flash/display/Sprite.ts",
        targetExport: "Sprite",
        targetKind: "class",
        targetSignature: "typeof Sprite",
        targetMember: {
            name: "_activeHierarchy", kind: "method", scope: "instance",
            signature: "internal member is never admissible",
        },
    });
    const internalJson = api.canonicalMappingJson(internal);
    assertErrorCode(() => api.loadCapabilityAuthority({
        sourceCensusJson,
        sourceCensusSha256: EXPECTED_SOURCE_SHA256,
        targetCapabilitiesJson,
        targetCapabilitiesSha256: EXPECTED_TARGET_SHA256,
        mappingJson: internalJson,
        mappingSha256: sha256(internalJson),
    }, sha256), "HARDENED_TARGET_MEMBER_MAPPING");

    fs.rmSync(compiled.output, { recursive: true, force: true });
    process.stdout.write("semantic IR + structural emitter: PASS\n");
}

main();
