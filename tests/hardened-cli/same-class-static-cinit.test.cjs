"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript-4-9");

const ROOT = path.resolve(__dirname, "../..");
const EVIDENCE_REVISION = "e04a2f051c188df8fc9396ff7c0b15f481062f7b";
const sha256 = value => crypto.createHash("sha256").update(value).digest("hex");
const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(",")}]`
    : value !== null && typeof value === "object"
        ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`
        : JSON.stringify(value);

function compileApi() {
    const output = fs.mkdtempSync(path.join(os.tmpdir(), "same-class-cinit-api-"));
    const config = {
        compilerOptions: { target:"ES2022", module:"Node16", moduleResolution:"Node16",
            rootDir:path.join(ROOT,"src"), outDir:output, esModuleInterop:true, noImplicitAny:true,
            strictNullChecks:false, strictPropertyInitialization:false, useUnknownInCatchVariables:false,
            skipLibCheck:true, noEmitOnError:true },
        files: ["src/parse/index.ts", "src/hardened/parser-normalizer.ts", "src/hardened/adapter.ts",
            "src/hardened/emitter.ts", "src/hardened/type-authority.ts", "src/hardened/local-declarations.ts",
            "src/hardened/local-types.ts", "src/hardened/local-members.ts", "src/hardened/ledger.ts"]
            .map(name => path.join(ROOT, name)),
    };
    const configPath = path.join(output, "tsconfig.json");
    fs.writeFileSync(configPath, JSON.stringify(config));
    childProcess.execFileSync(process.execPath,
        [path.join(ROOT, "node_modules/typescript/bin/tsc"), "-p", configPath], {cwd:ROOT,stdio:"pipe"});
    process.env.NODE_PATH=path.join(ROOT,"node_modules");require("node:module").Module._initPaths();
    return {
        output,
        parse:require(path.join(output,"parse/index.js")).default,
        normalizer:require(path.join(output,"hardened/parser-normalizer.js")),
        adapter:require(path.join(output,"hardened/adapter.js")),
        emitter:require(path.join(output,"hardened/emitter.js")),
        declarations:require(path.join(output,"hardened/local-declarations.js")),
        localTypes:require(path.join(output,"hardened/local-types.js")),
        localMembers:require(path.join(output,"hardened/local-members.js")),
        ledger:require(path.join(output,"hardened/ledger.js")),
        typeAuthority:require(path.join(output,"hardened/type-authority.js")),
    };
}

const api = compileApi();
test.after(() => fs.rmSync(api.output,{recursive:true,force:true}));

function emptyCapabilityAuthority() {
    const source = JSON.stringify({as3SourceCapabilities:{apis:[],memberUses:[]}});
    const target = JSON.stringify({schema:"laya-authored-content-capabilities@1",capabilities:[]});
    const mapping = api.ledger.canonicalMappingJson({schema:"as3-source-to-laya-capability-map@1",mappings:[]});
    const timer = fs.readFileSync(path.join(ROOT,"config/native-timer-authority.json"),"utf8").replace(/\r\n?/g,"\n");
    return api.ledger.loadCapabilityAuthority({applicationProfile:true,sourceCensusJson:source,sourceCensusSha256:sha256(source),
        targetCapabilitiesJson:target,targetCapabilitiesSha256:sha256(target),mappingJson:mapping,
        mappingSha256:sha256(mapping),nativeTimerAuthorityJson:timer,nativeTimerAuthoritySha256:sha256(timer)},sha256);
}

function normalized(source, name="Demo") {
    return api.normalizer.normalizeParserAst(api.parse(`fixtures/${name}.as`,source),source,sha256);
}

function authorityFor(source, name="Demo", declarationOverride) {
    const ast=normalized(source,name), extract=api.declarations.extractLocalDeclaration(ast,source,sha256,
        `game-client/tapplication_main/src/p/${name}.as`);
    const graphRaw="a".repeat(64),graphSemantic="b".repeat(64),manifest="c".repeat(64),nodeId="0000000000000001";
    const typeDocument={dependencyGraphRawSha256:graphRaw,dependencyGraphSemanticSha256:graphSemantic,entries:[{
        componentId:"scc-00001",graphSourceSha256:"d".repeat(64),importable:true,module:"application",nodeId,
        prerequisites:[],qname:`p.${name}`,sourceContentSha256:sha256(source),
        sourcePath:`game-client/tapplication_main/src/p/${name}.as`,
        targetPath:`game-client/layaair/src/application/p/${name}.ts`,topologicalLevel:0,typeKind:"class",
    }],entryCount:1,schema:"bleach-local-as3-type-map@2",sourceManifestSha256:manifest};
    const typeJson=`${canonical(typeDocument)}\n`;
    const types=api.localTypes.loadLocalTypeAuthority({json:typeJson,sha256:sha256(typeJson),expectedEntryCount:1,
        expectedDependencyGraphRawSha256:graphRaw,expectedDependencyGraphSemanticSha256:graphSemantic,
        expectedSourceManifestSha256:manifest},sha256);
    const declaration=declarationOverride || {baseQNames:[],interfaceQNames:[],members:extract.members,
        packageInitializer:null,...(extract.classInitializer?{classInitializer:{...extract.classInitializer,
            ownerQName:`p.${name}`,ownerName:undefined}}:{})};
    if(declaration.classInitializer)delete declaration.classInitializer.ownerName;
    const worker="e".repeat(64),census="f".repeat(64);
    const memberDocument={completeCount:1,declarationWorkerSha256:worker,entries:[{declaration,holdCode:null,
        holdSha256:null,module:"application",nodeId,qname:`p.${name}`,sourceContentSha256:sha256(source),
        status:"complete",typeKind:"class"}],entryCount:1,heldCount:0,
        localTypeMapSha256:sha256(typeJson),schema:"bleach-local-as3-member-map@2",sourceCensusSha256:census};
    const memberJson=`${canonical(memberDocument)}\n`;
    const members=api.localMembers.loadLocalMemberAuthority({json:memberJson,sha256:sha256(memberJson),
        expectedEntryCount:1,expectedCompleteCount:1,expectedHeldCount:0,
        expectedLocalTypeMapSha256:sha256(typeJson),expectedDeclarationWorkerSha256:worker,
        expectedSourceCensusSha256:census},sha256,types);
    return {ast,extract,types,members,declaration,memberDocument};
}

function adapt(source,name="Demo",override) {
    const local=authorityFor(source,name,override);
    return {local,program:api.adapter.adaptNormalizedParserAst(local.ast,emptyCapabilityAuthority(),source,sha256,
        local.types,`p/${name}.as`,local.members)};
}

const DEMO = `package p {
 public class Demo {
  public static var count:int = 0;
  public static var before:Object = {marker:7};
  Demo.initialize();
  public static function initialize():void { count = 1; }
  public static function observe():int { return count; }
 }
}`;

test("parser and declaration IR retain only the exact same-class zero-arg form",()=>{
    const local=authorityFor(DEMO);
    assert.equal(local.ast.nodes.filter(node=>node.kind==="CALL"&&node.span
        &&DEMO.slice(node.span.start,node.span.end)==="Demo.initialize()").length,1,
        "parser must retain the one class-body CALL node");
    assert.deepEqual(local.extract.classInitializer,{kind:"same-class-static-void-call",ownerName:"Demo",
        methodName:"initialize",argumentCount:0});
    for(const [replacement,code] of [
        ["Other.initialize();","HARDENED_CLASS_INITIALIZER_SHAPE"],
        ["Demo[\"initialize\"]();","HARDENED_CLASS_INITIALIZER_SHAPE"],
        ["Demo.initialize(1);","HARDENED_CLASS_INITIALIZER_SHAPE"],
        ["initialize();","HARDENED_CLASS_INITIALIZER_SHAPE"],
        ["Demo.initialize() ? 1 : 0;","HARDENED_LOCAL_DECLARATION_MEMBER"],
        ["Demo.initialize(); public static var after:int = 1;","HARDENED_CLASS_INITIALIZER_ORDER"],
    ]) {
        const source=DEMO.replace("Demo.initialize();",replacement);
        assert.throws(()=>api.declarations.extractLocalDeclaration(normalized(source),source,sha256),
            error=>error.code===code,`${replacement} must fail with ${code}`);
    }
    assert.throws(()=>api.parse("fixtures/Demo.as",DEMO.replace("Demo.initialize();","public Demo.initialize();")),
        error=>error.code==="AS3_PARSE_UNEXPECTED_TOKEN");
});

test("signature and local-member authority fail closed",()=>{
    for(const declaration of [
        "public function initialize():void {}",
        "public static function initialize(required:int):void {}",
        "public static function initialize():int { return 0; }",
    ]) {
        const source=DEMO.replace("public static function initialize():void { count = 1; }",declaration);
        assert.throws(()=>api.declarations.extractLocalDeclaration(normalized(source),source,sha256),
            error=>error.code==="HARDENED_CLASS_INITIALIZER_SIGNATURE");
    }
    const base=authorityFor(DEMO).declaration;
    for(const mutate of [
        value=>{value.classInitializer.ownerQName="p.Other";},
        value=>{value.classInitializer.methodName="observe";},
        value=>{value.classInitializer.extra=true;},
        value=>{value.members.find(item=>item.name==="initialize").modifiers=["public"];},
    ]) {
        const declaration=structuredClone(base);mutate(declaration);
        assert.throws(()=>authorityFor(DEMO,"Demo",declaration),
            error=>error.code==="HARDENED_LOCAL_MEMBER_CLASS_INITIALIZER");
    }
    const missing=structuredClone(base);delete missing.classInitializer;
    assert.throws(()=>adapt(DEMO,"Demo",missing),error=>error.code==="HARDENED_CLASS_INITIALIZER_AUTHORITY");
    const withoutCall=DEMO.replace("  Demo.initialize();\n","");
    assert.throws(()=>adapt(withoutCall,"Demo",base),error=>error.code==="HARDENED_CLASS_INITIALIZER_AUTHORITY");
});

test("semantic IR and emitted deferred callback bind exact owner, evidence, and order",()=>{
    const {program}=adapt(DEMO);
    assert.deepEqual(program.declaration.classInitializer,{sourceNodeId:program.declaration.classInitializer.sourceNodeId,
        sourceSpan:program.declaration.classInitializer.sourceSpan,kind:"sameClassStaticVoidCall",ownerName:"Demo",
        ownerQualifiedName:"p.Demo",methodName:"initialize",argumentCount:0,evidenceRevision:EVIDENCE_REVISION});
    const emitted=api.emitter.emitSemanticProgram(program,{compiler:ts,expectedTypeScriptVersion:"4.9.5"});
    const field=emitted.code.indexOf('__as3InitializeStaticField(Demo, __as3ConstructionProof, "before"');
    const call=emitted.code.indexOf("Demo.initialize();",field);
    assert(field>=0&&call>field,"cinit call must follow deferred field writes");
    assert.equal((emitted.code.match(/Demo\.initialize\(\);/g)||[]).length,1);
    assert.match(emitted.code,/static initialize\(\): void \{\s*__as3InitializeClass\(Demo, true\);/,
        "the static method must perform lexical-self lookup without recursively restarting cinit");
    const forged={...program,declaration:{...program.declaration,classInitializer:{...program.declaration.classInitializer,
        methodName:"observe"}}};
    assert.throws(()=>api.emitter.emitSemanticProgram(forged,{compiler:ts,expectedTypeScriptVersion:"4.9.5"}),
        error=>error.code==="HARDENED_SEMANTIC_IR_INSTANCE");
    api.typeAuthority.assertLocalRuntimeDefinitionClosure([program],ts);
    assert.equal(api.typeAuthority.localRuntimeTypeAuthoritySource(program,"../p/Demo").definitionSafe,true);
    const driftCompiler={...ts,createPrinter(options){const printer=ts.createPrinter(options);return {...printer,
        printFile(file){return printer.printFile(file).replace("Demo.initialize();","Demo.observe();");}};}};
    assert.throws(()=>api.typeAuthority.assertLocalRuntimeDefinitionClosure([program],driftCompiler),
        error=>error.code==="HARDENED_TYPE_AUTHORITY_STATIC_INIT");
});

test("generated TypeScript preserves deferred, once, retry, and lexical-self behavior",t=>{
    const retrySource=DEMO.replaceAll("Demo","Retry").replace("marker:7","marker:11");
    const demo=adapt(DEMO).program,retry=adapt(retrySource,"Retry").program;
    const demoCode=api.emitter.emitSemanticProgram(demo,{compiler:ts,expectedTypeScriptVersion:"4.9.5"}).code;
    const retryCode=api.emitter.emitSemanticProgram(retry,{compiler:ts,expectedTypeScriptVersion:"4.9.5"}).code;
    api.typeAuthority.assertLocalRuntimeDefinitionClosure([demo,retry],ts);
    const sources=[api.typeAuthority.localRuntimeTypeAuthoritySource(demo,"../p/Demo"),
        api.typeAuthority.localRuntimeTypeAuthoritySource(retry,"../p/Retry")];
    const authority=api.typeAuthority.emitRuntimeTypeAuthority(sources,sha256);
    const output=fs.mkdtempSync(path.join(os.tmpdir(),"same-class-cinit-runtime-"));
    t.after(()=>fs.rmSync(output,{recursive:true,force:true}));
    fs.cpSync(path.join(ROOT,"src/hardened-runtime"),path.join(output,"runtime"),{recursive:true});
    fs.mkdirSync(path.join(output,"p"));
    fs.writeFileSync(path.join(output,"p/Demo.ts"),demoCode);fs.writeFileSync(path.join(output,"p/Retry.ts"),retryCode);
    fs.writeFileSync(path.join(output,"runtime/AS3Authority.generated.ts"),authority.code);
    fs.writeFileSync(path.join(output,"tsconfig.json"),JSON.stringify({compilerOptions:{target:"ES2022",module:"CommonJS",
        moduleResolution:"Node",strict:true,skipLibCheck:true,baseUrl:".",paths:{"@bleach/as3-runtime/*":["runtime/*"]},outDir:"js"},
        files:["runtime/AS3Authority.generated.ts","p/Demo.ts","p/Retry.ts"]}));
    childProcess.execFileSync(process.execPath,[path.join(ROOT,"node_modules/typescript-4-9/bin/tsc"),"-p",path.join(output,"tsconfig.json")],
        {cwd:output,stdio:"pipe"});
    const packageDir=path.join(output,"js/node_modules/@bleach");fs.mkdirSync(packageDir,{recursive:true});
    fs.symlinkSync(path.join(output,"js/runtime"),path.join(packageDir,"as3-runtime"),"dir");
    require(path.join(output,"js/runtime/AS3Authority.generated.js"));
    const {Demo}=require(path.join(output,"js/p/Demo.js"));
    assert.equal(Object.getOwnPropertyDescriptor(Demo,"before").value,null,
        "module evaluation must not run the deferred field initializer");
    assert.equal(Demo.observe(),1);assert.equal(Demo.observe(),1);assert.equal(Demo.count,1);assert.deepEqual(Demo.before,{marker:7});
    const {Retry}=require(path.join(output,"js/p/Retry.js"));
    const original=Retry.initialize;let attempts=0;
    Retry.initialize=function(){attempts+=1;if(attempts===1)throw new Error("retry-first");return original.call(this);};
    assert.throws(()=>Retry.observe(),/retry-first/);assert.equal(Retry.observe(),1);assert.equal(attempts,2);
    assert.equal(Retry.count,1);assert.deepEqual(Retry.before,{marker:11});
});
