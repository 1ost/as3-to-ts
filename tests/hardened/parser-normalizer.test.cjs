"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");

function sha256(bytes) {
    return crypto.createHash("sha256").update(bytes, "utf8").digest("hex");
}

function compileFocusedSources() {
    const output = fs.mkdtempSync(path.join(os.tmpdir(), "parser-normalizer-"));
    const entries = [
        "src/parse/index.ts",
        "src/hardened/parser-normalizer.ts",
        "src/hardened/adapter.ts",
        "src/hardened/emitter.ts",
        "src/hardened/type-authority.ts",
        "src/hardened/local-declarations.ts",
        "src/hardened/ledger.ts",
        "src/hardened/contracts.ts",
        "src/hardened-runtime/AS3Coerce.ts",
        "src/hardened-runtime/AS3Type.ts",
        "src/hardened-runtime/internal/AS3TypeRegistry.ts",
    ].map((name) => path.join(ROOT, name));
    const config = {
      compilerOptions: {
        target: "ES2022",
        module: "Node16",
        moduleResolution: "Node16",
        rootDir: path.join(ROOT, "src"),
        outDir: output,
        esModuleInterop: true,
        noImplicitAny: true,
        strictNullChecks: false,
        strictPropertyInitialization: false,
        useUnknownInCatchVariables: false,
        skipLibCheck: true,
        noEmitOnError: true,
      },
      files: entries,
    };
    const configPath = path.join(output, "tsconfig.json");
    fs.writeFileSync(configPath, JSON.stringify(config), "utf8");
    try {
        childProcess.execFileSync(process.execPath,
            [path.join(ROOT, "node_modules/typescript/bin/tsc"), "-p", configPath],
            { cwd: ROOT, stdio: "inherit" });
    } catch (error) {
        fs.rmSync(output, { recursive: true, force: true });
        throw error;
    }
    process.env.NODE_PATH = path.join(ROOT, "node_modules");
    require("node:module").Module._initPaths();
    return {
        output,
        parse: require(path.join(output, "parse/index.js")).default,
        normalizer: require(path.join(output, "hardened/parser-normalizer.js")),
        adapter: require(path.join(output, "hardened/adapter.js")),
        emitter: require(path.join(output, "hardened/emitter.js")),
        typeAuthority: require(path.join(output, "hardened/type-authority.js")),
        localDeclarations: require(path.join(output, "hardened/local-declarations.js")),
        ledger: require(path.join(output, "hardened/ledger.js")),
    };
}

function authority(api) {
    const mappings = {
        schema: "as3-source-to-laya-capability-map@1",
        mappings: [
            {
                sourceQName: "flash.display.DisplayObject",
                sourceRoles: ["import"],
                sourceMember: null,
                targetCapabilityId: "api.flash.display.display-object",
                targetModule: "src/layaAir/flash/display/DisplayObject.ts",
                targetExport: "DisplayObject",
                targetKind: "class",
                targetSignature: "typeof DisplayObject",
                targetMember: null,
            },
            {
                sourceQName: "flash.display.Sprite",
                sourceRoles: ["base-type", "constructor", "import"],
                sourceMember: null,
                targetCapabilityId: "api.flash.display.sprite",
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
                    access: "call", name: "Sprite", minArgs: 0, maxArgs: 0,
                    signature: "public function Sprite()",
                },
                targetCapabilityId: "api.flash.display.sprite",
                targetModule: "src/layaAir/flash/display/Sprite.ts",
                targetExport: "Sprite",
                targetKind: "class",
                targetSignature: "typeof Sprite",
                targetMember: {
                    name: "Sprite", kind: "constructor", scope: "static", signature: "new (): Sprite",
                },
            },
            {
                sourceQName: "flash.events.Event",
                sourceRoles: ["import"],
                sourceMember: null,
                targetCapabilityId: "api.flash.events.event",
                targetModule: "src/layaAir/flash/events/Event.ts",
                targetExport: "Event",
                targetKind: "class",
                targetSignature: "typeof Event",
                targetMember: null,
            },
        ],
    };
    const source = {
        as3SourceCapabilities: {
            apis: [
                {
                    qname: "flash.display.DisplayObject", classification: "layaair-flash-api-bridge",
                    roles: ["import"], preserve: { apiName: true, signature: true },
                },
                {
                    qname: "flash.display.Sprite", classification: "layaair-flash-api-bridge",
                    roles: ["base-type", "constructor", "import"], preserve: { apiName: true, signature: true },
                },
                {
                    qname: "flash.events.Event", classification: "layaair-flash-api-bridge",
                    roles: ["import"], preserve: { apiName: true, signature: true },
                },
                {
                    qname: "flash.utils.Dictionary", classification: "layaair-flash-api-bridge",
                    roles: ["constructor", "import", "instance-member", "wildcard-resolution"],
                    preserve: { apiName: true, signature: true },
                },
                {
                    qname: "flash.utils.clearTimeout", classification: "layaair-flash-api-bridge",
                    roles: ["import", "package-function", "wildcard-resolution"],
                    preserve: { apiName: true, signature: true },
                },
                {
                    qname: "flash.utils.setTimeout", classification: "layaair-flash-api-bridge",
                    roles: ["import", "package-function", "wildcard-resolution"],
                    preserve: { apiName: true, signature: true },
                },
            ],
            memberUses: [
                {
                    qname: "flash.display.Sprite", member: "Sprite", access: "call",
                    context: "constructor", classification: "layaair-flash-api-bridge",
                    preserveNameAndSignature: true,
                    signatures: [{ signature: "public function Sprite()", minArgs: 0, maxArgs: 0 }],
                },
                {
                    qname: "flash.utils.clearTimeout", member: "<call>", access: "call",
                    context: "package-function", classification: "layaair-flash-api-bridge",
                    preserveNameAndSignature: true,
                    signatures: [{ signature: "public function clearTimeout(id:uint) : void", minArgs: 1, maxArgs: 1 }],
                },
                {
                    qname: "flash.utils.setTimeout", member: "<call>", access: "call",
                    context: "package-function", classification: "layaair-flash-api-bridge",
                    preserveNameAndSignature: true,
                    signatures: [{ signature: "public function setTimeout(closure:Function, delay:Number, ... arguments) : uint", minArgs: 2, maxArgs: null }],
                },
            ],
        },
    };
    const target = {
        schema: "laya-authored-content-capabilities@1",
        capabilities: [
            {
                id: "api.flash.display.display-object", status: "typescript-obligation",
                obligations: [{
                    module: "src/layaAir/flash/display/DisplayObject.ts", export: "DisplayObject",
                    kind: "class", signature: "typeof DisplayObject", members: [],
                }],
            },
            {
                id: "api.flash.display.sprite", status: "typescript-obligation",
                obligations: [{
                    module: "src/layaAir/flash/display/Sprite.ts", export: "Sprite",
                    kind: "class", signature: "typeof Sprite", members: [], constructors: ["new (): Sprite"],
                }],
            },
            {
                id: "api.flash.events.event", status: "typescript-obligation",
                obligations: [{
                    module: "src/layaAir/flash/events/Event.ts", export: "Event",
                    kind: "class", signature: "typeof Event", members: [],
                }],
            },
        ],
    };
    const sourceJson = JSON.stringify(source);
    const targetJson = JSON.stringify(target);
    const mappingJson = api.canonicalMappingJson(mappings);
    const nativeTimerAuthorityJson = fs.readFileSync(
        path.join(ROOT, "config", "native-timer-authority.json"), "utf8").replace(/\r\n?/g, "\n");
    return api.loadCapabilityAuthority({
        sourceCensusJson: sourceJson,
        sourceCensusSha256: sha256(sourceJson),
        targetCapabilitiesJson: targetJson,
        targetCapabilitiesSha256: sha256(targetJson),
        mappingJson,
        mappingSha256: sha256(mappingJson),
        nativeTimerAuthorityJson,
        nativeTimerAuthoritySha256: sha256(nativeTimerAuthorityJson),
    }, sha256);
}

function expectNormalizationCode(action, code) {
    assert.throws(action, (error) => error && error.name === "ParserNormalizationError" && error.code === code,
        `expected ${code}`);
}

const built = compileFocusedSources();
try {
    const source = [
        "package lobby.ui {",
        "    /* preserved comment trivia */",
        "    import flash.display.Sprite;",
        "    import flash.events.Event;",
        "    import flash.utils.Dictionary;",
        "    public class Demo extends Sprite {",
        "        private const label:String = \"ok\";",
        "        private var status:String = \"old\";",
        "        private var child:Sprite = new Sprite();",
        "        private var _value:Number = 1;",
        "        public function get value():Number { if (_value > 0) { return _value; } else { return 0; } }",
        "        public function set value(input:Number):void { _value = input; }",
        "        public function Demo() { super(); }",
        "        public function onEvent(event:Event):void { var total:Number = 1 + 2; var active:Boolean = !(total === 0); var chosen:Number = active ? total : 0; var reduced:Number = total - 1; while (total > 0) { total--; if (total === 1) { continue; } break; } status = \"changed\"; return; }",
        "        public function flow(value:Number):void { var active:Boolean = true; switch (value) { case 1: value = 2; break; default: value = 3; } do { active = false; } while (active); throw \"done\"; }",
        "        public function iteration():void { var values:Vector.<int> = new Vector.<int>(); for (var i:Number = 0; i < 2; i++) { values.push(int(i)); } for each (var item:int in values) { values.indexOf(item); } var existing:int = 0; for each (existing in values) { values.indexOf(existing); } }",
        "        public function guarded():void { try { throw \"bad\"; } catch (error:Error) { throw error; } finally { status = \"done\"; } }",
        "        public function bits():void { var flags:int = 1 | 2; var shifted:uint = flags >>> 1; var inverted:int = ~flags; var active:Boolean = true; flags >>>= 1; active &&= false; ++flags; --flags; }",
        "        public function objectConfig():void { var config:Object = {\"alpha\":1,\"label\":\"ready\"}; }",
        "        public function optional(enabled:Boolean = true,index:int = -1):void { }",
        "        public function collect(prefix:String,...values):void { }",
        "        public function labelled():void { outer: while (true) { break outer; } }",
        "        public function enumerate():void { var values:Object = {\"a\":1}; for (var key:String in values) { if (key === \"done\") { continue; } } }",
        "        public function closures():void { var offset:Number = 1; var handler:Function = function(value:Number):Number { return value + offset; }; var result:Number = handler(2); }",
        "        public function dictionaries():void { var dictionary:Dictionary = new Dictionary(true); var key:Object = {\"id\":1}; dictionary[key] = \"value\"; var removed:Boolean = delete dictionary[key]; }",
        "        public function shortVectors():void { var values:Vector.<int> = new <int>[1,2]; }",
        "    }",
        "}",
        "",
    ].join("\n");
    const parserTree = built.parse("fixtures/Demo.as", source);
    const normalized = built.normalizer.normalizeParserAst(parserTree, source, sha256);
    assert.equal(normalized.schema, "authored-ui-as3-flat-ast@1");
    assert.equal(normalized.sourceSha256, sha256(source));
    assert.equal(normalized.fingerprintSha256, sha256(JSON.stringify(normalized.nodes)));
    assert.ok(Object.isFrozen(normalized));
    assert.ok(Object.isFrozen(normalized.nodes));
    const rawPreorder = [];
    (function collect(node) {
        rawPreorder.push(node);
        node.children.forEach(collect);
    }(parserTree));
    const siblingOrders = new Map();
    normalized.nodes.forEach((node, index) => {
        assert.equal(node.id, `n${index}`);
        assert.equal(index === 0 ? node.parentId : typeof node.parentId, index === 0 ? null : "string");
        assert.equal(index === 0 ? node.order : Number.isInteger(node.order), index === 0 ? 0 : true);
        assert.ok(node.span && node.span.start >= 0 && node.span.end <= source.length);
        assert.equal(node.text === undefined, false);
        assert.equal(node.text, rawPreorder[index].text === undefined ? null : rawPreorder[index].text,
            "normalization preserves exact parser semantic text");
        if (node.text !== null && rawPreorder[index].children.length === 0) {
            assert.equal(source.slice(node.span.start, node.span.end), node.text,
                "leaf semantic text has an exact normalized source span");
        }
        if (node.parentId !== null) {
            const orders = siblingOrders.get(node.parentId) || [];
            orders.push(node.order);
            siblingOrders.set(node.parentId, orders);
        }
    });
    siblingOrders.forEach((orders) => assert.deepEqual(orders, orders.map((_value, index) => index),
        "sibling order is contiguous parser order"));
    assert.deepEqual(normalized.nodes.slice(0, 6).map((node) => node.kind),
        ["COMPILATION_UNIT", "PACKAGE", "NAME", "CONTENT", "IMPORT", "IMPORT"]);
    normalized.nodes.filter((node) => node.kind === "IMPORT").forEach((node) => {
        assert.equal(source.slice(node.span.start, node.span.end), node.text,
            "legacy import spans are normalized to the exact qualified-name source");
    });
    assert.equal(normalized.nodes.some((node) => /COMMENT/.test(node.kind)), false,
        "comments remain authenticated trivia and never semantic nodes");
    assert.equal(parserTree.trivia.length, 1);
    assert.equal(source.slice(parserTree.trivia[0].index, parserTree.trivia[0].end), parserTree.trivia[0].text);

    const semantic = built.adapter.adaptNormalizedParserAst(
        normalized, authority(built.ledger), source, sha256,
    );

    const primitiveRuntimeSource = [
        "package p {",
        "public class PrimitiveRuntime {",
        "private function acceptInt(value:int):int { return value; }",
        "public function assignment(value:Object):int { var result:int = value as int; return result; }",
        "public function argument(value:Object):int { return acceptInt(value as int); }",
        "public function castInt(value:Object):int { return value as int; }",
        "public function castUint(value:Object):uint { return value as uint; }",
        "public function castNumber(value:Object):Number { return value as Number; }",
        "public function castBoolean(value:Object):Boolean { return value as Boolean; }",
        "public function raw(value:Object):Object { return value as int; }",
        "public function matchesInt(value:Object):Boolean { return value is int; }",
        "}",
        "}",
    ].join("\n");
    const primitiveRuntimeTree = built.parse("fixtures/PrimitiveRuntime.as", primitiveRuntimeSource);
    const primitiveRuntimeNormalized = built.normalizer.normalizeParserAst(
        primitiveRuntimeTree, primitiveRuntimeSource, sha256);
    assert.ok(primitiveRuntimeNormalized.nodes.some(node => node.kind === "AS"));
    assert.ok(primitiveRuntimeNormalized.nodes.some(node => node.kind === "RELATION"));
    const primitiveRuntimeSemantic = built.adapter.adaptNormalizedParserAst(
        primitiveRuntimeNormalized, authority(built.ledger), primitiveRuntimeSource, sha256);
    const ts49 = require("typescript-4-9");
    const primitiveRuntimeCode = built.emitter.emitSemanticProgram(primitiveRuntimeSemantic,
        { compiler: ts49, expectedTypeScriptVersion: "4.9.5" }).code;
    assert.match(primitiveRuntimeCode, /var result: number = __as3Int\(__as3As\(value, __as3Types\.int\)\);/);
    assert.match(primitiveRuntimeCode, /this\.acceptInt\(__as3Int\(__as3As\(value, __as3Types\.int\)\)\)/);
    assert.match(primitiveRuntimeCode, /return __as3Int\(__as3As\(value, __as3Types\.int\)\);/);
    assert.match(primitiveRuntimeCode, /return __as3Uint\(__as3As\(value, __as3Types\.uint\)\);/);
    assert.match(primitiveRuntimeCode, /return __as3Number\(__as3As\(value, __as3Types\.Number\)\);/);
    assert.match(primitiveRuntimeCode, /return __as3Boolean\(__as3As\(value, __as3Types\.Boolean\)\);/);
    assert.match(primitiveRuntimeCode, /return __as3As\(value, __as3Types\.int\);/);
    assert.match(primitiveRuntimeCode, /return __as3Is\(value, __as3Types\.int\);/);
    const primitiveCheckRoot = fs.mkdtempSync(path.join(os.tmpdir(), "primitive-runtime-typecheck-"));
    try {
        const generatedPath = path.join(primitiveCheckRoot, "PrimitiveRuntime.ts");
        fs.writeFileSync(generatedPath, primitiveRuntimeCode, "utf8");
        const primitiveConfig = path.join(primitiveCheckRoot, "tsconfig.json");
        fs.writeFileSync(primitiveConfig, JSON.stringify({ compilerOptions: {
            target: "ES2020", module: "CommonJS", moduleResolution: "node", strict: true,
            strictNullChecks: true, skipLibCheck: true, noEmit: true, types: [], baseUrl: ROOT,
            paths: { "@bleach/as3-runtime/*": ["src/hardened-runtime/*"] },
        }, files: [generatedPath] }), "utf8");
        childProcess.execFileSync(process.execPath,
            [path.join(ROOT, "node_modules/typescript-4-9/bin/tsc"), "-p", primitiveConfig],
            { cwd: ROOT, stdio: "inherit" });
    } finally {
        fs.rmSync(primitiveCheckRoot, { recursive: true, force: true });
    }
    const executablePrimitiveCode = primitiveRuntimeCode
        .replaceAll("@bleach/as3-runtime/AS3Coerce", "./hardened-runtime/AS3Coerce")
        .replaceAll("@bleach/as3-runtime/AS3Type", "./hardened-runtime/AS3Type");
    const primitiveJavaScript = ts49.transpileModule(executablePrimitiveCode, { compilerOptions: {
        target: ts49.ScriptTarget.ES2020, module: ts49.ModuleKind.CommonJS,
    } }).outputText;
    const primitiveJavaScriptPath = path.join(built.output, "PrimitiveRuntime.generated.js");
    fs.writeFileSync(primitiveJavaScriptPath, primitiveJavaScript, "utf8");
    const primitiveModule = require(primitiveJavaScriptPath); const { PrimitiveRuntime } = primitiveModule;
    const primitiveEntry={kind:"class",qname:"p.PrimitiveRuntime",base:null,interfaces:[],
        sourceSha256:primitiveRuntimeSemantic.sourceSha256,fields:[],constructor:PrimitiveRuntime,
        predicate:primitiveModule.isAS3ClassInstance,constructionTarget:primitiveModule.as3ConstructionTarget,
        constructionProof:primitiveModule.isAS3ConstructionProof};
    const primitiveMetadata={schema:"as3-runtime-type-authority@1",qnames:[primitiveEntry.qname],entries:[{
        kind:primitiveEntry.kind,qname:primitiveEntry.qname,base:null,interfaces:[],sourceSha256:primitiveEntry.sourceSha256,fields:[]} ]};
    require(path.join(built.output,"hardened-runtime/internal/AS3TypeRegistry.js")).installAS3TypeAuthority({
        schema:primitiveMetadata.schema,sha256:sha256(JSON.stringify(primitiveMetadata)),qnames:primitiveMetadata.qnames,entries:[primitiveEntry]});
    const primitiveRuntime = new PrimitiveRuntime();
    for (const method of ["assignment", "argument", "castInt", "castUint", "castNumber"]) {
        assert.equal(primitiveRuntime[method]({}), 0, `${method} coerces failed as-result null to the AS3 primitive default`);
    }
    assert.equal(primitiveRuntime.castBoolean({}), false);
    assert.equal(primitiveRuntime.castInt(7), 7); assert.equal(primitiveRuntime.castUint(0xffffffff), 0xffffffff);
    assert.equal(primitiveRuntime.castNumber(1.5), 1.5); assert.equal(primitiveRuntime.castBoolean(true), true);
    assert.equal(primitiveRuntime.raw({}), null); assert.equal(primitiveRuntime.raw(7), 7);
    assert.equal(primitiveRuntime.matchesInt(7), true); assert.equal(primitiveRuntime.matchesInt(1.5), false);
    const declarationExtract = built.localDeclarations.extractLocalDeclaration(normalized, source, sha256);
    assert.equal(declarationExtract.schema, "as3-local-declaration-extract@1");
    assert.equal(declarationExtract.qualifiedName, "lobby.ui.Demo");
    assert.equal(declarationExtract.declarationKind, "class");
    assert.deepEqual(declarationExtract.imports,
        ["flash.display.Sprite", "flash.events.Event", "flash.utils.Dictionary"]);
    assert.deepEqual(declarationExtract.extendsNames, ["Sprite"]);
    assert.equal(declarationExtract.members.filter(member => member.kind === "field").length, 4);
    assert.equal(declarationExtract.members.find(member => member.kind === "constructor").name, "Demo");
    const extractedOptional = declarationExtract.members.find(member => member.name === "optional");
    assert.deepEqual(extractedOptional.parameters.map(parameter => ({ type: parameter.type, optional: parameter.optional })),
        [{ type: "Boolean", optional: true }, { type: "int", optional: true }]);
    assert.equal(declarationExtract.members.find(member => member.name === "iteration").returnType, "void");
    assert.equal(semantic.packageName, "lobby.ui");
    assert.equal(semantic.outputModulePath, "lobby/ui/Demo.ts");
    assert.deepEqual(semantic.imports.map((item) => item.sourceQualifiedName),
        ["flash.display.Sprite", "flash.events.Event", "flash.utils.Dictionary"]);
    assert.equal(semantic.declaration.name, "Demo");
    assert.deepEqual(semantic.declaration.members.map((member) => member.kind),
        ["field", "field", "field", "field", "getter", "setter", "constructor", "method", "method", "method", "method", "method", "method", "method", "method", "method", "method", "method", "method", "method"]);
    assert.equal(semantic.declaration.members[0].name, "label");
    assert.equal(semantic.declaration.members[0].readonly, true);
    assert.equal(semantic.declaration.members[1].name, "status");
    assert.equal(semantic.declaration.members[1].readonly, false);
    assert.equal(semantic.declaration.members[2].name, "child");
    assert.equal(semantic.declaration.members[2].initializer.kind, "new");
    assert.equal(semantic.declaration.members[2].initializer.sourceType.sourceName, "Sprite");
    assert.equal(semantic.declaration.members[3].name, "_value");
    assert.equal(semantic.declaration.members[4].kind, "getter");
    assert.equal(semantic.declaration.members[4].body[0].kind, "if");
    assert.equal(semantic.declaration.members[4].body[0].condition.kind, "binary");
    assert.equal(semantic.declaration.members[5].kind, "setter");
    assert.equal(semantic.declaration.members[5].parameter.name, "input");
    assert.equal(semantic.declaration.members[6].body[0].expression.callee.kind, "super");
    assert.equal(semantic.declaration.members[7].name, "onEvent");
    assert.equal(semantic.declaration.members[7].parameters[0].name, "event");
    assert.equal(semantic.declaration.members[7].body[0].kind, "local");
    assert.equal(semantic.declaration.members[7].body[0].declarations[0].name, "total");
    assert.equal(semantic.declaration.members[7].body[0].declarations[0].initializer.kind, "binary");
    assert.equal(semantic.declaration.members[7].body[1].kind, "local");
    assert.equal(semantic.declaration.members[7].body[1].declarations[0].initializer.kind, "unary");
    assert.equal(semantic.declaration.members[7].body[1].declarations[0].initializer.operand.kind, "parenthesized");
    assert.equal(semantic.declaration.members[7].body[1].declarations[0].initializer.operand.expression.kind, "binary");
    assert.equal(semantic.declaration.members[7].body[2].kind, "local");
    assert.equal(semantic.declaration.members[7].body[2].declarations[0].initializer.kind, "conditional");
    assert.equal(semantic.declaration.members[7].body[3].declarations[0].initializer.kind, "binary");
    assert.equal(semantic.declaration.members[7].body[4].kind, "while");
    assert.equal(semantic.declaration.members[7].body[4].condition.kind, "binary");
    assert.equal(semantic.declaration.members[7].body[4].statements[0].expression.kind, "update");
    assert.equal(semantic.declaration.members[7].body[4].statements[1].thenStatements[0].kind, "continue");
    assert.equal(semantic.declaration.members[7].body[4].statements[2].kind, "break");
    assert.equal(semantic.declaration.members[7].body[5].expression.kind, "assignment");
    assert.equal(semantic.declaration.members[7].body[5].expression.target.kind, "member");
    assert.equal(semantic.declaration.members[8].body[1].kind, "switch");
    assert.equal(semantic.declaration.members[8].body[1].cases.length, 2);
    assert.equal(semantic.declaration.members[8].body[1].cases[0].statements[1].kind, "break");
    assert.equal(semantic.declaration.members[8].body[2].kind, "doWhile");
    assert.equal(semantic.declaration.members[8].body[3].kind, "throw");
    assert.equal(semantic.declaration.members[9].body[1].kind, "for");
    assert.equal(semantic.declaration.members[9].body[2].kind, "forEach");
    assert.equal(semantic.declaration.members[9].body[2].declaresBinding, true);
    assert.equal(semantic.declaration.members[9].body[3].kind, "local");
    assert.equal(semantic.declaration.members[9].body[4].kind, "forEach");
    assert.equal(semantic.declaration.members[9].body[4].declaresBinding, false);
    ["FOR", "FOREACH", "IN", "ITER"].forEach(kind =>
        assert.ok(normalized.nodes.some(node => node.kind === kind), `real parser preserves ${kind}`));
    assert.equal(semantic.declaration.members[10].body[0].kind, "try");
    assert.equal(semantic.declaration.members[10].body[0].catchClause.type.sourceName, "Error");
    assert.equal(semantic.declaration.members[10].body[0].finallyStatements.length, 1);
    ["TRY", "CATCH", "FINALLY", "THROW"].forEach(kind =>
        assert.ok(normalized.nodes.some(node => node.kind === kind), `real parser preserves ${kind}`));
    assert.equal(semantic.declaration.members[11].body[0].declarations[0].initializer.operator, "|");
    assert.equal(semantic.declaration.members[11].body[1].declarations[0].initializer.operator, ">>>");
    assert.equal(semantic.declaration.members[11].body[2].declarations[0].initializer.operator, "~");
    assert.equal(semantic.declaration.members[11].body[4].expression.value.kind, "coercion");
    assert.equal(semantic.declaration.members[11].body[5].expression.value.kind, "binary");
    assert.equal(semantic.declaration.members[11].body[5].expression.value.operator, "&&");
    assert.equal(semantic.declaration.members[11].body[6].expression.kind, "update");
    assert.equal(semantic.declaration.members[11].body[7].expression.kind, "update");
    ["B_OR", "SHIFT", "B_NOT"].forEach(kind =>
        assert.ok(normalized.nodes.some(node => node.kind === kind), `real parser preserves ${kind}`));
    ["OBJECT", "PROP", "VALUE"].forEach(kind =>
        assert.ok(normalized.nodes.some(node => node.kind === kind), `real parser preserves ${kind}`));
    const objectInitializer = semantic.declaration.members[12].body[0].declarations[0].initializer;
    assert.equal(objectInitializer.kind, "object");
    assert.deepEqual(objectInitializer.properties.map(property => property.name), ["alpha", "label"]);
    assert.equal(semantic.declaration.members[13].parameters[0].defaultValue.value, true);
    assert.equal(semantic.declaration.members[13].parameters[1].defaultValue.kind, "coercion");
    assert.equal(semantic.declaration.members[13].parameters[1].defaultValue.argument.kind, "unary");
    assert.equal(semantic.declaration.members[13].parameters[1].defaultValue.argument.operator, "-");
    assert.equal(semantic.declaration.members[14].parameters[1].rest, true);
    assert.equal(semantic.declaration.members[14].parameters[1].type.sourceName, "*");
    assert.equal(semantic.declaration.members[15].body[0].kind, "label");
    assert.equal(semantic.declaration.members[15].body[0].statement.kind, "while");
    assert.ok(normalized.nodes.some(node => node.kind === "LAMBDA"), "real parser preserves anonymous functions");
    const closureMethod = semantic.declaration.members[17];
    assert.equal(closureMethod.name, "closures");
    assert.equal(closureMethod.body[1].declarations[0].initializer.kind, "lambda");
    assert.equal(closureMethod.body[2].declarations[0].initializer.kind, "call");
    const dictionaryMethod = semantic.declaration.members[18];
    assert.equal(dictionaryMethod.name, "dictionaries");
    assert.equal(dictionaryMethod.body[2].expression.target.accessKind, "dictionary");
    assert.equal(dictionaryMethod.body[3].declarations[0].initializer.kind, "delete");
    assert.ok(normalized.nodes.some(node => node.kind === "DELETE"), "real parser preserves Dictionary delete");
    const shortVectorMethod = semantic.declaration.members[19];
    assert.equal(shortVectorMethod.name, "shortVectors");
    assert.equal(shortVectorMethod.body[0].declarations[0].initializer.kind, "vectorConversion");
    assert.ok(normalized.nodes.some(node => node.kind === "SHORT_VECTOR"),
        "real parser preserves short Vector literals");
    assert.equal(semantic.declaration.members[15].body[0].statement.statements[0].label, "outer");
    assert.equal(semantic.declaration.members[16].name, "enumerate");
    assert.equal(semantic.declaration.members[16].body[1].kind, "forIn");
    assert.equal(semantic.declaration.members[16].body[1].declaresTarget, true);
    assert.equal(semantic.declaration.members[16].body[1].targetType.sourceName, "String");
    assert.ok(normalized.nodes.some(node => node.kind === "FORIN"));

    const forgedNamespaceSource = "package p { use namespace ResourcesSpace; public class C { ResourcesSpace function hidden():void {} } }";
    const forgedNamespaceTree = built.parse("fixtures/ForgedNamespace.as", forgedNamespaceSource);
    const forgedNamespaceNormalized = built.normalizer.normalizeParserAst(
        forgedNamespaceTree, forgedNamespaceSource, sha256,
    );
    assert.throws(() => built.adapter.adaptNormalizedParserAst(
        forgedNamespaceNormalized, authority(built.ledger), forgedNamespaceSource, sha256,
    ), error => error && error.code === "HARDENED_NAMESPACE_AUTHORITY");

    const packageFunctionSource = "package p { public function helper():void {} }";
    const packageFunctionTree = built.parse("fixtures/PackageFunction.as", packageFunctionSource);
    const packageFunctionNormalized = built.normalizer.normalizeParserAst(
        packageFunctionTree, packageFunctionSource, sha256,
    );
    assert.throws(() => built.localDeclarations.extractLocalDeclaration(
        packageFunctionNormalized, packageFunctionSource, sha256,
    ), error => error && error.code === "HARDENED_LOCAL_DECLARATION_CONTENT");

    const overrideSource = "package p { import flash.display.Sprite; public class C extends Sprite { public function C(){super();} override public function toString():String{return \"C\";} } }";
    const overrideTree = built.parse("fixtures/Override.as", overrideSource);
    const overrideNormalized = built.normalizer.normalizeParserAst(overrideTree, overrideSource, sha256);
    assert.ok(overrideNormalized.nodes.some(node => node.kind === "MODIFIER" && node.text === "override"));
    assert.throws(() => built.adapter.adaptNormalizedParserAst(
        overrideNormalized, authority(built.ledger), overrideSource, sha256,
    ), error => error && error.code === "HARDENED_OVERRIDE_AUTHORITY");

    const interfaceSource = "package p { public interface IThing { function run(value:int,...rest):String; function get name():String; function set name(value:String):void; } }";
    const interfaceTree = built.parse("fixtures/IThing.as", interfaceSource);
    const interfaceNormalized = built.normalizer.normalizeParserAst(interfaceTree, interfaceSource, sha256);
    assert.ok(interfaceNormalized.nodes.some(node => node.kind === "INTERFACE"));
    const interfaceSemantic = built.adapter.adaptNormalizedParserAst(
        interfaceNormalized, authority(built.ledger), interfaceSource, sha256,
    );
    assert.equal(interfaceSemantic.declaration.declarationKind, "interface");
    assert.deepEqual(interfaceSemantic.declaration.members.map(member => member.kind), ["method", "getter", "setter"]);
    assert.equal(interfaceSemantic.declaration.members[0].parameters[1].rest, true);

    const vectorSource = "package vectors { public class VectorFixture { public var values:Vector.<int> = new Vector.<int>(2,true); public function VectorFixture(){ values[0] = 3; values[values.length] = 5; var pushed:uint = values.push(4); var shifted:uint = values.unshift(2); var vectorLength:uint = values.length; values.length = vectorLength; var found:int = values.indexOf(2); var high:uint = 2147483648; var joined:String = values.join(\",\"); var copy:Vector.<int> = Vector.<int>([1,2]); var objectValue:Object = values as Object; var matches:Boolean = values is Vector.<int>; } } }";
    const vectorTree = built.parse("fixtures/VectorFixture.as", vectorSource);
    const vectorNormalized = built.normalizer.normalizeParserAst(vectorTree, vectorSource, sha256);
    ["VECTOR", "ARRAY", "ARRAY_ACCESSOR", "AS"].forEach(kind =>
        assert.ok(vectorNormalized.nodes.some(node => node.kind === kind), `real parser preserves ${kind}`));
    const vectorSemantic = built.adapter.adaptNormalizedParserAst(
        vectorNormalized, authority(built.ledger), vectorSource, sha256,
    );
    const vectorField = vectorSemantic.declaration.members[0];
    assert.equal(vectorField.type.sourceName, "Vector.<int>");
    assert.equal(vectorField.initializer.kind, "new");
    assert.equal(vectorSemantic.declaration.members[1].body[0].expression.target.kind, "index");
    assert.equal(vectorSemantic.declaration.members[1].body[1].expression.target.kind, "index");
    assert.equal(vectorSemantic.declaration.members[1].body[1].expression.target.index.kind, "member");
    const vectorTypeScript=built.emitter.emitSemanticProgram(vectorSemantic,
        {compiler:require("typescript-4-9"),expectedTypeScriptVersion:"4.9.5"}).code;
    assert.match(vectorTypeScript,/this\.values!\[this\.values!\.length\] = __as3Int\(5\);/);
    assert.match(vectorTypeScript,/this\.values!\.join\(","\)/);
    const vectorBody = vectorSemantic.declaration.members[1].body;
    const vectorLocals = Object.fromEntries(vectorBody.filter(statement => statement.kind === "local")
        .flatMap(statement => statement.declarations).map(declaration => [declaration.name,declaration]));
    assert.equal(vectorLocals.pushed.initializer.resultType.sourceName, "uint");
    assert.equal(vectorLocals.shifted.initializer.resultType.sourceName, "uint");
    assert.equal(vectorLocals.vectorLength.type.sourceName, "uint");
    assert.equal(vectorLocals.found.initializer.resultType.sourceName, "int");
    assert.equal(vectorLocals.high.type.sourceName, "uint");
    assert.equal(vectorLocals.joined.initializer.resultType.sourceName, "String");
    assert.equal(vectorLocals.copy.initializer.kind, "vectorConversion");
    assert.equal(semantic.declaration.members[7].body[5].expression.target.name, "status");

    const rejectedSorts = [
        "values.sort(16);",
        "values.sort(0);",
        "values.sort(18);",
        "var Array:Object = null; values.sort(Array.NUMERIC);",
        "values.sort(Array.NUMERIC + 2);",
    ];
    rejectedSorts.forEach((statement) => {
        const source = `package vectors { public class SortHold { public var values:Vector.<int> = new Vector.<int>(); public function SortHold(){ ${statement} } } }`;
        const tree = built.parse("fixtures/SortHold.as", source);
        const normalizedSort = built.normalizer.normalizeParserAst(tree, source, sha256);
        assert.throws(() => built.adapter.adaptNormalizedParserAst(
            normalizedSort, authority(built.ledger), source, sha256), error => error && /^HARDENED_/.test(error.code), statement);
    });
    const unauthenticatedNumeric="package vectors { public class SortHold { public var values:Vector.<int> = new Vector.<int>(); public function SortHold(){ values.sort(Array.NUMERIC); } } }";
    const unauthenticatedTree=built.parse("fixtures/SortHold.as",unauthenticatedNumeric);
    const unauthenticatedNormalized=built.normalizer.normalizeParserAst(
        unauthenticatedTree,unauthenticatedNumeric,sha256);
    assert.throws(()=>built.adapter.adaptNormalizedParserAst(
        unauthenticatedNormalized,authority(built.ledger),unauthenticatedNumeric,sha256),
    error=>error&&error.code==="HARDENED_INTRINSIC_IDENTITY_AUTHORITY");
    for(const badJoin of ["values.join(1);","values.join(true);","values.join({});"]){
        const source=`package vectors { public class JoinHold { public var values:Vector.<int> = new Vector.<int>(); public function JoinHold(){ ${badJoin} } } }`;
        const tree=built.parse("fixtures/JoinHold.as",source);
        const normalizedJoin=built.normalizer.normalizeParserAst(tree,source,sha256);
        assert.throws(()=>built.adapter.adaptNormalizedParserAst(
            normalizedJoin,authority(built.ledger),source,sha256),error=>error&&error.code==="HARDENED_ASSIGNMENT_TYPE",badJoin);
    }

    const concatSource = "package vectors { import flash.display.DisplayObject; import flash.display.Sprite; import flash.events.Event; public class ConcatFixture { public var baseValues:Vector.<DisplayObject>; public var derivedValues:Vector.<Sprite>; public var eventValues:Vector.<Event>; public var objectValues:Vector.<Object>; public var intValues:Vector.<int>; public var nestedValues:Vector.<Vector.<int>>; public var ordinaryArray:Array; public var ordinaryObject:Object; public var sprite:Sprite; public function ConcatFixture(){ baseValues.concat(derivedValues); objectValues.concat(intValues); objectValues.concat(derivedValues); objectValues.concat(nestedValues); } } }";
    const concatTree = built.parse("fixtures/ConcatFixture.as", concatSource);
    const concatNormalized = built.normalizer.normalizeParserAst(concatTree, concatSource, sha256);
    const predicateAuthorityJson=fs.readFileSync(path.join(ROOT,"config/runtime-type-predicates.json"),"utf8");
    const predicateAuthority=JSON.parse(predicateAuthorityJson);
    const referenceAuthority=built.typeAuthority.loadMappedRuntimeTypeAuthority(
        fs.readFileSync(path.join(ROOT,"config/runtime-type-authority-lock.json"),"utf8"),predicateAuthorityJson,
        predicateAuthority.types.map(row=>row.sourceQName),sha256);
    assert.throws(()=>built.adapter.adaptNormalizedParserAst(
        concatNormalized,authority(built.ledger),concatSource,sha256,undefined,undefined,undefined,[
            {kind:"class",qname:"flash.display.DisplayObject",base:null,interfaces:[]},
        ]),error=>error&&error.code==="HARDENED_TYPE_AUTHORITY_SOURCE");
    const concatSemantic = built.adapter.adaptNormalizedParserAst(
        concatNormalized, authority(built.ledger), concatSource, sha256, undefined, undefined, undefined,
        referenceAuthority);
    assert.equal(concatSemantic.declaration.members.find(member => member.kind === "constructor").body.length,4);
    for(const badCall of ["derivedValues.concat(baseValues);","baseValues.concat(eventValues);","intValues.concat(objectValues);",
        "objectValues.concat(ordinaryArray);","objectValues.concat(ordinaryObject);","objectValues.concat(sprite);",
        "objectValues.concat(null);","objectValues.concat(1);"]){
        const badSource=concatSource.replace("baseValues.concat(derivedValues); objectValues.concat(intValues); objectValues.concat(derivedValues); objectValues.concat(nestedValues);",badCall);
        const badTree=built.parse("fixtures/ConcatHold.as",badSource);
        const badNormalized=built.normalizer.normalizeParserAst(badTree,badSource,sha256);
        assert.throws(()=>built.adapter.adaptNormalizedParserAst(
            badNormalized,authority(built.ledger),badSource,sha256,undefined,undefined,undefined,referenceAuthority),
        error=>error&&error.code==="HARDENED_VECTOR_CONCAT_TYPE",badCall);
    }

    const implementsSource = "package p { import q.IReady; public class C implements IReady {} }";
    const implementsTree = built.parse("fixtures/Implements.as", implementsSource);
    const implementsNormalized = built.normalizer.normalizeParserAst(implementsTree, implementsSource, sha256);
    assert.ok(implementsNormalized.nodes.some(node => node.kind === "IMPLEMENTS_LIST"));
    assert.ok(implementsNormalized.nodes.some(node => node.kind === "IMPLEMENTS"));

    const repeat = built.normalizer.normalizeParserAst(built.parse("fixtures/Demo.as", source), source, sha256);
    assert.deepEqual(repeat, normalized, "real parser normalization is byte-for-byte deterministic");

    [
        "package p { [Bindable] public class C {} }",
    ].forEach((unsupported) => {
        const tree = built.parse("fixtures/Unsupported.as", unsupported);
        expectNormalizationCode(
            () => built.normalizer.normalizeParserAst(tree, unsupported, sha256),
            "PARSER_NORMALIZER_UNSUPPORTED_KIND",
        );
    });

    assert.throws(
        () => built.parse("fixtures/Malformed.as", "package p { public class C {"),
        (error) => error && error.name === "AS3ParseError" && /^AS3_PARSE_/.test(error.code),
        "parser failure produces no recoverable tree to normalize",
    );

    let tree = built.parse("fixtures/Recovery.as", "package p { public class C {} }");
    tree.recovery = [];
    expectNormalizationCode(
        () => built.normalizer.normalizeParserAst(tree, "package p { public class C {} }", sha256),
        "PARSER_NORMALIZER_RECOVERY",
    );

    tree = built.parse("fixtures/Null.as", "package p { public class C {} }");
    tree.children[0].children.push(null);
    expectNormalizationCode(
        () => built.normalizer.normalizeParserAst(tree, "package p { public class C {} }", sha256),
        "PARSER_NORMALIZER_NULL_CHILD",
    );

    tree = built.parse("fixtures/Span.as", "package p { public class C {} }");
    tree.children[0].children[0].end = 1000;
    expectNormalizationCode(
        () => built.normalizer.normalizeParserAst(tree, "package p { public class C {} }", sha256),
        "PARSER_NORMALIZER_SPAN",
    );

    tree = built.parse("fixtures/Kind.as", "package p { public class C {} }");
    tree.children[0].children[0].kind = 999999;
    expectNormalizationCode(
        () => built.normalizer.normalizeParserAst(tree, "package p { public class C {} }", sha256),
        "PARSER_NORMALIZER_UNSUPPORTED_KIND",
    );

    tree = built.parse("fixtures/Text.as", "package p { public class C {} }");
    tree.children[0].children[0].text = "invented";
    expectNormalizationCode(
        () => built.normalizer.normalizeParserAst(tree, "package p { public class C {} }", sha256),
        "PARSER_NORMALIZER_TEXT",
    );

    tree = built.parse("fixtures/Source.as", "package p { public class C {} }");
    expectNormalizationCode(
        () => built.normalizer.normalizeParserAst(tree, "package p { public class C {} }x", sha256),
        "PARSER_NORMALIZER_ROOT",
    );

    tree = built.parse("fixtures/Cycle.as", "package p { public class C {} }");
    tree.children[0].children.push(tree.children[0]);
    expectNormalizationCode(
        () => built.normalizer.normalizeParserAst(tree, "package p { public class C {} }", sha256),
        "PARSER_NORMALIZER_GRAPH",
    );

    tree = built.parse("fixtures/Hash.as", "package p { public class C {} }");
    expectNormalizationCode(
        () => built.normalizer.normalizeParserAst(tree, "package p { public class C {} }", () => "not-sha256"),
        "PARSER_NORMALIZER_HASH",
    );

    console.log(`parser normalizer gates passed (${normalized.nodes.length} real parser nodes)`);
} finally {
    fs.rmSync(built.output, { recursive: true, force: true });
}
