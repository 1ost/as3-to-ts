"use strict";
const assert=require("node:assert/strict"),test=require("node:test"),fs=require("node:fs"),
 path=require("node:path"),os=require("node:os"),cp=require("node:child_process"),crypto=require("node:crypto");
const root=path.resolve(__dirname,"../.."),sha=value=>crypto.createHash("sha256").update(value).digest("hex");
const air=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA,ffdec=process.env.HARDENED_FIXTURE_FFDEC;
test("signature imports preserve source bytes and require both authenticated edges",t=>{
 assert.ok(air&&laya&&ffdec,"AIR, Laya and FFDec fixture paths required");
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"signature-type-")));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const source=path.join(dir,"source"),fixture=path.join(laya,"tests/nativeFlashOracle/signature-type");fs.mkdirSync(source);
 const retained=JSON.parse(fs.readFileSync(path.join(fixture,"native-air.json")));
 for(const [name,hash] of Object.entries(retained.sourceFiles)){
  const bytes=fs.readFileSync(path.join(fixture,name));assert.equal(sha(bytes),hash);fs.mkdirSync(path.dirname(path.join(source,name)),{recursive:true});fs.writeFileSync(path.join(source,name),bytes);
 }
 assert.equal(sha(fs.readFileSync(path.join(fixture,"scenario.json"))),retained.scenarioSha256);
 const profile=path.join(dir,"profile");
 const run=(command,args)=>{const result=cp.spawnSync(command,args,{cwd:root,encoding:"utf8",timeout:120000});assert.equal(result.status,0,result.stdout+result.stderr);};
 const makeProfile=(extra=[])=>run("python3",["-B","tools/create-fixture-profile.py","--source",source,"--entry","SignatureTypeProbe","--air-sdk",air,"--laya",laya,"--ffdec-jar",ffdec,"--output",profile,"--omit-direct-edge","SignatureTypeProbe:api.IValue",...extra.flatMap(edge=>["--omit-direct-edge",edge])]);
 const compile=(operation,out,input=source)=>run(process.execPath,["bin/as3-frontend",operation,input,path.join(dir,out),"--source-census",path.join(profile,"census.json"),"--target-capabilities",path.join(laya,"docTool/architecture/authored-content-capabilities.json"),"--profile-lock",path.join(profile,"profile-lock.json")]);
 makeProfile();const snapshots=[];
 for(const output of ["first","second"]){
  compile("transpile",output);const rows=JSON.parse(fs.readFileSync(path.join(dir,output,"manifest.json"))).files;
  for(const row of rows)assert.equal(row.sourceSha256,retained.sourceFiles[row.sourcePath]);
  const code=fs.readFileSync(path.join(dir,output,"__as3_runtime/application/SignatureTypeProbe.ts"),"utf8");
  assert.match(code,/IValue as __as3Signature[0-9]+/);snapshots.push([rows,code]);
 }
 assert.deepEqual(snapshots[0],snapshots[1]);
 for(const [label,edge,expected] of [
  ["owner","api.Factory:api.IValue","HARDENED_LOCAL_MEMBER_HELD"],
  ["caller","SignatureTypeProbe:api.Factory","HARDENED_LOCAL_IMPORT_EDGE"]]){
  fs.rmSync(profile,{recursive:true,force:true});makeProfile([edge]);compile("qualify",label);
  const row=JSON.parse(fs.readFileSync(path.join(dir,label,"manifest.json"))).files.find(row=>row.sourcePath==="SignatureTypeProbe.as");
  assert.equal(row.status,"held");assert.equal(row.code,expected,JSON.stringify(row));
  if(label==="owner") {
   const owner=JSON.parse(fs.readFileSync(path.join(profile,"local-members.json"))).entries.find(row=>row.qname==="api.Factory");
   assert.equal(owner.status,"held");assert.ok(owner.holdCode);
  }
 }
 const probe=path.join(source,"SignatureTypeProbe.as");
 fs.writeFileSync(probe,fs.readFileSync(probe,"utf8").replace("result.push(Factory.create(value).read());","result.push(Factory.create(value).read()); IValue(null);"));
 fs.rmSync(profile,{recursive:true,force:true});makeProfile();compile("qualify","source-name");
 const row=JSON.parse(fs.readFileSync(path.join(dir,"source-name/manifest.json"))).files.find(row=>row.sourcePath==="SignatureTypeProbe.as");
 assert.equal(row.status,"held");assert.equal(row.code,"HARDENED_IDENTIFIER_SCOPE",JSON.stringify(row));
});
