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

test("owned TextField calls and numeric filter constructors transpile, typecheck, and coerce", t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "as3-text-filter-test-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const source = path.join(root, "source");
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, "TextFilterDemo.as"), [
        "package p {",
        "import flash.filters.BlurFilter; import flash.filters.DropShadowFilter; import flash.filters.GlowFilter;",
        "import flash.geom.Rectangle; import flash.text.TextField; import flash.text.TextFormat;",
        "public class TextFilterDemo {",
        "private var field:TextField;",
        "public function TextFilterDemo(field:TextField) { this.field = field; }",
        "public function run(format:TextFormat):int {",
        "field.appendText(\"x\");",
        "var bounds:Rectangle = field.getCharBoundaries(3.9);",
        "var index:int = field.getCharIndexAtPoint(1.5, 2.5);",
        "var length:int = field.getLineLength(3.9);",
        "var offset:int = field.getLineOffset(4.9);",
        "var current:TextFormat = field.getTextFormat(2.9, 5.9);",
        "field.replaceText(1.9, 2.9, \"z\"); field.setTextFormat(format, 2.9, 5.9);",
        "var blur:BlurFilter = new BlurFilter(2, 3, 3.9);",
        "var shadow:DropShadowFilter = new DropShadowFilter(4, 45, -1, 1, 4, 4, 1, 3.9, false, false, false);",
        "var glow:GlowFilter = new GlowFilter(-1, 1, 6, 6, 2, 3.9, false, false);",
        "return index;",
        "}",
        "}",
        "}",
        "",
    ].join("\n"), "utf8");
    const output = path.join(root, "output");
    const result = spawnSync(process.execPath, [executable, "transpile", source, output,
        "--source-census", sourceCensus, "--target-capabilities", targetCapabilities],
    { cwd: root, encoding: "utf8", timeout: 30_000, windowsHide: true });
    assert.equal(result.status, 0, result.stderr);
    const generated = path.join(output, "p", "TextFilterDemo.ts");
    const code = fs.readFileSync(generated, "utf8");
    assert.match(code, /getCharBoundaries\(__as3Int\(3\.9\)\)/);
    assert.match(code, /getLineLength\(__as3Int\(3\.9\)\)/);
    assert.match(code, /setTextFormat\(format!, __as3Int\(2\.9\), __as3Int\(5\.9\)\)/);
    assert.match(code, /new BlurFilter\(2, 3, __as3Int\(3\.9\)\)/);
    assert.match(code, /new DropShadowFilter\(4, 45, __as3Uint\(-1\)/);
    assert.match(code, /new GlowFilter\(__as3Uint\(-1\)/);

    const declarations = path.join(root, "bridge-types.d.ts");
    fs.writeFileSync(declarations, [
        "declare module \"laya/flash/geom/Rectangle\" { export class Rectangle {} }",
        "declare module \"laya/flash/text/TextFormat\" { export class TextFormat {} }",
        "declare module \"laya/flash/text/TextField\" { import {Rectangle} from \"laya/flash/geom/Rectangle\"; import {TextFormat} from \"laya/flash/text/TextFormat\"; export class TextField { appendText(v:string):void; getCharBoundaries(i:number):Rectangle|null; getCharIndexAtPoint(x:number,y:number):number; getLineLength(i:number):number; getLineOffset(i:number):number; getTextFormat(b?:number,e?:number):TextFormat; replaceText(b:number,e:number,v:string):void; setTextFormat(f:TextFormat,b?:number,e?:number):void; } }",
        "declare module \"laya/flash/filters/BlurFilter\" { export class BlurFilter { constructor(x?:number,y?:number,q?:number); } }",
        "declare module \"laya/flash/filters/DropShadowFilter\" { export class DropShadowFilter { constructor(d?:number,a?:number,c?:number,al?:number,x?:number,y?:number,s?:number,q?:number,i?:boolean,k?:boolean,h?:boolean); } }",
        "declare module \"laya/flash/filters/GlowFilter\" { export class GlowFilter { constructor(c?:number,a?:number,x?:number,y?:number,s?:number,q?:number,i?:boolean,k?:boolean); } }",
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
    moduleFile("laya/flash/filters/BlurFilter", "exports.BlurFilter=class{constructor(...a){globalThis.__tf.push(['blur',...a])}};\n");
    moduleFile("laya/flash/filters/DropShadowFilter", "exports.DropShadowFilter=class{constructor(...a){globalThis.__tf.push(['shadow',...a])}};\n");
    moduleFile("laya/flash/filters/GlowFilter", "exports.GlowFilter=class{constructor(...a){globalThis.__tf.push(['glow',...a])}};\n");
    moduleFile("@bleach/as3-runtime/AS3Coerce", "exports.as3Int=v=>Number(v)|0;exports.as3Uint=v=>Number(v)>>>0;exports.as3Number=Number;exports.as3Boolean=Boolean;exports.as3String=String;\n");
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
        "globalThis.__tf=[];",
        `const {TextFilterDemo}=require(${JSON.stringify(path.join(runtimeOutput, "TextFilterDemo.js"))});`,
        "const field={appendText(){},getCharBoundaries(i){globalThis.__tf.push(['bounds',i]);return{}},getCharIndexAtPoint(){return 1},getLineLength(i){globalThis.__tf.push(['length',i]);return 2},getLineOffset(i){globalThis.__tf.push(['offset',i]);return 3},getTextFormat(b,e){globalThis.__tf.push(['format',b,e]);return{}},replaceText(b,e){globalThis.__tf.push(['replace',b,e])},setTextFormat(f,b,e){globalThis.__tf.push(['set',b,e])}};",
        "const value=new TextFilterDemo(field).run({});process.stdout.write(JSON.stringify({value,events:globalThis.__tf}));",
    ].join("")], { cwd: root, encoding: "utf8", timeout: 30_000, windowsHide: true });
    assert.equal(runtime.status, 0, runtime.stderr);
    const observed = JSON.parse(runtime.stdout);
    assert.equal(observed.value, 1);
    assert.equal(observed.events.some(item => item[0] === "bounds" && item[1] === 3), true);
    assert.equal(observed.events.some(item => item[0] === "set" && item[1] === 2 && item[2] === 5), true);
    assert.equal(observed.events.some(item => item[0] === "blur" && item[3] === 3), true);
    assert.equal(observed.events.some(item => item[0] === "shadow" && item[3] === 4294967295 && item[8] === 3), true);
    assert.equal(observed.events.some(item => item[0] === "glow" && item[1] === 4294967295 && item[6] === 3), true);
});
