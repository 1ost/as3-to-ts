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
const canonical=value=>value===null||typeof value!=="object"?JSON.stringify(value)
    :Array.isArray(value)?`[${value.map(canonical).join(",")}]`
        :`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;

function loadTypeScript(file) {
    const record={exports:{}};
    const output=ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{
        target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,
    }}).outputText;
    Function("require","module","exports",output)(require,record,record.exports);
    return record.exports;
}

test("shared Object constructor target retains the actual Flash ordinary Object evidence",{skip:!LAYA},()=>{
    const root=path.join(LAYA,"tests/nativeDynamicObject");
    const retained=JSON.parse(fs.readFileSync(path.join(root,"offline-oracle.json"),"utf8"));
    assert.equal(retained.schema,1);
    assert.equal(retained.scope,"retained actual Flash ordinary Object write observations");
    assert.equal(retained.origin.flashSHA256,"73d6bb72bb7eaaaac8b553e23ebcac893c27bae46cf44ee2230c6b00058a497b");
    assert.equal(retained.expectedFlash.base.object,true);
    assert.equal(retained.expectedFlash.base.array,false);
    assert.equal(retained.expectedFlash.base.prototype,true);
    for(const source of retained.sources)
        assert.equal(sha256(fs.readFileSync(path.join(LAYA,source.path))),source.sha256,source.path);
    const api=loadTypeScript(path.join(LAYA,"src/layaAir/flash/utils/AS3DynamicObject.ts"));
    const value=api.as3CreateDynamicObject();
    assert.equal(Object.getPrototypeOf(value),Object.prototype);
    assert.equal(api.isAS3DynamicObject(value),true);
    assert.equal(api.isAS3DynamicObject({}),false);
    assert.equal(api.as3SetDynamicProperty(value,"__proto__",7),7);
    assert.equal(Object.getPrototypeOf(value),Object.prototype);
    assert.equal(Object.prototype.hasOwnProperty.call(value,"__proto__"),true);
});

test("zero-argument intrinsic new Object emits only the authenticated shared factory",{skip:!(AIR&&LAYA)},t=>{
    const temporary=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"object-constructor-provider-")));
    t.after(()=>fs.rmSync(temporary,{recursive:true,force:true}));
    const source=path.join(temporary,"source");fs.mkdirSync(source);
    const files={
        "Good.as":`package {public final class Good {public function run():Object {return new Object();}}}\n`,
        "Extra.as":`package {public final class Extra {public function run():Object {return new Object(1);}}}\n`,
        "Shadow.as":`package {public final class Shadow {public function run(Object:*):Object {return new Object();}}}\n`,
    };
    for(const [name,bytes] of Object.entries(files))fs.writeFileSync(path.join(source,name),bytes);
    const run=(command,args,expected=0)=>{const result=childProcess.spawnSync(command,args,{cwd:ROOT,encoding:"utf8",timeout:180000});
        assert.equal(result.status,expected,result.stdout+result.stderr);return result;};
    const profile=path.join(temporary,"profile");
    run("python3",["-B","tools/create-fixture-profile.py","--source",source,"--entry","Good",
        "--air-sdk",AIR,"--laya",LAYA,"--shared-object-constructor","--output",profile]);
    const qualified=path.join(temporary,"qualified");
    run(process.execPath,["bin/as3-frontend","qualify",source,qualified,
        "--source-census",path.join(profile,"census.json"),
        "--target-capabilities",path.join(LAYA,"docTool/architecture/authored-content-capabilities.json"),
        "--profile-lock",path.join(profile,"profile-lock.json")]);
    const rows=JSON.parse(fs.readFileSync(path.join(qualified,"manifest.json"),"utf8")).files;
    assert.equal(rows.find(row=>row.sourcePath==="Good.as").status,"admitted");
    for(const [name,code] of [["Extra.as","HARDENED_OBJECT_CONSTRUCTOR_ARITY"],
        ["Shadow.as","HARDENED_NEW_SHADOW"]]) {
        const row=rows.find(item=>item.sourcePath===name);assert.equal(row.status,"held",JSON.stringify(row));
        assert.equal(row.code,code,name);
    }
    const goodSource=path.join(temporary,"good-source");fs.mkdirSync(goodSource);
    fs.writeFileSync(path.join(goodSource,"Good.as"),files["Good.as"]);
    const goodProfile=path.join(temporary,"good-profile");
    run("python3",["-B","tools/create-fixture-profile.py","--source",goodSource,"--entry","Good",
        "--air-sdk",AIR,"--laya",LAYA,"--shared-object-constructor","--output",goodProfile]);
    const output=path.join(temporary,"output");
    run(process.execPath,["bin/as3-frontend","transpile",goodSource,output,
        "--source-census",path.join(goodProfile,"census.json"),
        "--target-capabilities",path.join(LAYA,"docTool/architecture/authored-content-capabilities.json"),
        "--profile-lock",path.join(goodProfile,"profile-lock.json")]);
    const code=fs.readFileSync(path.join(output,"__as3_runtime/application/Good.ts"),"utf8");
    assert.match(code,/as3CreateDynamicObject as __as3SharedCreateDynamicObject/);
    assert.match(code,/return __as3SharedCreateDynamicObject\(\);/);
    assert.doesNotMatch(code,/new Object/);
    const stub=path.join(temporary,"laya-stub.d.ts");
    fs.writeFileSync(stub,'declare module "laya/flash/utils/AS3DynamicObject" { export function as3CreateDynamicObject():Record<string,any>; }\n');
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
    assert.equal(held.status,"held");assert.equal(held.code,"HARDENED_NEW_AUTHORITY");

    const lockPath=path.join(goodProfile,"profile-lock.json");
    const savedLock=fs.readFileSync(lockPath);
    const positiveLock=JSON.parse(savedLock);
    const providerPath=path.join(goodProfile,positiveLock.files.objectConstructorProvider.path);
    const savedProvider=fs.readFileSync(providerPath);
    try {
        const forged=JSON.parse(savedProvider);
        forged.targetSources["src/layaAir/flash/utils/AS3DynamicObject.ts"]="0".repeat(64);
        fs.writeFileSync(providerPath,canonical(forged)+"\n");
        const changed=JSON.parse(savedLock);
        changed.files.objectConstructorProvider.sha256=sha256(fs.readFileSync(providerPath));
        fs.writeFileSync(lockPath,canonical(changed)+"\n");
        const rejected=childProcess.spawnSync(process.execPath,["bin/as3-frontend","qualify",goodSource,
            path.join(temporary,"forged-output"),"--source-census",path.join(goodProfile,"census.json"),
            "--target-capabilities",path.join(LAYA,"docTool/architecture/authored-content-capabilities.json"),
            "--profile-lock",lockPath],{cwd:ROOT,encoding:"utf8",timeout:180000});
        assert.equal(rejected.status,6,rejected.stdout+rejected.stderr);
        assert.match(rejected.stderr,/Object constructor provider/);
    } finally {
        fs.writeFileSync(providerPath,savedProvider);
        fs.writeFileSync(lockPath,savedLock);
    }
});
