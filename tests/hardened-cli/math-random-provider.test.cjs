"use strict";

const assert=require("node:assert/strict");
const childProcess=require("node:child_process");
const crypto=require("node:crypto");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const test=require("node:test");
const ts=require("typescript-4-9");

const ROOT=path.resolve(__dirname,"../..");
const AIR=process.env.HARDENED_FIXTURE_AIR_SDK;
const LAYA=process.env.HARDENED_FIXTURE_LAYA;
const sha256=value=>crypto.createHash("sha256").update(value).digest("hex");

function loadTypeScript(file) {
    const record={exports:{}};
    const output=ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{
        target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,
    }}).outputText;
    Function("require","module","exports",output)(require,record,record.exports);
    return record.exports;
}

test("shared Math.random bridge is bound to retained AIR range evidence and exact Laya target",{skip:!LAYA},()=>{
    const evidence=path.join(LAYA,"tests/nativeFlashOracle/math-random-range");
    const native=JSON.parse(fs.readFileSync(path.join(evidence,"native-air.json"),"utf8"));
    assert.equal(native.status,"passed");
    assert.equal(native.runtimeAuthority.artifacts["frameworks/libs/air/airglobal.swc"],
        "e0f81fdb2029d2bb16e6987c8d85d4eba5eedfa3a23ed6e7f780bf6eb67b0546");
    assert.equal(sha256(fs.readFileSync(path.join(evidence,"MathRandomRangeProbe.as"))),
        native.sourceFiles["MathRandomRangeProbe.as"]);
    for(const name of ["capture-a.json","capture-b.json"])
        assert.equal(sha256(fs.readFileSync(path.join(evidence,name))),native.sourceFiles[name]);
    assert.deepEqual(native.observations,[{id:"random-range",result:{sampleCount:4096,
        allFinite:true,allInRange:true,sawDifferent:true}}]);
    assert.match(fs.readFileSync(path.join(LAYA,"tests/nativeFlashOracle/math-floor-bridge/sdk-Math.as.txt"),"utf8"),
        /public static native function random\(\) : Number;/);
    const api=loadTypeScript(path.join(LAYA,"src/layaAir/flash/utils/AS3Math.ts"));
    const original=Math.random;
    try {
        Math.random=()=>0.25;
        assert.equal(api.sourceMathRandom(),0.25);
        Math.random=()=>-1;
        assert.throws(()=>api.sourceMathRandom(),/outside the source Number range/);
        Math.random=()=>1;
        assert.throws(()=>api.sourceMathRandom(),/outside the source Number range/);
        Math.random=()=>Number.NaN;
        assert.throws(()=>api.sourceMathRandom(),/outside the source Number range/);
    } finally { Math.random=original; }
});

test("zero-argument intrinsic Math.random emits only the authenticated shared provider",{skip:!(AIR&&LAYA)},t=>{
    const temporary=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"math-random-provider-")));
    t.after(()=>fs.rmSync(temporary,{recursive:true,force:true}));
    const source=path.join(temporary,"source");fs.mkdirSync(source);
    const files={
        "Good.as":`package {public final class Good {public function run():Number {return Math.random();}}}\n`,
        "Extra.as":`package {public final class Extra {public function run():Number {return Math.random(1);}}}\n`,
        "Closure.as":`package {public final class Closure {public function run():Function {return Math.random;}}}\n`,
        "Shadow.as":`package {public final class Shadow {public function run(Math:Object):Number {return Math.random();}}}\n`,
    };
    for(const [name,bytes] of Object.entries(files))fs.writeFileSync(path.join(source,name),bytes);
    const run=(command,args,expected=0)=>{const result=childProcess.spawnSync(command,args,{cwd:ROOT,encoding:"utf8",timeout:180000});
        assert.equal(result.status,expected,result.stdout+result.stderr);return result;};
    const profile=path.join(temporary,"profile");
    run("python3",["-B","tools/create-fixture-profile.py","--source",source,"--entry","Good",
        "--air-sdk",AIR,"--laya",LAYA,"--shared-math-floor","--output",profile]);
    const qualified=path.join(temporary,"qualified");
    run(process.execPath,["bin/as3-frontend","qualify",source,qualified,
        "--source-census",path.join(profile,"census.json"),
        "--target-capabilities",path.join(LAYA,"docTool/architecture/authored-content-capabilities.json"),
        "--profile-lock",path.join(profile,"profile-lock.json")]);
    const rows=JSON.parse(fs.readFileSync(path.join(qualified,"manifest.json"),"utf8")).files;
    assert.equal(rows.find(row=>row.sourcePath==="Good.as").status,"admitted");
    for(const [name,code] of [["Extra.as","HARDENED_MATH_ARITY"],["Closure.as","HARDENED_MATH_MEMBER"],
        ["Shadow.as","HARDENED_MATH_SHADOW"]]) {
        const row=rows.find(item=>item.sourcePath===name);assert.equal(row.status,"held",JSON.stringify(row));
        assert.equal(row.code,code,name);
    }
    const goodSource=path.join(temporary,"good-source");fs.mkdirSync(goodSource);
    fs.writeFileSync(path.join(goodSource,"Good.as"),files["Good.as"]);
    const goodProfile=path.join(temporary,"good-profile");
    run("python3",["-B","tools/create-fixture-profile.py","--source",goodSource,"--entry","Good",
        "--air-sdk",AIR,"--laya",LAYA,"--shared-math-floor","--output",goodProfile]);
    const output=path.join(temporary,"output");
    run(process.execPath,["bin/as3-frontend","transpile",goodSource,output,
        "--source-census",path.join(goodProfile,"census.json"),
        "--target-capabilities",path.join(LAYA,"docTool/architecture/authored-content-capabilities.json"),
        "--profile-lock",path.join(goodProfile,"profile-lock.json")]);
    const code=fs.readFileSync(path.join(output,"__as3_runtime/application/Good.ts"),"utf8");
    assert.match(code,/sourceMathRandom as __as3SharedMathRandom/);
    assert.match(code,/return __as3SharedMathRandom\(\);/);
    assert.doesNotMatch(code,/Math\.random/);
    const stub=path.join(temporary,"laya-stub.d.ts");
    fs.writeFileSync(stub,'declare module "laya/flash/utils/AS3Math" { export function sourceMathFloor(value:number):number; export function sourceMathRandom():number; }\n');
    const config=path.join(temporary,"strict.json");
    fs.writeFileSync(config,JSON.stringify({compilerOptions:{target:"ES2022",module:"CommonJS",moduleResolution:"Node",
        strict:true,skipLibCheck:true,noEmit:true,baseUrl:ROOT,
        paths:{"@laya/as3-runtime/*":["src/hardened-runtime/*"]}},files:[path.join(output,"__as3_runtime/application/Good.ts"),stub]}));
    run(process.execPath,[path.join(ROOT,"node_modules/typescript-4-9/bin/tsc"),"-p",config]);

    const withoutProfile=path.join(temporary,"without-profile");
    run("python3",["-B","tools/create-fixture-profile.py","--source",goodSource,"--entry","Good",
        "--air-sdk",AIR,"--laya",LAYA,"--output",withoutProfile]);
    const withoutOutput=path.join(temporary,"without-output");
    run(process.execPath,["bin/as3-frontend","qualify",goodSource,withoutOutput,
        "--source-census",path.join(withoutProfile,"census.json"),
        "--target-capabilities",path.join(LAYA,"docTool/architecture/authored-content-capabilities.json"),
        "--profile-lock",path.join(withoutProfile,"profile-lock.json")]);
    const held=JSON.parse(fs.readFileSync(path.join(withoutOutput,"manifest.json"),"utf8")).files[0];
    assert.equal(held.status,"held");assert.equal(held.code,"HARDENED_MATH_MEMBER");
});
