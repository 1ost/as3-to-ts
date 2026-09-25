"use strict";

const assert=require("node:assert/strict");
const childProcess=require("node:child_process");
const crypto=require("node:crypto");
const fs=require("node:fs");
const moduleApi=require("node:module");
const os=require("node:os");
const path=require("node:path");
const test=require("node:test");

const ROOT=path.resolve(__dirname,"../..");
const AIR=process.env.HARDENED_FIXTURE_AIR_SDK;
const LAYA=process.env.HARDENED_FIXTURE_LAYA;
const LAYA_EVIDENCE_REVISION="ced65d4303e92de140a1e062808bcfbd7a7aa3cf";
const sha256=value=>crypto.createHash("sha256").update(value).digest("hex");
const canonical=value=>Array.isArray(value)?`[${value.map(canonical).join(",")}]`
    :value!==null&&typeof value==="object"
        ?`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`
        :JSON.stringify(value);

function writeSources(root,files) {
    for(const [name,body] of Object.entries(files)) {
        const target=path.join(root,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,body);
    }
}

function run(command,args,timeout=180000) {
    const result=childProcess.spawnSync(command,args,{cwd:ROOT,encoding:"utf8",timeout});
    assert.equal(result.status,0,result.stdout+result.stderr);return result;
}

function makeProfile(source,profile,intrinsic=true) {
    run("python3",["-B","tools/create-fixture-profile.py","--source",source,"--entry","DictionaryReadProbe",
        "--air-sdk",AIR,"--laya",LAYA,"--output",profile,
        ...(intrinsic?["--intrinsic-type","flash.utils.Dictionary"]:[])]);
}

function compile(operation,source,profile,output) {
    run(process.execPath,["bin/as3-frontend",operation,source,output,
        "--source-census",path.join(profile,"census.json"),
        "--target-capabilities",path.join(LAYA,"docTool/architecture/authored-content-capabilities.json"),
        "--profile-lock",path.join(profile,"profile-lock.json")]);
    return JSON.parse(fs.readFileSync(path.join(output,"manifest.json"),"utf8"));
}

const positiveSources=Object.freeze({
    "game/data/town/AvatarInfo.as":`package game.data.town {
 import flash.utils.Dictionary;
 public final class AvatarInfo {
  public const avatars:Dictionary=new Dictionary();
  public function AvatarInfo(){avatars[7]=41;}
 }
}\n`,
    "game/manager/ClientConfigManager.as":`package game.manager {
 import game.data.town.AvatarInfo;
 public final class ClientConfigManager {
  private static const value:AvatarInfo=new AvatarInfo();
  public static function get avatarInfo():AvatarInfo{return value;}
 }
}\n`,
    "DictionaryReadProbe.as":`package {
 import game.manager.ClientConfigManager;
 public final class DictionaryReadProbe {
  public function run(selectedTemplateId:int):* {
   return ClientConfigManager.avatarInfo.avatars[selectedTemplateId];
  }
  public function write(selectedTemplateId:int,value:int):* {
   return ClientConfigManager.avatarInfo.avatars[selectedTemplateId]=value;
  }
 }
}\n`,
    "ObjectReadProbe.as":`package {
 public final class ObjectReadProbe {
  public function run(value:*):* {return Object(value)["enabled"];}
  public function literal():* {var value:Object={"enabled":17};return Object(value)["enabled"];}
  public function nullValue():* {return Object(null)["enabled"];}
 }
}\n`,
});

test("cross-declaration Dictionary recognition remains bound to retained AIR evidence",{skip:!LAYA},()=>{
    assert.equal(childProcess.spawnSync("git",["merge-base","--is-ancestor",LAYA_EVIDENCE_REVISION,"HEAD"],
        {cwd:LAYA}).status,0);
    const fixture=path.join(fs.realpathSync(LAYA),"tests/nativeFlashOracle/assignment-targets");
    const nativeBytes=fs.readFileSync(path.join(fixture,"native-air.json"));
    const native=JSON.parse(nativeBytes);
    assert.equal(sha256(nativeBytes),"9f7b179aa43c967f069697739c5ea9c0575fc477c7f20159ee72c726789c7ee8");
    assert.equal(native.sources["AssignmentTargetsProbe.as"],
        "c782942bbecb631dfea649560a9c94ee10ff895014a660cf91ae474e654541d6");
    assert.equal(sha256(fs.readFileSync(path.join(fixture,"scenario.json"))),native.scenarioSha256);
    assert.equal(native.capture.runtime.version,"MAC 51,3,3,2");
    for(const [file,digest] of [["AS3Dictionary.ts","6093e08ea252cc7926982934da92c1d7785d093880e196c798c67c5f8d7d8f84"],
        ["AS3ObjectDispatch.ts","e4ce2347b69067c9dd23b7a6d0b95e53b68fa8fd83b0c20ff2f42378938ef289"],
        ["AS3Coerce.ts","6ab4b745c5f13f945b817eb333a0d8b137c2b4e54a153bd6c4451f1142d03eb7"]]) {
        assert.equal(sha256(fs.readFileSync(path.join(ROOT,"src/hardened-runtime",file))),digest,file);
    }
});

test("exact cross-file Dictionary read and nested Object conversion typecheck and execute",
    {skip:!(AIR&&LAYA)},t=>{
    const temporary=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"cross-declaration-dictionary-")));
    t.after(()=>fs.rmSync(temporary,{recursive:true,force:true}));
    const source=path.join(temporary,"source"),profile=path.join(temporary,"profile");
    fs.mkdirSync(source);writeSources(source,positiveSources);makeProfile(source,profile);
    const output=path.join(temporary,"output"),manifest=compile("transpile",source,profile,output);
    assert.equal(manifest.files.length,Object.keys(positiveSources).length,JSON.stringify(manifest.files));
    assert.equal(manifest.files.every(row=>row.typescriptPath&&row.typescriptSha256),true,JSON.stringify(manifest.files));
    const application=path.join(output,"__as3_runtime/application");
    const dictionaryCode=fs.readFileSync(path.join(application,"DictionaryReadProbe.ts"),"utf8");
    assert.match(dictionaryCode,
        /__as3ClassMemberReceiver\(__as3InitializeClass\(ClientConfigManager, false\)\)\.avatarInfo!\.avatars!\.get\(selectedTemplateId\)/);
    assert.match(dictionaryCode,
        /const __as3AssignmentReceiver = __as3ClassMemberReceiver\(__as3InitializeClass\(ClientConfigManager, false\)\)\.avatarInfo!\.avatars;/);
    assert.match(dictionaryCode,
        /__as3AssignmentReceiver!\.set\(__as3AssignmentKey, __as3AssignmentValue\)/);
    assert.doesNotMatch(dictionaryCode,/as3ObjectRead/);
    const objectCode=fs.readFileSync(path.join(application,"ObjectReadProbe.ts"),"utf8");
    assert.match(objectCode,
        /__as3ObjectRead\(__as3ObjectConversion\(value\), "enabled", "ObjectReadProbe"\)/);

    const files=[];
    const visit=directory=>{for(const name of fs.readdirSync(directory)) {
        const item=path.join(directory,name),stat=fs.statSync(item);
        if(stat.isDirectory())visit(item);else if(name.endsWith(".ts"))files.push(item);
    }};visit(application);
    const config=path.join(temporary,"strict.json");
    fs.writeFileSync(config,JSON.stringify({compilerOptions:{target:"ES2022",module:"CommonJS",
        moduleResolution:"Node",strict:true,skipLibCheck:true,noEmit:true,baseUrl:ROOT,
        paths:{"@bleach/as3-runtime/*":["src/hardened-runtime/*"],
            "@laya/as3-runtime/*":["src/hardened-runtime/*"]}},files}));
    run(process.execPath,[path.join(ROOT,"node_modules/typescript-4-9/bin/tsc"),"-p",config]);

    const entryPath=path.join(output,"__as3_runtime/ApplicationEntry.generated.js");
    const entry=moduleApi.createRequire(entryPath)(entryPath);
    const find=name=>entry.AS3_APPLICATION_MODULES.find(module=>module[name])?.[name];
    const DictionaryReadProbe=find("DictionaryReadProbe"),ObjectReadProbe=find("ObjectReadProbe");
    const dictionaryProbe=new DictionaryReadProbe();
    assert.equal(dictionaryProbe.run(7),41);assert.equal(dictionaryProbe.write(7,53),53);
    assert.equal(dictionaryProbe.run(7),53);
    const objectProbe=new ObjectReadProbe();
    assert.equal(objectProbe.literal(),17);assert.equal(objectProbe.nullValue(),undefined);
});

test("incomplete, foreign, spoofed, and unmapped Dictionary signatures remain held",
    {skip:!(AIR&&LAYA)},t=>{
    const temporary=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"cross-declaration-dictionary-hostile-")));
    t.after(()=>fs.rmSync(temporary,{recursive:true,force:true}));
    const source=path.join(temporary,"source");fs.mkdirSync(source);writeSources(source,positiveSources);
    const profile=path.join(temporary,"profile");makeProfile(source,profile);

    const memberPath=path.join(profile,"local-members.json"),lockPath=path.join(profile,"profile-lock.json");
    const originalMembers=fs.readFileSync(memberPath,"utf8"),originalLock=fs.readFileSync(lockPath,"utf8");
    const mutateMember=(label,change)=>{
        const members=JSON.parse(originalMembers),entry=members.entries.find(row=>row.qname==="game.data.town.AvatarInfo");
        change(entry,members);
        const memberBytes=canonical(members)+"\n";fs.writeFileSync(memberPath,memberBytes);
        const lock=JSON.parse(originalLock);lock.files.localMemberMap.sha256=sha256(memberBytes);
        if(entry.status==="held") {lock.counts.localMembersComplete-=1;lock.counts.localMembersHeld+=1;}
        fs.writeFileSync(lockPath,canonical(lock)+"\n");
        const manifest=compile("qualify",source,profile,path.join(temporary,label));
        const row=manifest.files.find(item=>item.sourcePath==="DictionaryReadProbe.as");
        assert.equal(row.status,"held",JSON.stringify(row));return row;
    };
    const incomplete=mutateMember("incomplete",(entry,members)=>{
        entry.status="held";entry.declaration=null;entry.holdCode="TEST_DICTIONARY_OWNER_INCOMPLETE";
        entry.holdSha256="a".repeat(64);members.completeCount-=1;members.heldCount+=1;
    });
    assert.equal(incomplete.code,"HARDENED_LOCAL_MEMBER_HELD",JSON.stringify(incomplete));
    const spoofed=mutateMember("spoofed",entry=>{
        entry.declaration.members.find(member=>member.name==="avatars").fieldType="spoof.flash.utils.Dictionary";
    });
    assert.equal(spoofed.code,"HARDENED_INDEX_TARGET",JSON.stringify(spoofed));

    fs.rmSync(profile,{recursive:true,force:true});makeProfile(source,profile,false);
    const unmappedRows=compile("qualify",source,profile,path.join(temporary,"unmapped")).files;
    const unmapped=unmappedRows.find(item=>item.sourcePath==="DictionaryReadProbe.as");
    assert.equal(unmapped.status,"held",JSON.stringify(unmapped));
    assert.equal(unmapped.code,"HARDENED_LOCAL_OUTPUT_CLOSURE",JSON.stringify(unmapped));
    const unmappedOwner=unmappedRows.find(item=>item.sourcePath==="game/data/town/AvatarInfo.as");
    assert.equal(unmappedOwner.status,"held",JSON.stringify(unmappedOwner));
    assert.equal(unmappedOwner.code,"HARDENED_NEW_ARITY",JSON.stringify(unmappedOwner));

    const foreignSource=path.join(temporary,"foreign-source");fs.mkdirSync(foreignSource);
    writeSources(foreignSource,{
        "other/Dictionary.as":`package other {public final class Dictionary {public function Dictionary(){}}}\n`,
        "other/Box.as":`package other {public final class Box {public const values:Dictionary=new Dictionary();}}\n`,
        "DictionaryReadProbe.as":`package {import other.Box; public final class DictionaryReadProbe {
 public function run(box:Box,key:int):* {return box.values[key];}}}\n`,
    });
    const foreignProfile=path.join(temporary,"foreign-profile");makeProfile(foreignSource,foreignProfile,false);
    const foreign=compile("qualify",foreignSource,foreignProfile,path.join(temporary,"foreign")).files
        .find(item=>item.sourcePath==="DictionaryReadProbe.as");
    assert.equal(foreign.status,"held",JSON.stringify(foreign));assert.equal(foreign.code,"HARDENED_INDEX_TARGET");
});

test("Object(value) literal reads keep exact arity, key, and lexical boundaries",
    {skip:!(AIR&&LAYA)},t=>{
    const temporary=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"object-conversion-read-hostile-")));
    t.after(()=>fs.rmSync(temporary,{recursive:true,force:true}));
    const source=path.join(temporary,"source");fs.mkdirSync(source);writeSources(source,{
        "DictionaryReadProbe.as":positiveSources["DictionaryReadProbe.as"],
        "game/data/town/AvatarInfo.as":positiveSources["game/data/town/AvatarInfo.as"],
        "game/manager/ClientConfigManager.as":positiveSources["game/manager/ClientConfigManager.as"],
        "Zero.as":`package {public final class Zero {public function run():* {return Object()["enabled"];}}}\n`,
        "Extra.as":`package {public final class Extra {public function run(value:*,other:*):* {return Object(value,other)["enabled"];}}}\n`,
        "VoidKey.as":`package {public final class VoidKey {private function nope():void{} public function run(value:*):* {return Object(value)[nope()];}}}\n`,
        "foreign/Object.as":`package foreign {public final class Object {public function Object(value:* = null){}}}\n`,
        "ForeignObject.as":`package {import foreign.Object; public final class ForeignObject {
 public function run(value:*):* {return Object(value)["enabled"];}}}\n`,
    });
    const profile=path.join(temporary,"profile");makeProfile(source,profile);
    const rows=compile("qualify",source,profile,path.join(temporary,"qualified")).files;
    for(const [name,expected] of [["Zero.as","HARDENED_OBJECT_CONVERSION_ARITY"],
        ["Extra.as","HARDENED_OBJECT_CONVERSION_ARITY"],["VoidKey.as","HARDENED_OBJECT_KEY"],
        ["ForeignObject.as","HARDENED_CALL_TARGET"]]) {
        const row=rows.find(item=>item.sourcePath===name);assert.equal(row.status,"held",JSON.stringify(row));
        assert.equal(row.code,expected,JSON.stringify(row));
    }
});
