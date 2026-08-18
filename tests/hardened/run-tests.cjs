"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const EXPECTED_SOURCE_SHA256 = "2144b14090e51a1c0525ec3a35bfb8e532c6a19bb7ab355428ce70b4db7bde90";
const EXPECTED_TARGET_SHA256 = "109405663cc7ee936008d29732026fc82a06460aff1e9f341cd761e6d12b5b54";
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
        fs.mkdirSync(path.join(root, "base"), { recursive: true });
        fs.copyFileSync(path.join(ROOT, "src/hardened-runtime/AS3Type.ts"), path.join(runtime, "AS3Type.ts"));
        fs.copyFileSync(path.join(ROOT, "src/hardened-runtime/AS3Vector.ts"), path.join(runtime, "AS3Vector.ts"));
        fs.copyFileSync(path.join(ROOT, "src/hardened-runtime/AS3Coerce.ts"), path.join(runtime, "AS3Coerce.ts"));
        fs.copyFileSync(path.join(ROOT, "src/hardened-runtime/AS3Dictionary.ts"), path.join(runtime, "AS3Dictionary.ts"));
        fs.copyFileSync(path.join(ROOT, "src/hardened-runtime/AS3ByteArray.ts"), path.join(runtime, "AS3ByteArray.ts"));
        fs.writeFileSync(path.join(stubs, "Sprite.ts"),
            "export class Sprite { public addEventListener(_type:string,_listener:Function,_capture=false,_priority=0,_weak=false):void {} }\n", "utf8");
        fs.writeFileSync(path.join(stubs, "Event.ts"), "export class Event {}\n", "utf8");
        fs.writeFileSync(path.join(root, "base", "Base.ts"),
            "export class Base { public constructor(_value:number=0) {} }\n", "utf8");
        outputs.forEach((code, index) => fs.writeFileSync(path.join(generated, `Fixture${index}.ts`), code, "utf8"));
        const config = path.join(root, "tsconfig.json");
        fs.writeFileSync(config, JSON.stringify({
            compilerOptions: {
                target: "ES2022", module: "CommonJS", moduleResolution: "Node", strict: true,
                strictNullChecks: true, skipLibCheck: true, noEmit: true, baseUrl: root,
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

function parameter(name, typeName, defaultValue) {
    const children = [n("NAME", name), type(typeName)];
    if (defaultValue !== undefined) children.push(n("INIT", null, [n("LITERAL", defaultValue)]));
    return n("PARAMETER", null, [n("NAME_TYPE_INIT", null, children)]);
}

function method(name, parameters, returnType, body, modifierValues = ["public"]) {
    return n("FUNCTION", "function", [
        mods(...modifierValues), n("NAME", name), n("PARAMETER_LIST", null, parameters), type(returnType), n("BLOCK", null, body),
    ]);
}

function vectorParameter(name, elementType) {
    return n("PARAMETER", null, [n("NAME_TYPE_INIT", null, [n("NAME", name), vectorType(elementType)])]);
}

function expressionParameter(name, typeName, defaultExpression) {
    return n("PARAMETER", null, [n("NAME_TYPE_INIT", null, [
        n("NAME", name), type(typeName), n("INIT", null, [defaultExpression]),
    ])]);
}

function restParameter(name) {
    return n("PARAMETER", null, [n("REST", name)]);
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

function objectLiteral(properties) {
    return n("OBJECT", null, properties.map(([name, value]) => n("PROP", null, [
        n("NAME", JSON.stringify(name)), n("VALUE", null, [value]),
    ])));
}

function lambda(parameters, returnType, body) {
    return n("LAMBDA", null, [n("PARAMETER_LIST", null, parameters), type(returnType), n("BLOCK", null, body)]);
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
    const body = options.implicitObjectSuper ? [superStatement]
        : options.badSuperOrder ? [closureStatement, superStatement] : [superStatement, closureStatement];
    if (options.unsupportedStatement) {
        body.push(n("DELETE"));
    }
    const field = n(options.constFields ? "CONST_LIST" : "VAR_LIST", null, [
        mods(...(options.fieldModifiers || ["private"])),
        n("NAME_TYPE_INIT", null, [n("NAME", "a"), type("Number"), n("INIT", null, [
            options.nestedExpressionWorkpack
                ? binary("ADD", n("LITERAL", "1"), "+", n("LITERAL", "2"))
                : options.badNestedExpression ? n("FORIN") : n("LITERAL", "1"),
        ])]),
        n("NAME_TYPE_INIT", null, [n("NAME", "b"), type("String"), n("INIT", null, [n("LITERAL", '"x"')])]),
    ]);
    if (options.newField) {
        field.children.push(n("NAME_TYPE_INIT", null, [
            n("NAME", "sprite"), type("Sprite"),
            n("INIT", null, [construct("Sprite", options.newArguments || [])]),
        ]));
    }
    if (options.nullableWorkpack || options.badPrimitiveNull) {
        field.children.push(n("NAME_TYPE_INIT", null, [
            n("NAME", options.badPrimitiveNull ? "badNull" : "maybeSprite"),
            type(options.badPrimitiveNull ? "Number" : "Sprite"),
            n("INIT", null, [n("LITERAL", "null")]),
        ]));
    }
    if (options.dictionaryWorkpack || options.badDictionaryConstructor) {
        field.children.push(n("NAME_TYPE_INIT", null, [
            n("NAME", "dictionary"), type("Dictionary"), n("INIT", null, [
                construct("Dictionary", options.badDictionaryConstructor ? [n("LITERAL", "1")] : [n("LITERAL", "true")]),
            ]),
        ]));
    }
    if (options.byteArrayWorkpack || options.heldByteArrayMember) {
        field.children.push(n("NAME_TYPE_INIT", null, [
            n("NAME", "bytes"), type("ByteArray"), n("INIT", null, [construct("ByteArray")]),
        ]));
    }
    if (options.vectorWorkpack || options.vectorNumericWorkpack || options.vectorRuntimeWorkpack
        || options.vectorCallbackWorkpack || options.badVectorCallback || options.staleVectorCallbackProof
        || options.iterationWorkpack
        || options.existingForEachWorkpack || options.badForEachType) {
        field.children.push(n("NAME_TYPE_INIT", null, [
            n("NAME", "values"), vectorType("int"),
            n("INIT", null, [n("NEW", null, [call(vectorType("int"), [
                n("LITERAL", options.vectorNumericWorkpack ? "1.5" : "2"), n("LITERAL", "false")])])]),
        ]));
        if (options.vectorWorkpack) {
            body.push(
                assignment(n("ARRAY_ACCESSOR", null, [n("IDENTIFIER", "values"), n("LITERAL", "0")]), n("LITERAL", "4")),
                call(dot(n("IDENTIFIER", "values"), "push"), [n("LITERAL", "5")]),
            );
        }
        if (options.vectorNumericWorkpack) {
            body.push(call(dot(n("IDENTIFIER", "values"), "slice"), [n("LITERAL", "4294967295")]));
        }
    }
    if (options.nestedVectorWorkpack) {
        field.children.push(n("NAME_TYPE_INIT", null, [
            n("NAME", "matrix"), nestedVectorType("int"),
            n("INIT", null, [n("NEW", null, [call(nestedVectorType("int"), [n("LITERAL", "1")])])]),
        ]));
    }
    if (options.vectorBuiltinReferenceWorkpack) {
        for (const [name, element] of [["classes", "Class"], ["routines", "Function"], ["rows", "Array"]]) {
            field.children.push(n("NAME_TYPE_INIT", null, [
                n("NAME", name), vectorType(element),
                n("INIT", null, [n("NEW", null, [call(vectorType(element))])]),
            ]));
        }
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
    if (options.shortVectorWorkpack || options.badShortVectorShape) {
        const shortVector = options.badShortVectorShape
            ? n("SHORT_VECTOR", null, [vectorType("int")])
            : n("SHORT_VECTOR", null, [
                vectorType("int"), n("ARRAY", null, [n("LITERAL", "1"), n("LITERAL", "2")]),
            ]);
        onEventBody = [
            n("VAR_LIST", null, [n("NAME_TYPE_INIT", null, [
                n("NAME", "shortValues"), vectorType("int"), n("INIT", null, [shortVector]),
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
    if (options.vectorCallbackWorkpack || options.badVectorCallback) {
        onEventBody = [
            call(dot(n("IDENTIFIER", "values"), "sort"), [
                n("IDENTIFIER", options.badVectorCallback ? "onEvent" : "compareValues"),
            ]),
            call(dot(n("IDENTIFIER", "values"), "forEach"), [n("IDENTIFIER", "visitValue")]),
            n("RETURN"),
        ];
    }
    if (options.staleVectorCallbackProof) {
        onEventBody = [
            localDeclaration("VAR_LIST", "callback", "Function",
                lambda([parameter("value", "int")], "void", [n("RETURN")])),
            assignment(n("IDENTIFIER", "callback"), n("IDENTIFIER", "visitValue")),
            call(dot(n("IDENTIFIER", "values"), "forEach"), [
                n("IDENTIFIER", "callback"), n("LITERAL", "1"),
            ]),
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
    if (options.statementWorkpack || options.duplicateSwitchDefault || options.continueInSwitch) {
        const total = localDeclaration("VAR_LIST", "total", "Number", n("LITERAL", "2"));
        const active = localDeclaration("VAR_LIST", "active", "Boolean", n("LITERAL", "true"));
        const firstCase = n("CASE", null, [n("LITERAL", "1"), n("SWITCH_BLOCK", null, [
            assignment(n("IDENTIFIER", "total"), n("LITERAL", "4")),
            options.continueInSwitch ? n("CONTINUE") : n("BREAK"),
        ])]);
        const defaultCase = n("CASE", null, [n("DEFAULT", "default"), n("SWITCH_BLOCK", null, [
            assignment(n("IDENTIFIER", "total"), n("LITERAL", "3")),
        ])]);
        const cases = [firstCase, defaultCase];
        if (options.duplicateSwitchDefault) cases.push(n("CASE", null, [
            n("DEFAULT", "default"), n("SWITCH_BLOCK"),
        ]));
        onEventBody = [
            total,
            active,
            n("SWITCH", null, [n("CONDITION", null, [n("IDENTIFIER", "total")]), n("CASES", null, cases)]),
            n("DO", null, [
                n("BLOCK", null, [assignment(n("IDENTIFIER", "active"), n("LITERAL", "false"))]),
                n("CONDITION", null, [n("IDENTIFIER", "active")]),
            ]),
            n("THROW", null, [n("LITERAL", '"done"')]),
        ];
    }
    if (options.iterationWorkpack || options.existingForEachWorkpack || options.badForEachType) {
        const bindingType = options.badForEachType ? "String" : "int";
        const forEachBinding = options.existingForEachWorkpack
            ? n("NAME", "existingItem")
            : n("VAR", null, [n("NAME_TYPE_INIT", null, [n("NAME", "item"), type(bindingType)])]);
        onEventBody = [
            n("FOR", null, [
                n("INIT", null, [localDeclaration("VAR_LIST", "i", "Number", n("LITERAL", "0"))]),
                n("COND", null, [binary("RELATION", n("IDENTIFIER", "i"), "<", n("LITERAL", "2"))]),
                n("ITER", null, [n("POST_INC", null, [n("IDENTIFIER", "i")])]),
                n("BLOCK", null, [call(dot(n("IDENTIFIER", "values"), "push"), [call(n("IDENTIFIER", "int"), [n("IDENTIFIER", "i")])])]),
            ]),
            ...(options.existingForEachWorkpack
                ? [localDeclaration("VAR_LIST", "existingItem", "int", n("LITERAL", "0"))] : []),
            n("FOREACH", null, [
                forEachBinding,
                n("IN", null, [n("IDENTIFIER", "values")]),
                n("BLOCK", null, [call(dot(n("IDENTIFIER", "values"), "indexOf"), [
                    n("IDENTIFIER", options.existingForEachWorkpack ? "existingItem" : "item"),
                ])]),
            ]),
            n("RETURN"),
        ];
    }
    if (options.tryWorkpack || options.badCatchType || options.strayCatch) {
        const catchType = options.badCatchType ? "String" : "Error";
        onEventBody = options.strayCatch ? [n("CATCH", null, [
            n("NAME", "error"), type(catchType), n("BLOCK"),
        ])] : [
            n("TRY", null, [n("BLOCK", null, [n("THROW", null, [n("LITERAL", '"bad"')])])]),
            n("CATCH", null, [n("NAME", "error"), type(catchType), n("BLOCK", null, [
                n("THROW", null, [n("IDENTIFIER", "error")]),
            ])]),
            n("FINALLY", null, [n("BLOCK", null, [assignment(n("IDENTIFIER", "b"), n("LITERAL", '"done"'))])]),
        ];
    }
    if (options.bitwiseWorkpack || options.badBitwiseType) {
        const left = options.badBitwiseType ? n("LITERAL", '"bad"') : n("LITERAL", "1");
        onEventBody = [
            localDeclaration("VAR_LIST", "flags", "int", binary("B_OR", left, "|", n("LITERAL", "2"))),
            localDeclaration("VAR_LIST", "shifted", "uint",
                binary("SHIFT", n("IDENTIFIER", "flags"), ">>>", n("LITERAL", "1"))),
            localDeclaration("VAR_LIST", "inverted", "int", n("B_NOT", null, [n("IDENTIFIER", "flags")])),
            n("RETURN"),
        ];
    }
    if (options.compoundWorkpack || options.badLogicalCompound) {
        onEventBody = [
            localDeclaration("VAR_LIST", "flags", "int", n("LITERAL", "1")),
            localDeclaration("VAR_LIST", "active", "Boolean", n("LITERAL", "true")),
            assignment(n("IDENTIFIER", "flags"), n("LITERAL", "2"), "+="),
            assignment(n("IDENTIFIER", "flags"), n("LITERAL", "1"), ">>>="),
            assignment(n("IDENTIFIER", "active"), n("LITERAL", options.badLogicalCompound ? "1" : "false"), "&&="),
            n("RETURN"),
        ];
    }
    if (options.objectWorkpack || options.objectDuplicate || options.objectProto) {
        const properties = options.objectProto
            ? [["__proto__", n("LITERAL", "1")]]
            : options.objectDuplicate
                ? [["alpha", n("LITERAL", "1")], ["alpha", n("LITERAL", "2")]]
                : [["alpha", n("LITERAL", "1")], ["label", n("LITERAL", '\"ready\"')]];
        onEventBody = [
            localDeclaration("VAR_LIST", "config", "Object", objectLiteral(properties)),
            n("RETURN"),
        ];
    }
    if (options.defaultParameterWorkpack) {
        onEventBody = [call(n("IDENTIFIER", "configure")), n("RETURN")];
    }
    if (options.nestedExpressionWorkpack) {
        onEventBody = [call(n("IDENTIFIER", "int"), [
            binary("MINUS", n("LITERAL", "4"), "-", n("LITERAL", "1")),
        ]), n("RETURN")];
    }
    if (options.labelWorkpack || options.badContinueLabel) {
        const target = options.badContinueLabel
            ? n("SWITCH", null, [n("CONDITION", null, [n("LITERAL", "1")]), n("CASES", null, [
                n("CASE", null, [n("DEFAULT"), n("SWITCH_BLOCK", null, [n("CONTINUE", null, [n("IDENTIFIER", "outer")])])]),
            ])])
            : n("WHILE", null, [n("CONDITION", null, [n("LITERAL", "true")]), n("BLOCK", null, [
                n("BREAK", null, [n("IDENTIFIER", "outer")]),
            ])]);
        onEventBody = [n("LABEL", "outer", [target]), n("RETURN")];
    }
    if (options.restParameterWorkpack || options.badRestPosition) {
        onEventBody = options.badRestPosition ? [n("RETURN")] : [
            call(n("IDENTIFIER", "collect"), [n("LITERAL", '"p"'), n("LITERAL", "1"), n("LITERAL", '"two"')]),
            n("RETURN"),
        ];
    }
    if (options.forInWorkpack || options.badForInKey || options.badForInIterable) {
        const keyType = options.badForInKey ? "Number" : "String";
        const iterableType = options.badForInIterable ? "Number" : "Object";
        onEventBody = [
            localDeclaration("VAR_LIST", "key", keyType,
                n("LITERAL", options.badForInKey ? "0" : '""')),
            localDeclaration("VAR_LIST", "enumerable", iterableType,
                options.badForInIterable ? n("LITERAL", "1") : objectLiteral([["alpha", n("LITERAL", "1")]])),
            n("FORIN", null, [n("INIT", null, [n("IDENTIFIER", "key")]),
                n("IN", null, [n("IDENTIFIER", "enumerable")]), n("BLOCK", null, [n("CONTINUE")])]),
            n("RETURN"),
        ];
    }
    if (options.nullableWorkpack) {
        onEventBody = [
            localDeclaration("VAR_LIST", "maybeEvent", "Event", n("LITERAL", "null")),
            localDeclaration("VAR_LIST", "isMissing", "Boolean",
                binary("EQUALITY", n("IDENTIFIER", "maybeEvent"), "===", n("LITERAL", "null"))),
            localDeclaration("VAR_LIST", "selected", "Event",
                conditional(n("LITERAL", "true"), n("IDENTIFIER", "maybeEvent"), n("LITERAL", "null"))),
            n("RETURN"),
        ];
    }
    if (options.lambdaWorkpack || options.badLambdaThis || options.badLambdaArity || options.badLambdaReturn) {
        const lambdaBody = options.badLambdaReturn ? [] : [n("RETURN", null, [
            options.badLambdaThis ? n("IDENTIFIER", "a")
                : binary("ADD", n("IDENTIFIER", "value"), "+", n("IDENTIFIER", "offset")),
        ])];
        onEventBody = [
            localDeclaration("VAR_LIST", "offset", "Number", n("LITERAL", "1")),
            localDeclaration("VAR_LIST", "handler", "Function",
                lambda([parameter("value", "Number")], "Number", lambdaBody)),
            localDeclaration("VAR_LIST", "result", "Number",
                call(n("IDENTIFIER", "handler"), options.badLambdaArity ? [] : [n("LITERAL", "2")])),
            n("RETURN"),
        ];
    }
    if (options.dictionaryWorkpack) {
        const dictionaryIndex = () => n("ARRAY_ACCESSOR", null, [n("IDENTIFIER", "dictionary"), n("IDENTIFIER", "key")]);
        onEventBody = [
            localDeclaration("VAR_LIST", "key", "Object", objectLiteral([["id", n("LITERAL", "1")]])),
            assignment(dictionaryIndex(), n("LITERAL", '"value"')),
            localDeclaration("VAR_LIST", "found", "Object", dictionaryIndex()),
            localDeclaration("VAR_LIST", "removed", "Boolean", n("DELETE", null, [dictionaryIndex()])),
            n("FORIN", null, [n("INIT", null, [n("IDENTIFIER", "key")]),
                n("IN", null, [n("IDENTIFIER", "dictionary")]), n("BLOCK", null, [n("CONTINUE")])]),
            n("RETURN"),
        ];
    }
    if (options.byteArrayWorkpack || options.heldByteArrayMember) {
        onEventBody = options.heldByteArrayMember ? [
            call(dot(n("IDENTIFIER", "bytes"), "uncompress")), n("RETURN"),
        ] : [
            assignment(dot(n("IDENTIFIER", "bytes"), "endian"),
                dot(n("IDENTIFIER", "Endian"), "LITTLE_ENDIAN")),
            call(dot(n("IDENTIFIER", "bytes"), "writeInt"), [n("LITERAL", "1")]),
            assignment(dot(n("IDENTIFIER", "bytes"), "position"), n("LITERAL", "0")),
            localDeclaration("VAR_LIST", "decoded", "uint",
                call(dot(n("IDENTIFIER", "bytes"), "readUnsignedInt"))),
            assignment(n("ARRAY_ACCESSOR", null, [n("IDENTIFIER", "bytes"), n("LITERAL", "1.5")]),
                n("LITERAL", "258")),
            localDeclaration("VAR_LIST", "indexed", "uint",
                n("ARRAY_ACCESSOR", null, [n("IDENTIFIER", "bytes"), n("LITERAL", "1")])),
            call(dot(n("IDENTIFIER", "bytes"), "writeMultiByte"), [n("LITERAL", '"mail"'), n("LITERAL", '""')]),
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
    if (options.vectorCallbackWorkpack || options.badVectorCallback || options.staleVectorCallbackProof) {
        members.push(
            method("compareValues", [parameter("left", "int"), parameter("right", "int")],
                "Number", [n("RETURN", null, [n("LITERAL", "0")])]),
            method("visitValue", [parameter("value", "int")], "void", [n("RETURN")]),
        );
    }
    if (options.defaultParameterWorkpack) {
        members.push(method("configure", [parameter("enabled", "Boolean", "true")], "void", [n("RETURN")]));
    }
    if (options.negativeDefaultWorkpack || options.badNegativeDefault) {
        const operand = options.badNegativeDefault ? n("LITERAL", '"bad"') : n("LITERAL", "1");
        members.push(method("configureIndex", [expressionParameter("index", "int",
            n("MINUS", null, [operand]))], "void", [n("RETURN")]));
    }
    if (options.restParameterWorkpack || options.badRestPosition) {
        const parameters = options.badRestPosition
            ? [restParameter("values"), parameter("suffix", "String")]
            : [parameter("prefix", "String"), restParameter("values")];
        members.push(method("collect", parameters, "void", [n("RETURN")]));
    }
    if (options.overrideWorkpack) {
        members.push(method("addEventListener", [
            parameter("type", "String"), parameter("listener", "Function"),
            parameter("useCapture", "Boolean", "false"), parameter("priority", "int", "0"),
            parameter("useWeakReference", "Boolean", "false"),
        ], "void", [n("RETURN")], ["override", "public"]));
    }
    if (options.nullableWorkpack || options.badPrimitiveNullDefault) {
        members.push(method("acceptNullable", [parameter("value",
            options.badPrimitiveNullDefault ? "Number" : "Event", "null")], "void", [n("RETURN")]));
    }
    if (options.namespaceWorkpack || options.namespaceCollision || options.namespaceAccessCollision) {
        members.push(method("namespaced", [], "void", [n("RETURN")],
            options.namespaceAccessCollision ? ["public", "ResourcesSpace"] : ["ResourcesSpace"]));
        if (options.namespaceCollision) {
            members.push(method("namespaced", [], "void", [n("RETURN")], ["OtherSpace"]));
        }
    }
    if (options.implicitObjectSuper) members.splice(0, members.length, constructor(body));
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
    const classChildren = [n("NAME", "Demo"), mods("public")];
    if (!options.implicitObjectSuper) classChildren.push(n("EXTENDS", "Sprite"));
    if (options.unsupportedChild) {
        classChildren.push(n("META_LIST"));
    }
    classChildren.push(n("CONTENT", null, members));
    const imports = options.wildcardImports
        ? [n("IMPORT", "flash.display.*"), n("IMPORT", "flash.events.*")]
        : [n("IMPORT", "flash.display.Sprite"), n("IMPORT", "flash.events.Event")];
    if (options.dictionaryWorkpack || options.badDictionaryConstructor) {
        imports.push(n("IMPORT", "flash.utils.Dictionary"));
    }
    if (options.byteArrayWorkpack || options.heldByteArrayMember) {
        imports.push(n("IMPORT", "flash.utils.ByteArray"), n("IMPORT", "flash.utils.Endian"));
    }
    if (options.unmappedFlashImport) imports.push(n("IMPORT", "flash.geom.Point"));
    if (options.unusedWildcard) imports.push(n("IMPORT", "flash.geom.*"));
    if (options.namespaceWorkpack || options.namespaceCollision || options.namespaceAccessCollision) {
        imports.push(n("USE", "ResourcesSpace"));
        if (options.namespaceCollision) imports.push(n("USE", "OtherSpace"));
    }
    return n("COMPILATION_UNIT", null, [
        n("PACKAGE", null, [
            n("NAME", "lobby.ui"),
            n("CONTENT", null, options.postClassImport ? [
                n("CLASS", null, classChildren),
            ].concat(imports) : imports.concat([n("CLASS", null, classChildren)])),
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

function buildInterfaceTree(options = {}) {
    const members = [
        n("FUNCTION", "function", [n("NAME", "run"), n("PARAMETER_LIST", null, [
            parameter("value", "int"), restParameter("rest"),
        ]), type("String")]),
        n("GET", "name", [n("NAME", "name"), n("PARAMETER_LIST"), type("String")]),
        n("SET", "name", [n("NAME", "name"), n("PARAMETER_LIST", null, [parameter("value", "String")]), type("void")]),
    ];
    if (options.duplicate) members.push(members[0]);
    return n("COMPILATION_UNIT", null, [
        n("PACKAGE", null, [n("NAME", "lobby.api"), n("CONTENT", null, [
            n("INTERFACE", null, [n("NAME", "IThing"), mods("public"), n("CONTENT", null, members)]),
        ])]),
        n("CONTENT"),
    ]);
}

function canonicalJson(value) {
    if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

function buildLocalBaseTree(options = {}) {
    const imports = options.samePackage ? []
        : options.wildcardImports ? [n("IMPORT", "lobby.base.*")] : [n("IMPORT", "lobby.base.Base")];
    if (options.withPackageSymbols) imports.push(n("IMPORT", "lobby.base.SCore"));
    if (options.withPackageSymbols || options.withNamespace) {
        imports.push(n("IMPORT", "lobby.base.InternalSpace"), n("USE", "InternalSpace"));
    }
    if (options.withInterface && !options.wildcardImports && !options.samePackage) {
        imports.push(n("IMPORT", "lobby.base.IReady"));
    }
    if (options.localStaticCall || options.badLocalStaticCall || options.localStaticField
        || options.badLocalStaticWrite) imports.push(n("IMPORT", "lobby.base.Utility"));
    const classChildren = [n("NAME", "Demo"), mods("public"), n("EXTENDS", "Base")];
    if (options.withInterface) classChildren.push(n("IMPLEMENTS_LIST", null, [n("IMPLEMENTS", "IReady")]));
    const superArguments = options.superArgument ? [n("LITERAL", options.badSuperArgument ? '"bad"' : "1")] : [];
    const members = [constructor([call(n("IDENTIFIER", "super"), superArguments)])];
    if (options.localOverride || options.badLocalOverride) {
        members.push(method("run", [vectorParameter("value", options.badLocalOverride ? "uint" : "int")],
            "String", [n("RETURN", null, [n("LITERAL", '"ok"')])], ["protected", "override"]));
    }
    if (options.localNew || options.badLocalNew) {
        members.unshift(n("VAR_LIST", null, [mods("private"), n("NAME_TYPE_INIT", null, [
            n("NAME", "created"), type("Base"), n("INIT", null, [construct("Base", [
                n("LITERAL", options.badLocalNew ? '"bad"' : "1"),
            ])]),
        ])]));
    }
    if (options.inheritedCall || options.badInheritedCall) {
        const element = options.badInheritedCall ? "uint" : "int";
        members.push(method("invokeInherited", [], "void", [
            call(n("IDENTIFIER", "run"), [n("NEW", null, [call(vectorType(element), [])])]),
            n("RETURN"),
        ]));
    }
    if (options.inheritedMembers) {
        members.push(method("useInheritedMembers", [], "void", [
            assignment(n("IDENTIFIER", "count"), n("LITERAL", "1")),
            localDeclaration("VAR_LIST", "label", "String", n("IDENTIFIER", "title")),
            assignment(n("IDENTIFIER", "title"), n("LITERAL", '"updated"')),
            n("RETURN"),
        ]));
    }
    if (options.withPackageSymbols) {
        members.push(method("usePackageConstant", [], "void", [
            localDeclaration("VAR_LIST", "shared", "Base", n("IDENTIFIER", "SCore")), n("RETURN"),
        ]));
    }
    if (options.withPackageSymbols || options.withNamespace) {
        members.push(method("packageNamespaced", [], "void", [n("RETURN")], ["InternalSpace"]));
    }
    if (options.superMethodCall || options.badSuperMethodCall || options.staticSuperMethodCall
        || options.lambdaSuperMethodCall) {
        const superRun = () => call(dot(n("IDENTIFIER", "super"), "run"), [
            n("NEW", null, [call(vectorType(options.badSuperMethodCall ? "uint" : "int"), [])]),
        ]);
        const body = options.lambdaSuperMethodCall ? [
            localDeclaration("VAR_LIST", "callback", "Function", lambda([], "void", [superRun(), n("RETURN")])),
            n("RETURN"),
        ] : [superRun(), n("RETURN")];
        members.push(method("invokeSuperMethod", [], "void", body,
            options.staticSuperMethodCall ? ["public", "static"] : ["public"]));
    }
    if (options.superMethodField) {
        members.unshift(n("VAR_LIST", null, [mods("private"), n("NAME_TYPE_INIT", null, [
            n("NAME", "superMethod"), type("Function"),
            n("INIT", null, [dot(n("IDENTIFIER", "super"), "run")]),
        ])]));
    }
    if (options.localNamespaceOverride) {
        members.push(method("namespacedRun", [], "void", [n("RETURN")], ["override", "InternalSpace"]));
    }
    if (options.withInterface) members.push(method("check", [parameter("value", "Object")], "void", [
        localDeclaration("VAR_LIST", "ready", "IReady",
            n("RELATION", null, [n("IDENTIFIER", "value"), n("AS", "as"), n("IDENTIFIER", "IReady")])),
        localDeclaration("VAR_LIST", "matches", "Boolean",
            n("RELATION", null, [n("IDENTIFIER", "value"), n("OP", "is"), n("IDENTIFIER", "IReady")])),
        n("RETURN"),
    ]));
    if (options.localStaticCall || options.badLocalStaticCall) members.push(method("useLocalStatic", [], "String", [
        n("RETURN", null, [call(dot(n("IDENTIFIER", "Utility"), "describe"), [
            n("LITERAL", options.badLocalStaticCall ? '"wrong"' : "1.5"),
        ])]),
    ]));
    if (options.localStaticField) members.push(method("readLocalStatic", [], "String", [
        n("RETURN", null, [dot(n("IDENTIFIER", "Utility"), "VERSION")]),
    ]));
    if (options.badLocalStaticWrite) members.push(method("writeLocalStatic", [], "void", [
        assignment(dot(n("IDENTIFIER", "Utility"), "VERSION"), n("LITERAL", '"changed"')),
        n("RETURN"),
    ]));
    classChildren.push(n("CONTENT", null, members));
    return n("COMPILATION_UNIT", null, [
        n("PACKAGE", null, [n("NAME", "lobby.ui"), n("CONTENT", null,
            imports.concat([n("CLASS", null, classChildren)]))]),
        n("CONTENT"),
    ]);
}

function localAuthority(api, normalized, options = {}) {
    const baseNodeId = "0000000000000001";
    const currentNodeId = "0000000000000002";
    const entries = [
        {
            componentId: "scc-00001", importable: options.baseImportable !== false, module: options.baseModule || "application",
            graphSourceSha256: "1".repeat(64), nodeId: baseNodeId, prerequisites: [],
            qname: options.baseQName || (options.samePackage ? "lobby.ui.Base" : "lobby.base.Base"),
            sourceContentSha256: "5".repeat(64),
            sourcePath: options.samePackage ? "game-client/tapplication_main/src/lobby/ui/Base.as"
                : "game-client/tapplication_main/src/lobby/base/Base.as",
            targetPath: options.samePackage ? "game-client/layaair/src/application/lobby/ui/Base.ts"
                : "game-client/layaair/src/application/lobby/base/Base.ts", topologicalLevel: 0,
            typeKind: options.baseKind || "class",
        },
        ...(options.withInterface ? [{
            componentId: "scc-00001", importable: true, module: "application",
            graphSourceSha256: "6".repeat(64), nodeId: "0000000000000003", prerequisites: [],
            qname: options.samePackage ? "lobby.ui.IReady" : "lobby.base.IReady", sourceContentSha256: "7".repeat(64),
            sourcePath: options.samePackage ? "game-client/tapplication_main/src/lobby/ui/IReady.as"
                : "game-client/tapplication_main/src/lobby/base/IReady.as",
            targetPath: options.samePackage ? "game-client/layaair/src/application/lobby/ui/IReady.ts"
                : "game-client/layaair/src/application/lobby/base/IReady.ts", topologicalLevel: 0,
            typeKind: "interface",
        }] : []),
        ...(options.withPackageSymbols ? [{
            componentId: "scc-00001", importable: true, module: "application",
            graphSourceSha256: "9".repeat(64), nodeId: "0000000000000004", prerequisites: [baseNodeId],
            qname: "lobby.base.SCore", sourceContentSha256: "a".repeat(64),
            sourcePath: "game-client/tapplication_main/src/lobby/base/SCore.as",
            targetPath: "game-client/layaair/src/application/lobby/base/SCore.ts", topologicalLevel: 1,
            typeKind: "package",
        }] : []),
        ...(options.withPackageSymbols || options.withNamespace ? [{
            componentId: "scc-00001", importable: true, module: "application",
            graphSourceSha256: "b".repeat(64), nodeId: "0000000000000005", prerequisites: [],
            qname: "lobby.base.InternalSpace", sourceContentSha256: "c".repeat(64),
            sourcePath: "game-client/tapplication_main/src/lobby/base/InternalSpace.as",
            targetPath: "game-client/layaair/src/application/lobby/base/InternalSpace.ts", topologicalLevel: 0,
            typeKind: "package",
        }] : []),
        ...(options.localStaticCall || options.badLocalStaticCall || options.localStaticField
            || options.badLocalStaticWrite ? [{
            componentId: "scc-00001", importable: true, module: "application",
            graphSourceSha256: "d".repeat(64), nodeId: "0000000000000006", prerequisites: [],
            qname: "lobby.base.Utility", sourceContentSha256: "e".repeat(64),
            sourcePath: "game-client/tapplication_main/src/lobby/base/Utility.as",
            targetPath: "game-client/layaair/src/application/lobby/base/Utility.ts", topologicalLevel: 0,
            typeKind: "class",
        }] : []),
        {
            componentId: "scc-00002", graphSourceSha256: "8".repeat(64), importable: true,
            module: "application", nodeId: currentNodeId,
            prerequisites: options.withEdge === false ? [] : [baseNodeId]
                .concat(options.withInterface ? ["0000000000000003"] : [])
                .concat(options.withPackageSymbols ? ["0000000000000004"] : [])
                .concat(options.withPackageSymbols || options.withNamespace ? ["0000000000000005"] : [])
                .concat(options.localStaticCall || options.badLocalStaticCall || options.localStaticField
                    || options.badLocalStaticWrite ? ["0000000000000006"] : []), qname: "lobby.ui.Demo",
            sourcePath: options.currentSourcePath || "game-client/tapplication_main/src/lobby/ui/Demo.as",
            sourceContentSha256: options.currentSourceSha256 || normalized.ast.sourceSha256,
            targetPath: "game-client/layaair/src/application/lobby/ui/Demo.ts", topologicalLevel: 1, typeKind: "class",
        },
    ].sort((left, right) => `${left.module}\u0000${left.qname}`.localeCompare(`${right.module}\u0000${right.qname}`));
    const document = {
        dependencyGraphRawSha256: "2".repeat(64), dependencyGraphSemanticSha256: "3".repeat(64), entries,
        entryCount: entries.length, schema: "bleach-local-as3-type-map@2", sourceManifestSha256: "4".repeat(64),
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
    const normalized = flatten(buildLocalBaseTree(options));
    const locals = localAuthority(api, normalized, options);
    const members = options.withoutMemberAuthority ? undefined : localMemberAuthority(api, locals,
        options.mutateMemberAuthority || null);
    return api.adaptNormalizedParserAst(normalized.ast, authority, normalized.sourceText, sha256,
        locals, options.logicalPath || "lobby/ui/Demo.as", members);
}

function localMemberAuthority(api, localTypes, mutate = null) {
    const entries = localTypes.entries.map(entry => ({
        module: entry.module,
        qname: entry.qname,
        nodeId: entry.nodeId,
        sourceContentSha256: entry.sourceContentSha256,
        typeKind: entry.typeKind,
        status: "complete",
        holdCode: null,
        holdSha256: null,
        declaration: entry.typeKind === "package" ? {
            baseQNames: [], interfaceQNames: [], members: [entry.qname.endsWith(".InternalSpace") ? {
                kind: "namespace", name: "InternalSpace", modifiers: ["public"], namespaceName: null,
                parameters: [], returnType: null, fieldType: null, readonly: false,
            } : {
                kind: "field", name: "SCore", modifiers: ["public"], namespaceName: null,
                parameters: [], returnType: null, fieldType: "lobby.base.Base", readonly: true,
            }],
            packageInitializer: entry.qname.endsWith(".InternalSpace") ? null
                : { kind: "new", targetQName: "lobby.base.Base", argumentCount: 0 },
        } : {
            baseQNames: entry.qname.endsWith(".Demo") ? [entry.qname.replace(/\.Demo$/, ".Base")] : [],
            interfaceQNames: [],
            members: entry.qname.endsWith(".Utility") ? [{
                kind: "method", name: "describe", modifiers: ["public", "static"], namespaceName: null,
                parameters: [{ name: "value", type: "int", optional: false, rest: false }],
                returnType: "String", fieldType: null, readonly: false,
            }, {
                kind: "field", name: "VERSION", modifiers: ["public", "static"], namespaceName: null,
                parameters: [], returnType: null, fieldType: "String", readonly: true,
            }] : entry.qname.endsWith(".Base") ? [{
                kind: "constructor", name: "Base", modifiers: ["public"], namespaceName: null,
                parameters: [{ name: "value", type: "int", optional: true, rest: false }],
                returnType: null, fieldType: null, readonly: false,
            }, {
                kind: "method", name: "run", modifiers: ["protected"], namespaceName: null,
                parameters: [{ name: "value", type: "Vector.<int>", optional: false, rest: false }],
                returnType: "String", fieldType: null, readonly: false,
            }, {
                kind: "method", name: "namespacedRun", modifiers: [], namespaceName: "InternalSpace",
                parameters: [], returnType: "void", fieldType: null, readonly: false,
            }, {
                kind: "field", name: "count", modifiers: ["protected"], namespaceName: null,
                parameters: [], returnType: null, fieldType: "int", readonly: false,
            }, {
                kind: "getter", name: "title", modifiers: ["protected"], namespaceName: null,
                parameters: [], returnType: "String", fieldType: null, readonly: false,
            }, {
                kind: "setter", name: "title", modifiers: ["protected"], namespaceName: null,
                parameters: [{ name: "value", type: "String", optional: false, rest: false }],
                returnType: "void", fieldType: null, readonly: false,
            }] : [{
                kind: "constructor", name: "Demo", modifiers: ["public"], namespaceName: null,
                parameters: [], returnType: null, fieldType: null, readonly: false,
            }],
            packageInitializer: null,
        },
    }));
    if (mutate) mutate(entries);
    const document = {
        completeCount: entries.length,
        declarationWorkerSha256: "a".repeat(64),
        entries,
        entryCount: entries.length,
        heldCount: 0,
        localTypeMapSha256: "b".repeat(64),
        schema: "bleach-local-as3-member-map@2",
        sourceCensusSha256: "c".repeat(64),
    };
    const json = `${canonicalJson(document)}\n`;
    return api.loadLocalMemberAuthority({
        expectedCompleteCount: entries.length,
        expectedDeclarationWorkerSha256: document.declarationWorkerSha256,
        expectedEntryCount: entries.length,
        expectedHeldCount: 0,
        expectedLocalTypeMapSha256: document.localTypeMapSha256,
        expectedSourceCensusSha256: document.sourceCensusSha256,
        json,
        sha256: sha256(json),
    }, sha256, localTypes);
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
    const targetCapabilitiesJson = fs.readFileSync(requiredEnvironmentPath("HARDENED_TARGET_CAPABILITIES"), "utf8")
        .replace(/\r\n?/g, "\n");
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
    assert.ok(Object.isFrozen(authority.intrinsicTypesBySource));
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
    const localOverrideProgram = adaptLocal(api, authority, { localOverride: true });
    const localOverrideOutput = api.emitSemanticProgram(localOverrideProgram,
        { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(localOverrideOutput.code,
        /protected override run\(value: __as3Vector<number> \| null\): string \| null/);
    assertErrorCode(() => adaptLocal(api, authority, { badLocalOverride: true }),
        "HARDENED_LOCAL_MEMBER_SIGNATURE");
    assertErrorCode(() => adaptLocal(api, authority, { localOverride: true, withoutMemberAuthority: true }),
        "HARDENED_LOCAL_MEMBER_AUTHORITY");
    const localSuperArgumentOutput = api.emitSemanticProgram(adaptLocal(api, authority, { superArgument: true }),
        { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(localSuperArgumentOutput.code, /super\(__as3Int\(1\)\);/);
    assertErrorCode(() => adaptLocal(api, authority, { superArgument: true, badSuperArgument: true }),
        "HARDENED_LOCAL_CONSTRUCTOR_TYPE");
    const localNewOutput = api.emitSemanticProgram(adaptLocal(api, authority, { localNew: true }),
        { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(localNewOutput.code, /private created: Base \| null = new Base\(__as3Int\(1\)\);/);
    assertErrorCode(() => adaptLocal(api, authority, { badLocalNew: true }),
        "HARDENED_LOCAL_CONSTRUCTOR_TYPE");
    const inheritedCallOutput = api.emitSemanticProgram(adaptLocal(api, authority, { inheritedCall: true }),
        { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(inheritedCallOutput.code,
        /this\.run\(new __as3Vector<number>\(__as3VectorPolicies\.int\)\);/);
    assertErrorCode(() => adaptLocal(api, authority, { badInheritedCall: true }),
        "HARDENED_LOCAL_CALL_TYPE");
    const superMethodOutput = api.emitSemanticProgram(adaptLocal(api, authority, { superMethodCall: true }),
        { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(superMethodOutput.code,
        /super\.run\(new __as3Vector<number>\(__as3VectorPolicies\.int\)\);/);
    assertErrorCode(() => adaptLocal(api, authority, { badSuperMethodCall: true }),
        "HARDENED_LOCAL_CALL_TYPE");
    assertErrorCode(() => adaptLocal(api, authority, { staticSuperMethodCall: true }),
        "HARDENED_SUPER_CONTEXT");
    assertErrorCode(() => adaptLocal(api, authority, { lambdaSuperMethodCall: true }),
        "HARDENED_SUPER_CONTEXT");
    assertErrorCode(() => adaptLocal(api, authority, { superMethodField: true }),
        "HARDENED_SUPER_CONTEXT");
    const inheritedMembersOutput = api.emitSemanticProgram(adaptLocal(api, authority, { inheritedMembers: true }),
        { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(inheritedMembersOutput.code, /this\.count = __as3Int\(1\);/);
    assert.match(inheritedMembersOutput.code, /var label: string \| null = this\.title;/);
    assert.match(inheritedMembersOutput.code, /this\.title = "updated";/);
    const packageValueOutput = api.emitSemanticProgram(adaptLocal(api, authority, { withPackageSymbols: true }),
        { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(packageValueOutput.code, /import \{ SCore \} from "\.\.\/base\/SCore";/);
    assert.match(packageValueOutput.code, /var shared: Base \| null = SCore;/);
    assertErrorCode(() => adaptLocal(api, authority, { withPackageSymbols: true,
        mutateMemberAuthority: entries => {
            const base = entries.find(entry => entry.qname === "lobby.base.Base");
            base.declaration.members.find(member => member.kind === "constructor").parameters[0].optional = false;
        },
    }), "HARDENED_LOCAL_PACKAGE_INITIALIZER_ARITY");
    const namespaceProgram = adaptLocal(api, authority, { withNamespace: true });
    const localNamespaceOutput = api.emitSemanticProgram(namespaceProgram,
        { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.doesNotMatch(localNamespaceOutput.code, /InternalSpace/);
    const namespaceOverrideOutput = api.emitSemanticProgram(adaptLocal(api, authority,
        { withNamespace: true, localNamespaceOverride: true }),
    { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(namespaceOverrideOutput.code, /override namespacedRun\(\): void/);
    assert.doesNotMatch(namespaceOverrideOutput.code, /InternalSpace/);
    const localStaticOutput = api.emitSemanticProgram(adaptLocal(api, authority,
        { localStaticCall: true }), { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(localStaticOutput.code, /return Utility\.describe\(__as3Int\(1\.5\)\);/);
    const localStaticFieldOutput = api.emitSemanticProgram(adaptLocal(api, authority,
        { localStaticField: true }), { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(localStaticFieldOutput.code, /return Utility\.VERSION;/);
    assertErrorCode(() => adaptLocal(api, authority, { badLocalStaticCall: true }),
        "HARDENED_LOCAL_CALL_TYPE");
    assertErrorCode(() => adaptLocal(api, authority, { badLocalStaticWrite: true }),
        "HARDENED_LOCAL_STATIC_WRITE");
    assertErrorCode(() => adaptLocal(api, authority, { localStaticCall: true,
        mutateMemberAuthority: entries => {
            const utility = entries.find(entry => entry.qname === "lobby.base.Utility");
            utility.declaration.members.find(member => member.name === "describe").modifiers = ["private", "static"];
        },
    }), "HARDENED_LOCAL_STATIC_VISIBILITY");
    const localNormalizedForMembers = flatten(buildLocalBaseTree());
    const localTypesForMembers = localAuthority(api, localNormalizedForMembers);
    const localMembers = localMemberAuthority(api, localTypesForMembers);
    assert.ok(Object.isFrozen(localMembers));
    assert.ok(Object.isFrozen(localMembers.entries));
    assert.equal(localMembers.completeCount, 2);
    assert.equal(localMembers.entriesByIdentity["application\u0000lobby.base.Base"]
        .declaration.members[1].parameters[0].type, "Vector.<int>");
    assertErrorCode(() => api.loadLocalMemberAuthority({
        expectedCompleteCount: 2, expectedDeclarationWorkerSha256: "a".repeat(64), expectedEntryCount: 2,
        expectedHeldCount: 0, expectedLocalTypeMapSha256: "b".repeat(64),
        expectedSourceCensusSha256: "c".repeat(64), json: "{}\n", sha256: sha256("{}\n"),
    }, sha256, localTypesForMembers), "HARDENED_LOCAL_MEMBER_SCHEMA");
    assertErrorCode(() => localMemberAuthority(api, localTypesForMembers,
        entries => { entries[0].sourceContentSha256 = "c".repeat(64); }), "HARDENED_LOCAL_MEMBER_ENTRY");
    const samePackageBaseProgram = adaptLocal(api, authority, { samePackage: true });
    assert.equal(samePackageBaseProgram.imports[0].sourceQualifiedName, "lobby.ui.Base");
    assert.equal(samePackageBaseProgram.imports[0].authorityKind, "local");
    assert.match(api.emitSemanticProgram(samePackageBaseProgram,
        { compiler: ts, expectedTypeScriptVersion: "4.9.5" }).code,
    /import \{ Base \} from "\.\/Base";/);
    assertErrorCode(() => adaptLocal(api, authority, { samePackage: true, withEdge: false }),
        "HARDENED_LOCAL_IMPORT_EDGE");
    const samePackageInterfaceProgram = adaptLocal(api, authority, { samePackage: true, withInterface: true });
    assert.deepEqual(samePackageInterfaceProgram.imports.map(item => item.sourceQualifiedName),
        ["lobby.ui.Base", "lobby.ui.IReady"]);
    assert.equal(samePackageInterfaceProgram.declaration.implementsTypes[0].runtimeName, "lobby.ui.IReady");
    const localInterfaceProgram = adaptLocal(api, authority, { withInterface: true });
    assert.equal(localInterfaceProgram.imports[1].runtimeInterface, true);
    assert.equal(localInterfaceProgram.declaration.implementsTypes[0].runtimeName, "lobby.base.IReady");
    const localInterfaceOutput = api.emitSemanticProgram(localInterfaceProgram,
        { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(localInterfaceOutput.code, /export class Demo extends Base implements IReady/);
    assert.match(localInterfaceOutput.code, /__as3RegisterInterfaces\(Demo, \[__as3InterfaceType\("lobby\.base\.IReady"\)\]\);/);
    assert.match(localInterfaceOutput.code, /__as3As\(value, __as3InterfaceType\("lobby\.base\.IReady"\)\)/);
    const localWildcardProgram = adaptLocal(api, authority, { withInterface: true, wildcardImports: true });
    assert.deepEqual(localWildcardProgram.imports.map(item => item.sourceQualifiedName),
        ["lobby.base.Base", "lobby.base.IReady"]);
    assert.match(api.emitSemanticProgram(localWildcardProgram,
        { compiler: ts, expectedTypeScriptVersion: "4.9.5" }).code,
    /import \{ Base \} from "\.\.\/base\/Base";/);
    assertErrorCode(() => adaptLocal(api, authority, { withEdge: false }), "HARDENED_LOCAL_IMPORT_EDGE");
    assertErrorCode(() => adaptLocal(api, authority, { baseQName: "lobby.base.Other" }), "HARDENED_LOCAL_IMPORT");
    assertErrorCode(() => adaptLocal(api, authority, { baseKind: "interface" }), "HARDENED_BASE_TYPE");
    assertErrorCode(() => adaptLocal(api, authority, { currentSourceSha256: "5".repeat(64) }),
        "HARDENED_LOCAL_SOURCE_AUTHORITY");
    assertErrorCode(() => adaptLocal(api, authority, { logicalPath: "other/Demo.as" }),
        "HARDENED_LOCAL_SOURCE_AUTHORITY");
    assertErrorCode(() => adapt(api, buildTree({ unmappedFlashImport: true }), authority),
        "HARDENED_FLASH_IMPORT_UNMAPPED");

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
    assert.match(emitted.code, /private b: string \| null = "x";/);
    assert.ok(emitted.code.indexOf("super();") < emitted.code.indexOf("this.addEventListener"));
    assert.match(emitted.code, /this\.onEvent = this\.onEvent\.bind\(this\);/);
    assert.match(emitted.code, /this\.addEventListener\("ready", this\.onEvent\);/);
    assert.equal((emitted.code.match(/this\.onEvent = this\.onEvent\.bind\(this\);/g) || []).length, 1);
    assert.doesNotMatch(emitted.code, /AVM|ABC|compat|wrapper/i);
    const wildcardProgram = adapt(api, buildTree({ wildcardImports: true }), authority);
    assert.ok(wildcardProgram.imports.some(item => item.sourceQualifiedName === "flash.display.Sprite"));
    assert.ok(wildcardProgram.imports.some(item => item.sourceQualifiedName === "flash.events.Event"));
    const wildcardOutput = api.emitSemanticProgram(wildcardProgram,
        { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(wildcardOutput.code, /import \{ Sprite \} from "laya\/flash\/display\/Sprite";/);
    const unusedWildcardProgram = adapt(api, buildTree({ unusedWildcard: true }), authority);
    assert.deepEqual(unusedWildcardProgram.imports.map(item => item.sourceQualifiedName),
        ["flash.display.Sprite", "flash.events.Event"]);
    const implicitObjectProgram = adapt(api, buildTree({ implicitObjectSuper: true }), authority);
    assert.equal(implicitObjectProgram.declaration.extendsType, null);
    const implicitObjectOutput = api.emitSemanticProgram(implicitObjectProgram,
        { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(implicitObjectOutput.code, /export class Demo \{/);
    assert.doesNotMatch(implicitObjectOutput.code, /super\(\)/,
        "AS3's explicit call to the implicit Object constructor lowers to the native TS class default");
    const constProgram = adapt(api, buildTree({ constFields: true }), authority);
    const constFields = constProgram.declaration.members.filter((member) => member.kind === "field");
    assert.equal(constFields.every((field) => field.readonly), true);
    const constOutput = api.emitSemanticProgram(constProgram, { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(constOutput.code, /private readonly a: number = 1;/);
    assert.match(constOutput.code, /private readonly b: string \| null = "x";/);
    const vectorProgram = adapt(api, buildTree({ vectorWorkpack: true }), authority);
    const vectorOutput = api.emitSemanticProgram(vectorProgram, { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(vectorOutput.code, /AS3Vector as __as3Vector/);
    assert.match(vectorOutput.code, /private values: __as3Vector<number> \| null = new __as3Vector<number>\(__as3VectorPolicies\.int, __as3Uint\(2\), false\);/);
    assert.match(vectorOutput.code, /this\.values!\[__as3Uint\(0\)\] = __as3Int\(4\);/);
    assert.match(vectorOutput.code, /this\.values!\.push\(__as3Int\(5\)\);/);
    assert.match(vectorOutput.code, /var copy: __as3Vector<number> \| null = __as3Vector\.from<number>\(__as3VectorPolicies\.int, \[1, 2\]\);/);
    const vectorNumericProgram = adapt(api, buildTree({ vectorNumericWorkpack: true }), authority);
    const vectorNumericOutput = api.emitSemanticProgram(vectorNumericProgram,
        { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(vectorNumericOutput.code,
        /new __as3Vector<number>\(__as3VectorPolicies\.int, __as3Uint\(1\.5\), false\)/);
    assert.match(vectorNumericOutput.code, /this\.values!\.slice\(__as3Int\(4294967295\)\);/);
    const vectorCallbackProgram = adapt(api, buildTree({ vectorCallbackWorkpack: true }), authority);
    const vectorCallbackOutput = api.emitSemanticProgram(vectorCallbackProgram,
        { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(vectorCallbackOutput.code, /this\.values!\.sort\(this\.compareValues\);/);
    assert.match(vectorCallbackOutput.code, /this\.values!\.forEach\(this\.visitValue\);/);
    assertErrorCode(() => adapt(api, buildTree({ badVectorCallback: true }), authority),
        "HARDENED_VECTOR_CALLBACK_TYPE");
    assertErrorCode(() => adapt(api, buildTree({ staleVectorCallbackProof: true }), authority),
        "HARDENED_VECTOR_CALLBACK_IDENTITY");
    const shortVectorProgram = adapt(api, buildTree({ shortVectorWorkpack: true }), authority);
    const shortVectorOutput = api.emitSemanticProgram(shortVectorProgram,
        { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(shortVectorOutput.code,
        /var shortValues: __as3Vector<number> \| null = __as3Vector\.from<number>\(__as3VectorPolicies\.int, \[1, 2\]\);/);
    assertErrorCode(() => adapt(api, buildTree({ badShortVectorShape: true }), authority),
        "HARDENED_SHORT_VECTOR_SHAPE");
    const runtimeTypeProgram = adapt(api, buildTree({ runtimeTypeWorkpack: true }), authority);
    const runtimeTypeOutput = api.emitSemanticProgram(runtimeTypeProgram, { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(runtimeTypeOutput.code, /as3As as __as3As/);
    assert.match(runtimeTypeOutput.code, /var cast: Event \| null = __as3As\(event, __as3ClassType\("flash\.events\.Event", Event\)\);/);
    assert.match(runtimeTypeOutput.code, /var matches: boolean = __as3Is\(event, __as3ClassType\("flash\.events\.Event", Event\)\);/);
    const vectorRuntimeProgram = adapt(api, buildTree({ vectorRuntimeWorkpack: true }), authority);
    const vectorRuntimeOutput = api.emitSemanticProgram(vectorRuntimeProgram, { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(vectorRuntimeOutput.code, /__as3As\(this\.values, __as3VectorType\(__as3VectorPolicies\.int\)\)/);
    assert.match(vectorRuntimeOutput.code, /__as3Is\(this\.values, __as3VectorType\(__as3VectorPolicies\.int\)\)/);
    const nestedVectorProgram = adapt(api, buildTree({ nestedVectorWorkpack: true }), authority);
    const nestedVectorOutput = api.emitSemanticProgram(nestedVectorProgram, { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(nestedVectorOutput.code,
        /private matrix: __as3Vector<__as3Vector<number> \| null> \| null = new __as3Vector<__as3Vector<number> \| null>\(__as3VectorNested\(__as3VectorPolicies\.int\), __as3Uint\(1\)\);/);
    const vectorBuiltinReferenceProgram = adapt(api, buildTree({ vectorBuiltinReferenceWorkpack: true }), authority);
    const vectorBuiltinReferenceOutput = api.emitSemanticProgram(vectorBuiltinReferenceProgram,
        { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(vectorBuiltinReferenceOutput.code,
        /private classes: __as3Vector<Function \| null> \| null = new __as3Vector<Function \| null>\(__as3VectorPolicies\.class\);/);
    assert.match(vectorBuiltinReferenceOutput.code,
        /private routines: __as3Vector<Function \| null> \| null = new __as3Vector<Function \| null>\(__as3VectorPolicies\.function\);/);
    assert.match(vectorBuiltinReferenceOutput.code,
        /private rows: __as3Vector<unknown\[] \| null> \| null = new __as3Vector<unknown\[] \| null>\(__as3VectorPolicies\.array\);/);
    const coercionProgram = adapt(api, buildTree({ coercionWorkpack: true }), authority);
    const coercionOutput = api.emitSemanticProgram(coercionProgram, { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(coercionOutput.code, /as3Int as __as3Int/);
    assert.match(coercionOutput.code, /var signed: number = __as3Int\(4294967295\);/);
    assert.match(coercionOutput.code, /var unsigned: number = __as3Uint\(-1\);/);
    assert.match(coercionOutput.code, /var message: string \| null = __as3String\(event\);/);
    const statementProgram = adapt(api, buildTree({ statementWorkpack: true }), authority);
    const statementOutput = api.emitSemanticProgram(statementProgram, { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(statementOutput.code, /switch \(total\)/);
    assert.match(statementOutput.code, /case 1:/);
    assert.match(statementOutput.code, /default:/);
    assert.match(statementOutput.code, /do \{/);
    assert.match(statementOutput.code, /while \(active\);/);
    assert.match(statementOutput.code, /throw "done";/);
    assertErrorCode(() => adapt(api, buildTree({ duplicateSwitchDefault: true }), authority),
        "HARDENED_SWITCH_DEFAULT");
    assertErrorCode(() => adapt(api, buildTree({ continueInSwitch: true }), authority),
        "HARDENED_LOOP_CONTEXT");
    const iterationProgram = adapt(api, buildTree({ iterationWorkpack: true }), authority);
    const iterationOutput = api.emitSemanticProgram(iterationProgram, { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(iterationOutput.code, /for \(var i: number = 0; i < 2; i\+\+\)/);
    assert.match(iterationOutput.code, /for \(var item of this\.values!\)/);
    const existingForEachProgram = adapt(api, buildTree({ existingForEachWorkpack: true }), authority);
    const existingForEachOutput = api.emitSemanticProgram(existingForEachProgram,
        { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(existingForEachOutput.code, /var existingItem: number = __as3Int\(0\);/);
    assert.match(existingForEachOutput.code, /for \(existingItem of this\.values!\)/);
    assert.doesNotMatch(existingForEachOutput.code, /for \(var existingItem of/);
    assert.match(iterationOutput.code, /this\.values!\.indexOf\(item\);/);
    assertErrorCode(() => adapt(api, buildTree({ badForEachType: true }), authority),
        "HARDENED_ASSIGNMENT_TYPE");
    const tryProgram = adapt(api, buildTree({ tryWorkpack: true }), authority);
    const tryOutput = api.emitSemanticProgram(tryProgram, { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(tryOutput.code, /try \{/);
    assert.match(tryOutput.code, /catch \(__as3Caught/);
    assert.match(tryOutput.code, /instanceof Error/);
    assert.match(tryOutput.code, /const error: Error = __as3Caught/);
    assert.match(tryOutput.code, /finally \{/);
    assertErrorCode(() => adapt(api, buildTree({ badCatchType: true }), authority), "HARDENED_CATCH_TYPE");
    assertErrorCode(() => adapt(api, buildTree({ strayCatch: true }), authority), "HARDENED_TRY_SEQUENCE");
    const bitwiseProgram = adapt(api, buildTree({ bitwiseWorkpack: true }), authority);
    const bitwiseOutput = api.emitSemanticProgram(bitwiseProgram, { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(bitwiseOutput.code, /var flags: number = 1 \| 2;/);
    assert.match(bitwiseOutput.code, /var shifted: number = flags >>> 1;/);
    assert.match(bitwiseOutput.code, /var inverted: number = ~flags;/);
    const objectProgram = adapt(api, buildTree({ objectWorkpack: true }), authority);
    const objectOutput = api.emitSemanticProgram(objectProgram, { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(objectOutput.code, /var config: unknown = \{ "alpha": 1, "label": "ready" \};/);
    assertErrorCode(() => adapt(api, buildTree({ objectDuplicate: true }), authority), "HARDENED_OBJECT_NAME");
    assertErrorCode(() => adapt(api, buildTree({ objectProto: true }), authority), "HARDENED_OBJECT_NAME");
    const defaultParameterProgram = adapt(api, buildTree({ defaultParameterWorkpack: true }), authority);
    const defaultParameterOutput = api.emitSemanticProgram(defaultParameterProgram,
        { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(defaultParameterOutput.code, /configure\(enabled: boolean = true\): void/);
    assert.match(defaultParameterOutput.code, /this\.configure\(\);/);
    const negativeDefaultProgram = adapt(api, buildTree({ negativeDefaultWorkpack: true }), authority);
    const negativeDefaultOutput = api.emitSemanticProgram(negativeDefaultProgram,
        { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(negativeDefaultOutput.code, /configureIndex\(index: number = __as3Int\(-1\)\): void/);
    assertErrorCode(() => adapt(api, buildTree({ badNegativeDefault: true }), authority),
        "HARDENED_UNARY_NUMBER");
    const nestedExpressionProgram = adapt(api, buildTree({ nestedExpressionWorkpack: true }), authority);
    const nestedExpressionOutput = api.emitSemanticProgram(nestedExpressionProgram,
        { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(nestedExpressionOutput.code, /private a: number = 1 \+ 2;/);
    assert.match(nestedExpressionOutput.code, /__as3Int\(4 - 1\);/);
    assertErrorCode(() => adapt(api, buildTree({ badNestedExpression: true }), authority), "HARDENED_EXPRESSION_UNSUPPORTED");
    const labelProgram = adapt(api, buildTree({ labelWorkpack: true }), authority);
    const labelOutput = api.emitSemanticProgram(labelProgram,
        { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(labelOutput.code, /outer: while \(true\)/);
    assert.match(labelOutput.code, /break outer;/);
    assertErrorCode(() => adapt(api, buildTree({ badContinueLabel: true }), authority), "HARDENED_LOOP_LABEL");
    const interfaceProgram = adapt(api, buildInterfaceTree(), authority);
    const interfaceOutput = api.emitSemanticProgram(interfaceProgram,
        { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.equal(interfaceProgram.declaration.declarationKind, "interface");
    assert.match(interfaceOutput.code, /export interface IThing/);
    assert.match(interfaceOutput.code, /run\(value: number, \.\.\.rest: unknown\[\]\): string \| null;/);
    assert.match(interfaceOutput.code, /get name\(\): string \| null;/);
    assert.match(interfaceOutput.code, /set name\(value: string \| null\);/);
    assertErrorCode(() => adapt(api, buildInterfaceTree({ duplicate: true }), authority), "HARDENED_INTERFACE_DUPLICATE");
    const restParameterProgram = adapt(api, buildTree({ restParameterWorkpack: true }), authority);
    const restParameterOutput = api.emitSemanticProgram(restParameterProgram,
        { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(restParameterOutput.code, /collect\(prefix: string \| null, \.\.\.values: unknown\[\]\): void/);
    assert.match(restParameterOutput.code, /this\.collect\("p", 1, "two"\);/);
    assertErrorCode(() => adapt(api, buildTree({ badRestPosition: true }), authority), "HARDENED_PARAMETER_REST");
    assertErrorCode(() => adapt(api, buildTree({ namespaceWorkpack: true }), authority),
        "HARDENED_NAMESPACE_AUTHORITY");
    assertErrorCode(() => adapt(api, buildTree({ namespaceCollision: true }), authority),
        "HARDENED_NAMESPACE_AUTHORITY");
    assertErrorCode(() => adapt(api, buildTree({ namespaceAccessCollision: true }), authority),
        "HARDENED_NAMESPACE_AUTHORITY");
    const overrideProgram = adapt(api, buildTree({ overrideWorkpack: true }), authority);
    const overrideOutput = api.emitSemanticProgram(overrideProgram,
        { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(overrideOutput.code, /public override addEventListener\(type: string \| null, listener: Function \| null, useCapture: boolean = false, priority: number = __as3Int\(0\), useWeakReference: boolean = false\): void/);
    assertErrorCode(() => adapt(api, buildTree({ fieldModifiers: ["override"] }), authority), "HARDENED_OVERRIDE_TARGET");
    const forInProgram = adapt(api, buildTree({ forInWorkpack: true }), authority);
    const forInOutput = api.emitSemanticProgram(forInProgram,
        { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(forInOutput.code, /for \(key in enumerable as object\)/);
    assertErrorCode(() => adapt(api, buildTree({ badForInKey: true }), authority), "HARDENED_FORIN_KEY");
    assertErrorCode(() => adapt(api, buildTree({ badForInIterable: true }), authority), "HARDENED_FORIN_ITERABLE");
    const nullableProgram = adapt(api, buildTree({ nullableWorkpack: true }), authority);
    const nullableOutput = api.emitSemanticProgram(nullableProgram,
        { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(nullableOutput.code, /private maybeSprite: Sprite \| null = null;/);
    assert.match(nullableOutput.code, /var maybeEvent: Event \| null = null;/);
    assert.match(nullableOutput.code, /var isMissing: boolean = maybeEvent === null;/);
    assert.match(nullableOutput.code, /var selected: Event \| null = true \? maybeEvent : null;/);
    assert.match(nullableOutput.code, /acceptNullable\(value: Event \| null = null\): void/);
    assertErrorCode(() => adapt(api, buildTree({ badPrimitiveNull: true }), authority), "HARDENED_ASSIGNMENT_TYPE");
    assertErrorCode(() => adapt(api, buildTree({ badPrimitiveNullDefault: true }), authority), "HARDENED_ASSIGNMENT_TYPE");
    const lambdaProgram = adapt(api, buildTree({ lambdaWorkpack: true }), authority);
    const lambdaOutput = api.emitSemanticProgram(lambdaProgram,
        { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(lambdaOutput.code,
        /var handler: Function \| null = function \(value: number\): number \{[\s\S]*return value \+ offset;[\s\S]*\};/);
    assert.match(lambdaOutput.code, /var result: number = handler!\(2\);/);
    assertErrorCode(() => adapt(api, buildTree({ badLambdaThis: true }), authority), "HARDENED_LAMBDA_THIS");
    assertErrorCode(() => adapt(api, buildTree({ badLambdaArity: true }), authority), "HARDENED_LAMBDA_CALL_ARITY");
    assertErrorCode(() => adapt(api, buildTree({ badLambdaReturn: true }), authority), "HARDENED_LAMBDA_RETURN_PATH");
    const dictionaryProgram = adapt(api, buildTree({ dictionaryWorkpack: true }), authority);
    const dictionaryOutput = api.emitSemanticProgram(dictionaryProgram,
        { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(dictionaryOutput.code,
        /import \{ AS3Dictionary as Dictionary \} from "@bleach\/as3-runtime\/AS3Dictionary";/);
    assert.match(dictionaryOutput.code, /private dictionary: Dictionary \| null = new Dictionary\(true\);/);
    assert.match(dictionaryOutput.code, /this\.dictionary!\.set\(key, "value"\);/);
    assert.match(dictionaryOutput.code, /var found: unknown = this\.dictionary!\.get\(key\);/);
    assert.match(dictionaryOutput.code, /var removed: boolean = this\.dictionary!\.delete\(key\);/);
    assert.match(dictionaryOutput.code, /for \(key of this\.dictionary!\.keys\(\)\)/);
    assertErrorCode(() => adapt(api, buildTree({ badDictionaryConstructor: true }), authority),
        "HARDENED_DICTIONARY_CONSTRUCTOR");
    const byteArrayProgram = adapt(api, buildTree({ byteArrayWorkpack: true }), authority);
    const byteArrayOutput = api.emitSemanticProgram(byteArrayProgram,
        { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(byteArrayOutput.code,
        /import \{ AS3ByteArray as ByteArray \} from "@bleach\/as3-runtime\/AS3ByteArray";/);
    assert.match(byteArrayOutput.code,
        /import \{ AS3Endian as Endian \} from "@bleach\/as3-runtime\/AS3ByteArray";/);
    assert.match(byteArrayOutput.code, /private bytes: ByteArray \| null = new ByteArray\(\);/);
    assert.match(byteArrayOutput.code, /this\.bytes!\.endian = Endian\.LITTLE_ENDIAN;/);
    assert.match(byteArrayOutput.code, /this\.bytes!\.writeInt\(__as3Int\(1\)\);/);
    assert.match(byteArrayOutput.code, /var decoded: number = this\.bytes!\.readUnsignedInt\(\);/);
    assert.match(byteArrayOutput.code, /this\.bytes!\[__as3Uint\(1\.5\)\] = __as3Uint\(258\);/);
    assert.match(byteArrayOutput.code, /var indexed: number = this\.bytes!\[__as3Uint\(1\)\];/);
    assert.match(byteArrayOutput.code, /this\.bytes!\.writeMultiByte\("mail", ""\);/);
    assertErrorCode(() => adapt(api, buildTree({ heldByteArrayMember: true }), authority),
        "HARDENED_INTRINSIC_MEMBER");
    const compoundProgram = adapt(api, buildTree({ compoundWorkpack: true }), authority);
    const compoundOutput = api.emitSemanticProgram(compoundProgram,
        { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(compoundOutput.code, /flags = __as3Int\(flags \+ 2\);/);
    assert.match(compoundOutput.code, /flags = __as3Int\(flags >>> 1\);/);
    assert.match(compoundOutput.code, /active = active && false;/);
    assertErrorCode(() => adapt(api, buildTree({ badLogicalCompound: true }), authority), "HARDENED_COMPOUND_TYPE");
    assertErrorCode(() => adapt(api, buildTree({ badBitwiseType: true }), authority), "HARDENED_BITWISE_TYPE");
    assertGeneratedRuntimeTypechecks([vectorOutput.code, vectorNumericOutput.code, vectorCallbackOutput.code,
        shortVectorOutput.code, runtimeTypeOutput.code, vectorRuntimeOutput.code,
        nestedVectorOutput.code, vectorBuiltinReferenceOutput.code, coercionOutput.code, statementOutput.code, iterationOutput.code,
        existingForEachOutput.code, tryOutput.code,
        bitwiseOutput.code, compoundOutput.code, restParameterOutput.code, negativeDefaultOutput.code,
        nestedExpressionOutput.code,
        labelOutput.code, interfaceOutput.code, localNamespaceOutput.code, overrideOutput.code, forInOutput.code,
        nullableOutput.code, lambdaOutput.code, dictionaryOutput.code, byteArrayOutput.code]);
    const assignedProgram = adapt(api, buildTree({ assignment: true }), authority);
    const assignedOutput = api.emitSemanticProgram(assignedProgram, { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(assignedOutput.code, /this\.b = "changed";/);
    assertErrorCode(
        () => adapt(api, buildTree({ assignment: true, assignmentValue: "1" }), authority),
        "HARDENED_ASSIGNMENT_TYPE",
    );
    const compoundStringProgram = adapt(api, buildTree({ assignment: true, assignmentOperator: "+=" }), authority);
    assert.match(api.emitSemanticProgram(compoundStringProgram,
        { compiler: ts, expectedTypeScriptVersion: "4.9.5" }).code, /this\.b = this\.b \+ "changed";/);
    assertErrorCode(
        () => adapt(api, buildTree({ constFields: true, assignment: true }), authority),
        "HARDENED_ASSIGNMENT_READONLY",
    );
    const constructedProgram = adapt(api, buildTree({ newField: true }), authority);
    const constructedOutput = api.emitSemanticProgram(constructedProgram, { compiler: ts, expectedTypeScriptVersion: "4.9.5" });
    assert.match(constructedOutput.code, /private sprite: Sprite \| null = new Sprite\(\);/);
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
        "HARDENED_DELETE_SHAPE",
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
    const weakenedIntrinsic = JSON.parse(sourceCensusJson);
    const dictionaryApi = weakenedIntrinsic.as3SourceCapabilities.apis
        .find(item => item.qname === "flash.utils.Dictionary");
    dictionaryApi.roles = dictionaryApi.roles.filter(role => role !== "constructor");
    const weakenedIntrinsicJson = JSON.stringify(weakenedIntrinsic);
    assertErrorCode(() => api.loadCapabilityAuthority({
        sourceCensusJson: weakenedIntrinsicJson,
        sourceCensusSha256: sha256(weakenedIntrinsicJson),
        targetCapabilitiesJson,
        targetCapabilitiesSha256: EXPECTED_TARGET_SHA256,
        mappingJson,
        mappingSha256: sha256(mappingJson),
    }, sha256), "HARDENED_SOURCE_INTRINSIC");
    const alteredByteArrayMember = JSON.parse(sourceCensusJson);
    const bytesAvailable = alteredByteArrayMember.as3SourceCapabilities.memberUses.find(item =>
        item.receiverType === "flash.utils.ByteArray" && item.member === "bytesAvailable" && item.access === "read");
    bytesAvailable.signatures[0].returnType = "int";
    const alteredByteArrayMemberJson = JSON.stringify(alteredByteArrayMember);
    assertErrorCode(() => api.loadCapabilityAuthority({
        sourceCensusJson: alteredByteArrayMemberJson,
        sourceCensusSha256: sha256(alteredByteArrayMemberJson),
        targetCapabilitiesJson,
        targetCapabilitiesSha256: EXPECTED_TARGET_SHA256,
        mappingJson,
        mappingSha256: sha256(mappingJson),
    }, sha256), "HARDENED_SOURCE_INTRINSIC_MEMBER");

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
