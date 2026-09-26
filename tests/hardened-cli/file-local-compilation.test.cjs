"use strict";
const assert=require("node:assert/strict"),test=require("node:test"),fs=require("node:fs"),path=require("node:path"),
    os=require("node:os"),cp=require("node:child_process"),crypto=require("node:crypto");
const root=path.resolve(__dirname,"../..");
const sha=value=>crypto.createHash("sha256").update(value).digest("hex");
const canonical=value=>Array.isArray(value)?`[${value.map(canonical).join(",")}]`
    :value!==null&&typeof value==="object"?`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`:JSON.stringify(value);
const air=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA,ffdec=process.env.HARDENED_FIXTURE_FFDEC;

test("original source units emit private helpers deterministically and hold the entire dependency closure",t=>{
    assert.ok(air && laya && ffdec,"fixture AIR SDK, Laya and FFDec paths are required");
    const output=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"file-local-compilation-")));
    t.after(()=>fs.rmSync(output,{recursive:true,force:true}));
    const source=path.join(output,"source");fs.mkdirSync(path.join(source,"p"),{recursive:true});
    const owner=`package p { public class Owner {
        public function Owner() {}
        public function make():String { var item:Item=new Item("ok"); return item.label; }
    } }
    import p.Base;
    class Item extends Base {
        public var label:String;
        public function Item(label:String) { super(); this.label=label; }
    }`;
    const base="package p { public class Base { public function Base() {} } }";
    fs.writeFileSync(path.join(source,"p/Owner.as"),owner);fs.writeFileSync(path.join(source,"p/Base.as"),base);
    const profile=path.join(output,"profile");
    cp.execFileSync("python3",["-B",path.join(root,"tools/create-fixture-profile.py"),"--source",source,"--entry","p.Owner",
        "--laya",laya,"--air-sdk",air,"--ffdec-jar",ffdec,"--output",profile],{cwd:root,stdio:"pipe",timeout:60000});
    function run(operation,name) {
        return cp.spawnSync(process.execPath,[path.join(root,"bin/as3-frontend"),operation,source,path.join(output,name),
            "--source-census",path.join(profile,"census.json"),"--target-capabilities",path.join(laya,"docTool/architecture/authored-content-capabilities.json"),
            "--profile-lock",path.join(profile,"profile-lock.json")],{encoding:"utf8",timeout:30000});
    }
    const snapshots=[];
    for(const name of ["first","second"]){
        const result=run("transpile",name);assert.equal(result.status,0,result.stderr);
        const manifest=JSON.parse(fs.readFileSync(path.join(output,name,"manifest.json")));
        assert.equal(manifest.files.length,2,"one manifest row per original source");
        const row=manifest.files.find(file=>file.sourcePath==="p/Owner.as");
        assert.equal(row.sourceSha256,sha(owner));assert.equal(row.fileLocalOutputs.length,1);
        const helper=row.fileLocalOutputs[0];assert.equal(helper.modulePath,"p/Owner.file-local/Item.ts");
        const code=fs.readFileSync(path.join(output,name,"__as3_runtime/application",helper.modulePath),"utf8");
        assert.equal(sha(code),helper.typescriptSha256);assert.match(code,/class Item extends Base/);
        assert.doesNotMatch(code,/export class Item/);
        snapshots.push([manifest.files,code]);
    }
    assert.deepEqual(snapshots[0],snapshots[1]);
    const qualified=run("qualify","qualified");assert.equal(qualified.status,0,qualified.stderr);
    const good=JSON.parse(fs.readFileSync(path.join(output,"qualified/manifest.json")));
    assert.equal(good.files.length,2);assert.ok(good.files.every(file=>file.status==="admitted"));
    fs.unlinkSync(path.join(source,"p/Base.as"));
    const held=run("qualify","missing-base");assert.equal(held.status,0,held.stderr);
    const missing=JSON.parse(fs.readFileSync(path.join(output,"missing-base/manifest.json")));
    assert.equal(missing.files.length,1);assert.equal(missing.files[0].code,"HARDENED_LOCAL_OUTPUT_CLOSURE");
    assert.match(missing.files[0].message,/p\/Base.ts/);
    const rejected=run("transpile","rejected");assert.equal(rejected.status,4,rejected.stderr);
    assert.equal(fs.existsSync(path.join(output,"rejected")),false,"incomplete source unit cannot publish a module");
    fs.writeFileSync(path.join(source,"p/Base.as"),base);
    fs.writeFileSync(path.join(source,"p/Owner.as"),owner.replace('this.label=label','this.label="changed"'));
    const drift=run("qualify","drift");assert.equal(drift.status,0,drift.stderr);
    const driftManifest=JSON.parse(fs.readFileSync(path.join(output,"drift/manifest.json")));
    assert.equal(driftManifest.files.find(file=>file.sourcePath==="p/Owner.as").code,"HARDENED_APPLICATION_SOURCE_IDENTITY");
    fs.writeFileSync(path.join(source,"p/Owner.as"),owner);
    const lockPath=path.join(profile,"profile-lock.json"),lock=JSON.parse(fs.readFileSync(lockPath));
    const membersPath=path.join(profile,lock.files.localMemberMap.path),members=JSON.parse(fs.readFileSync(membersPath));
    members.entries.find(entry=>entry.qname==="p.Owner").declaration.fileLocalClasses[0].members
        .find(member=>member.name==="label").fieldType="Number";
    const altered=canonical(members)+"\n";fs.writeFileSync(membersPath,altered);
    lock.files.localMemberMap.sha256=sha(altered);fs.writeFileSync(lockPath,canonical(lock)+"\n");
    const forged=run("qualify","altered-header");assert.equal(forged.status,0,forged.stderr);
    const forgedManifest=JSON.parse(fs.readFileSync(path.join(output,"altered-header/manifest.json")));
    const forgedOwner=forgedManifest.files.find(file=>file.sourcePath==="p/Owner.as");
    assert.equal(forgedOwner.code,"HARDENED_FILE_LOCAL_AUTHORITY");
    assert.equal(forgedOwner.fileLocalOutputs,undefined);
});
