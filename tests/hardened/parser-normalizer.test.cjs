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
        "src/hardened/ledger.ts",
        "src/hardened/contracts.ts",
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
        ledger: require(path.join(output, "hardened/ledger.js")),
    };
}

function authority(api) {
    const mappings = {
        schema: "as3-source-to-laya-capability-map@1",
        mappings: [
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
                    qname: "flash.display.Sprite", classification: "layaair-flash-api-bridge",
                    roles: ["base-type", "constructor", "import"], preserve: { apiName: true, signature: true },
                },
                {
                    qname: "flash.events.Event", classification: "layaair-flash-api-bridge",
                    roles: ["import"], preserve: { apiName: true, signature: true },
                },
            ],
            memberUses: [{
                qname: "flash.display.Sprite", member: "Sprite", access: "call",
                context: "constructor",
                preserveNameAndSignature: true,
                signatures: [{ signature: "public function Sprite()", minArgs: 0, maxArgs: 0 }],
            }],
        },
    };
    const target = {
        schema: "laya-authored-content-capabilities@1",
        capabilities: [
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
    return api.loadCapabilityAuthority({
        sourceCensusJson: sourceJson,
        sourceCensusSha256: sha256(sourceJson),
        targetCapabilitiesJson: targetJson,
        targetCapabilitiesSha256: sha256(targetJson),
        mappingJson,
        mappingSha256: sha256(mappingJson),
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
        "        public function iteration():void { var values:Vector.<int> = new Vector.<int>(); for (var i:Number = 0; i < 2; i++) { values.push(int(i)); } for each (var item:int in values) { values.indexOf(item); } }",
        "        public function guarded():void { try { throw \"bad\"; } catch (error:Error) { throw error; } finally { status = \"done\"; } }",
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
    assert.equal(semantic.packageName, "lobby.ui");
    assert.equal(semantic.outputModulePath, "lobby/ui/Demo.ts");
    assert.deepEqual(semantic.imports.map((item) => item.sourceQualifiedName),
        ["flash.display.Sprite", "flash.events.Event"]);
    assert.equal(semantic.declaration.name, "Demo");
    assert.deepEqual(semantic.declaration.members.map((member) => member.kind),
        ["field", "field", "field", "field", "getter", "setter", "constructor", "method", "method", "method", "method"]);
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
    ["FOR", "FOREACH", "IN", "ITER"].forEach(kind =>
        assert.ok(normalized.nodes.some(node => node.kind === kind), `real parser preserves ${kind}`));
    assert.equal(semantic.declaration.members[10].body[0].kind, "try");
    assert.equal(semantic.declaration.members[10].body[0].catchClause.type.sourceName, "Error");
    assert.equal(semantic.declaration.members[10].body[0].finallyStatements.length, 1);
    ["TRY", "CATCH", "FINALLY", "THROW"].forEach(kind =>
        assert.ok(normalized.nodes.some(node => node.kind === kind), `real parser preserves ${kind}`));

    const vectorSource = "package vectors { public class VectorFixture { public var values:Vector.<int> = new Vector.<int>(2,true); public function VectorFixture(){ values[0] = 3; values.push(4); var copy:Vector.<int> = Vector.<int>([1,2]); var objectValue:Object = values as Object; var matches:Boolean = values is Vector.<int>; } } }";
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
    assert.equal(vectorSemantic.declaration.members[1].body[2].declarations[0].initializer.kind, "vectorConversion");
    assert.equal(semantic.declaration.members[7].body[5].expression.target.name, "status");

    const implementsSource = "package p { import q.IReady; public class C implements IReady {} }";
    const implementsTree = built.parse("fixtures/Implements.as", implementsSource);
    const implementsNormalized = built.normalizer.normalizeParserAst(implementsTree, implementsSource, sha256);
    assert.ok(implementsNormalized.nodes.some(node => node.kind === "IMPLEMENTS_LIST"));
    assert.ok(implementsNormalized.nodes.some(node => node.kind === "IMPLEMENTS"));

    const repeat = built.normalizer.normalizeParserAst(built.parse("fixtures/Demo.as", source), source, sha256);
    assert.deepEqual(repeat, normalized, "real parser normalization is byte-for-byte deterministic");

    [
        "package p { public interface I {} }",
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
