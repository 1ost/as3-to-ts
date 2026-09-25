"use strict";
const assert=require("node:assert/strict"),test=require("node:test"),fs=require("node:fs"),
 path=require("node:path"),cp=require("node:child_process"),crypto=require("node:crypto");
const root=path.resolve(__dirname,"../.."),sha=value=>crypto.createHash("sha256").update(value).digest("hex");
test("original TextStyle declaration recovery preserves flagged regex source bytes and contracts",()=>{
 const laya=process.env.HARDENED_FIXTURE_LAYA;assert.ok(laya,"Laya fixture path required");
 const source=path.join(laya,"tests/nativeFlashOracle/original-text-style");
 const receipt=JSON.parse(fs.readFileSync(path.join(source,"native-air.json")));
 const names=Object.keys(receipt.sourceFiles);
 for(const name of names) assert.equal(sha(fs.readFileSync(path.join(source,name))),receipt.sourceFiles[name]);
 assert.equal(sha(fs.readFileSync(path.join(source,"scenario.json"))),receipt.scenarioSha256);
 const inspect=()=>JSON.parse(cp.execFileSync(process.execPath,["tools/inspect-source-declarations.cjs",source,...names],
  {cwd:root,encoding:"utf8",timeout:120000}));
 const first=inspect();assert.deepEqual(inspect(),first);
 for(const row of first.entries){assert.equal(row.status,"complete",JSON.stringify(row));assert.equal(row.sourceSha256,receipt.sourceFiles[row.sourcePath]);}
 const declaration=first.entries.find(row=>row.sourcePath==="util/TextStyle.as").declaration;
 assert.equal(declaration.qualifiedName,"util.TextStyle");assert.equal(declaration.members.length,46);
 for(const [name,type] of [["CHAR_HYPHEN","String"],["R_CN_COMMA_DUN","RegExp"]]){
  const member=declaration.members.find(row=>row.name===name);
  assert.equal(member.kind,"field");assert.equal(member.fieldType,type);assert.equal(member.readonly,true);
  assert.deepEqual(member.modifiers,["public","static"]);
 }
});
