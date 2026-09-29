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
const REVISION="71b52775bec9401b2efb8c5699cf08ca932d58c1";
const sha256=value=>crypto.createHash("sha256").update(value).digest("hex");
const canonical=value=>Array.isArray(value)?`[${value.map(canonical).join(",")}]`
    :value!==null&&typeof value==="object"?`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`
    :JSON.stringify(value);

const moduleCache=new Map();
function loadTypeScript(file,cache=moduleCache) {
    if(cache.has(file))return cache.get(file).exports;
    const record={exports:{}};cache.set(file,record);
    const output=ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{
        target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,
    }}).outputText;
    Function("require","module","exports",output)(specifier=>specifier.startsWith(".")
        ?loadTypeScript(path.resolve(path.dirname(file),specifier+".ts"),cache):require(specifier),record,record.exports);
    return record.exports;
}

test("mapped-native dynamic literal-read trust root binds exact retained evidence and runtime",{skip:!LAYA},()=>{
    const api=loadTypeScript(path.join(ROOT,"src/hardened/mapped-native-dynamic-literal-read-authority.ts"));
    const authority=api.MAPPED_NATIVE_DYNAMIC_LITERAL_READ_AUTHORITY;
    assert.equal(authority.evidenceRevision,REVISION);
    assert.equal(childProcess.spawnSync("git",["merge-base","--is-ancestor",REVISION,"HEAD"],
        {cwd:LAYA}).status,0);
    const evidenceRoot=path.join(fs.realpathSync(LAYA),"tests/nativeFlashOracle/dynamic-movieclip-literal-read");
    for(const [name,digest] of [
        ["native-air.json",authority.nativeEvidenceSha256],
        ["browser-air.json",authority.browserEvidenceSha256],
        ["browser-pin.json",authority.browserPinSha256],
        ["run-browser.mjs",authority.browserRunnerSha256],
    ])assert.equal(sha256(fs.readFileSync(path.join(evidenceRoot,name))),digest,name);
    for(const [source,digest] of [
        [authority.runtimeObjectDispatchSourcePath,authority.runtimeObjectDispatchSourceSha256],
        [authority.runtimeTypeSourcePath,authority.runtimeTypeSourceSha256],
        [authority.runtimeTypeRegistrySourcePath,authority.runtimeTypeRegistrySourceSha256],
    ])assert.equal(sha256(fs.readFileSync(path.join(ROOT,source))),digest,source);
    const {authoritySha256,...document}=authority;
    assert.equal(sha256(canonical(document)+"\n"),authoritySha256);
    const native=JSON.parse(fs.readFileSync(path.join(evidenceRoot,"native-air.json"),"utf8"));
    const relation=JSON.parse(fs.readFileSync(path.join(evidenceRoot,"browser-air.json"),"utf8"));
    assert.equal(native.runtimeAuthority.artifacts["frameworks/libs/air/airglobal.swc"],authority.sourceArtifactSha256);
    assert.deepEqual(native.sdkAbcInspection.classes.map(row=>[row.qname,row.dynamic]),[
        ["flash.display::Sprite",false],["flash.display::MovieClip",true]]);
    assert.equal(relation.relation.authoredInstanceGetterIdentityAndOnce,"equal");
    assert.equal(relation.relation.forgedUnregisteredRejection,"generated-model-only");
    assert.equal(relation.relation.pinnedCompilerOwnDynamicRead,"held-returns-undefined");
});

test("proof construction requires one authentic @2 dynamic entry and exact mapping identity",()=>{
    const sourceMembers=loadTypeScript(path.join(ROOT,"src/hardened/source-member-authority.ts"));
    const api=loadTypeScript(path.join(ROOT,"src/hardened/mapped-native-dynamic-literal-read-authority.ts"));
    const document=(schema="as3-source-member-authority@2",dynamic=true,artifact=api.MAPPED_NATIVE_DYNAMIC_LITERAL_READ_AUTHORITY.sourceArtifactSha256)=>({
        schema,generator:"air-sdk-swfdump-abc@1",sourceArtifactSha256:artifact,entryCount:1,
        entries:[{qname:"flash.display.MovieClip",baseQName:null,ownInstanceMemberNames:[],...(schema.endsWith("@2")?{dynamic}:{})}],
    });
    const load=value=>{const json=JSON.stringify(value);return sourceMembers.loadSourceMemberAuthority(json,sha256(json),sha256);};
    const loaded=load(document());
    const proof=api.mappedNativeDynamicLiteralReadProof(loaded,"flash.display.MovieClip","lock",
        "laya/flash/display/MovieClip","MovieClip");
    assert.equal(Object.isFrozen(proof),true);
    api.assertMappedNativeDynamicLiteralReadProof(proof,"flash.display.MovieClip","lock",
        "laya/flash/display/MovieClip","MovieClip");
    for(const value of [document("as3-source-member-authority@1"),document(undefined,false),
        document(undefined,true,"a".repeat(64))]) {
        assert.throws(()=>api.mappedNativeDynamicLiteralReadProof(load(value),"flash.display.MovieClip","lock",
            "laya/flash/display/MovieClip","MovieClip"),error=>
            error.code==="HARDENED_MAPPED_NATIVE_DYNAMIC_LITERAL_READ_AUTHORITY");
    }
    for(const [key,module,exportName] of [["not-valid!","laya/flash/display/MovieClip","MovieClip"],
        ["lock","../forged","MovieClip"],["lock","laya/flash/display/MovieClip","not-valid!"]])
        assert.throws(()=>api.mappedNativeDynamicLiteralReadProof(loaded,"flash.display.MovieClip",key,module,exportName),
            error=>error.code==="HARDENED_MAPPED_NATIVE_DYNAMIC_LITERAL_READ_AUTHORITY");
    assert.throws(()=>api.assertMappedNativeDynamicLiteralReadProof({...proof,propertyName:"other"},
        "flash.display.MovieClip","lock","laya/flash/display/MovieClip","MovieClip"),error=>
        error.code==="HARDENED_MAPPED_NATIVE_DYNAMIC_LITERAL_READ_AUTHORITY");
});

test("exact MovieClip literal read emits nominal object dispatch and hostile variants remain held",
    {skip:!(AIR&&LAYA)},t=>{
    const temporary=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"mapped-native-dynamic-read-")));
    t.after(()=>fs.rmSync(temporary,{recursive:true,force:true}));
    const source=path.join(temporary,"source");fs.mkdirSync(source);
    const files={
        "Good.as":`package {import flash.display.MovieClip; public final class Good {public function run(value:MovieClip):* {return value["lock"];}}}\n`,
        "Computed.as":`package {import flash.display.MovieClip; public final class Computed {public function run(value:MovieClip,key:String):* {return value[key];}}}\n`,
        "Write.as":`package {import flash.display.MovieClip; public final class Write {public function run(value:MovieClip):void {value["lock"]=null;}}}\n`,
        "DeleteRead.as":`package {import flash.display.MovieClip; public final class DeleteRead {public function run(value:MovieClip):Boolean {return delete value["lock"];}}}\n`,
        "CallRead.as":`package {import flash.display.MovieClip; public final class CallRead {public function run(value:MovieClip):* {return value["lock"]();}}}\n`,
        "StaticRead.as":`package {import flash.display.MovieClip; public final class StaticRead {public function run():* {return MovieClip["lock"];}}}\n`,
        "SealedRead.as":`package {import flash.display.Sprite; public final class SealedRead {public function run(value:Sprite):* {return value["lock"];}}}\n`,
    };
    for(const [name,bytes] of Object.entries(files))fs.writeFileSync(path.join(source,name),bytes);
    const run=(command,args,expected=0)=>{const result=childProcess.spawnSync(command,args,{cwd:ROOT,encoding:"utf8",timeout:180000});
        assert.equal(result.status,expected,result.stdout+result.stderr);return result;};
    const profile=path.join(temporary,"profile");
    run("python3",["-B","tools/create-fixture-profile.py","--source",source,"--entry","Good",
        "--air-sdk",AIR,"--laya",LAYA,"--output",profile]);
    const profileLock=JSON.parse(fs.readFileSync(path.join(profile,"profile-lock.json"),"utf8"));
    const sourceMemberBytes=fs.readFileSync(path.join(profile,profileLock.files.sourceMemberAuthority.path),"utf8");
    assert.equal(sha256(sourceMemberBytes),profileLock.files.sourceMemberAuthority.sha256);
    const sourceMemberDocument=JSON.parse(sourceMemberBytes);
    assert.equal(sourceMemberDocument.schema,"as3-source-member-authority@2");
    assert.equal(sourceMemberDocument.sourceArtifactSha256,
        "e0f81fdb2029d2bb16e6987c8d85d4eba5eedfa3a23ed6e7f780bf6eb67b0546");
    assert.equal(sourceMemberDocument.entries.find(row=>row.qname==="flash.display.MovieClip").dynamic,true);
    const qualified=path.join(temporary,"qualified");
    run(process.execPath,["bin/as3-frontend","qualify",source,qualified,"--source-census",path.join(profile,"census.json"),
        "--target-capabilities",path.join(LAYA,"docTool/architecture/authored-content-capabilities.json"),
        "--profile-lock",path.join(profile,"profile-lock.json")]);
    const rows=JSON.parse(fs.readFileSync(path.join(qualified,"manifest.json"),"utf8")).files;
    assert.equal(rows.find(row=>row.sourcePath==="Good.as").status,"admitted");
    for(const [name,codes] of Object.entries({
        "Computed.as":["HARDENED_MAPPED_NATIVE_DYNAMIC_LITERAL_READ_KEY"],
        "Write.as":["HARDENED_MAPPED_NATIVE_DYNAMIC_LITERAL_READ_CONTEXT"],
        "DeleteRead.as":["HARDENED_MAPPED_NATIVE_DYNAMIC_LITERAL_READ_CONTEXT"],
        "CallRead.as":["HARDENED_MAPPED_NATIVE_DYNAMIC_LITERAL_READ_CONTEXT"],
        "StaticRead.as":["HARDENED_ASSIGNMENT_TYPE","HARDENED_INDEX_TARGET"],
        "SealedRead.as":["HARDENED_MAPPED_NATIVE_DYNAMIC_LITERAL_READ_AUTHORITY"],
    })) {
        const row=rows.find(row=>row.sourcePath===name);assert.equal(row.status,"held",JSON.stringify(row));
        assert(codes.includes(row.code),`${name}: unexpected ${row.code}`);
    }

    const goodSource=path.join(temporary,"good-source");fs.mkdirSync(goodSource);
    fs.writeFileSync(path.join(goodSource,"Good.as"),files["Good.as"]);
    const goodProfile=path.join(temporary,"good-profile");
    run("python3",["-B","tools/create-fixture-profile.py","--source",goodSource,"--entry","Good",
        "--air-sdk",AIR,"--laya",LAYA,"--output",goodProfile]);
    const output=path.join(temporary,"out");
    run(process.execPath,["bin/as3-frontend","transpile",goodSource,output,
        "--source-census",path.join(goodProfile,"census.json"),
        "--target-capabilities",path.join(LAYA,"docTool/architecture/authored-content-capabilities.json"),
        "--profile-lock",path.join(goodProfile,"profile-lock.json")]);
    const root=path.join(output,"__as3_runtime/application");
    const code=fs.readFileSync(path.join(root,"Good.ts"),"utf8");
    assert.match(code,/__as3ObjectRead\(__as3Cast\(value, __as3NamedReferenceType\("flash\.display\.MovieClip"\)\), "lock", "Good"\)/);
    assert.equal((code.match(/__as3ObjectRead/g)||[]).length,2,"one import and one exact runtime operation expected");
    const layaStub=path.join(temporary,"laya-stub.d.ts");
    fs.writeFileSync(layaStub,'declare module "laya/flash/display/MovieClip" { export class MovieClip {} }\n');
    const config=path.join(temporary,"strict.json");
    fs.writeFileSync(config,JSON.stringify({compilerOptions:{target:"ES2022",module:"CommonJS",moduleResolution:"Node",
        strict:true,skipLibCheck:true,noEmit:true,baseUrl:ROOT,
        paths:{"@laya/as3-runtime/*":["src/hardened-runtime/*"]}},files:[path.join(root,"Good.ts"),layaStub]}));
    run(process.execPath,[path.join(ROOT,"node_modules/typescript-4-9/bin/tsc"),"-p",config]);

});
