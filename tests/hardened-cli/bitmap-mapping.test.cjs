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
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "as3-bitmap-test-"));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    return directory;
}

function invoke(operation, source, output, cwd) {
    return spawnSync(process.execPath, [executable, operation, source, output,
        "--source-census", sourceCensus, "--target-capabilities", targetCapabilities], {
        cwd, encoding: "utf8", timeout: 30_000, windowsHide: true,
    });
}

const admittedBitmap = [
    "package p {",
    "    import flash.display.Bitmap;",
    "    import flash.display.BitmapData;",
    "    import flash.display.BitmapDataChannel;",
    "    import flash.geom.Point;",
    "    import flash.geom.Rectangle;",
    "    public class BitmapDemo {",
    "        private var data:BitmapData = new BitmapData(3.9, 2.2, true, -1);",
    "        private var bitmap:Bitmap;",
    "        public function BitmapDemo(bitmap:Bitmap) { this.bitmap = bitmap; }",
    "        public function run():uint {",
    "            var copy:BitmapData = data.clone();",
    "            bitmap.bitmapData = copy;",
    "            var selected:BitmapData = bitmap.bitmapData;",
    "            bitmap.smoothing = true;",
    "            var smooth:Boolean = bitmap.smoothing;",
    "            var channel:uint = BitmapDataChannel.RED;",
    "            copy.copyChannel(data, data.rect, new Point(), BitmapDataChannel.RED, BitmapDataChannel.ALPHA);",
    "            copy.copyPixels(data, data.rect, new Point());",
    "            copy.copyPixels(data, data.rect, new Point(), null, null, true);",
    "            copy.fillRect(copy.rect, -1);",
    "            var bounds:Rectangle = copy.getColorBoundsRect(255, 0, true);",
    "            copy.lock();",
    "            copy.unlock(bounds);",
    "            copy.threshold(data, data.rect, new Point(), \">\", 0);",
    "            var height:int = copy.height;",
    "            var width:int = copy.width;",
    "            var result:uint = smooth ? copy.getPixel(width, height) : copy.getPixel32(0, 0);",
    "            selected.dispose();",
    "            return result;",
    "        }",
    "    }",
    "}",
    "",
].join("\n");

test("Bitmap properties and CPU BitmapData mappings transpile, typecheck, and preserve int/uint coercions", t => {
    const root = temporaryDirectory(t);
    const source = path.join(root, "source");
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, "BitmapDemo.as"), admittedBitmap, "utf8");
    const output = path.join(root, "output");
    const result = invoke("transpile", source, output, root);
    assert.equal(result.status, 0, result.stderr);
    const generated = path.join(output, "p", "BitmapDemo.ts");
    const code = fs.readFileSync(generated, "utf8");
    assert.match(code, /new BitmapData\(__as3Int\(3\.9\), __as3Int\(2\.2\), true, __as3Uint\(-1\)\)/);
    assert.doesNotMatch(code, /new Bitmap\(/);
    assert.match(code, /BitmapDataChannel\.RED/);
    assert.match(code, /BitmapDataChannel\.ALPHA/);
    assert.match(code, /fillRect\(copy!\.rect!, __as3Uint\(-1\)\)/);
    assert.match(code, /copyPixels\(this\.data!, this\.data!\.rect!, new Point\(\), null!, null!, true\)/);
    assert.match(code, /selected!\.dispose\(\)/);

    const declarations = path.join(root, "bridge-types.d.ts");
    fs.writeFileSync(declarations, [
        "declare module \"laya/flash/display/Bitmap\" { import { BitmapData } from \"laya/flash/display/BitmapData\"; export class Bitmap { bitmapData:BitmapData; smoothing:boolean; } }",
        "declare module \"laya/flash/display/BitmapData\" { import { Point } from \"laya/flash/geom/Point\"; import { Rectangle } from \"laya/flash/geom/Rectangle\"; export class BitmapData { constructor(w:number,h:number,t?:boolean,c?:number); readonly width:number; readonly height:number; readonly rect:Rectangle; clone():BitmapData; copyChannel(s:BitmapData,r:Rectangle,p:Point,sc:number,dc:number):void; copyPixels(s:BitmapData,r:Rectangle,p:Point,a?:BitmapData|null,ap?:Point|null,m?:boolean):void; dispose():void; fillRect(r:Rectangle,c:number):void; getColorBoundsRect(m:number,c:number,f?:boolean):Rectangle; getPixel(x:number,y:number):number; getPixel32(x:number,y:number):number; lock():void; threshold(s:BitmapData,r:Rectangle,p:Point,o:string,t:number,c?:number,m?:number,cs?:boolean):number; unlock(r?:Rectangle|null):void; } }",
        "declare module \"laya/flash/display/BitmapDataChannel\" { export class BitmapDataChannel { static readonly RED:1; static readonly ALPHA:8; } }",
        "declare module \"laya/flash/geom/Point\" { export class Point { constructor(x?:number,y?:number); } }",
        "declare module \"laya/flash/geom/Rectangle\" { export class Rectangle {} }",
        "declare module \"@bleach/as3-runtime/AS3Coerce\" { export function as3Boolean(v:unknown):boolean; export function as3Int(v:unknown):number; export function as3Number(v:unknown):number; export function as3String(v:unknown):string; export function as3Uint(v:unknown):number; }",
        "",
    ].join("\n"), "utf8");
    const tsconfig = path.join(root, "tsconfig.json");
    fs.writeFileSync(tsconfig, JSON.stringify({ compilerOptions: { target: "ES2020", module: "CommonJS",
        moduleResolution: "node", strict: true, skipLibCheck: true, noEmit: true, types: [], lib: ["ES2020"] },
    files: [declarations, generated] }), "utf8");
    const compile = spawnSync(process.execPath,
        [path.join(layaRoot, "node_modules/typescript/bin/tsc"), "-p", tsconfig, "--pretty", "false"],
        { cwd: root, encoding: "utf8", timeout: 30_000, windowsHide: true });
    assert.equal(compile.status, 0, `${compile.stdout}${compile.stderr}`);

    const moduleFile = (specifier, body) => {
        const file = path.join(root, "node_modules", ...specifier.split("/")) + ".js";
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, body, "utf8");
    };
    moduleFile("laya/flash/geom/Point", "exports.Point=class Point{constructor(x=0,y=0){this.x=x;this.y=y}};\n");
    moduleFile("laya/flash/geom/Rectangle", "exports.Rectangle=class Rectangle{};\n");
    moduleFile("laya/flash/display/BitmapDataChannel", "exports.BitmapDataChannel={RED:1,ALPHA:8};\n");
    moduleFile("laya/flash/display/Bitmap", "exports.Bitmap=class Bitmap{};\n");
    moduleFile("laya/flash/display/BitmapData", [
        "const {Rectangle}=require('laya/flash/geom/Rectangle');",
        "exports.BitmapData=class BitmapData{",
        "constructor(w,h,t=true,c=4294967295){this.width=w;this.height=h;this.rect=new Rectangle();(globalThis.__bitmapEvents||=[]).push(['data',w,h,t,c]);}",
        "clone(){return new exports.BitmapData(this.width,this.height,true,0)} copyChannel(){} copyPixels(){}",
        "dispose(){globalThis.__bitmapEvents.push(['dispose'])} fillRect(r,c){globalThis.__bitmapEvents.push(['fill',c])}",
        "getColorBoundsRect(){return new Rectangle()} getPixel(){return 7} getPixel32(){return 8} lock(){} unlock(){} threshold(){return 0}",
        "};", "",
    ].join("\n"));
    moduleFile("@bleach/as3-runtime/AS3Coerce", [
        "exports.as3Int=v=>Number(v)|0; exports.as3Uint=v=>Number(v)>>>0; exports.as3Number=v=>Number(v);",
        "exports.as3Boolean=v=>Boolean(v); exports.as3String=v=>String(v);", "",
    ].join("\n"));
    const runtimeConfig = path.join(root, "tsconfig.runtime.json");
    const runtimeOutput = path.join(root, "runtime");
    fs.writeFileSync(runtimeConfig, JSON.stringify({ compilerOptions: { target: "ES2020", module: "CommonJS",
        moduleResolution: "node", strict: true, skipLibCheck: true, types: [], lib: ["ES2020"], outDir: runtimeOutput },
    files: [declarations, generated] }), "utf8");
    const emit = spawnSync(process.execPath,
        [path.join(layaRoot, "node_modules/typescript/bin/tsc"), "-p", runtimeConfig, "--pretty", "false"],
        { cwd: root, encoding: "utf8", timeout: 30_000, windowsHide: true });
    assert.equal(emit.status, 0, `${emit.stdout}${emit.stderr}`);
    const runtime = spawnSync(process.execPath, ["-e", [
        "globalThis.__bitmapEvents=[];",
        `const {BitmapDemo}=require(${JSON.stringify(path.join(runtimeOutput, "BitmapDemo.js"))});`,
        "const result=new BitmapDemo({bitmapData:null,smoothing:false}).run();",
        "process.stdout.write(JSON.stringify({result,events:globalThis.__bitmapEvents}));",
    ].join("")], { cwd: root, encoding: "utf8", timeout: 30_000, windowsHide: true });
    assert.equal(runtime.status, 0, runtime.stderr);
    const observed = JSON.parse(runtime.stdout);
    assert.equal(observed.result, 7);
    assert.deepEqual(observed.events[0], ["data", 3, 2, true, 4294967295]);
    assert.equal(observed.events.some(item => item[0] === "bitmap"), false);
    assert.equal(observed.events.some(item => item[0] === "fill" && item[1] === 4294967295), true);
    assert.equal(observed.events.some(item => item[0] === "dispose"), true);
});

test("bitmap construction, renderer gaps, and unobserved members stay held", t => {
    const root = temporaryDirectory(t);
    const source = path.join(root, "source");
    fs.mkdirSync(source);
    const cases = {
        BitmapZeroArgs: "private var value:Bitmap = new Bitmap();",
        BitmapOneArg: "private var data:BitmapData = new BitmapData(1,1); private var value:Bitmap = new Bitmap(data);",
        BitmapTwoArgs: "private var data:BitmapData = new BitmapData(1,1); private var value:Bitmap = new Bitmap(data, \"auto\");",
        BitmapThreeArgs: "private var data:BitmapData = new BitmapData(1,1); private var value:Bitmap = new Bitmap(data, \"always\", true);",
        PixelSnappingWrite: "private var value:Bitmap; public function bad():void { value.pixelSnapping = \"always\"; }",
        PixelSnappingRead: "public function bad():String { return PixelSnapping.AUTO; }",
        DrawHold: "private var data:BitmapData = new BitmapData(1,1); public function bad():void { data.draw(data); }",
        FilterHold: "private var data:BitmapData = new BitmapData(1,1); public function bad():void { data.applyFilter(data, data.rect, new Point(), null); }",
        TransparentHold: "private var data:BitmapData = new BitmapData(1,1); public function bad():Boolean { return data.transparent; }",
        BadCtorType: "private var data:BitmapData = new BitmapData(\"x\",1);",
    };
    for (const [name, body] of Object.entries(cases)) {
        fs.writeFileSync(path.join(source, `${name}.as`), [
            "package p { import flash.display.Bitmap; import flash.display.BitmapData; import flash.display.PixelSnapping; import flash.geom.Point;",
            `public class ${name} { ${body} public function ${name}() {} }`, "}", "",
        ].join("\n"), "utf8");
    }
    const output = path.join(root, "qualification");
    const result = invoke("qualify", source, output, root);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(fs.readFileSync(path.join(output, "manifest.json"), "utf8"));
    const diagnostic = JSON.stringify(report.counts);
    assert.equal(report.counts.HARDENED_NEW_ARITY, 4, diagnostic);
    assert.equal(report.counts.HARDENED_MEMBER_TARGET, 4, diagnostic);
    assert.equal(report.counts.HARDENED_CAPABILITY_CALL_TYPE, 1, diagnostic);
    assert.equal(report.counts.HARDENED_STATIC_MEMBER, 1, diagnostic);
    assert.equal(report.counts.admitted || 0, 0);
});
