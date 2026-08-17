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
        .filter((name) => name.endsWith(".ts") && name !== "parser-normalizer.ts")
        .map((name) => path.join(ROOT, "src/hardened", name));
    const program = ts.createProgram(sources, {
        target: ts.ScriptTarget.ES2019,
        module: ts.ModuleKind.CommonJS,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        strict: true,
        noImplicitAny: true,
        types: [],
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

function assertGeneratedRuntimeTypechecks(outputs) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "as3-generated-runtime-"));
    try {
        const runtime = path.join(root, "runtime");
        const stubs = path.join(root, "stubs");
        const generated = path.join(root, "generated");
        fs.mkdirSync(runtime, { recursive: true });
        fs.mkdirSync(stubs, { recursive: true });
        fs.mkdirSync(generated, { recursive: true });
        fs.copyFileSync(path.join(ROOT, "src/hardened-runtime/AS3Type.ts"), path.join(runtime, "AS3Type.ts"));
        fs.copyFileSync(path.join(ROOT, "src/hardened-runtime/AS3Vector.ts"), path.join(runtime, "AS3Vector.ts"));
        fs.copyFileSync(path.join(ROOT, "src/hardened-runtime/AS3Coerce.ts"), path.join(runtime, "AS3Coerce.ts"));
        fs.writeFileSync(path.join(stubs, "Sprite.ts"),
            "export class Sprite { public addEventListener(_type:string,_listener:Function):void {} }\n", "utf8");
        fs.writeFileSync(path.join(stubs, "Event.ts"), "export class Event {}\n", "utf8");
        outputs.forEach((code, index) => fs.writeFileSync(path.join(generated, `Fixture${index}.ts`), code, "utf8"));
        const config = path.join(root, "tsconfig.json");
        fs.writeFileSync(config, JSON.stringify({
            compilerOptions: {
                target: "ES2022", module: "CommonJS", moduleResolution: "Node", strict: true,
                strictNullChecks: false, skipLibCheck: true, noEmit: true, baseUrl: root,
                paths: {
                    "@bleach/as3-runtime/*": ["runtime/*"],
                    "laya/flash/display/Sprite": ["stubs/Sprite"],
                    "laya/flash/events/Event": ["stubs/Event"],
                },
            },
            include: ["generated/**/*.ts", "runtime/**/*.ts", "stubs/**/*.ts"],
        }), "utf8");
        childProcess.execFileSync(process.execPath,
            [path.join(requiredEnvironmentPath("HARDENED_TYPESCRIPT_PATH", "directory"), "bin/tsc"), "-p", config],
            { cwd: root, stdio: "inherit" });
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
}

function vectorType(name) {
    return n("VECTOR", null, [type(name)]);
}

function nestedVectorType(name) {
    return n("VECTOR", null, [vectorType(name)]);
}

function dot(target, name) {
    return n("DOT", null, [target, n("LITERAL", name)]);
}

function call(target, args = []) {
    return n("CALL", null, [target, n("ARGUMENTS", null, args)]);
}

function assignment(target, value, operator = "=") {
    return n("ASSIGN", null, [target, n("OP", operator), value]);
}

function construct(name, args = []) {
    return n("NEW", null, [call(n("IDENTIFIER", name), args)]);
}

function parameter(name, typeName) {
    return n("PARAMETER", null, [n("NAME_TYPE_INIT", null, [n("NAME", name), type(typeName)])]);
}

function method(name, parameters, returnType, body, modifierValues = ["public"]) {
    return n("FUNCTION", "function", [
        mods(...modifierValues), n("NAME", name), n("PARAMETER_LIST", null, parameters), type(returnType), n("BLOCK", null, body),
    ]);
}

function accessor(kind, name, parameters, returnType, body, modifierValues = ["public"]) {
    return n(kind, name, [
        mods(...modifierValues), n("NAME", name), n("PARAMETER_LIST", null, parameters),
        type(returnType), n("BLOCK", null, body),
    ]);
}

function binary(kind, left, operator, right) {
    return n(kind, null, [left, n("OP", operator), right]);
}

function localDeclaration(kind, name, typeName, initializer) {
    const children = [n("NAME", name), type(typeName)];
    if (initializer !== undefined) children.push(n("INIT", null, [initializer]));
    return n(kind, null, [n("NAME_TYPE_INIT", null, children)]);
}

function conditional(condition, whenTrue, whenFalse) {
    return n("CONDITIONAL", null, [condition, whenTrue, whenFalse]);
}

function constructor(body) {
    return n("FUNCTION", "function", [
        mods("public"), n("NAME", "Demo"), n("PARAMETER_LIST"), type(null), n("BLOCK", null, body),
    ]);
}

function buildTree(options = {}) {
    const superStatement = call(n("IDENTIFIER", "super"));
    const closureStatement = call(n("IDENTIFIER", "addEventListener"), [
        n("LITERAL", '"ready"'), n("IDENTIFIER", "onEvent"),
    ]);
    const body = options.badSuperOrder ? [closureStatement, superStatement] : [superStatement, closureStatement];
    if (options.unsupportedStatement) {
        body.push(n("SWITCH"));
    }
    const field = n(options.constFields ? "CONST_LIST" : "VAR_LIST", null, [
        mods(...(options.fieldModifiers || ["private"])),
        n("NAME_TYPE_INIT", null, [n("NAME", "a"), type("Number"), n("INIT", null, [n("LITERAL", "1")])]),
        n("NAME_TYPE_INIT", null, [n("NAME", "b"), type("String"), n("INIT", null, [n("LITERAL", '"x"')])]),
    ]);
    if (options.newField) {
        field.children.push(n("NAME_TYPE_INIT", null, [
            n("NAME", "sprite"), type("Sprite"),
            n("INIT", null, [construct("Sprite", options.newArguments || [])]),
        ]));
    }
    if (options.vectorWorkpack || options.vectorRuntimeWorkpack) {
        field.children.push(n("NAME_TYPE_INIT", null, [
            n("NAME", "values"), vectorType("int"),
            n("INIT", null, [n("NEW", null, [call(vectorType("int"), [n("LITERAL", "2"), n("LITERAL", "false")])])]),
        ]));
        if (options.vectorWorkpack) {
            body.push(
                assignment(n("ARRAY_ACCESSOR", null, [n("IDENTIFIER", "values"), n("LITERAL", "0")]), n("LITERAL", "4")),
                call(dot(n("IDENTIFIER", "values"), "push"), [n("LITERAL", "5")]),
            );
        }
    }
    if (options.nestedVectorWorkpack) {
        field.children.push(n("NAME_TYPE_INIT", null, [
            n("NAME", "matrix"), nestedVectorType("int"),
            n("INIT", null, [n("NEW", null, [call(nestedVectorType("int"), [n("LITERAL", "1")])])]),
        ]));
    }
    let onEventBody = options.returnValue ? [n("RETURN", null, [n("LITERAL", "1")])] : [n("RETURN")];
    if (options.assignment) {
        const target = n("IDENTIFIER", options.assignmentTarget || "b");
        const value = n("LITERAL", options.assignmentValue || '"changed"');
        onEventBody = [assignment(target, value, options.assignmentOperator || "="), n("RETURN")];
    }
    if (options.localWorkpack || options.localNoInitializer || options.localMixedAdd
        || options.localBadNot || options.localNonBooleanWhile || options.localConstWrite
        || options.localDuplicate || options.localParameterCollision) {
        const declarationKind = options.localConstWrite ? "CONST_LIST" : "VAR_LIST";
        let initializer = binary("ADD", n("LITERAL", "1"), "+", n("LITERAL", "2"));
        if (options.localMixedAdd) initializer = binary("ADD", n("LITERAL", '"x"'), "+", n("LITERAL", "1"));
        if (options.localBadNot) initializer = n("NOT", null, [n("LITERAL", "1")]);
        const localName = options.localParameterCollision ? "event" : "total";
        const declaration = localDeclaration(declarationKind, localName, "Number",
            options.localNoInitializer ? undefined : initializer);
        const condition = options.localNonBooleanWhile
            ? n("IDENTIFIER", "total")
            : binary("RELATION", n("IDENTIFIER", "total"), ">", n("LITERAL", "0"));
        const loop = n("WHILE", null, [
            n("CONDITION", null, [condition]),
            n("BLOCK", null, [assignment(n("IDENTIFIER", "total"),
                binary("ADD", n("IDENTIFIER", "total"), "-", n("LITERAL", "1")))]),
        ]);
        const active = localDeclaration("VAR_LIST", "active", "Boolean",
            n("NOT", null, [binary("EQUALITY", n("IDENTIFIER", "total"), "===", n("LITERAL", "0"))]));
        onEventBody = [declaration];
        if (options.localDuplicate) {
            onEventBody.push(localDeclaration("VAR_LIST", "total", "Number", n("LITERAL", "3")));
        }
        onEventBody.push(active, loop, n("RETURN"));
    }
    if (options.controlWorkpack || options.conditionalNonBoolean || options.conditionalTypeMismatch
        || options.updateNonNumber || options.breakOutsideLoop) {
        const active = localDeclaration("VAR_LIST", "active", "Boolean", n("LITERAL", "true"));
        const total = localDeclaration("VAR_LIST", "total", "Number", n("LITERAL", "2"));
        const choiceCondition = options.conditionalNonBoolean ? n("IDENTIFIER", "total") : n("IDENTIFIER", "active");
        const falseChoice = options.conditionalTypeMismatch ? n("LITERAL", '"none"') : n("LITERAL", "0");
        const chosen = localDeclaration("VAR_LIST", "chosen", "Number",
            conditional(choiceCondition, n("IDENTIFIER", "total"), falseChoice));
        const updateTarget = options.updateNonNumber ? n("IDENTIFIER", "b") : n("IDENTIFIER", "total");
        const loop = n("WHILE", null, [n("CONDITION", null, [n("IDENTIFIER", "active")]), n("BLOCK", null, [
            n("POST_DEC", null, [updateTarget]),
            n("IF", null, [
                n("CONDITION", null, [binary("EQUALITY", n("IDENTIFIER", "total"), "===", n("LITERAL", "1"))]),
                n("BLOCK", null, [n("CONTINUE")]),
            ]),
            n("BREAK"),
        ])]);
        onEventBody = options.breakOutsideLoop
            ? [active, total, chosen, n("BREAK"), n("RETURN")]
            : [active, total, chosen, loop, n("RETURN")];
    }
    if (options.vectorWorkpack) {
        onEventBody = [
            n("VAR_LIST", null, [n("NAME_TYPE_INIT", null, [
                n("NAME", "copy"), vectorType("int"), n("INIT", null, [
                    call(vectorType("int"), [n("ARRAY", null, [n("LITERAL", "1"), n("LITERAL", "2")])]),
                ]),
            ])]),
            n("RETURN"),
        ];
    }
    if (options.runtimeTypeWorkpack) {
        onEventBody = [
            localDeclaration("VAR_LIST", "cast", "Event",
                n("RELATION", null, [n("IDENTIFIER", "event"), n("AS", "as"), n("IDENTIFIER", "Event")])),
            localDeclaration("VAR_LIST", "matches", "Boolean",
                n("RELATION", null, [n("IDENTIFIER", "event"), n("OP", "is"), n("IDENTIFIER", "Event")])),
            n("RETURN"),
        ];
    }
    if (options.vectorRuntimeWorkpack) {
        onEventBody = [
            n("VAR_LIST", null, [n("NAME_TYPE_INIT", null, [
                n("NAME", "castVector"), vectorType("int"), n("INIT", null, [
                    n("RELATION", null, [n("IDENTIFIER", "values"), n("AS", "as"), vectorType("int")]),
                ]),
            ])]),
            localDeclaration("VAR_LIST", "matchesVector", "Boolean",
                n("RELATION", null, [n("IDENTIFIER", "values"), n("OP", "is"), vectorType("int")])),
            n("RETURN"),
        ];
    }
    if (options.coercionWorkpack) {
        onEventBody = [
            localDeclaration("VAR_LIST", "signed", "int", call(n("IDENTIFIER", "int"), [n("LITERAL", "4294967295")])),
            localDeclaration("VAR_LIST", "unsigned", "uint", call(n("IDENTIFIER", "uint"), [n("LITERAL", "-1")])),
            localDeclaration("VAR_LIST", "message", "String", call(n("IDENTIFIER", "String"), [n("IDENTIFIER", "event")])),
            n("RETURN"),
        ];
    }
    const members = [
        field,
        constructor(body),
        method("onEvent", [parameter("event", "Event")], "void",
            options.superInMethod ? [call(n("IDENTIFIER", "super"))] : onEventBody,
            options.staticMethod ? ["public", "static"] : ["public"]),
    ];
    if (options.accessors) {
        const getterBody = options.getterNoReturn ? [] : options.accessorIf
            ? [n("IF", null, [
                n("CONDITION", null, [binary("RELATION", n("IDENTIFIER", "a"), options.relationOperator || ">", n("LITERAL", "0"))]),
                n("BLOCK", null, [n("RETURN", null, [n("IDENTIFIER", "a")])]),
                n("BLOCK", null, [n("RETURN", null, [n("LITERAL", "0")])]),
            ])]
            : [n("RETURN", null, [n("IDENTIFIER", "a")])];
        members.splice(1, 0,
            accessor("GET", "value", [], "Number", getterBody),
            accessor("SET", "value", [parameter("input", options.setterType || "Number")], "void", [
                assignment(n("IDENTIFIER", "a"), n("IDENTIFIER", "input")),
            ]));
    }
    if (options.nonBooleanIf) {
        members[members.length - 1].children[4].children.unshift(n("IF", null, [
            n("CONDITION", null, [n("LITERAL", "1")]), n("BLOCK"),
        ]));
    }
    if (options.noConstructor) {
        const constructorIndex = members.findIndex((member) => member.kind === "FUNCTION"
            && member.children.some((child) => child.kind === "NAME" && child.text === "Demo"));
        members.splice(constructorIndex, 1);
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

function canonicalJson(value) {
    if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

function buildLocalBaseTree() {
    return n("COMPILATION_UNIT", null, [
        n("PACKAGE", null, [n("NAME", "lobby.ui"), n("CONTENT", null, [
            n("IMPORT", "lobby.base.Base"),
            n("CLASS", null, [n("NAME", "Demo"), mods("public"), n("EXTENDS", "Base"),
                n("CONTENT", null, [constructor([call(n("IDENTIFIER", "super"))])])]),
        ])]),
        n("CONTENT"),
    ]);
}

function localAuthority(api, normalized, options = {}) {
    const baseNodeId = "0000000000000001";
    const currentNodeId = "0000000000000002";
    const entries = [
        {
            componentId: "scc-00001", importable: options.baseImportable !== false, module: options.baseModule || "application",
            nodeId: baseNodeId, prerequisites: [], qname: options.baseQName || "lobby.base.Base",
            sourcePath: "game-client/tapplication_main/src/lobby/base/Base.as", sourceSha256: "1".repeat(64),
            targetPath: "game-client/layaair/src/application/lobby/base/Base.ts", topologicalLevel: 0,
            typeKind: options.baseKind || "class",
        },
        {
            componentId: "scc-00002", importable: true, module: "application", nodeId: currentNodeId,
            prerequisites: options.withEdge === false ? [] : [baseNodeId], qname: "lobby.ui.Demo",
            sourcePath: options.currentSourcePath || "game-client/tapplication_main/src/lobby/ui/Demo.as",
            sourceSha256: options.currentSourceSha256 || normalized.ast.sourceSha256,
            targetPath: "game-client/layaair/src/application/lobby/ui/Demo.ts", topologicalLevel: 1, typeKind: "class",
        },
    ].sort((left, right) => `${left.module}\u0000${left.qname}`.localeCompare(`${right.module}\u0000${right.qname}`));
    const document = {
        dependencyGraphRawSha256: "2".repeat(64), dependencyGraphSemanticSha256: "3".repeat(64), entries,
        entryCount: entries.length, schema: "bleach-local-as3-type-map@1", sourceManifestSha256: "4".repeat(64),
    };
    const json = `${canonicalJson(document)}\n`;
    return api.loadLocalTypeAuthority({
        expectedDependencyGraphRawSha256: document.dependencyGraphRawSha256,
        expectedDependencyGraphSemanticSha256: document.dependencyGraphSemanticSha256,
        expectedEntryCount: entries.length,
        expectedSourceManifestSha256: document.sourceManifestSha256,
        json, sha256: sha256(json),
    }, sha256);
}

function adaptLocal(api, authority, options = {}) {
    const normalized = flatten(buildLocalBaseTree());
    const locals = localAuthority(api, normalized, options);
    return api.adaptNormalizedParserAst(normalized.ast, authority, normalized.sourceText, sha256,
        locals, options.logicalPath || "lobby/ui/Demo.as");
}

function mappingDocument() {
    return {
        schema: "as3-source-to-laya-capability-map@1",
        mappings: [
            {
                sourceQName: "flash.display.Sprite",
                sourceRoles: ["base-type", "constructor", "import"],
                sourceMember: null,
                targetCapabilityId: "api.flash.display",
                targetModule: "src/layaAir/flash/display/Sprite.ts",
                targetExport: "Sprite",
                targetKind: "class",
                targetSignature: "typeof Sprite",
                targetMember: null,
            },
            {
                sourceQName: "flash.display.Sprite",
                sourceRoles: ["constructor"],
                sourceMember: {
                    access: "call",
                    name: "Sprite",
                    minArgs: 0,
                    maxArgs: 0,
                    signature: "public function Sprite()",
                },
                targetCapabilityId: "api.flash.display",
                targetModule: "src/layaAir/flash/display/Sprite.ts",
                targetExport: "Sprite",
                targetKind: "class",
                targetSignature: "typeof Sprite",
                targetMember: {
                    name: "Sprite",
                    kind: "constructor",
                    scope: "static",
                    signature: "new (): Sprite",
                },
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
    assert.equal(fields[0].readonly, false);

    const localBaseProgram = adaptLocal(api, authority);
    assert.equal(localBaseProgram.imports[0].authorityKind, "local");
    assert.equal(localBaseProgram.imports[0].localNodeId, "0000000000000001");
    assert.equal(localBaseProgram.imports[0].targetModule, "../base/Base");
    const localBaseOutput = api.emitSemanticProgram(localBaseProgram, { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(localBaseOutput.code, /import \{ Base \} from "\.\.\/base\/Base";/);
    assert.match(localBaseOutput.code, /export class Demo extends Base/);
    assertErrorCode(() => adaptLocal(api, authority, { withEdge: false }), "HARDENED_LOCAL_IMPORT_EDGE");
    assertErrorCode(() => adaptLocal(api, authority, { baseQName: "lobby.base.Other" }), "HARDENED_LOCAL_IMPORT");
    assertErrorCode(() => adaptLocal(api, authority, { baseKind: "interface" }), "HARDENED_BASE_TYPE");
    assertErrorCode(() => adaptLocal(api, authority, { currentSourceSha256: "5".repeat(64) }),
        "HARDENED_LOCAL_SOURCE_AUTHORITY");
    assertErrorCode(() => adaptLocal(api, authority, { logicalPath: "other/Demo.as" }),
        "HARDENED_LOCAL_SOURCE_AUTHORITY");

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
    const constProgram = adapt(api, buildTree({ constFields: true }), authority);
    const constFields = constProgram.declaration.members.filter((member) => member.kind === "field");
    assert.equal(constFields.every((field) => field.readonly), true);
    const constOutput = api.emitSemanticProgram(constProgram, { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(constOutput.code, /private readonly a: number = 1;/);
    assert.match(constOutput.code, /private readonly b: string = "x";/);
    const vectorProgram = adapt(api, buildTree({ vectorWorkpack: true }), authority);
    const vectorOutput = api.emitSemanticProgram(vectorProgram, { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(vectorOutput.code, /AS3Vector as __as3Vector/);
    assert.match(vectorOutput.code, /private values: __as3Vector<number> = new __as3Vector<number>\(__as3VectorPolicies\.int, 2, false\);/);
    assert.match(vectorOutput.code, /this\.values\[0\] = 4;/);
    assert.match(vectorOutput.code, /this\.values\.push\(5\);/);
    assert.match(vectorOutput.code, /var copy: __as3Vector<number> = __as3Vector\.from<number>\(__as3VectorPolicies\.int, \[1, 2\]\);/);
    const runtimeTypeProgram = adapt(api, buildTree({ runtimeTypeWorkpack: true }), authority);
    const runtimeTypeOutput = api.emitSemanticProgram(runtimeTypeProgram, { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(runtimeTypeOutput.code, /as3As as __as3As/);
    assert.match(runtimeTypeOutput.code, /var cast: Event = __as3As\(event, __as3ClassType\("flash\.events\.Event", Event\)\);/);
    assert.match(runtimeTypeOutput.code, /var matches: boolean = __as3Is\(event, __as3ClassType\("flash\.events\.Event", Event\)\);/);
    const vectorRuntimeProgram = adapt(api, buildTree({ vectorRuntimeWorkpack: true }), authority);
    const vectorRuntimeOutput = api.emitSemanticProgram(vectorRuntimeProgram, { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(vectorRuntimeOutput.code, /__as3As\(this\.values, __as3VectorType\(__as3VectorPolicies\.int\)\)/);
    assert.match(vectorRuntimeOutput.code, /__as3Is\(this\.values, __as3VectorType\(__as3VectorPolicies\.int\)\)/);
    const nestedVectorProgram = adapt(api, buildTree({ nestedVectorWorkpack: true }), authority);
    const nestedVectorOutput = api.emitSemanticProgram(nestedVectorProgram, { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(nestedVectorOutput.code,
        /private matrix: __as3Vector<__as3Vector<number> \| null> = new __as3Vector<__as3Vector<number> \| null>\(__as3VectorNested\(__as3VectorPolicies\.int\), 1\);/);
    const coercionProgram = adapt(api, buildTree({ coercionWorkpack: true }), authority);
    const coercionOutput = api.emitSemanticProgram(coercionProgram, { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(coercionOutput.code, /as3Int as __as3Int/);
    assert.match(coercionOutput.code, /var signed: number = __as3Int\(4294967295\);/);
    assert.match(coercionOutput.code, /var unsigned: number = __as3Uint\(-1\);/);
    assert.match(coercionOutput.code, /var message: string = __as3String\(event\);/);
    assertGeneratedRuntimeTypechecks([vectorOutput.code, runtimeTypeOutput.code, vectorRuntimeOutput.code,
        nestedVectorOutput.code, coercionOutput.code]);
    const assignedProgram = adapt(api, buildTree({ assignment: true }), authority);
    const assignedOutput = api.emitSemanticProgram(assignedProgram, { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(assignedOutput.code, /this\.b = "changed";/);
    assertErrorCode(
        () => adapt(api, buildTree({ assignment: true, assignmentValue: "1" }), authority),
        "HARDENED_ASSIGNMENT_TYPE",
    );
    assertErrorCode(
        () => adapt(api, buildTree({ assignment: true, assignmentOperator: "+=" }), authority),
        "HARDENED_ASSIGNMENT_OPERATOR",
    );
    assertErrorCode(
        () => adapt(api, buildTree({ constFields: true, assignment: true }), authority),
        "HARDENED_ASSIGNMENT_READONLY",
    );
    const constructedProgram = adapt(api, buildTree({ newField: true }), authority);
    const constructedOutput = api.emitSemanticProgram(constructedProgram, { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(constructedOutput.code, /private sprite: Sprite = new Sprite\(\);/);
    assertErrorCode(
        () => adapt(api, buildTree({ newField: true, newArguments: [n("LITERAL", "1")] }), authority),
        "HARDENED_NEW_ARGUMENT_TYPES",
    );
    const accessorProgram = adapt(api, buildTree({ accessors: true, accessorIf: true }), authority);
    const accessorOutput = api.emitSemanticProgram(accessorProgram, { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(accessorOutput.code, /public get value\(\): number/);
    assert.match(accessorOutput.code, /if \(this\.a > 0\)/);
    assert.match(accessorOutput.code, /public set value\(input: number\)/);
    assert.match(accessorOutput.code, /this\.a = input;/);
    assertErrorCode(
        () => adapt(api, buildTree({ accessors: true, getterNoReturn: true }), authority),
        "HARDENED_RETURN_PATH",
    );
    assertErrorCode(
        () => adapt(api, buildTree({ accessors: true, setterType: "String" }), authority),
        "HARDENED_ACCESSOR_PAIR",
    );
    assertErrorCode(
        () => adapt(api, buildTree({ accessors: true, accessorIf: true, relationOperator: "==" }), authority),
        "HARDENED_BINARY_OPERATOR",
    );
    assertErrorCode(
        () => adapt(api, buildTree({ nonBooleanIf: true }), authority),
        "HARDENED_IF_BOOLEAN",
    );
    const localProgram = adapt(api, buildTree({ localWorkpack: true }), authority);
    const localOutput = api.emitSemanticProgram(localProgram, { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(localOutput.code, /var total: number = 1 \+ 2;/);
    assert.match(localOutput.code, /var active: boolean = !\(total === 0\);/);
    assert.match(localOutput.code, /while \(total > 0\)/);
    assert.match(localOutput.code, /total = total - 1;/);
    assertErrorCode(
        () => adapt(api, buildTree({ localNoInitializer: true }), authority),
        "HARDENED_LOCAL_INITIALIZER",
    );
    assertErrorCode(
        () => adapt(api, buildTree({ localMixedAdd: true }), authority),
        "HARDENED_BINARY_TYPE",
    );
    assertErrorCode(
        () => adapt(api, buildTree({ localBadNot: true }), authority),
        "HARDENED_UNARY_BOOLEAN",
    );
    assertErrorCode(
        () => adapt(api, buildTree({ localNonBooleanWhile: true }), authority),
        "HARDENED_WHILE_BOOLEAN",
    );
    assertErrorCode(
        () => adapt(api, buildTree({ localConstWrite: true }), authority),
        "HARDENED_ASSIGNMENT_READONLY",
    );
    assertErrorCode(
        () => adapt(api, buildTree({ localDuplicate: true }), authority),
        "HARDENED_LOCAL_DUPLICATE",
    );
    assertErrorCode(
        () => adapt(api, buildTree({ localParameterCollision: true }), authority),
        "HARDENED_LOCAL_PARAMETER_COLLISION",
    );
    const controlProgram = adapt(api, buildTree({ controlWorkpack: true }), authority);
    const controlOutput = api.emitSemanticProgram(controlProgram, { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(controlOutput.code, /var chosen: number = active \? total : 0;/);
    assert.match(controlOutput.code, /total--;/);
    assert.match(controlOutput.code, /continue;/);
    assert.match(controlOutput.code, /break;/);
    assertErrorCode(
        () => adapt(api, buildTree({ conditionalNonBoolean: true }), authority),
        "HARDENED_CONDITIONAL_BOOLEAN",
    );
    assertErrorCode(
        () => adapt(api, buildTree({ conditionalTypeMismatch: true }), authority),
        "HARDENED_CONDITIONAL_TYPE",
    );
    assertErrorCode(
        () => adapt(api, buildTree({ updateNonNumber: true }), authority),
        "HARDENED_UPDATE_NUMBER",
    );
    assertErrorCode(
        () => adapt(api, buildTree({ breakOutsideLoop: true }), authority),
        "HARDENED_LOOP_CONTEXT",
    );
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
        "HARDENED_RETURN_VOID",
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
