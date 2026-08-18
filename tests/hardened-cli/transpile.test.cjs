"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repository = path.resolve(__dirname, "../..");
const executable = path.join(repository, "bin", "as3-frontend");
const sourceCensus = process.env.HARDENED_SOURCE_CAPABILITY_CENSUS
    || "C:/Users/admin/Desktop/GITHUB REPO/bleach-services/as3-to-layaair-porting-kit/generated/reports/swf-capability-census.json";
const targetCapabilities = process.env.HARDENED_TARGET_CAPABILITIES
    || "C:/Users/admin/Desktop/GITHUB REPO/LayaAir/docTool/architecture/authored-content-capabilities.json";
const layaRoot = process.env.HARDENED_TARGET_REPO
    || "C:/Users/admin/Desktop/GITHUB REPO/LayaAir";
const sourceRepository = process.env.HARDENED_SOURCE_REPO
    || "C:/Users/admin/Desktop/GITHUB REPO/bleach-services";

function temporaryDirectory(t) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "as3-transpile-test-"));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    return directory;
}

function write(directory, relativePath, content) {
    const target = path.join(directory, ...relativePath.split("/"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, "utf8");
}

function invoke(source, output, cwd) {
    return spawnSync(process.execPath, [executable, "transpile", source, output,
        "--source-census", sourceCensus, "--target-capabilities", targetCapabilities], {
        cwd,
        encoding: "utf8",
        timeout: 20_000,
        windowsHide: true,
    });
}

function qualify(source, output, cwd) {
    return spawnSync(process.execPath, [executable, "qualify", source, output,
        "--source-census", sourceCensus, "--target-capabilities", targetCapabilities], {
        cwd,
        encoding: "utf8",
        timeout: 30_000,
        windowsHide: true,
    });
}

const admittedSource = [
    "package lobby.ui {",
    "    import flash.display.Sprite;",
    "    import flash.events.Event;",
    "    public class Demo extends Sprite {",
    "        private var label:String = \"ok\";",
    "        private var child:Sprite = new Sprite();",
    "        private var _value:Number = 1;",
    "        public function get value():Number { if (_value > 0) { return _value; } else { return 0; } }",
    "        public function set value(input:Number):void { _value = input; }",
    "        public function Demo() { super(); addEventListener(\"ready\", onEvent); }",
    "        public function onEvent(event:Event):void { var total:Number = 1 + 2; var active:Boolean = !(total === 0); var chosen:Number = active ? total : 0; var reduced:Number = total - 1; while (total > 0) { total--; if (total === 1) { continue; } break; } label = \"changed\"; return; }",
    "    }",
    "}",
    "",
].join("\n");

test("transpiles the double-pinned structural subset deterministically", t => {
    const root = temporaryDirectory(t);
    const source = path.join(root, "source");
    const first = path.join(root, "first");
    const second = path.join(root, "second");
    fs.mkdirSync(source);
    write(source, "Demo.as", admittedSource);
    const firstRun = invoke(source, first, root);
    const secondRun = invoke(source, second, os.tmpdir());
    assert.equal(firstRun.status, 0, firstRun.stderr);
    assert.equal(secondRun.status, 0, secondRun.stderr);
    const modulePath = path.join("__as3_runtime", "application", "lobby", "ui", "Demo.ts");
    const firstCode = fs.readFileSync(path.join(first, modulePath), "utf8");
    const secondCode = fs.readFileSync(path.join(second, modulePath), "utf8");
    assert.equal(firstCode, secondCode);
    assert.match(firstCode, /import \{ Sprite \} from "laya\/flash\/display\/Sprite";/);
    assert.match(firstCode, /export class Demo extends Sprite/);
    assert.match(firstCode, /const __as3ClassInstances: WeakSet<object> = new WeakSet\(\), __as3ConstructionTargets:/);
    assert.match(firstCode, /export function isAS3ClassInstance\(value: unknown\): value is Demo/);
    assert.doesNotMatch(firstCode, /#__as3NativeClassBrand/);
    assert.match(firstCode, /constructor\(\) \{\n\s+if \(arguments\.length !== 0\)[\s\S]*__as3RejectConstructorArity\("Demo", 0, 0\);[\s\S]*try \{/);
    assert.match(firstCode, /__as3InitializeInstanceFields\(this, new\.target\);[\s\S]*this\.onEvent = __as3BindMethod\(this, this\.onEvent\);[\s\S]*this\.addEventListener\("ready", this\.onEvent\);/);
    assert.match(firstCode, /import \{ as3BindMethod as __as3BindMethod \} from "@bleach\/as3-runtime\/AS3MethodClosure";/);
    assert.doesNotMatch(firstCode, /\.bind\(this\)/);
    assert.match(firstCode, /this\.label = "changed";/);
    assert.match(firstCode, /private child: Sprite \| null;/);
    assert.match(firstCode, /private label: string \| null;/);
    assert.match(firstCode, /this\.child = new Sprite\(\);/);
    assert.match(firstCode, /this\.label = "ok";/);
    assert.match(firstCode, /public get value\(\): number/);
    assert.match(firstCode, /if \(this\._value > 0\)/);
    assert.match(firstCode, /public set value\(input: number\)/);
    assert.match(firstCode, /var total: number = 1 \+ 2;/);
    assert.match(firstCode, /var active: boolean = !\(total === 0\);/);
    assert.match(firstCode, /var chosen: number = active \? total : 0;/);
    assert.match(firstCode, /var reduced: number = total - 1;/);
    assert.match(firstCode, /while \(total > 0\)/);
    assert.match(firstCode, /total--;/);
    assert.match(firstCode, /continue;/);
    assert.match(firstCode, /break;/);
    const manifest = JSON.parse(fs.readFileSync(path.join(first, "manifest.json"), "utf8"));
    assert.equal(manifest.schema, "bleach.as3.transpile-manifest.v1");
    assert.match(manifest.parserWorkerSha256, /^[0-9a-f]{64}$/);
    assert.equal(manifest.typeScriptVersion, "4.9.5");
    assert.equal(manifest.classification, "capability-authenticated-typescript-proposal");
    assert.equal(manifest.runtimeAuthorityPath, "__as3_runtime/AS3Authority.generated.js");
    assert.equal(manifest.applicationEntryPath, "__as3_runtime/ApplicationEntry.generated.ts");
    assert.match(manifest.runtimeAuthoritySha256, /^[0-9a-f]{64}$/);
    assert.match(manifest.applicationEntrySha256, /^[0-9a-f]{64}$/);
    assert.ok(manifest.runtimeAuthorityQNames.includes("flash.events.Event"));
    assert.ok(manifest.runtimeAuthorityQNames.includes("lobby.ui.Demo"));
    assert.equal(manifest.files[0].typescriptPath, "__as3_runtime/application/lobby/ui/Demo.ts");
    assert.equal(manifest.nativeTimerAuthoritySha256,
        "1db6dff27b308bf4081c06d4e45d50ee1f8ebe36614024e5b1bd2a99af252e79");
    assert.equal(manifest.files[0].normalizedFingerprintSha256.length, 64);
    const authorityCode=fs.readFileSync(path.join(first,manifest.runtimeAuthorityPath),"utf8");
    const entryCode=fs.readFileSync(path.join(first,manifest.applicationEntryPath),"utf8");
    assert.match(authorityCode,/installAS3TypeAuthority/);
    assert.match(authorityCode,/require\("laya\/flash\/events\/Event"\)/);
    assert.match(authorityCode,/require\("\.\/application\/lobby\/ui\/Demo"\)/);
    assert.equal(fs.existsSync(path.join(first,"__as3_runtime/internal/AS3TypeRegistry.ts")),false);
    assert.equal(fs.existsSync(path.join(first,"__as3_runtime/internal/AS3TypeRegistry.js")),false);
    assert.equal(entryCode.indexOf("./AS3Authority.generated") < entryCode.indexOf("./application/lobby/ui/Demo"),true);
    assert.equal(authorityCode,fs.readFileSync(path.join(second,manifest.runtimeAuthorityPath),"utf8"));
    assert.equal(entryCode,fs.readFileSync(path.join(second,manifest.applicationEntryPath),"utf8"));

    const tsconfig = path.join(root, "tsconfig.json");
    const bridgeTypes = path.join(root, "bridge-types.d.ts");
    fs.writeFileSync(bridgeTypes, [
        "declare module \"laya/flash/display/Sprite\" { export class Sprite { addEventListener(type: string, listener: Function): void; } }",
        "declare module \"laya/flash/events/Event\" { export class Event {} }",
        "declare module \"@bleach/as3-runtime/AS3Type\" { export interface AS3TypeToken<T> { readonly name:string; } export type AS3ClassValue=Function|AS3TypeToken<unknown>; export const AS3Types:unknown; export function as3As<T>(value:unknown,type:AS3TypeToken<T>):T|null; export function as3Is<T>(value:unknown,type:AS3TypeToken<T>):value is T; export function as3ClassType<T extends object>(name:string,ctor:abstract new (...args:any[])=>T):AS3TypeToken<T>; export function as3InterfaceType<T extends object>(name:string):AS3TypeToken<T>; export function as3NamedReferenceType<T extends object>(name:string):AS3TypeToken<T>; export function as3RejectConstructorArity(className:string,minimum:number,maximum:number|null):never; export function as3InitializeInstanceFields(value:object,newTarget:Function):void; export function as3PrepareConstruction(newTarget:unknown,declared:Function,proof:unknown):readonly []; export function as3CancelPreparedConstruction(newTarget:unknown,proof:unknown,frame:unknown):void; export function as3EnterConstruction(value:object,newTarget:unknown,declared:Function,proof:unknown):void; export function as3AbortConstruction(value:object,newTarget:unknown,declared:Function,proof:unknown):void; export function as3CompleteConstruction(value:object,newTarget:unknown,declared:Function,proof:unknown):void; }",
        "declare module \"@bleach/as3-runtime/AS3MethodClosure\" { export function as3BindMethod<A extends unknown[],R>(receiver:object,method:(...args:A)=>R):(...args:A)=>R; }",
        "",
    ].join("\n"), "utf8");
    fs.writeFileSync(tsconfig, JSON.stringify({
        compilerOptions: {
            target: "ES2020",
            module: "CommonJS",
            moduleResolution: "node",
            strict: true,
            skipLibCheck: true,
            noEmit: true,
            types: [],
            lib: ["ES2020"],
        },
        files: [bridgeTypes, path.join(first, modulePath)],
    }), "utf8");
    const compile = spawnSync(process.execPath,
        [path.join(layaRoot, "node_modules/typescript/bin/tsc"), "-p", tsconfig, "--pretty", "false"], {
            cwd: root, encoding: "utf8", timeout: 30_000, windowsHide: true,
        });
    assert.equal(compile.status, 0, `${compile.stdout}${compile.stderr}`);
});

test("lowers maintained-style Flash timeout calls through the authenticated native timer", t => {
    const root = temporaryDirectory(t);
    const source = path.join(root, "source");
    const first = path.join(root, "first");
    const second = path.join(root, "second");
    fs.mkdirSync(source);
    write(source, "TimerDemo.as", [
        "package timer.fixture {",
        "    import flash.utils.setTimeout;",
        "    import flash.utils.clearTimeout;",
        "    public class TimerDemo {",
        "        private var id:uint = 0;",
        "        public var result:String = \"\";",
        "        public function TimerDemo() {}",
        "        public function arm():void { id = setTimeout(this.onTimer, 10, \"ok\"); }",
        "        public function cancel():void { clearTimeout(id); }",
        "        private function onTimer(value:String):void { result = value; }",
        "    }",
        "}",
        "",
    ].join("\n"));
    const firstRun = invoke(source, first, root);
    const secondRun = invoke(source, second, os.tmpdir());
    assert.equal(firstRun.status, 0, firstRun.stderr);
    assert.equal(secondRun.status, 0, secondRun.stderr);
    const modulePath = path.join("__as3_runtime", "application", "timer", "fixture", "TimerDemo.ts");
    const firstCode = fs.readFileSync(path.join(first, modulePath), "utf8");
    const secondCode = fs.readFileSync(path.join(second, modulePath), "utf8");
    assert.equal(firstCode, secondCode, "timer lowering must be cross-CWD deterministic");
    assert.match(firstCode, /import \{ setTimeout \} from "@bleach\/as3-runtime\/AS3Timer";/);
    assert.match(firstCode, /import \{ clearTimeout \} from "@bleach\/as3-runtime\/AS3Timer";/);
    assert.match(firstCode, /this\.onTimer = __as3BindMethod\(this, this\.onTimer\);/);
    assert.match(firstCode, /this\.id = setTimeout\(this\.onTimer, 10, "ok"\);/);
    assert.match(firstCode, /clearTimeout\(this\.id\);/);

    const declarations = path.join(root, "runtime.d.ts");
    fs.writeFileSync(declarations, [
        "declare module \"@bleach/as3-runtime/AS3Type\" { export interface AS3TypeToken<T> { readonly name:string; } export type AS3ClassValue=Function|AS3TypeToken<unknown>; export const AS3Types:unknown; export function as3As<T>(value:unknown,type:AS3TypeToken<T>):T|null; export function as3Is<T>(value:unknown,type:AS3TypeToken<T>):value is T; export function as3ClassType<T extends object>(name:string,ctor:abstract new (...args:any[])=>T):AS3TypeToken<T>; export function as3InterfaceType<T extends object>(name:string):AS3TypeToken<T>; export function as3NamedReferenceType<T extends object>(name:string):AS3TypeToken<T>; export function as3RejectConstructorArity(className:string,minimum:number,maximum:number|null):never; export function as3InitializeInstanceFields(value:object,newTarget:Function):void; export function as3PrepareConstruction(newTarget:unknown,declared:Function,proof:unknown):readonly []; export function as3CancelPreparedConstruction(newTarget:unknown,proof:unknown,frame:unknown):void; export function as3EnterConstruction(value:object,newTarget:unknown,declared:Function,proof:unknown):void; export function as3AbortConstruction(value:object,newTarget:unknown,declared:Function,proof:unknown):void; export function as3CompleteConstruction(value:object,newTarget:unknown,declared:Function,proof:unknown):void; }",
        "declare module \"@bleach/as3-runtime/AS3Timer\" {",
        "  export function setTimeout(closure: Function, delay: number, ...args: unknown[]): number;",
        "  export function clearTimeout(id: number): void;",
        "}",
        "declare module \"@bleach/as3-runtime/AS3MethodClosure\" {",
        "  export function as3BindMethod<A extends unknown[], R>(receiver: object, method: (...args: A) => R): (...args: A) => R;",
        "}",
        "declare module \"@bleach/as3-runtime/AS3Coerce\" {",
        "  export function as3Boolean(value: unknown): boolean;",
        "  export function as3Int(value: unknown): number;",
        "  export function as3Number(value: unknown): number;",
        "  export function as3String(value: unknown): string | null;",
        "  export function as3Uint(value: unknown): number;",
        "}",
        "",
    ].join("\n"), "utf8");
    const tsconfig = path.join(root, "timer-tsconfig.json");
    fs.writeFileSync(tsconfig, JSON.stringify({
        compilerOptions: {
            target: "ES2020", module: "CommonJS", moduleResolution: "node", strict: true,
            skipLibCheck: true, noEmit: true, types: [], lib: ["ES2020"],
        },
        files: [declarations, path.join(first, modulePath)],
    }), "utf8");
    const compile = spawnSync(process.execPath,
        [path.join(layaRoot, "node_modules/typescript/bin/tsc"), "-p", tsconfig, "--pretty", "false"], {
            cwd: os.tmpdir(), encoding: "utf8", timeout: 30_000, windowsHide: true,
        });
    assert.equal(compile.status, 0, `${compile.stdout}${compile.stderr}`);
});

test("timer lowering requires the exact imported lexical binding", t => {
    const root = temporaryDirectory(t);
    const source = path.join(root, "source");
    const output = path.join(root, "qualification");
    fs.mkdirSync(source);
    const unit = (name, imports, member) => [
        "package timer.shadow {",
        ...imports.map(value => `    import ${value};`),
        `    public class ${name} {`,
        `        public function ${name}() {}`,
        `        ${member}`,
        "    }",
        "}",
        "",
    ].join("\n");
    write(source, "ParameterShadow.as", unit("ParameterShadow", ["flash.utils.setTimeout"],
        "public function arm(setTimeout:Function):void { setTimeout(function():void {}, 0); }"));
    write(source, "LocalShadow.as", unit("LocalShadow", ["flash.utils.setTimeout"],
        "public function arm():void { var setTimeout:Function = function(closure:Function, delay:Number):uint { return 1; }; setTimeout(function():void {}, 0); }"));
    write(source, "CatchShadow.as", unit("CatchShadow", ["flash.utils.setTimeout"],
        "public function arm():void { try { var value:Number = 1; } catch (setTimeout:Error) { setTimeout(function():void {}, 0); } }"));
    write(source, "FieldShadow.as", unit("FieldShadow", ["flash.utils.setTimeout"],
        "private var setTimeout:Function; public function arm():void { setTimeout(function():void {}, 0); }"));
    write(source, "MethodShadow.as", unit("MethodShadow", ["flash.utils.setTimeout"],
        "private function setTimeout(closure:Function, delay:Number):uint { return 1; } public function arm():void { setTimeout(function():void {}, 0); }"));
    write(source, "ImportedAlias.as", unit("ImportedAlias", ["flash.utils.setTimeout"],
        "public function arm():void { var timerAlias:Function = setTimeout; timerAlias(function():void {}, 0); }"));
    write(source, "WildcardShadow.as", unit("WildcardShadow", ["flash.utils.*"],
        "public function arm(setTimeout:Function):void { setTimeout(function():void {}, 0); }"));
    write(source, "ClearShadow.as", unit("ClearShadow", ["flash.utils.clearTimeout"],
        "public function cancel(clearTimeout:Function):void { clearTimeout(1); }"));
    const result = qualify(source, output, os.tmpdir());
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(fs.readFileSync(path.join(output, "manifest.json"), "utf8"));
    assert.equal(report.files.length, 8);
    assert.equal(report.files.every(item => item.status === "held"), true,
        JSON.stringify(report.files.map(item => ({ sourcePath: item.sourcePath, status: item.status, code: item.code }))));
    assert.deepEqual(Object.fromEntries(report.files.map(item => [item.sourcePath, item.code])), {
        "CatchShadow.as": "HARDENED_NATIVE_TIMER_SHADOW",
        "ClearShadow.as": "HARDENED_NATIVE_TIMER_SHADOW",
        "FieldShadow.as": "HARDENED_NATIVE_TIMER_SHADOW",
        "ImportedAlias.as": "HARDENED_ASSIGNMENT_TYPE",
        "LocalShadow.as": "HARDENED_NATIVE_TIMER_SHADOW",
        "MethodShadow.as": "HARDENED_NATIVE_TIMER_SHADOW",
        "ParameterShadow.as": "HARDENED_NATIVE_TIMER_SHADOW",
        "WildcardShadow.as": "HARDENED_NATIVE_TIMER_SHADOW",
    });
    assert.equal(report.files.every(item => item.code !== null && item.code !== "FRONTEND_HOLD"), true);
    assert.equal(fs.readdirSync(output).sort().join(","), "manifest.json");
});

test("unsupported syntax fails closed without publishing", t => {
    const root = temporaryDirectory(t);
    const source = path.join(root, "source");
    const output = path.join(root, "output");
    fs.mkdirSync(source);
    write(source, "Unsupported.as",
        "package p { public interface Unsupported { function dynamicValue(value:*):void; } }\n");
    const result = invoke(source, output, root);
    assert.equal(result.status, 4, result.stderr);
    assert.match(result.stderr, /HARDENED_TYPE_UNMAPPED/);
    assert.equal(fs.existsSync(output), false);
});

test("package runtime values cannot publish an import whose local constructor module is absent", t => {
    const root = temporaryDirectory(t);
    const source = path.join(root, "source");
    const output = path.join(root, "output");
    const portable = "Externals/SExternalCore.as";
    fs.mkdirSync(source);
    write(source, portable, fs.readFileSync(path.join(sourceRepository,
        "game-client/tapplication_main/src", ...portable.split("/")), "utf8"));
    const result = invoke(source, output, root);
    assert.equal(result.status, 4, result.stderr);
    assert.match(result.stderr, /local dependency has no emitted output.*TExternalCore\.ts/);
    assert.equal(fs.existsSync(output), false);
});

test("authority byte drift fails before output reservation", t => {
    const root = temporaryDirectory(t);
    const source = path.join(root, "source");
    const output = path.join(root, "output");
    const changedTarget = path.join(root, "target.json");
    fs.mkdirSync(source);
    write(source, "Demo.as", admittedSource);
    fs.writeFileSync(changedTarget, `${fs.readFileSync(targetCapabilities, "utf8")} `, "utf8");
    const result = spawnSync(process.execPath, [executable, "transpile", source, output,
        "--source-census", sourceCensus, "--target-capabilities", changedTarget], {
        cwd: root, encoding: "utf8", timeout: 20_000, windowsHide: true,
    });
    assert.equal(result.status, 6, result.stderr);
    assert.match(result.stderr, /capability authority rejected/);
    assert.equal(fs.existsSync(output), false);
});

test("qualification records holds without materializing TypeScript", t => {
    const root = temporaryDirectory(t);
    const source = path.join(root, "source");
    const output = path.join(root, "qualification");
    fs.mkdirSync(source);
    write(source, "Demo.as", admittedSource);
    write(source, "Unsupported.as",
        "package p { public interface Unsupported { function dynamicValue(value:*):void; } }\n");
    const result = spawnSync(process.execPath, [executable, "qualify", source, output,
        "--source-census", sourceCensus, "--target-capabilities", targetCapabilities], {
        cwd: root, encoding: "utf8", timeout: 20_000, windowsHide: true,
    });
    assert.equal(result.status, 0, result.stderr);
    const files = fs.readdirSync(output);
    assert.deepEqual(files, ["manifest.json"]);
    const report = JSON.parse(fs.readFileSync(path.join(output, "manifest.json"), "utf8"));
    assert.equal(report.schema, "bleach.as3.qualification-report.v1");
    assert.match(report.parserWorkerSha256, /^[0-9a-f]{64}$/);
    assert.equal(report.generatedTypeScriptMaterialized, false);
    assert.equal(report.counts.admitted, 1);
    assert.equal(report.counts.HARDENED_TYPE_UNMAPPED, 1);
    assert.deepEqual(report.files.map(item => item.status), ["admitted", "held"]);
});

test("the authenticated TTreeNode record advances without general Object admission", t => {
    const root = temporaryDirectory(t);
    const source = path.join(root, "source");
    const output = path.join(root, "qualification");
    const portable = "Foundation/SensitiveWord/TTreeNode.as";
    fs.mkdirSync(source);
    write(source, portable, fs.readFileSync(path.join(sourceRepository,
        "game-client/tapplication_main/src", ...portable.split("/")), "utf8"));
    const result = spawnSync(process.execPath, [executable, "qualify", source, output,
        "--source-census", sourceCensus, "--target-capabilities", targetCapabilities], {
        cwd: root, encoding: "utf8", timeout: 20_000, windowsHide: true,
    });
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(fs.readFileSync(path.join(output, "manifest.json"), "utf8"));
    assert.equal(report.generatedTypeScriptMaterialized, false);
    assert.equal(report.files.length, 1);
    assert.equal(report.files[0].sourcePath, portable);
    assert.equal(report.files[0].code, "HARDENED_WHILE_BOOLEAN");
    assert.doesNotMatch(report.files[0].message, /HARDENED_INDEX_TARGET|HARDENED_OWN_RECORD/);
});

test("the exact Inner DTOs advance while Outer and Easter records stay held", t => {
    const root = temporaryDirectory(t);
    const source = path.join(root, "source");
    const output = path.join(root, "qualification");
    const innerPortables = [
        "Logics/HDActivityBigTurnTable/TBigTurnTableGoldLotteryInner.as",
        "Logics/HDActivityBigTurnTable/TBigTurnTableLuckyLotteryInner.as",
    ];
    const heldPortables = [
        "Logics/HDActivityBigTurnTable/TBigTurnTableGoldLotteryOutter.as",
        "Logics/HDActivityBigTurnTable/TBigTurnTableLuckyLotteryOutter.as",
        "Logics/Streamization/HDEaster2016/TUnstreamizerEaster2016_2.as",
    ];
    const portables = innerPortables.concat(heldPortables).sort();
    fs.mkdirSync(source);
    portables.forEach(portable => write(source, portable, fs.readFileSync(path.join(sourceRepository,
        "game-client/tapplication_main/src", ...portable.split("/")), "utf8")));
    const result = spawnSync(process.execPath, [executable, "qualify", source, output,
        "--source-census", sourceCensus, "--target-capabilities", targetCapabilities], {
        cwd: root, encoding: "utf8", timeout: 20_000, windowsHide: true,
    });
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(fs.readFileSync(path.join(output, "manifest.json"), "utf8"));
    assert.equal(report.files.length, 5);
    assert.deepEqual(report.files.map(item => item.sourcePath), portables);
    report.files.filter(item => innerPortables.includes(item.sourcePath)).forEach(item => {
        assert.equal(item.code, "HARDENED_MEMBER_TARGET");
        assert.doesNotMatch(item.message, /HARDENED_INDEX_TARGET|HARDENED_BIG_TURN_TABLE/);
    });
    assert.equal(report.files.find(item => item.sourcePath.endsWith("GoldLotteryOutter.as")).code,
        "HARDENED_SUPER_CONTEXT");
    report.files.filter(item => item.sourcePath.endsWith("LuckyLotteryOutter.as")
        || item.sourcePath.endsWith("TUnstreamizerEaster2016_2.as"))
        .forEach(item => assert.equal(item.code, "HARDENED_INDEX_TARGET"));
});
