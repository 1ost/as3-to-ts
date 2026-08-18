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

test("authenticated Flash text constants transpile, typecheck, and execute with exact literal identities", t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "as3-text-constants-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const source = path.join(root, "source");
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, "TextConstants.as"), [
        "package p {",
        "import flash.text.AntiAliasType; import flash.text.TextFieldAutoSize;",
        "import flash.text.TextFieldType; import flash.text.TextFormatAlign;",
        "public class TextConstants {",
        "public function antiAlias():String { return AntiAliasType.ADVANCED; }",
        "public function autoCenter():String { return TextFieldAutoSize.CENTER; }",
        "public function autoLeft():String { return TextFieldAutoSize.LEFT; }",
        "public function autoNone():String { return TextFieldAutoSize.NONE; }",
        "public function dynamicType():String { return TextFieldType.DYNAMIC; }",
        "public function inputType():String { return TextFieldType.INPUT; }",
        "public function alignCenter():String { return TextFormatAlign.CENTER; }",
        "public function alignLeft():String { return TextFormatAlign.LEFT; }",
        "}",
        "}",
        "",
    ].join("\n"), "utf8");
    const output = path.join(root, "output");
    const result = spawnSync(process.execPath, [executable, "transpile", source, output,
        "--source-census", sourceCensus, "--target-capabilities", targetCapabilities],
    { cwd: root, encoding: "utf8", timeout: 30_000, windowsHide: true });
    assert.equal(result.status, 0, result.stderr);
    const generated = path.join(output, "__as3_runtime", "application", "p", "TextConstants.ts");
    const code = fs.readFileSync(generated, "utf8");
    assert.match(code, /from "laya\/flash\/text\/TextFormat"/);
    for (const access of ["AntiAliasType.ADVANCED", "TextFieldAutoSize.CENTER", "TextFieldAutoSize.LEFT",
        "TextFieldAutoSize.NONE", "TextFieldType.DYNAMIC", "TextFieldType.INPUT", "TextFormatAlign.CENTER",
        "TextFormatAlign.LEFT"]) assert.ok(code.includes(access), access);

    const declarations = path.join(root, "bridge-types.d.ts");
    fs.writeFileSync(declarations, [
        "declare module \"laya/flash/text/TextFormat\" { export class AntiAliasType { static readonly ADVANCED:\"advanced\"; } export class TextFieldAutoSize { static readonly CENTER:\"center\"; static readonly LEFT:\"left\"; static readonly NONE:\"none\"; } export class TextFieldType { static readonly DYNAMIC:\"dynamic\"; static readonly INPUT:\"input\"; } export class TextFormatAlign { static readonly CENTER:\"center\"; static readonly LEFT:\"left\"; } }",
        "declare module \"@bleach/as3-runtime/AS3Coerce\" { export function as3Boolean(v:unknown):boolean; export function as3Int(v:unknown):number; export function as3Number(v:unknown):number; export function as3String(v:unknown):string; export function as3Uint(v:unknown):number; }",
        "declare module \"@bleach/as3-runtime/AS3Type\" { export interface AS3TypeToken<T> {} export type AS3ClassValue<T> = Function; export const AS3Types:Readonly<Record<string,AS3TypeToken<unknown>>>; export function as3As<T>(value:unknown,type:AS3TypeToken<T>):T|null; export function as3Is<T>(value:unknown,type:AS3TypeToken<T>):value is T; export function as3ClassType<T extends object>(name:string,constructor:Function):AS3TypeToken<T>; export function as3InterfaceType<T extends object>(name:string):AS3TypeToken<T>; export function as3NamedReferenceType<T extends object>(name:string):AS3TypeToken<T>; export function as3RejectConstructorArity(className:string,minimum:number,maximum:number|null):never; export function as3InitializeInstanceFields(value:object,newTarget:Function):void; export function as3PrepareConstruction(newTarget:unknown,declared:Function,proof:unknown):readonly []; export function as3CancelPreparedConstruction(newTarget:unknown,proof:unknown,frame:unknown):void; export function as3EnterConstruction(value:object,newTarget:unknown,declared:Function,proof:unknown):void; export function as3AbortConstruction(value:object,newTarget:unknown,declared:Function,proof:unknown):void; export function as3CompleteConstruction(value:object,newTarget:unknown,declared:Function,proof:unknown):void; }",
        "",
    ].join("\n"), "utf8");
    const runtimeOutput = path.join(root, "runtime");
    const tsconfig = path.join(root, "tsconfig.json");
    fs.writeFileSync(tsconfig, JSON.stringify({ compilerOptions: { target: "ES2020", module: "CommonJS",
        moduleResolution: "node", strict: true, skipLibCheck: true, types: [], lib: ["ES2020"], outDir: runtimeOutput },
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
    moduleFile("laya/flash/text/TextFormat", "exports.AntiAliasType={ADVANCED:'advanced'};exports.TextFieldAutoSize={CENTER:'center',LEFT:'left',NONE:'none'};exports.TextFieldType={DYNAMIC:'dynamic',INPUT:'input'};exports.TextFormatAlign={CENTER:'center',LEFT:'left'};\n");
    moduleFile("@bleach/as3-runtime/AS3Coerce", "exports.as3Int=v=>Number(v)|0;exports.as3Uint=v=>Number(v)>>>0;exports.as3Number=Number;exports.as3Boolean=Boolean;exports.as3String=String;\n");
    moduleFile("@bleach/as3-runtime/AS3Type", "exports.AS3Types={};exports.as3As=v=>v;exports.as3Is=()=>false;exports.as3ClassType=()=>({});exports.as3InterfaceType=()=>({});exports.as3NamedReferenceType=()=>({});exports.as3RejectConstructorArity=()=>{throw new TypeError('arity')};exports.as3InitializeInstanceFields=()=>{};exports.as3PrepareConstruction=()=>[];exports.as3CancelPreparedConstruction=()=>{};exports.as3EnterConstruction=()=>{};exports.as3AbortConstruction=()=>{};exports.as3CompleteConstruction=()=>{};\n");
    const runtime = spawnSync(process.execPath, ["-e", [
        `const {TextConstants}=require(${JSON.stringify(path.join(runtimeOutput, "TextConstants.js"))});`,
        "const value=new TextConstants();process.stdout.write(JSON.stringify([value.antiAlias(),value.autoCenter(),value.autoLeft(),value.autoNone(),value.dynamicType(),value.inputType(),value.alignCenter(),value.alignLeft()]));",
    ].join("")], { cwd: root, encoding: "utf8", timeout: 30_000, windowsHide: true });
    assert.equal(runtime.status, 0, runtime.stderr);
    assert.deepEqual(JSON.parse(runtime.stdout), ["advanced", "center", "left", "none", "dynamic", "input", "center", "left"]);
});
