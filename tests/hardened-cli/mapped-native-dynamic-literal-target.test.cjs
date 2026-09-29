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
const MOVIECLIP_REVISION="71b52775bec9401b2efb8c5699cf08ca932d58c1";
const FIXED_CALL_REVISION="009ae4376e2c8168d7e7e5631f2f026b7e408a8d";
const MUTATION_REVISION="37e8e3fff8287c1e96f173ea04cf52f4497aeebd";
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

function gitShow(revision,file) {
    const result=childProcess.spawnSync("git",["show",`${revision}:${file}`],{cwd:LAYA,encoding:null,maxBuffer:64*1024*1024});
    assert.equal(result.status,0,result.stderr?.toString()||`${revision}:${file}`);
    return result.stdout;
}

test("mapped-native dynamic literal-target trust root binds immutable AIR evidence and runtime",{skip:!LAYA},()=>{
    const api=loadTypeScript(path.join(ROOT,"src/hardened/mapped-native-dynamic-literal-target-authority.ts"));
    const authority=api.MAPPED_NATIVE_DYNAMIC_LITERAL_TARGET_AUTHORITY;
    assert.equal(authority.movieClipEvidenceRevision,MOVIECLIP_REVISION);
    assert.equal(authority.fixedCallEvidenceRevision,FIXED_CALL_REVISION);
    assert.equal(authority.mutationEvidenceRevision,MUTATION_REVISION);
    for(const revision of [MOVIECLIP_REVISION,FIXED_CALL_REVISION,MUTATION_REVISION])
        assert.equal(childProcess.spawnSync("git",["merge-base","--is-ancestor",revision,"HEAD"],{cwd:LAYA}).status,0,revision);
    const evidence=[
        [MOVIECLIP_REVISION,"tests/nativeFlashOracle/dynamic-movieclip-literal-read/native-air.json",authority.movieClipNativeEvidenceSha256],
        [MOVIECLIP_REVISION,"tests/nativeFlashOracle/dynamic-movieclip-literal-read/browser-air.json",authority.movieClipBrowserEvidenceSha256],
        [FIXED_CALL_REVISION,"tests/nativeFlashOracle/dynamic-call-arguments/DynamicCallArgumentsProbe.as",authority.fixedCallSourceSha256],
        [FIXED_CALL_REVISION,"tests/nativeFlashOracle/dynamic-call-arguments/native-air.json",authority.fixedCallNativeEvidenceSha256],
        [FIXED_CALL_REVISION,"tests/nativeFlashOracle/dynamic-call-arguments/comparison.json",authority.fixedCallComparisonSha256],
        [FIXED_CALL_REVISION,"tests/nativeFlashOracle/dynamic-call-arguments/scenario.json",authority.fixedCallScenarioSha256],
        [MUTATION_REVISION,"tests/nativeFlashOracle/generated-dynamic-mutations/evidence-pin.json",authority.mutationEvidencePinSha256],
        [MUTATION_REVISION,"tests/nativeFlashOracle/generated-dynamic-mutations/evidence/receipt.json",authority.mutationReceiptSha256],
        [MUTATION_REVISION,"tests/nativeFlashOracle/generated-dynamic-mutations/source/MutationProbe.as",authority.mutationProbeSha256],
        [MUTATION_REVISION,"tests/nativeFlashOracle/generated-dynamic-mutations/source/mutation/Mutator.as",authority.mutationMutatorSha256],
        [MUTATION_REVISION,"tests/nativeFlashOracle/generated-dynamic-mutations/source/mutation/Slot.as",authority.mutationSlotSha256],
    ];
    for(const [revision,file,digest] of evidence)assert.equal(sha256(gitShow(revision,file)),digest,file);
    for(const [source,digest] of [
        [authority.runtimeObjectDispatchSourcePath,authority.runtimeObjectDispatchSourceSha256],
        [authority.runtimeTypeSourcePath,authority.runtimeTypeSourceSha256],
        [authority.runtimeTypeRegistrySourcePath,authority.runtimeTypeRegistrySourceSha256],
    ])assert.equal(sha256(fs.readFileSync(path.join(ROOT,source))),digest,source);
    const native=JSON.parse(gitShow(MOVIECLIP_REVISION,
        "tests/nativeFlashOracle/dynamic-movieclip-literal-read/native-air.json"));
    assert.equal(native.runtimeAuthority.artifacts["frameworks/libs/air/airglobal.swc"],authority.sourceArtifactSha256);
    assert.equal(native.sdkAbcInspection.classes.find(row=>row.qname==="flash.display::MovieClip").dynamic,true);
    assert.equal(native.capture.state.observations[0].result.ownLock.own,true);
    assert.equal(native.capture.state.observations[0].result.ownBuiltin.errorID,1037);
    const fixed=JSON.parse(gitShow(FIXED_CALL_REVISION,"tests/nativeFlashOracle/dynamic-call-arguments/native-air.json"));
    assert.deepEqual(fixed.capture.state.observations[0].result,["value","receiver|argument|coerce|body"]);
    assert.equal(JSON.parse(gitShow(FIXED_CALL_REVISION,
        "tests/nativeFlashOracle/dynamic-call-arguments/comparison.json")).status,"passed");
    const receipt=JSON.parse(gitShow(MUTATION_REVISION,
        "tests/nativeFlashOracle/generated-dynamic-mutations/evidence/receipt.json"));
    assert.deepEqual([receipt.status,receipt.capture.status,receipt.capture.identical,receipt.capture.observationCount],
        ["passed","passed",true,19]);
    const {authoritySha256,...document}=authority;
    assert.equal(sha256(canonical(document)+"\n"),authoritySha256);
});

test("target proof requires an authentic dynamic receiver and rejects every native ancestry collision",()=>{
    const sourceMembers=loadTypeScript(path.join(ROOT,"src/hardened/source-member-authority.ts"));
    const api=loadTypeScript(path.join(ROOT,"src/hardened/mapped-native-dynamic-literal-target-authority.ts"));
    const document=(movieDynamic=true,artifact=api.MAPPED_NATIVE_DYNAMIC_LITERAL_TARGET_AUTHORITY.sourceArtifactSha256)=>({
        schema:"as3-source-member-authority@2",generator:"air-sdk-swfdump-abc@1",sourceArtifactSha256:artifact,
        entryCount:3,entries:[
            {qname:"Object",baseQName:null,dynamic:true,ownInstanceMemberNames:["hasOwnProperty"]},
            {qname:"flash.display.MovieClip",baseQName:"flash.display.Sprite",dynamic:movieDynamic,ownInstanceMemberNames:[]},
            {qname:"flash.display.Sprite",baseQName:"Object",dynamic:false,ownInstanceMemberNames:["nativeName"]},
        ],
    });
    const load=value=>{const json=JSON.stringify(value);return sourceMembers.loadSourceMemberAuthority(json,sha256(json),sha256);};
    const loaded=load(document());
    const proof=api.mappedNativeDynamicLiteralTargetProof(loaded,"flash.display.MovieClip","tip",
        "laya/flash/display/MovieClip","MovieClip");
    assert.equal(Object.isFrozen(proof),true);
    api.assertMappedNativeDynamicLiteralTargetProof(proof,"flash.display.MovieClip","tip",
        "laya/flash/display/MovieClip","MovieClip");
    assert.throws(()=>api.mappedNativeDynamicLiteralTargetProof(loaded,"flash.display.MovieClip","nativeName",
        "laya/flash/display/MovieClip","MovieClip"),error=>
        error.code==="HARDENED_MAPPED_NATIVE_DYNAMIC_LITERAL_TARGET_AUTHORITY");
    for(const invalid of [load(document(false)),load(document(true,"a".repeat(64)))])
        assert.throws(()=>api.mappedNativeDynamicLiteralTargetProof(invalid,"flash.display.MovieClip","tip",
            "laya/flash/display/MovieClip","MovieClip"),error=>
            error.code==="HARDENED_MAPPED_NATIVE_DYNAMIC_LITERAL_TARGET_AUTHORITY");
    for(const [key,module,exportName] of [["not-valid!","laya/flash/display/MovieClip","MovieClip"],
        ["tip","../forged","MovieClip"],["tip","laya/flash/display/MovieClip","not-valid!"]])
        assert.throws(()=>api.mappedNativeDynamicLiteralTargetProof(loaded,"flash.display.MovieClip",key,module,exportName),
            error=>error.code==="HARDENED_MAPPED_NATIVE_DYNAMIC_LITERAL_TARGET_AUTHORITY");
    assert.throws(()=>api.assertMappedNativeDynamicLiteralTargetProof({...proof,propertyName:"other"},
        "flash.display.MovieClip","tip","laya/flash/display/MovieClip","MovieClip"),error=>
        error.code==="HARDENED_MAPPED_NATIVE_DYNAMIC_LITERAL_TARGET_AUTHORITY");
});

test("MovieClip literal writes and calls use nominal dispatch while broader mutation remains held",
    {skip:!(AIR&&LAYA)},t=>{
    const temporary=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"mapped-native-dynamic-target-")));
    t.after(()=>fs.rmSync(temporary,{recursive:true,force:true}));
    const source=path.join(temporary,"source");fs.mkdirSync(source);
    const files={
        "Good.as":`package {import flash.display.MovieClip; public final class Good {public function run(value:MovieClip):* {value.tip="loading";value.render("loading",1);value.resize(640,480);return value.tip;}}}\n`,
        "ComputedWrite.as":`package {import flash.display.MovieClip; public final class ComputedWrite {public function run(value:MovieClip,key:String):void {value[key]="x";}}}\n`,
        "CompoundWrite.as":`package {import flash.display.MovieClip; public final class CompoundWrite {public function run(value:MovieClip):void {value.tip+="x";}}}\n`,
        "DeleteWrite.as":`package {import flash.display.MovieClip; public final class DeleteWrite {public function run(value:MovieClip):Boolean {return delete value.tip;}}}\n`,
        "SealedWrite.as":`package {import flash.display.Sprite; public final class SealedWrite {public function run(value:Sprite):void {value.tip="x";}}}\n`,
        "UpdateWrite.as":`package {import flash.display.MovieClip; public final class UpdateWrite {public function run(value:MovieClip):void {value.count++;}}}\n`,
    };
    for(const [name,bytes] of Object.entries(files))fs.writeFileSync(path.join(source,name),bytes);
    const run=(command,args,expected=0)=>{const result=childProcess.spawnSync(command,args,{cwd:ROOT,encoding:"utf8",timeout:180000});
        assert.equal(result.status,expected,result.stdout+result.stderr);return result;};
    const profile=path.join(temporary,"profile");
    run("python3",["-B","tools/create-fixture-profile.py","--source",source,"--entry","Good",
        "--air-sdk",AIR,"--laya",LAYA,"--output",profile]);
    const qualified=path.join(temporary,"qualified");
    run(process.execPath,["bin/as3-frontend","qualify",source,qualified,
        "--source-census",path.join(profile,"census.json"),
        "--target-capabilities",path.join(LAYA,"docTool/architecture/authored-content-capabilities.json"),
        "--profile-lock",path.join(profile,"profile-lock.json")]);
    const rows=JSON.parse(fs.readFileSync(path.join(qualified,"manifest.json"),"utf8")).files;
    assert.equal(rows.find(row=>row.sourcePath==="Good.as").status,"admitted");
    for(const [name,codes] of Object.entries({
        "ComputedWrite.as":["HARDENED_MAPPED_NATIVE_DYNAMIC_LITERAL_READ_CONTEXT"],
        "CompoundWrite.as":["HARDENED_COMPOUND_TARGET"],
        "DeleteWrite.as":["HARDENED_DELETE_TARGET"],
        "SealedWrite.as":["HARDENED_MAPPED_NATIVE_DYNAMIC_LITERAL_TARGET_AUTHORITY"],
        "UpdateWrite.as":["HARDENED_UPDATE_NUMBER"],
    })) {
        const row=rows.find(item=>item.sourcePath===name);assert.equal(row.status,"held",JSON.stringify(row));
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
    const nominal='__as3Cast\\(value, __as3NamedReferenceType\\("flash\\.display\\.MovieClip"\\)\\)';
    assert.match(code,new RegExp(`__as3ObjectWrite\\(${nominal}, "tip", "loading", "Good"\\)`));
    assert.match(code,new RegExp(`__as3ObjectCall\\(${nominal}, "render", \\["loading", 1\\], "Good"\\)`));
    assert.match(code,new RegExp(`__as3ObjectCall\\(${nominal}, "resize", \\[640, 480\\], "Good"\\)`));
    assert.match(code,new RegExp(`__as3ObjectRead\\(${nominal}, "tip", "Good"\\)`));
    const layaStub=path.join(temporary,"laya-stub.d.ts");
    fs.writeFileSync(layaStub,'declare module "laya/flash/display/MovieClip" { export class MovieClip {} }\n');
    const config=path.join(temporary,"strict.json");
    fs.writeFileSync(config,JSON.stringify({compilerOptions:{target:"ES2022",module:"CommonJS",moduleResolution:"Node",
        strict:true,skipLibCheck:true,noEmit:true,baseUrl:ROOT,
        paths:{"@laya/as3-runtime/*":["src/hardened-runtime/*"]}},files:[path.join(root,"Good.ts"),layaStub]}));
    run(process.execPath,[path.join(ROOT,"node_modules/typescript-4-9/bin/tsc"),"-p",config]);
});
