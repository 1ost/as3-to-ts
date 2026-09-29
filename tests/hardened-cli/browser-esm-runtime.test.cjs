"use strict";

const assert=require("node:assert/strict");
const childProcess=require("node:child_process");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const test=require("node:test");

const root=path.resolve(__dirname,"../.."),output=fs.mkdtempSync(path.join(os.tmpdir(),"as3-browser-esm-runtime-"));
test.after(()=>fs.rmSync(output,{recursive:true,force:true}));
fs.writeFileSync(path.join(output,"tsconfig.json"),JSON.stringify({compilerOptions:{target:"ES2022",module:"CommonJS",
    strict:true,skipLibCheck:true,esModuleInterop:true,rootDir:path.join(root,"src"),outDir:output,
    typeRoots:[path.join(root,"node_modules/@types")],types:["node"]},files:[
    path.join(root,"src/hardened-cli/browser-esm-runtime.ts"),path.join(root,"src/hardened-cli/errors.ts"),
    ]}));
childProcess.execFileSync(process.execPath,[path.join(root,"node_modules/typescript/bin/tsc"),"-p",path.join(output,"tsconfig.json")],
    {cwd:root,stdio:"inherit"});
fs.symlinkSync(path.join(root,"node_modules"),path.join(output,"node_modules"),"dir");
const {emitBrowserEsmRuntime}=require(path.join(output,"hardened-cli/browser-esm-runtime.js"));

test("browser ESM runtime rewrites and authenticates one closed relative static graph",()=>{
    const result=emitBrowserEsmRuntime([
        {path:"AS3Authority.generated.mjs",code:'import { value } from "./internal/value"; export const answer=value;\n'},
        {path:"internal/value.mjs",code:"export const value=42;\n"},
    ],"@test/runtime",["AS3Authority.generated.mjs"]);
    assert.deepEqual(result.files.map(file=>file.path),["AS3Authority.generated.mjs","internal/value.mjs"]);
    assert.deepEqual(result.primaryRuntime.imports,[{specifier:"./internal/value.mjs",path:"internal/value.mjs"}]);
    result.files.forEach(file=>{assert.doesNotMatch(file.body,/(?:\brequire\s*\(|\bmodule\.exports\b|\bexports\.)/);
        assert.match(file.identity.sha256,/^[0-9a-f]{64}$/);});
});

test("browser ESM runtime rejects unowned, missing, dynamic, and CommonJS dependencies",()=>{
    assert.throws(()=>emitBrowserEsmRuntime([{path:"AS3Authority.generated.mjs",code:'import value from "unowned"; export { value };\n'}],
        "@test/runtime",["AS3Authority.generated.mjs"]),/lacks exact compiler-owned bytes/);
    assert.throws(()=>emitBrowserEsmRuntime([{path:"AS3Authority.generated.mjs",code:'import "./missing";\n'}],
        "@test/runtime",["AS3Authority.generated.mjs"]),/dependency is absent/);
    assert.throws(()=>emitBrowserEsmRuntime([{path:"AS3Authority.generated.mjs",code:'export const load=()=>import("./missing");\n'}],
        "@test/runtime",["AS3Authority.generated.mjs"]),/dynamic import/);
    assert.throws(()=>emitBrowserEsmRuntime([{path:"AS3Authority.generated.mjs",code:'export const value=require("./missing");\n'}],
        "@test/runtime",["AS3Authority.generated.mjs"]),/contains CommonJS/);
});
