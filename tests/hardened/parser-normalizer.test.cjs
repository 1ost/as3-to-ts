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
        "src/hardened/source-member-authority.ts",
        "src/hardened/local-declarations.ts",
        "src/hardened/ledger.ts",
        "src/hardened/contracts.ts",
        "src/hardened-runtime/AS3Coerce.ts",
        "src/hardened-runtime/AS3ClassInitialization.ts",
        "src/hardened-runtime/AS3Function.ts",
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
        sourceMembers: require(path.join(output, "hardened/source-member-authority.js")),
        localDeclarations: require(path.join(output, "hardened/local-declarations.js")),
        ledger: require(path.join(output, "hardened/ledger.js")),
    };
}

function authority(api, includeTrace = false) {
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
                    qname: "flash.utils.clearInterval", classification: "layaair-flash-api-bridge",
                    roles: ["import", "package-function", "wildcard-resolution"],
                    preserve: { apiName: true, signature: true },
                },
                {
                    qname: "flash.utils.clearTimeout", classification: "layaair-flash-api-bridge",
                    roles: ["import", "package-function", "wildcard-resolution"],
                    preserve: { apiName: true, signature: true },
                },
                {
                    qname: "flash.utils.getTimer", classification: "layaair-flash-api-bridge",
                    roles: ["import", "package-function"],
                    preserve: { apiName: true, signature: true },
                },
                {
                    qname: "flash.utils.setInterval", classification: "layaair-flash-api-bridge",
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
                    qname: "flash.utils.clearInterval", member: "<call>", access: "call",
                    context: "package-function", classification: "layaair-flash-api-bridge",
                    preserveNameAndSignature: true,
                    signatures: [{ signature: "public function clearInterval(id:uint) : void", minArgs: 1, maxArgs: 1 }],
                },
                {
                    qname: "flash.utils.clearTimeout", member: "<call>", access: "call",
                    context: "package-function", classification: "layaair-flash-api-bridge",
                    preserveNameAndSignature: true,
                    signatures: [{ signature: "public function clearTimeout(id:uint) : void", minArgs: 1, maxArgs: 1 }],
                },
                {
                    qname: "flash.utils.getTimer", member: "<call>", access: "call",
                    context: "package-function", classification: "layaair-flash-api-bridge",
                    preserveNameAndSignature: true,
                    signatures: [{ signature: "public native function getTimer() : int;", minArgs: 0, maxArgs: 0 }],
                },
                {
                    qname: "flash.utils.setInterval", member: "<call>", access: "call",
                    context: "package-function", classification: "layaair-flash-api-bridge",
                    preserveNameAndSignature: true,
                    signatures: [{ signature: "public function setInterval(closure:Function, delay:Number, ... arguments) : uint", minArgs: 2, maxArgs: null }],
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
    if (includeTrace) {
        source.as3SourceCapabilities.apis.push({qname:"trace", roles:["global-function"],
            classification:"layaair-flash-api-bridge", preserve:{apiName:true, signature:true},
            signatures:["public native function trace(... rest) : void;"]});
        const row = {module:"src/layaAir/flash/debug/trace.ts", export:"trace", kind:"function", signature:"(...values: unknown[]) => void"};
        target.capabilities.push({id:"api.flash.debug", status:"typescript-obligation", obligations:[row]});
        mappings.mappings.push({sourceQName:"trace", sourceRoles:["global-function"], sourceMember:null,
            targetCapabilityId:"api.flash.debug", targetModule:row.module, targetExport:row.export,
            targetKind:row.kind, targetSignature:row.signature, targetMember:null});
        const corrupt = structuredClone(source);
        corrupt.as3SourceCapabilities.apis.find(row => row.qname === "trace").signatures = ["public function trace(value:String):void"];
        assert.throws(() => api.selectCapabilityCandidates(JSON.stringify(corrupt), JSON.stringify(target), api.canonicalMappingJson(mappings)),
            error => error?.code === "HARDENED_GLOBAL_FUNCTION_AUTHORITY");
    }
    const sourceJson = JSON.stringify(source);
    const targetJson = JSON.stringify(target);
    const mappingJson = api.canonicalMappingJson(mappings);
    const selection = api.selectCapabilityCandidates(sourceJson, targetJson, mappingJson);
    assert.equal(selection.mappings.length, mappings.mappings.length);
    assert.deepEqual(selection.held, []);
    for (const [signature, accepted] of [
        ['new <K = unknown, V = unknown>(): Sprite<K, V>', true],
        ['new <K = unknown, V = unknown>(): Sprite<V, K>', false],
        ['new <K = string>(): Sprite<K>', false],
        ['new <K = unknown>(value?: K): Sprite<K>', false],
        ['new <K = unknown, K = unknown>(): Sprite<K, K>', false],
    ]) {
        const genericTarget = structuredClone(target);
        genericTarget.capabilities.find(row => row.id === 'api.flash.display.sprite').obligations[0].constructors = [signature];
        const genericMappings = structuredClone(mappings);
        genericMappings.mappings.find(row => row.targetMember?.kind === 'constructor').targetMember.signature = signature;
        const genericSelection = api.selectCapabilityCandidates(sourceJson, JSON.stringify(genericTarget), JSON.stringify(genericMappings));
        assert.equal(genericSelection.held.length, accepted ? 0 : 1, signature);
        if (!accepted) assert.equal(genericSelection.held[0].code, 'HARDENED_TARGET_CONSTRUCTOR_SIGNATURE');
    }
    assert.throws(() => api.assertLoadedCapabilityAuthority(selection), error => error?.code === "HARDENED_CAPABILITY_AUTHORITY_INSTANCE");
    const drifted = JSON.parse(mappingJson);
    const constructor = drifted.mappings.find(row => row.sourceMember !== null);
    constructor.targetMember.signature = "new (host?: unknown): Sprite";
    const heldSelection = api.selectCapabilityCandidates(sourceJson, targetJson, JSON.stringify(drifted));
    assert.equal(heldSelection.held.length, 1);
    assert.equal(heldSelection.held[0].code, "HARDENED_TARGET_CONSTRUCTOR_ARITY");
    assert.deepEqual(heldSelection.held[0].mapping, constructor);
    drifted.mappings.find(row => row.sourceMember === null).targetSignature = "typeof Missing";
    assert.throws(() => api.selectCapabilityCandidates(sourceJson, targetJson, JSON.stringify(drifted)));
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
    {
        for (const literal of ["/[，、]/g", "/x/gim", "/x/", String.raw`/a\/b/gi`]) {
            const source=`package p { public class RegexSpan { public var a:RegExp=${literal}; public var b:RegExp=${literal}; } }`;
            const normalized=built.normalizer.normalizeParserAst(built.parse("RegexSpan.as",source),source,sha256);
            const literals=normalized.nodes.filter(node=>node.kind==="LITERAL" && node.text===literal);
            assert.equal(literals.length,2);
            for (const node of literals) assert.equal(source.slice(node.span.start,node.span.end),literal);
            const ast=built.parse("RegexSpan.as",source);
            const alter=node=>{if(node.text===literal) node.text=literal+"i";(node.children||[]).forEach(alter);};
            alter(ast);
            expectNormalizationCode(()=>built.normalizer.normalizeParserAst(ast,source,sha256),"PARSER_NORMALIZER_TEXT");
            const runtimeSource=`package p { public class RegexRuntime { public function run():String { return ${literal}; } } }`;
            const runtimeAst=built.normalizer.normalizeParserAst(built.parse("RegexRuntime.as",runtimeSource),runtimeSource,sha256);
            assert.throws(()=>built.adapter.adaptNormalizedParserAst(runtimeAst,authority(built.ledger),runtimeSource,sha256),
                error=>error.code==="HARDENED_LITERAL");
        }
    }
    {
        const source = 'package p { public class CallHold { public function run(callback:Function):void { callback(); } } }';
        const normalized = built.normalizer.normalizeParserAst(built.parse("CallHold.as", source), source, sha256);
        const start = source.indexOf("callback();");
        assert.throws(() => built.adapter.adaptNormalizedParserAst(normalized, authority(built.ledger), source, sha256),
            error => error?.code === "HARDENED_CALL_TARGET"
                && error.message.includes(`parameter callback at source offsets ${start}:${start + 8}`)
                && normalized.nodes.find(node => node.id === error.sourceNodeId)?.text === "callback");
    }
    {
        const source = 'package p { public class TraceFixture { public function run():void { trace("hello", 1, null); } } }';
        const adapt = (text, admitted = true) => built.adapter.adaptNormalizedParserAst(
            built.normalizer.normalizeParserAst(built.parse("TraceFixture.as", text), text, sha256), authority(built.ledger, admitted), text, sha256);
        const semantic = adapt(source);
        assert.equal(semantic.declaration.members.find(m => m.name === "run").body[0].expression.kind, "globalCall");
        assert.throws(() => adapt(source, false), error => error?.code === "HARDENED_GLOBAL_FUNCTION_AUTHORITY");
        const shadow = adapt(source.replace('public function run()', 'private function trace(a:String,b:int,c:Object):void {} public function run()'));
        assert.equal(JSON.stringify(shadow).includes('"globalCall"'), false);
        assert.equal(adapt(source.replace('trace("hello", 1, null)', 'trace(this)'))
            .declaration.members.find(m => m.name === "run").body[0].expression.kind,"globalCall");
        const parameter = source.replace('run():void', 'run(trace:Function):void');
        assert.throws(() => adapt(parameter), error => error?.code !== "HARDENED_GLOBAL_FUNCTION_AUTHORITY");
    }
    for (const [expression, kind] of [
        ["new Sprite() as Sprite", "RELATION"],
        ["new Sprite() == null", "EQUALITY"],
        ["new Sprite().visible", "DOT"],
    ]) {
        const text = `package p { import flash.display.Sprite; public class C { public var value:Object = ${expression}; } }`;
        const ast = built.normalizer.normalizeParserAst(built.parse("C.as", text), text, sha256);
        const created = ast.nodes.find(node => node.kind === "NEW");
        assert.equal(ast.nodes.find(node => node.id === created.parentId).kind, kind);
        assert.equal(ast.nodes.find(node => node.parentId === created.id).kind, "CALL");
        assert.equal(text.slice(created.span.start, created.span.end), "new Sprite()");
    }
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

    // PureMVC Facade repeats an import name in its ASDoc @see reference.
    // Retain the name's token range instead of searching the comment.
    for (const newline of ["\n", "\r\n"]) {
        const importSource = [
            "package p {",
            "    import org.puremvc.as3.core.*;",
            "    import org.puremvc.as3.patterns.observer.Notification;",
            "    /** @see org.puremvc.as3.patterns.observer.Notification Notification */",
            "    public class Facade { public function Facade() {} }",
            "}",
        ].join(newline);
        const importTree = built.parse("fixtures/Facade.as", importSource);
        const importNormalized = built.normalizer.normalizeParserAst(importTree, importSource, sha256);
        const imports = importNormalized.nodes.filter(node => node.kind === "IMPORT");
        assert.equal(imports.length, 2);
        for (const node of imports) {
            assert.equal(node.span.start, importSource.indexOf(node.text));
            assert.equal(importSource.slice(node.span.start, node.span.end), node.text);
        }
        assert.equal(importTree.trivia.length, 1);
        assert.equal(importSource.slice(importTree.trivia[0].index, importTree.trivia[0].end),
            importTree.trivia[0].text);
        assert.ok(built.localDeclarations.extractLocalDeclaration(importNormalized, importSource, sha256));
        // A corrupted raw range must still fail closed at the ambiguous text.
        let damaged;
        (function visit(node) {
            if (node.text === "org.puremvc.as3.patterns.observer.Notification") damaged = node;
            node.children.forEach(visit);
        }(importTree));
        damaged.start -= "import ".length;
        damaged.end = damaged.start + damaged.text.length;
        expectNormalizationCode(() => built.normalizer.normalizeParserAst(importTree, importSource, sha256),
            "PARSER_NORMALIZER_TEXT");
    }

    const semantic = built.adapter.adaptNormalizedParserAst(
        normalized, authority(built.ledger), source, sha256,
    );

    const startupLanguageSource = `package p { public class StartupLanguage {
        public function values(message:String, value:Number):String {
            var clamped:Number = Math.max(0, Math.min(100, value));
            var divided:Number = 100 / 5 / 2;
            var chosen:String = message == null ? "" : message;
            var position:Number = chosen.indexOf(" | ");
            return chosen.substr(position + 3) + ":" + clamped + "%";
        }
        public function angle():Number { return Math.PI / 2; }
    } }`;
    const startupLanguage = built.adapter.adaptNormalizedParserAst(
        built.normalizer.normalizeParserAst(built.parse("StartupLanguage.as", startupLanguageSource), startupLanguageSource, sha256),
        authority(built.ledger), startupLanguageSource, sha256);
    assert.equal(startupLanguage.declaration.members.filter(member => member.kind === "method").length, 2);
    const emptySource = 'package p { public class EmptyFixture { public function run():String { ; if (false); else ; while (false) { }; return "ready"; } } }';
    const emptySemantic = built.adapter.adaptNormalizedParserAst(
        built.normalizer.normalizeParserAst(built.parse("EmptyFixture.as", emptySource), emptySource, sha256),
        authority(built.ledger), emptySource, sha256);
    const emptyBody = emptySemantic.declaration.members.find(member => member.name === "run").body;
    assert.equal(emptyBody[0].kind, "empty");
    assert.equal(emptyBody[1].thenStatements[0].kind, "empty");
    assert.equal(emptyBody[1].elseStatements[0].kind, "empty");
    assert.equal(emptyBody[3].kind, "empty");
    assert.match(built.emitter.emitSemanticProgram(emptySemantic, {
        compiler: require("typescript-4-9"), expectedTypeScriptVersion: "4.9.5", sha256,
    }).code, /if \(false\) \{\s*;/);
    for (const body of ['return Math.random();', 'return Math.max("1", 2);', 'return 1 == "1";']) {
        const held = `package p { public class Held { public function run():Number { ${body} } } }`;
        assert.throws(() => built.adapter.adaptNormalizedParserAst(
            built.normalizer.normalizeParserAst(built.parse("Held.as", held), held, sha256),
            authority(built.ledger), held, sha256), built.adapter.HardenedSemanticError || Error);
    }

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
        .replaceAll("@bleach/as3-runtime/AS3ClassInitialization", "./hardened-runtime/AS3ClassInitialization")
        .replaceAll("@bleach/as3-runtime/AS3Coerce", "./hardened-runtime/AS3Coerce")
        .replaceAll("@bleach/as3-runtime/AS3Function", "./hardened-runtime/AS3Function")
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
    const defaultPackageSource = "package { public class Root {} }";
    const defaultPackageTree = built.parse("fixtures/Root.as", defaultPackageSource);
    const defaultPackageNormalized = built.normalizer.normalizeParserAst(
        defaultPackageTree, defaultPackageSource, sha256,
    );
    const defaultPackageDeclaration = built.localDeclarations.extractLocalDeclaration(
        defaultPackageNormalized, defaultPackageSource, sha256,
    );
    assert.equal(defaultPackageDeclaration.qualifiedName, "Root");
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
    const packageFunctionDeclaration = built.localDeclarations.extractLocalDeclaration(
        packageFunctionNormalized, packageFunctionSource, sha256,
    );
    assert.equal(packageFunctionDeclaration.declarationKind, "package");
    assert.equal(packageFunctionDeclaration.qualifiedName, "p.helper");
    assert.equal(packageFunctionDeclaration.members[0].kind, "method");
    assert.equal(packageFunctionDeclaration.members[0].name, "helper");

    for (const [text, value] of [[".5", .5], ["5.", 5]]) {
        const source = `package p { public class DecimalProbe { public function run():Number { return ${text}; } } }`;
        const semantic = built.adapter.adaptNormalizedParserAst(
            built.normalizer.normalizeParserAst(built.parse("fixtures/DecimalProbe.as", source), source, sha256),
            authority(built.ledger), source, sha256);
        assert.equal(semantic.declaration.members.find(m => m.name === "run").body[0].expression.value, value);
    }

    const adaptConstructor = body => {
        const source = `package p { import flash.display.Sprite; public class C extends Sprite {
            public var result:int = 0;
            public function C() { ${body} }
        } }`;
        const tree = built.parse("fixtures/ConstructorLocals.as", source);
        return built.adapter.adaptNormalizedParserAst(
            built.normalizer.normalizeParserAst(tree, source, sha256), authority(built.ledger), source, sha256);
    };
    const constructorLocals = adaptConstructor("var saved:int = 3; ; super(); result = saved;");
    assert.deepEqual(constructorLocals.declaration.members.find(m => m.kind === "constructor").body.map(s => s.kind),
        ["local", "empty", "expression", "expression"]);
    for (const body of ["var saved:Object = this; super();", "var saved:int = result; super();"])
        assert.throws(() => adaptConstructor(body), error => error.code === "HARDENED_SUPER_LOCAL_RECEIVER");
    for (const body of ["super(); super();", "var saved:int = 3; saved = 4; super();",
        "if (true) { super(); }"])
        assert.throws(() => adaptConstructor(body), error => error.code === "HARDENED_SUPER_CONTEXT");

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
    const sourceMemberDocument={entries:[
        {baseQName:null,ownInstanceMemberNames:["hasOwnProperty"],qname:"Object"},
        {baseQName:"Object",ownInstanceMemberNames:["alpha"],qname:"flash.display.DisplayObject"},
        {baseQName:"flash.display.DisplayObject",ownInstanceMemberNames:["graphics"],qname:"flash.display.Sprite"},
    ],entryCount:3,generator:"air-sdk-swfdump-abc@1",schema:"as3-source-member-authority@1",
    sourceArtifactSha256:"a".repeat(64)};
    const sourceMemberJson=JSON.stringify(sourceMemberDocument);
    const sourceMemberAuthority=built.sourceMembers.loadSourceMemberAuthority(
        sourceMemberJson,sha256(sourceMemberJson),sha256);
    {
        for (const expression of ['flag ? null : "never"','flag ? "never" : null']) {
            const source=`package p { public class NullableText {public function select(flag:Boolean):String {return ${expression};}} }`;
            const normalized=built.normalizer.normalizeParserAst(built.parse("NullableText.as",source),source,sha256);
            const program=built.adapter.adaptNormalizedParserAst(normalized,authority(built.ledger),source,sha256,
                undefined,undefined,undefined,referenceAuthority,sourceMemberAuthority);
            const result=program.declaration.members.find(member=>member.name === "select").body[0].expression;
            assert.equal(result.resultType.sourceName,"String");assert.equal(result.resultType.nullable,true);
            assert.throws(()=>built.adapter.adaptNormalizedParserAst(normalized,authority(built.ledger),source,sha256),
                error=>error?.code === "HARDENED_CONDITIONAL_TYPE");
        }
    }
    {
        const adaptError = (body, authenticated = true, parameters = "") => {
            const source = `package p { public class ErrorConstruction {
                public function fail(${parameters}):Error { ${body} }
            } }`;
            return built.adapter.adaptNormalizedParserAst(
                built.normalizer.normalizeParserAst(built.parse("ErrorConstruction.as",source),source,sha256),
                authority(built.ledger),source,sha256,undefined,undefined,undefined,referenceAuthority,
                authenticated ? sourceMemberAuthority : undefined);
        };
        const admitted = adaptError('return new ArgumentError("missing", -7);');
        const returned = admitted.declaration.members.find(member=>member.name === "fail").body[0].expression;
        assert.equal(returned.kind,"new");
        assert.equal(returned.sourceType.sourceName,"ArgumentError");
        assert.equal(returned.sourceType.emittedName,"__AS3ArgumentError");
        const errorSource='package p { public class ErrorRead { public function read(error:Error):* { return error.message + 1; } } }';
        const message=built.adapter.adaptNormalizedParserAst(
            built.normalizer.normalizeParserAst(built.parse("ErrorRead.as",errorSource),errorSource,sha256),
            authority(built.ledger),errorSource,sha256,undefined,undefined,undefined,referenceAuthority,sourceMemberAuthority);
        const sum=message.declaration.members.find(member=>member.name === "read").body[0].expression;
        assert.equal(sum.additionCoercion,true);

        assert.throws(()=>adaptError('return new ArgumentError("missing");',false),error=>error?.code === "HARDENED_NEW_AUTHORITY");
        assert.throws(()=>adaptError('return new ArgumentError("missing");',true,'ArgumentError:Function'),error=>error?.code === "HARDENED_NEW_AUTHORITY");
        for (const args of ['"message", "id"','"message", 7, 8'])
            assert.throws(()=>adaptError(`return new ArgumentError(${args});`),error=>error?.code === "HARDENED_ARGUMENT_ERROR_CONSTRUCTOR");
    }

    {
        const adapt = (expression, authenticated = true) => {
            const source = `package p { import flash.display.Sprite; public class NullableReference {
                public function choose(flag:Boolean, numeric:Number):Sprite { return ${expression}; }
            } }`;
            return built.adapter.adaptNormalizedParserAst(
                built.normalizer.normalizeParserAst(built.parse("NullableReference.as", source), source, sha256),
                authority(built.ledger), source, sha256, undefined, undefined, undefined, referenceAuthority,
                authenticated ? sourceMemberAuthority : undefined);
        };
        for (const expression of ["flag ? new Sprite() : null", "flag ? null : new Sprite()"]) {
            const semantic = adapt(expression);
            const result = semantic.declaration.members.find(member => member.name === "choose").body[0].expression;
            assert.equal(result.resultType.sourceName, "Sprite");
            assert.equal(result.resultType.nullable, true);
            assert.throws(() => adapt(expression, false), error => error?.code === "HARDENED_CONDITIONAL_TYPE");
        }
        for (const expression of ["flag ? 1 : null", "flag ? numeric : null", "flag ? new Sprite() : true"])
            assert.throws(() => adapt(expression), error => error?.code === "HARDENED_CONDITIONAL_TYPE");
        for (const expression of ["flag ? this : new Sprite()", "flag ? new Sprite() : this"]) {
            const source = `package p { import flash.display.Sprite; public class DerivedConditional extends Sprite {
                public function choose(flag:Boolean):Sprite { return ${expression}; }
            } }`;
            const tree = built.normalizer.normalizeParserAst(built.parse("DerivedConditional.as",source),source,sha256);
            const semantic = built.adapter.adaptNormalizedParserAst(tree,authority(built.ledger),source,sha256,
                undefined,undefined,undefined,referenceAuthority,sourceMemberAuthority);
            assert.equal(semantic.declaration.members.find(member => member.name === "choose").body[0].expression.resultType.sourceName,"Sprite");
        }
    }
    {
        const adapt = source => built.adapter.adaptNormalizedParserAst(
            built.normalizer.normalizeParserAst(built.parse("AccessorGuard.as", source), source, sha256),
            authority(built.ledger), source, sha256, undefined, undefined, undefined, referenceAuthority, sourceMemberAuthority);
        const readonly = adapt('package p { import flash.display.Sprite; public class AccessorGuard extends Sprite { public function AccessorGuard(){super();} public function get value():Number{return 3;} } }');
        assert.equal(readonly.declaration.inheritedAccessors, undefined, "no setter is invented without an inherited declaration");
        assert.throws(() => adapt('package p { public class AccessorGuard { public function set value(input:Number):void{} public function read():Number{return value;} } }'),
            error => error?.code === "HARDENED_ACCESSOR_WRITE_ONLY");
        const hex = adapt('package p { public class AccessorGuard { public var color:uint=0xff0000; public var limit:Number=0xFFFFFFFF; } }');
        assert.deepEqual(hex.declaration.members.filter(member=>member.kind==="field").map(member=>
            member.initializer.kind==="coercion"?member.initializer.argument.value:member.initializer.value),[16711680,4294967295]);
        assert.throws(() => adapt('package p { public class AccessorGuard { public var wide:Number=0x100000000; } }'),
            error => error?.code === "HARDENED_LITERAL");
    }

    {
        const adapt = (source, authenticated = true) => built.adapter.adaptNormalizedParserAst(
            built.normalizer.normalizeParserAst(built.parse("AssignmentGuard.as", source), source, sha256),
            authority(built.ledger), source, sha256, undefined, undefined, undefined, referenceAuthority,
            authenticated ? sourceMemberAuthority : undefined);
        const source = `package p { public class AssignmentGuard {
            public var stored:int;
            public function assign(value:Number):Number { return (stored = value); }
            public function local(value:Number):Number { var slot:int=0; return (slot = value); }
            public function compound(value:Number):Number { return (stored += value); }
            public function wildcard(value:*):* { return (stored = value); }
        } }`;
        assert.throws(() => adapt('package p { public class AssignmentGuard { public var stored:int; public function assign(value:Number):Number{return(stored=value);} } }', false),
            error => error?.code === "HARDENED_ASSIGNMENT_CONTEXT");
        const semantic = adapt(source);
        const assignment = semantic.declaration.members.find(member => member.name === "assign").body[0].expression.expression;
        assert.equal(assignment.resultType.sourceName, "Number");
        assert.equal(assignment.storageCoercion.targetType.sourceName, "int");
        const code = built.emitter.emitSemanticProgram(semantic,
            {compiler:ts49, expectedTypeScriptVersion:"4.9.5"}).code;
        assert.equal(code, built.emitter.emitSemanticProgram(adapt(source),
            {compiler:ts49, expectedTypeScriptVersion:"4.9.5"}).code);
        const outputPath = path.join(built.output, "AssignmentGuard.generated.js");
        fs.writeFileSync(outputPath, ts49.transpileModule(code.replaceAll("@bleach/as3-runtime/", "./hardened-runtime/"),
            {compilerOptions:{target:ts49.ScriptTarget.ES2020, module:ts49.ModuleKind.CommonJS}}).outputText);
        // Exercise generated method bodies; the native pair separately covers construction.
        const probe = Object.create(require(outputPath).AssignmentGuard.prototype);
        for (const [input, stored] of [[3.75,3],[-1.75,-1],[4294967297,1]]) {
            assert.equal(probe.assign(input), input); assert.equal(probe.stored, stored);
            assert.equal(probe.local(input), input);
            assert.equal(probe.compound(input), stored + input);
        }
        assert.equal(probe.wildcard("7.5"), "7.5"); assert.equal(probe.stored, 7);
        for (const [body, code] of [
            ['public const value:int=0; public function run(input:Number):Number{return(value=input);}', 'HARDENED_ASSIGNMENT_READONLY'],
            ['public function run(input:Number):Number{const value:int=0; return(value=input);}', 'HARDENED_ASSIGNMENT_READONLY'],
            ['public var value:int=0; public var result:Number=(value=3);', 'HARDENED_ASSIGNMENT_CONTEXT'],
        ]) assert.throws(() => adapt(`package p { public class AssignmentGuard { ${body} } }`),
            error => error?.code === code, body);
    }

    {
        const source = 'package p { public class ObjectFixture { public var value:Object; public function run(input:*):void { value = input; var missing:*; } public function make():Object { return {"__proto__":"data", "constructor":"ctor", "stage":1, "stage":2}; } } }';
        const semantic = built.adapter.adaptNormalizedParserAst(
            built.normalizer.normalizeParserAst(built.parse("ObjectFixture.as", source), source, sha256), authority(built.ledger), source, sha256, undefined, undefined, undefined, referenceAuthority, sourceMemberAuthority);
        const assignment = semantic.declaration.members.find(m => m.name === "run").body[0].expression;
        assert.equal(assignment.value.kind, "coercion");
        assert.equal(assignment.value.targetType.sourceName, "Object");
        assert.equal(semantic.declaration.members.find(m => m.name === "run").body[1].declarations[0].initializer.kind, "undefined");
        const literal = semantic.declaration.members.find(m => m.name === "make").body[0].expression;
        assert.deepEqual(literal.properties.map(property => property.name), ["__proto__", "constructor", "stage", "stage"]);
    }
    {
        const adaptObject = body => {
            const source = `package p { public class ObjectConversion { ${body} } }`;
            return built.adapter.adaptNormalizedParserAst(
                built.normalizer.normalizeParserAst(built.parse("ObjectConversion.as", source), source, sha256),
                authority(built.ledger), source, sha256, undefined, undefined, undefined,
                referenceAuthority, sourceMemberAuthority);
        };
        const semantic=adaptObject('public function run(value:*):Object { return Object(value); }');
        const expression=semantic.declaration.members.find(m=>m.name === "run").body[0].expression;
        assert.equal(expression.kind,"coercion"); assert.equal(expression.objectCall,true);
        for (const args of ["", "null, undefined"])
            assert.throws(()=>adaptObject(`public function run():Object { return Object(${args}); }`),
                error=>error?.code === "HARDENED_OBJECT_CONVERSION_ARITY");
    }
    {
        const source = 'package p { import flash.display.Sprite; import flash.display.DisplayObject; public class DirectSubtype extends Sprite { public function DirectSubtype(){super();} public function make():DisplayObject { return new Sprite(); } public function self():DisplayObject { return this; } } }';
        const ast = built.normalizer.normalizeParserAst(built.parse("DirectSubtype.as", source), source, sha256);
        const semantic = built.adapter.adaptNormalizedParserAst(ast, authority(built.ledger), source, sha256,
            undefined, undefined, undefined, referenceAuthority, sourceMemberAuthority);
        const nativeUpcast=semantic.declaration.members.find(m => m.name === "make").body[0].expression;
        assert.equal(nativeUpcast.argument.sourceType.runtimeName,"flash.display.Sprite");
        assert.deepEqual(nativeUpcast.reference,{targetKind:"class",runtimeName:"flash.display.DisplayObject"});
        const invalid = source.replace('public function make():DisplayObject { return new Sprite(); }', 'public function make(value:Object):DisplayObject { return value; }');
        const invalidAst = built.normalizer.normalizeParserAst(built.parse("DirectSubtype.as", invalid), invalid, sha256);
        const narrowed = built.adapter.adaptNormalizedParserAst(invalidAst, authority(built.ledger), invalid, sha256,
            undefined, undefined, undefined, referenceAuthority, sourceMemberAuthority);
        const conversion = narrowed.declaration.members.find(m => m.name === "make").body[0].expression;
        assert.equal(conversion.kind, "coercion");
        assert.deepEqual(conversion.reference, {targetKind:"class", runtimeName:"flash.display.DisplayObject"});
    }
    {
    const inheritedMathSource = "package p { import flash.display.Sprite; public class MathFixture extends Sprite { public function angle():Number { return Math.PI; } } }";
    const inheritedMathAst = built.normalizer.normalizeParserAst(built.parse("MathFixture.as", inheritedMathSource), inheritedMathSource, sha256);
    built.adapter.adaptNormalizedParserAst(inheritedMathAst, authority(built.ledger), inheritedMathSource,
        sha256, undefined, undefined, undefined, referenceAuthority, sourceMemberAuthority);
    const shadowDocument = JSON.parse(sourceMemberJson);
    shadowDocument.entries.find(row => row.qname === "flash.display.Sprite").ownInstanceMemberNames.push("Math");
    shadowDocument.entries.forEach(row => row.ownInstanceMemberNames.sort());
    const shadowJson = JSON.stringify(shadowDocument);
    const shadowAuthority = built.sourceMembers.loadSourceMemberAuthority(shadowJson, sha256(shadowJson), sha256);
    assert.throws(() => built.adapter.adaptNormalizedParserAst(inheritedMathAst, authority(built.ledger), inheritedMathSource,
        sha256, undefined, undefined, undefined, referenceAuthority, shadowAuthority),
        error => error && error.code === "HARDENED_NATIVE_TIMER_MAPPED_BASE_HELD");
    }
    assert.throws(()=>built.sourceMembers.loadSourceMemberAuthority(
        sourceMemberJson,sha256(sourceMemberJson+" "),sha256),
    error=>error&&error.code==="HARDENED_SOURCE_MEMBER_AUTHORITY_PIN");
    const timerSource="package p { import flash.display.Sprite; import flash.utils.setTimeout; public class TimerFixture extends Sprite { public function TimerFixture(){ super(); setTimeout(done,1); } private function done():void {} } }";
    const timerTree=built.parse("fixtures/TimerFixture.as",timerSource);
    const timerNormalized=built.normalizer.normalizeParserAst(timerTree,timerSource,sha256);
    const timerSemantic=built.adapter.adaptNormalizedParserAst(timerNormalized,authority(built.ledger),timerSource,
        sha256,undefined,undefined,undefined,referenceAuthority,sourceMemberAuthority);
    assert.equal(timerSemantic.imports.find(item=>item.sourceQualifiedName==="flash.utils.setTimeout").authorityKind,
        "native-timer-function");
    const shadowDocument=JSON.parse(sourceMemberJson);
    shadowDocument.entries[2].ownInstanceMemberNames.push("setTimeout");
    const shadowJson=JSON.stringify(shadowDocument);
    const shadowAuthority=built.sourceMembers.loadSourceMemberAuthority(shadowJson,sha256(shadowJson),sha256);
    assert.throws(()=>built.adapter.adaptNormalizedParserAst(timerNormalized,authority(built.ledger),timerSource,
        sha256,undefined,undefined,undefined,referenceAuthority,shadowAuthority),
    error=>error&&error.code==="HARDENED_NATIVE_TIMER_MAPPED_BASE_HELD");
    const defaultsSource="package p { public class LocalDefaults { public function run():void { var item:Object; var count:int; var active:Boolean; } } }";
    const defaultsTree=built.parse("fixtures/LocalDefaults.as",defaultsSource);
    const defaultsNormalized=built.normalizer.normalizeParserAst(defaultsTree,defaultsSource,sha256);
    assert.throws(()=>built.adapter.adaptNormalizedParserAst(
        defaultsNormalized,authority(built.ledger),defaultsSource,sha256),
    error=>error&&error.code==="HARDENED_LOCAL_INITIALIZER");
    const defaultsSemantic=built.adapter.adaptNormalizedParserAst(defaultsNormalized,authority(built.ledger),
        defaultsSource,sha256,undefined,undefined,undefined,undefined,sourceMemberAuthority);
    const defaultLocals=defaultsSemantic.declaration.members.find(member=>member.name==="run").body
        .flatMap(statement=>statement.kind==="local"?statement.declarations:[]);
    assert.deepEqual(defaultLocals.map(local=>local.initializer.kind==="coercion"
        ?local.initializer.argument.value:local.initializer.value),[null,0,false]);
    for(const heldDefault of ["const item:Object;"]){
        const heldSource=`package p { public class HeldDefault { public function run():void { ${heldDefault} } } }`;
        const heldTree=built.parse("fixtures/HeldDefault.as",heldSource);
        const heldNormalized=built.normalizer.normalizeParserAst(heldTree,heldSource,sha256);
        assert.throws(()=>built.adapter.adaptNormalizedParserAst(heldNormalized,authority(built.ledger),heldSource,
            sha256,undefined,undefined,undefined,undefined,sourceMemberAuthority),
        error=>error&&["HARDENED_LOCAL_DEFAULT","HARDENED_LOCAL_INITIALIZER"].includes(error.code),heldDefault);
    }
    const staticLambdaSource="package p { public class StaticCapture { public static var ready:Boolean = false; public function run():void { var handler:Function = function():void { ready = true; }; } } }";
    const staticLambdaTree=built.parse("fixtures/StaticCapture.as",staticLambdaSource);
    const staticLambdaNormalized=built.normalizer.normalizeParserAst(staticLambdaTree,staticLambdaSource,sha256);
    const staticLambdaSemantic=built.adapter.adaptNormalizedParserAst(staticLambdaNormalized,
        authority(built.ledger),staticLambdaSource,sha256,undefined,undefined,undefined,undefined,
        sourceMemberAuthority);
    const staticLambdaOutput=built.emitter.emitSemanticProgram(staticLambdaSemantic,
        {compiler:require("typescript-4-9"),expectedTypeScriptVersion:"4.9.5"});
    assert.match(staticLambdaOutput.code,/__as3ClassMemberReceiver\(__as3InitializeClass\(StaticCapture, true\)\)\.ready = true;/);
    const instanceLambdaSource=staticLambdaSource.replace("public static var ready","public var ready");
    const instanceLambdaTree=built.parse("fixtures/InstanceCapture.as",instanceLambdaSource);
    const instanceLambdaNormalized=built.normalizer.normalizeParserAst(instanceLambdaTree,instanceLambdaSource,sha256);
    const instanceLambdaSemantic=built.adapter.adaptNormalizedParserAst(instanceLambdaNormalized,
        authority(built.ledger),instanceLambdaSource,sha256,undefined,undefined,undefined,undefined,
        sourceMemberAuthority);
    const instanceLambdaOutput=built.emitter.emitSemanticProgram(instanceLambdaSemantic,
        {compiler:require("typescript-4-9"),expectedTypeScriptVersion:"4.9.5"});
    assert.match(instanceLambdaOutput.code,/__as3LexicalReceiver1\.ready = true;/);
    assert.match(instanceLambdaOutput.code,/=> function/);
    const explicitThisSource=instanceLambdaSource.replace("ready = true", "this.ready = true");
    const explicitThisNormalized=built.normalizer.normalizeParserAst(
        built.parse("fixtures/ExplicitThis.as",explicitThisSource),explicitThisSource,sha256);
    assert.throws(()=>built.adapter.adaptNormalizedParserAst(explicitThisNormalized,
        authority(built.ledger),explicitThisSource,sha256,undefined,undefined,undefined,undefined,
        sourceMemberAuthority),error=>error&&error.code==="HARDENED_LAMBDA_THIS");
    const methodCaptureSource = "package p { public class MethodCapture { private function complete():void {} public function run():void { var callback:Function=function():void { var inner:Function=function():void { complete(); }; inner(); }; callback(); } } }";
    const methodCaptureAst=built.normalizer.normalizeParserAst(
        built.parse("fixtures/MethodCapture.as",methodCaptureSource),methodCaptureSource,sha256);
    assert.throws(()=>built.adapter.adaptNormalizedParserAst(methodCaptureAst,authority(built.ledger),
        methodCaptureSource,sha256),error=>error&&error.code==="HARDENED_LAMBDA_THIS");
    const methodCaptureSemantic=built.adapter.adaptNormalizedParserAst(methodCaptureAst,authority(built.ledger),
        methodCaptureSource,sha256,undefined,undefined,undefined,undefined,sourceMemberAuthority);
    const methodCaptureOutput=built.emitter.emitSemanticProgram(methodCaptureSemantic,
        {compiler:require("typescript-4-9"),expectedTypeScriptVersion:"4.9.5"});
    assert.match(methodCaptureOutput.code,/__as3LexicalReceiver2\.complete\(\)/);
    assert.match(methodCaptureOutput.code,/\}\)\(__as3LexicalReceiver1\)/);
    for (const heldCaptureSource of [methodCaptureSource.replace("complete();", "this.complete();"),
        methodCaptureSource.replace("complete();", "var saved:Function=complete;"),
        methodCaptureSource.replace("public function run", "public static function run")]) {
        const heldCaptureAst=built.normalizer.normalizeParserAst(
            built.parse("fixtures/HeldMethodCapture.as",heldCaptureSource),heldCaptureSource,sha256);
        assert.throws(()=>built.adapter.adaptNormalizedParserAst(heldCaptureAst,authority(built.ledger),
            heldCaptureSource,sha256,undefined,undefined,undefined,undefined,sourceMemberAuthority),
            error=>error&&error.code==="HARDENED_LAMBDA_THIS");
    }
    const wildcardCatchSource="package p { public class CatchValue { public function run(value:*):* { try { throw value; } catch(caught:*) { return caught; } return null; } } }";
    const wildcardCatchAst=built.normalizer.normalizeParserAst(
        built.parse("fixtures/CatchValue.as",wildcardCatchSource),wildcardCatchSource,sha256);
    const wildcardCatchSemantic=built.adapter.adaptNormalizedParserAst(wildcardCatchAst,authority(built.ledger),
        wildcardCatchSource,sha256,undefined,undefined,undefined,undefined,sourceMemberAuthority);
    const wildcardCatchOutput=built.emitter.emitSemanticProgram(wildcardCatchSemantic,
        {compiler:require("typescript-4-9"),expectedTypeScriptVersion:"4.9.5"});
    assert.match(wildcardCatchOutput.code,/const caught: unknown = __as3Caught/);
    assert.doesNotMatch(wildcardCatchOutput.code,/instanceof unknown/);
    const typedCatchSource=wildcardCatchSource.replace("caught:*", "caught:Error");
    const typedCatchAst=built.normalizer.normalizeParserAst(
        built.parse("fixtures/TypedCatchValue.as",typedCatchSource),typedCatchSource,sha256);
    const typedCatchSemantic=built.adapter.adaptNormalizedParserAst(typedCatchAst,authority(built.ledger),
        typedCatchSource,sha256,undefined,undefined,undefined,undefined,sourceMemberAuthority);
    assert.match(built.emitter.emitSemanticProgram(typedCatchSemantic,
        {compiler:require("typescript-4-9"),expectedTypeScriptVersion:"4.9.5"}).code,/instanceof Error/);
    const fallingMethodSource="package p { public class FallingReturn { public function clear():* {} } }";
    const fallingMethodAst=built.normalizer.normalizeParserAst(
        built.parse("fixtures/FallingReturn.as",fallingMethodSource),fallingMethodSource,sha256);
    const fallingMethodSemantic=built.adapter.adaptNormalizedParserAst(fallingMethodAst,authority(built.ledger),
        fallingMethodSource,sha256,undefined,undefined,undefined,undefined,sourceMemberAuthority);
    assert.match(built.emitter.emitSemanticProgram(fallingMethodSemantic,
        {compiler:require("typescript-4-9"),expectedTypeScriptVersion:"4.9.5"}).code,/return void 0;/);
    const fallingNumberSource=fallingMethodSource.replace(":*",":Number");
    const fallingNumberAst=built.normalizer.normalizeParserAst(
        built.parse("fixtures/FallingNumber.as",fallingNumberSource),fallingNumberSource,sha256);
    assert.throws(()=>built.adapter.adaptNormalizedParserAst(fallingNumberAst,authority(built.ledger),
        fallingNumberSource,sha256,undefined,undefined,undefined,undefined,sourceMemberAuthority),
        error=>error&&error.code==="HARDENED_RETURN_PATH");
    const numericFieldSortSource='package p { public class FieldSort { public function run(values:Array):void { values.sortOn("priority",18); } } }';
    const numericFieldSortAst=built.normalizer.normalizeParserAst(
        built.parse("fixtures/FieldSort.as",numericFieldSortSource),numericFieldSortSource,sha256);
    const numericFieldSortSemantic=built.adapter.adaptNormalizedParserAst(numericFieldSortAst,authority(built.ledger),
        numericFieldSortSource,sha256,undefined,undefined,undefined,undefined,sourceMemberAuthority);
    assert.match(built.emitter.emitSemanticProgram(numericFieldSortSemantic,
        {compiler:require("typescript-4-9"),expectedTypeScriptVersion:"4.9.5"}).code,/__as3ArrayCall\(values, "sortOn", \["priority", 18\]\)/);
    for(const heldFieldSort of [numericFieldSortSource.replace(',18',',8'),
        numericFieldSortSource.replace('"priority",18','["priority"],18'),
        numericFieldSortSource.replace('"priority",18','"priority"')]) {
        const ast=built.normalizer.normalizeParserAst(built.parse("fixtures/HeldFieldSort.as",heldFieldSort),heldFieldSort,sha256);
        assert.throws(()=>built.adapter.adaptNormalizedParserAst(ast,authority(built.ledger),heldFieldSort,
            sha256,undefined,undefined,undefined,undefined,sourceMemberAuthority),error=>error&&error.code==="HARDENED_ARRAY_SORT_ON");
    }
    const conditionSource="package p { public class TruthyCondition { public function run(item:Object):void { if (item) { return; } } } }";
    const conditionTree=built.parse("fixtures/TruthyCondition.as",conditionSource);
    const conditionNormalized=built.normalizer.normalizeParserAst(conditionTree,conditionSource,sha256);
    assert.throws(()=>built.adapter.adaptNormalizedParserAst(conditionNormalized,authority(built.ledger),
        conditionSource,sha256),error=>error&&error.code==="HARDENED_IF_BOOLEAN");
    const conditionSemantic=built.adapter.adaptNormalizedParserAst(conditionNormalized,authority(built.ledger),
        conditionSource,sha256,undefined,undefined,undefined,undefined,sourceMemberAuthority);
    const booleanContextSource = 'package p { public class BooleanContext { public function negate(value:Object):Boolean { return !value; } public function loop(value:Number):void { for (;value;) { break; } } } }';
    const booleanContextAst = built.normalizer.normalizeParserAst(built.parse("BooleanContext.as", booleanContextSource), booleanContextSource, sha256);
    assert.throws(() => built.adapter.adaptNormalizedParserAst(booleanContextAst, authority(built.ledger), booleanContextSource, sha256),
        error => error && error.code === "HARDENED_UNARY_BOOLEAN");
    const booleanContext = built.adapter.adaptNormalizedParserAst(booleanContextAst, authority(built.ledger), booleanContextSource,
        sha256, undefined, undefined, undefined, undefined, sourceMemberAuthority);
    const negation = booleanContext.declaration.members.find(member => member.name === "negate").body[0].expression;
    assert.equal(negation.operand.kind, "coercion");
    assert.equal(negation.resultType.sourceName, "Boolean");
    assert.equal(negation.resultType.nullable, false);
    assert.equal(booleanContext.declaration.members.find(member => member.name === "loop").body[0].condition.kind, "coercion");
    const equalitySource = 'package p { public class Equality { public function same(a:Equality,b:Equality):Boolean { return a == b; } public function numbers(a:int,b:Number):Boolean { return a != b; } } }';
    const equalityAst = built.normalizer.normalizeParserAst(built.parse("Equality.as", equalitySource), equalitySource, sha256);
    built.adapter.adaptNormalizedParserAst(equalityAst, authority(built.ledger), equalitySource, sha256,
        undefined, undefined, undefined, undefined, sourceMemberAuthority);
    const defaultConstruction = 'package p { public class DefaultConstruction { public function create():DefaultConstruction { return new DefaultConstruction(); } } }';
    const defaultConstructionAst = built.normalizer.normalizeParserAst(built.parse("DefaultConstruction.as", defaultConstruction), defaultConstruction, sha256);
    built.adapter.adaptNormalizedParserAst(defaultConstructionAst, authority(built.ledger), defaultConstruction, sha256,
        undefined, undefined, undefined, undefined, sourceMemberAuthority);
    const badDefaultConstruction = defaultConstruction.replace('new DefaultConstruction()', 'new DefaultConstruction(1)');
    const badDefaultAst = built.normalizer.normalizeParserAst(built.parse("DefaultConstruction.as", badDefaultConstruction), badDefaultConstruction, sha256);
    assert.throws(() => built.adapter.adaptNormalizedParserAst(badDefaultAst, authority(built.ledger), badDefaultConstruction, sha256,
        undefined, undefined, undefined, undefined, sourceMemberAuthority), error => error?.code === "HARDENED_NEW_LOCAL_ARITY");
    const derivedDefault = defaultConstruction.replace('package p { public class DefaultConstruction',
        'package p { import flash.display.Sprite; public class DefaultConstruction extends Sprite');
    const derivedDefaultAst = built.normalizer.normalizeParserAst(built.parse("DerivedDefault.as",derivedDefault),derivedDefault,sha256);
    built.adapter.adaptNormalizedParserAst(derivedDefaultAst,authority(built.ledger),derivedDefault,sha256,
        undefined,undefined,undefined,referenceAuthority,sourceMemberAuthority);
    const badDerivedDefault = derivedDefault.replace('new DefaultConstruction()','new DefaultConstruction(1)');
    const badDerivedAst = built.normalizer.normalizeParserAst(built.parse("BadDerivedDefault.as",badDerivedDefault),badDerivedDefault,sha256);
    assert.throws(()=>built.adapter.adaptNormalizedParserAst(badDerivedAst,authority(built.ledger),badDerivedDefault,sha256,
        undefined,undefined,undefined,referenceAuthority,sourceMemberAuthority),error=>error?.code==="HARDENED_NEW_LOCAL_ARITY");
    for (const [left, right] of [["Object", "Object"], ["*", "*"], ["String", "Number"], ["Object", "NativeEquality"]]) {
        const equalitySource = `package p { public class NativeEquality {
            public function same(a:${left},b:${right}):Boolean { return a == b; }
            public function different(a:${left},b:${right}):Boolean { return a != b; }
        } }`;
        const equalityAst = built.normalizer.normalizeParserAst(built.parse("NativeEquality.as", equalitySource), equalitySource, sha256);
        const equality = built.adapter.adaptNormalizedParserAst(equalityAst, authority(built.ledger), equalitySource, sha256,
            undefined, undefined, undefined, undefined, sourceMemberAuthority);
        for (const member of equality.declaration.members) assert.equal(member.body[0].expression.equalityCoercion,true);
        const emitted = built.emitter.emitSemanticProgram(equality,{compiler:require("typescript-4-9"),expectedTypeScriptVersion:"4.9.5"}).code;
        assert.match(emitted,/return __as3Equals\(a, b\);/);
        assert.match(emitted,/return !__as3Equals\(a, b\);/);
        if (left === "String") assert.throws(() => built.adapter.adaptNormalizedParserAst(
            equalityAst,authority(built.ledger),equalitySource,sha256),error => error?.code === "HARDENED_BINARY_COERCION");
    }
    const conditionOutput=built.emitter.emitSemanticProgram(conditionSemantic,
        {compiler:require("typescript-4-9"),expectedTypeScriptVersion:"4.9.5"});
    assert.match(conditionOutput.code,/if \(__as3Boolean\(item\)\)/);
    const arraySource="package p { public class ArrayLiteral { private var values:Array = []; } }";
    const arrayTree=built.parse("fixtures/ArrayLiteral.as",arraySource);
    const arrayNormalized=built.normalizer.normalizeParserAst(arrayTree,arraySource,sha256);
    assert.throws(()=>built.adapter.adaptNormalizedParserAst(arrayNormalized,authority(built.ledger),
        arraySource,sha256),error=>error&&error.code==="HARDENED_ASSIGNMENT_TYPE");
    const arraySemantic=built.adapter.adaptNormalizedParserAst(arrayNormalized,authority(built.ledger),
        arraySource,sha256,undefined,undefined,undefined,undefined,sourceMemberAuthority);
    const arrayOutput=built.emitter.emitSemanticProgram(arraySemantic,
        {compiler:require("typescript-4-9"),expectedTypeScriptVersion:"4.9.5"});
    assert.match(arrayOutput.code,/private values: unknown\[\] \| null;/);
    assert.match(arrayOutput.code,/this\.values = __as3ArrayLiteral\(\[\]\);/);
    const shadowArraySource="package p { public class Array { public function Array() {} public function make():* { return new Array(); } } }";
    const shadowArrayAst=built.normalizer.normalizeParserAst(built.parse("fixtures/Array.as",shadowArraySource),shadowArraySource,sha256);
    const shadowArrayProgram=built.adapter.adaptNormalizedParserAst(shadowArrayAst,authority(built.ledger),
        shadowArraySource,sha256,undefined,undefined,undefined,undefined,sourceMemberAuthority);
    const shadowArrayCode=built.emitter.emitSemanticProgram(shadowArrayProgram,
        {compiler:require("typescript-4-9"),expectedTypeScriptVersion:"4.9.5"}).code;
    assert.doesNotMatch(shadowArrayCode,/__as3NewArray/);
    assert.match(shadowArrayCode,/return new \(__as3InitializeClass\(Array, true\)\)/);
    const typeofSource="package p { public class TypeofCheck { public function run(item:Object):void { if (typeof item !== \"object\") { return; } } } }";
    const typeofTree=built.parse("fixtures/TypeofCheck.as",typeofSource);
    const typeofNormalized=built.normalizer.normalizeParserAst(typeofTree,typeofSource,sha256);
    assert.ok(typeofNormalized.nodes.some(node=>node.kind==="TYPEOF"));
    assert.throws(()=>built.adapter.adaptNormalizedParserAst(typeofNormalized,authority(built.ledger),
        typeofSource,sha256),error=>error&&error.code==="HARDENED_TYPEOF_PROFILE");
    const typeofSemantic=built.adapter.adaptNormalizedParserAst(typeofNormalized,authority(built.ledger),
        typeofSource,sha256,undefined,undefined,undefined,undefined,sourceMemberAuthority);
    const typeofOutput=built.emitter.emitSemanticProgram(typeofSemantic,
        {compiler:require("typescript-4-9"),expectedTypeScriptVersion:"4.9.5"});
    assert.match(typeofOutput.code,/typeof item !== "object"/);
    for (const operator of ["==", "!=", "===", "!=="]) {
        for (const expression of [`typeof item ${operator} "object"`,
            `item != null && typeof item ${operator} "object"`]) {
            const source = `package p { public class TypeofCheck { public function run(item:Object):Boolean { return ${expression}; } } }`;
            const normalized = built.normalizer.normalizeParserAst(built.parse("TypeofCheck.as", source), source, sha256);
            const semantic = built.adapter.adaptNormalizedParserAst(normalized, authority(built.ledger),
                source, sha256, undefined, undefined, undefined, undefined, sourceMemberAuthority);
            const code = built.emitter.emitSemanticProgram(semantic,
                {compiler:require("typescript-4-9"),expectedTypeScriptVersion:"4.9.5"}).code;
            assert.ok(code.includes(`typeof item ${operator} "object"`), code);
            assert.doesNotMatch(code, /typeof __as3Equals/);
        }
    }
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
        const normalizedMetadata = built.normalizer.normalizeParserAst(tree, unsupported, sha256);
        assert.ok(normalizedMetadata.nodes.some(node => node.kind === "META"));
        assert.throws(() => built.adapter.adaptNormalizedParserAst(
            normalizedMetadata, authority(built.ledger), unsupported, sha256),
            error => error && error.name === "HardenedSemanticError",
            "unimplemented class metadata remains a semantic hold");
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
