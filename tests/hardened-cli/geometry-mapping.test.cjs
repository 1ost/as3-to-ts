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
const layaRoot = process.env.HARDENED_TARGET_REPO || "C:/Users/admin/Desktop/GITHUB REPO/LayaAir";

function temporaryDirectory(t) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "as3-geometry-test-"));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    return directory;
}

function writeSource(root, file, body) {
    const directory = path.join(root, "source");
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, file), body, "utf8");
    return directory;
}

function invoke(operation, source, output, cwd) {
    return spawnSync(process.execPath, [executable, operation, source, output,
        "--source-census", sourceCensus, "--target-capabilities", targetCapabilities], {
        cwd, encoding: "utf8", timeout: 30_000, windowsHide: true,
    });
}

const admittedGeometry = [
    "package p {",
    "    import flash.geom.Point;",
    "    import flash.geom.Rectangle;",
    "    public class GeometryDemo {",
    "        private var point:Point = new Point(1, 2);",
    "        private var rect:Rectangle = new Rectangle(3, 4, 5, 6);",
    "        public function GeometryDemo() {}",
    "        public function run():Rectangle {",
    "            point.x = point.x + point.length;",
    "            point.y = 8;",
    "            rect.width = rect.width + 1;",
    "            rect.height = 9;",
    "            rect.inflate(1, 2);",
    "            var copy:Rectangle = rect.clone();",
    "            var overlap:Rectangle = rect.intersection(copy);",
    "            return overlap.union(rect);",
    "        }",
    "    }",
    "}",
    "",
].join("\n");

test("Point and Rectangle constructors, properties, getters, and typed calls transpile", t => {
    const root = temporaryDirectory(t);
    const source = writeSource(root, "GeometryDemo.as", admittedGeometry);
    const output = path.join(root, "output");
    const result = invoke("transpile", source, output, root);
    assert.equal(result.status, 0, result.stderr);
    const generated = path.join(output, "__as3_runtime", "application", "p", "GeometryDemo.ts");
    const code = fs.readFileSync(generated, "utf8");
    assert.match(code, /new Point\(1, 2\)/);
    assert.match(code, /new Rectangle\(3, 4, 5, 6\)/);
    assert.match(code, /this\.point!\.x = this\.point!\.x \+ this\.point!\.length/);
    assert.match(code, /this\.rect!\.inflate\(1, 2\)/);
    assert.match(code, /var overlap: Rectangle \| null = this\.rect!\.intersection\(copy!\)/);

    const declarations = path.join(root, "bridge-types.d.ts");
    fs.writeFileSync(declarations, [
        "declare module \"laya/flash/geom/Point\" { export class Point { constructor(x?: number, y?: number); x:number; y:number; readonly length:number; } }",
        "declare module \"laya/flash/geom/Rectangle\" { export class Rectangle { constructor(x?:number,y?:number,width?:number,height?:number); width:number; height:number; inflate(dx:number,dy:number):void; clone():Rectangle; intersection(value:Rectangle):Rectangle; union(value:Rectangle):Rectangle; } }",
        "declare module \"@bleach/as3-runtime/AS3Type\" { export interface AS3TypeToken<T> {} export type AS3ClassValue<T> = Function; export const AS3Types:Readonly<Record<string,AS3TypeToken<unknown>>>; export function as3As<T>(value:unknown,type:AS3TypeToken<T>):T|null; export function as3Is<T>(value:unknown,type:AS3TypeToken<T>):value is T; export function as3ClassType<T extends object>(name:string,constructor:Function):AS3TypeToken<T>; export function as3InterfaceType<T extends object>(name:string):AS3TypeToken<T>; export function as3NamedReferenceType<T extends object>(name:string):AS3TypeToken<T>; export function as3RejectConstructorArity(className:string,minimum:number,maximum:number|null,actual?:number):never; export function as3ConstructClass(value:unknown,args:unknown[]):unknown; export function as3InitializeInstanceFields(value:object,newTarget:Function):void; export function as3PrepareConstruction(newTarget:unknown,declared:Function,proof:unknown):readonly []; export function as3CancelPreparedConstruction(newTarget:unknown,proof:unknown,frame:unknown):void; export function as3EnterConstruction(value:object,newTarget:unknown,declared:Function,proof:unknown):void; export function as3AbortConstruction(value:object,newTarget:unknown,declared:Function,proof:unknown):void; export function as3CompleteConstruction(value:object,newTarget:unknown,declared:Function,proof:unknown):void; }",
        "",
    ].join("\n"), "utf8");
    const tsconfig = path.join(root, "tsconfig.json");
    fs.writeFileSync(tsconfig, JSON.stringify({
        compilerOptions: { target: "ES2020", module: "CommonJS", moduleResolution: "node",
            strict: true, skipLibCheck: true, noEmit: true, types: [], lib: ["ES2020"] },
        files: [declarations, generated],
    }), "utf8");
    const compile = spawnSync(process.execPath,
        [path.join(layaRoot, "node_modules/typescript/bin/tsc"), "-p", tsconfig, "--pretty", "false"],
        { cwd: root, encoding: "utf8", timeout: 30_000, windowsHide: true });
    assert.equal(compile.status, 0, `${compile.stdout}${compile.stderr}`);
});

test("geometry mappings reject wrong constructor and method types plus unmapped members", t => {
    const root = temporaryDirectory(t);
    const source = path.join(root, "source");
    fs.mkdirSync(source);
    const cases = {
        BadConstructorType: "private var value:Point = new Point(\"x\", 1);",
        BadConstructorArity: "private var value:Rectangle = new Rectangle(1, 2, 3, 4, 5);",
        BadMethodType: "private var point:Point = new Point(); private var rect:Rectangle = new Rectangle(); public function bad():Rectangle { return rect.union(point); }",
        UnmappedMember: "private var point:Point = new Point(); public function bad():Number { return point.z; }",
    };
    for (const [name, member] of Object.entries(cases)) {
        fs.writeFileSync(path.join(source, `${name}.as`), [
            "package p { import flash.geom.Point; import flash.geom.Rectangle;",
            `public class ${name} { ${member} public function ${name}() {} }`,
            "}", "",
        ].join("\n"), "utf8");
    }
    const output = path.join(root, "qualification");
    const result = invoke("qualify", source, output, root);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(fs.readFileSync(path.join(output, "manifest.json"), "utf8"));
    assert.equal(report.counts.HARDENED_CAPABILITY_CALL_TYPE, 2);
    assert.equal(report.counts.HARDENED_NEW_ARITY, 1);
    assert.equal(report.counts.HARDENED_MEMBER_TARGET, 1);
    assert.equal(report.counts.admitted || 0, 0);
});

test("getBounds, getRect, and scrollRect stay held as target-semantic mismatches", t => {
    const root = temporaryDirectory(t);
    const source = path.join(root, "source");
    fs.mkdirSync(source);
    const expressions = {
        BoundsHold: "sprite.getBounds(sprite);",
        RectHold: "sprite.getRect(sprite);",
        ScrollHold: "var value:Object = sprite.scrollRect;",
    };
    for (const [name, expression] of Object.entries(expressions)) {
        fs.writeFileSync(path.join(source, `${name}.as`), [
            "package p { import flash.display.Sprite;",
            `public class ${name} { private var sprite:Sprite = new Sprite(); public function ${name}() {}`,
            `public function run():void { ${expression} } }`,
            "}", "",
        ].join("\n"), "utf8");
    }
    const output = path.join(root, "qualification");
    const result = invoke("qualify", source, output, root);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(fs.readFileSync(path.join(output, "manifest.json"), "utf8"));
    assert.equal(report.counts.HARDENED_MEMBER_TARGET, 3);
    assert.equal(report.counts.admitted || 0, 0);
});
