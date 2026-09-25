"use strict";
const assert=require("node:assert/strict"),test=require("node:test"),fs=require("node:fs"),
 path=require("node:path"),os=require("node:os"),cp=require("node:child_process"),crypto=require("node:crypto");
const root=path.resolve(__dirname,"../.."),sha=value=>crypto.createHash("sha256").update(value).digest("hex");
// Same canonical envelope as the local member/profile authority loaders.
function canonical(value) {
 if(value===null || typeof value!=="object")return JSON.stringify(value);
 if(Array.isArray(value))return `[${value.map(canonical).join(",")}]`;
 return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
}
const writeCanonical=(file,value)=>fs.writeFileSync(file,canonical(value)+"\n","utf8");
const air=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA,ffdec=process.env.HARDENED_FIXTURE_FFDEC;
test("field and getter signature imports require exact authenticated owners and edges",t=>{
 assert.ok(air&&laya&&ffdec,"AIR, Laya and FFDec fixture paths required");
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"field-signature-type-")));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const source=path.join(dir,"source"),fixture=path.join(laya,"tests/nativeFlashOracle/field-signature-type");fs.mkdirSync(source);
 const retained=JSON.parse(fs.readFileSync(path.join(fixture,"native-air.json")));
 for(const [name,hash] of Object.entries(retained.sourceFiles)){
  const bytes=fs.readFileSync(path.join(fixture,name));assert.equal(sha(bytes),hash);fs.mkdirSync(path.dirname(path.join(source,name)),{recursive:true});fs.writeFileSync(path.join(source,name),bytes);
 }
 assert.equal(sha(fs.readFileSync(path.join(fixture,"scenario.json"))),retained.scenarioSha256);
 const profile=path.join(dir,"profile");
 const run=(command,args)=>{const result=cp.spawnSync(command,args,{cwd:root,encoding:"utf8",timeout:120000});assert.equal(result.status,0,result.stdout+result.stderr);};
 const makeProfile=(extra=[])=>run("python3",["-B","tools/create-fixture-profile.py","--source",source,"--entry","FieldSignatureTypeProbe","--air-sdk",air,"--laya",laya,"--ffdec-jar",ffdec,"--output",profile,"--omit-direct-edge","FieldSignatureTypeProbe:api.Value",...extra.flatMap(edge=>["--omit-direct-edge",edge])]);
 const compile=(operation,out,input=source)=>run(process.execPath,["bin/as3-frontend",operation,input,path.join(dir,out),"--source-census",path.join(profile,"census.json"),"--target-capabilities",path.join(laya,"docTool/architecture/authored-content-capabilities.json"),"--profile-lock",path.join(profile,"profile-lock.json")]);
 makeProfile();const snapshots=[];
 for(const output of ["first","second"]){
  compile("transpile",output);const rows=JSON.parse(fs.readFileSync(path.join(dir,output,"manifest.json"))).files;
  for(const row of rows)assert.equal(row.sourceSha256,retained.sourceFiles[row.sourcePath]);
  const code=fs.readFileSync(path.join(dir,output,"__as3_runtime/application/FieldSignatureTypeProbe.ts"),"utf8");
  assert.match(code,/Value as __as3Signature[0-9]+/);snapshots.push([rows,code]);
 }
 assert.deepEqual(snapshots[0],snapshots[1]);
 // Keep the profile's SCC valid while deleting a required direct edge. This
 // diagnostic-only vertex gives an alternate graph route; source imports and
 // signature ownership must still reject reliance on that transitive route.
 fs.writeFileSync(path.join(source,"ProfileRoute.as"),"package { public class ProfileRoute {} }\n");
 for(const [label,edge,expected] of [
  ["owner","api.Holder:api.Value","HARDENED_LOCAL_MEMBER_HELD"],
  ["caller","FieldSignatureTypeProbe:api.Holder","HARDENED_LOCAL_IMPORT_EDGE"]]){
  fs.rmSync(profile,{recursive:true,force:true});makeProfile([edge]);compile("qualify",label);
  const row=JSON.parse(fs.readFileSync(path.join(dir,label,"manifest.json"))).files.find(row=>row.sourcePath==="FieldSignatureTypeProbe.as");
  assert.equal(row.status,"held");assert.equal(row.code,expected,JSON.stringify(row));
  if(label==="owner") {
   const owner=JSON.parse(fs.readFileSync(path.join(profile,"local-members.json"))).entries.find(row=>row.qname==="api.Holder");
   assert.equal(owner.status,"held");assert.ok(owner.holdCode);
  }
 }
 // A rehashed member artifact may not substitute another declaration for the
 // actual source-selected field, even when the real target type still exists.
 fs.rmSync(profile,{recursive:true,force:true});makeProfile();
 const memberPath=path.join(profile,"local-members.json");
 const memberMap=JSON.parse(fs.readFileSync(memberPath));
 const owner=memberMap.entries.find(row=>row.qname==="api.Holder");
 const field=owner.declaration.members.find(member=>member.name==="current");
 assert.equal(field.fieldType,"api.Value");field.name="forgedCurrent";
 writeCanonical(memberPath,memberMap);
 const lockPath=path.join(profile,"profile-lock.json"),lock=JSON.parse(fs.readFileSync(lockPath));
 lock.files.localMemberMap.sha256=sha(fs.readFileSync(memberPath));
 writeCanonical(lockPath,lock);
 // Both edited JSON envelopes must be canonical, and every pinned profile
 // artifact must retain its exact digest before the compiler adversary runs.
 for(const file of [memberPath,lockPath]) {
  const bytes=fs.readFileSync(file,"utf8");assert.equal(bytes,canonical(JSON.parse(bytes))+"\n");
 }
 for(const [name,pin] of Object.entries(lock.files))
  assert.equal(sha(fs.readFileSync(path.resolve(profile,pin.path))),pin.sha256,name);
 compile("qualify","forged-field");
 const forged=JSON.parse(fs.readFileSync(path.join(dir,"forged-field/manifest.json"))).files.find(row=>row.sourcePath==="FieldSignatureTypeProbe.as");
 assert.equal(forged.status,"held");assert.ok(["HARDENED_LOCAL_STATIC_MEMBER","HARDENED_LOCAL_STATIC_READ"].includes(forged.code),JSON.stringify(forged));
 const probe=path.join(source,"FieldSignatureTypeProbe.as");
 const originalProbe=fs.readFileSync(probe,"utf8");
 // Exercise getter signature derivation independently of the field-created alias.
 fs.writeFileSync(probe,originalProbe.replaceAll("Holder.current","Holder.selected"));
 fs.rmSync(profile,{recursive:true,force:true});makeProfile();compile("transpile","getter-only");
 const getterCode=fs.readFileSync(path.join(dir,"getter-only/__as3_runtime/application/FieldSignatureTypeProbe.ts"),"utf8");
 assert.match(getterCode,/Value as __as3Signature[0-9]+/);
 fs.writeFileSync(probe,originalProbe);
 fs.writeFileSync(probe,fs.readFileSync(probe,"utf8").replace("Holder.clear();","Holder.clear(); Value(null);"));
 fs.rmSync(profile,{recursive:true,force:true});makeProfile();compile("qualify","source-name");
 const row=JSON.parse(fs.readFileSync(path.join(dir,"source-name/manifest.json"))).files.find(row=>row.sourcePath==="FieldSignatureTypeProbe.as");
 assert.equal(row.status,"held");assert.equal(row.code,"HARDENED_IDENTIFIER_SCOPE",JSON.stringify(row));
});
