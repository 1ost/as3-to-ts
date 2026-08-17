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
                sourceRoles: ["base-type", "import"],
                sourceMember: null,
                targetCapabilityId: "api.flash.display.sprite",
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
                    roles: ["base-type", "import"], preserve: { apiName: true, signature: true },
                },
                {
                    qname: "flash.events.Event", classification: "layaair-flash-api-bridge",
                    roles: ["import"], preserve: { apiName: true, signature: true },
                },
            ],
            memberUses: [],
        },
    };
    const target = {
        schema: "laya-authored-content-capabilities@1",
        capabilities: [
            {
                id: "api.flash.display.sprite", status: "typescript-obligation",
                obligations: [{
                    module: "src/layaAir/flash/display/Sprite.ts", export: "Sprite",
                    kind: "class", signature: "typeof Sprite", members: [],
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
        "        private var label:String = \"ok\";",
        "        public function Demo() { super(); }",
        "        public function onEvent(event:Event):void { return; }",
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
        ["field", "constructor", "method"]);
    assert.equal(semantic.declaration.members[0].name, "label");
    assert.equal(semantic.declaration.members[1].body[0].expression.callee.kind, "super");
    assert.equal(semantic.declaration.members[2].name, "onEvent");
    assert.equal(semantic.declaration.members[2].parameters[0].name, "event");

    const repeat = built.normalizer.normalizeParserAst(built.parse("fixtures/Demo.as", source), source, sha256);
    assert.deepEqual(repeat, normalized, "real parser normalization is byte-for-byte deterministic");

    [
        "package p { public interface I {} }",
        "package p { public class C { public const X:int = 1; } }",
        "package p { [Bindable] public class C {} }",
        "package p { public class C { public function f():void { while (true) {} } } }",
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
