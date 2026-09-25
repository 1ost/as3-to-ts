"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),cp=require("node:child_process"),crypto=require("node:crypto");
const root=path.resolve(__dirname,"../.."),air=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA,ffdec=process.env.HARDENED_FIXTURE_FFDEC;
const sha=file=>crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

test("SDK-pinned Number.MAX_VALUE lowers to the original finite Number constant",{skip:!(air&&laya&&ffdec)},t=>{
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"number-max-value-")));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const evidence=path.join(laya,"tests/nativeFlashOracle/number-max-value");
 const receipt=JSON.parse(fs.readFileSync(path.join(evidence,"native-receipt.json")));
 assert.equal(receipt.status,"passed");assert.equal(receipt.capture.identical,true);
 assert.equal(sha(path.join(evidence,"NumberMaxValueProbe.as")),receipt.artifacts["source/NumberMaxValueProbe.as"]);
 assert.equal(sha(path.join(evidence,"native-capture.json")),receipt.artifacts["run-1/capture.json"]);
 const captured=JSON.parse(fs.readFileSync(path.join(evidence,"native-capture.json"))).state.observations;
 assert.equal(captured[0].result[1],true);
 assert.deepEqual(captured.slice(1).map(row=>row.result),[[true,true],[true,0],[true,true]]);
 const source=path.join(dir,"source");fs.mkdirSync(source);
 fs.writeFileSync(path.join(source,"MaxProbe.as"),
  'package {public class MaxProbe {public function run():Number {return Number.MAX_VALUE;}}}');
 const run=(command,args)=>{const result=cp.spawnSync(command,args,{cwd:root,encoding:"utf8",timeout:180000});
  assert.equal(result.status,0,result.stdout+result.stderr);return result;};
 const profile=path.join(dir,"profile");
 run("python3",["-B","tools/create-fixture-profile.py","--source",source,"--entry","MaxProbe",
  "--air-sdk",air,"--laya",laya,"--ffdec-jar",ffdec,"--output",profile]);
 const output=path.join(dir,"output");
 run(process.execPath,["bin/as3-frontend","transpile",source,output,"--source-census",path.join(profile,"census.json"),
  "--target-capabilities",path.join(laya,"docTool/architecture/authored-content-capabilities.json"),
  "--profile-lock",path.join(profile,"profile-lock.json")]);
 const emitted=fs.readFileSync(path.join(output,"__as3_runtime/application/MaxProbe.ts"),"utf8");
 assert.match(emitted,/1\.7976931348623157e\+308/);
 assert.doesNotMatch(emitted,/Number\.MAX_VALUE/);
});
