"use strict";
const assert=require("node:assert/strict"),test=require("node:test"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),cp=require("node:child_process"),crypto=require("node:crypto");
const root=path.resolve(__dirname,"../.."),air=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA,ffdec=process.env.HARDENED_FIXTURE_FFDEC;
const sha=value=>crypto.createHash("sha256").update(value).digest("hex"),configured=!!(air&&laya&&ffdec);
test("authenticated exact one-String encodeURIComponent lowers to the compiler-owned URI operation",{skip:!configured},t=>{
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"encode-uri-component-")));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const source=path.join(dir,"source"),fixture=path.join(fs.realpathSync(laya),"tests/nativeFlashOracle/encode-uri-component");fs.mkdirSync(source);
 const retainedProbe=fs.readFileSync(path.join(fixture,"EncodeURIComponentProbe.as"));
 assert.equal(sha(retainedProbe),"d02d738d978520fd8b4a6288393042c8d2e775d6a46ca830ba489abbd1fd6e6e");
 fs.writeFileSync(path.join(source,"UriProbe.as"),'package {public class UriProbe {public function run(value:String):String {return encodeURIComponent(value);}}}');
 const run=(command,args,expected=0)=>{const result=cp.spawnSync(command,args,{cwd:root,encoding:"utf8",timeout:180000});assert.equal(result.status,expected,result.stdout+result.stderr);return result;};
 const profile=path.join(dir,"profile"),make=()=>run("python3",["-B","tools/create-fixture-profile.py","--source",source,"--entry","UriProbe","--air-sdk",air,"--laya",laya,"--ffdec-jar",ffdec,"--native-uri-component","--output",profile]);
 const compile=(operation,name)=>run(process.execPath,["bin/as3-frontend",operation,source,path.join(dir,name),"--source-census",path.join(profile,"census.json"),"--target-capabilities",path.join(laya,"docTool/architecture/authored-content-capabilities.json"),"--profile-lock",path.join(profile,"profile-lock.json")]);
 make();compile("transpile","first");compile("transpile","second");
 const relative="__as3_runtime/application/UriProbe.ts",first=fs.readFileSync(path.join(dir,"first",relative),"utf8"),second=fs.readFileSync(path.join(dir,"second",relative),"utf8");
 assert.equal(first,second);assert.match(first,/import \{ as3EncodeURIComponent as __as3EncodeURIComponent \} from "@laya\/as3-runtime\/AS3URI";/);assert.match(first,/__as3EncodeURIComponent\(value\)/);
 const lock=JSON.parse(fs.readFileSync(path.join(profile,"profile-lock.json"))),proof=JSON.parse(fs.readFileSync(path.join(profile,lock.files.nativeUriComponent.path)));
 assert.equal(proof.evidenceRevision,"1563e72a6f3849554c3ccb3eacd615fd3083f435");assert.equal(proof.runtime.sourceSha256,"2264c65a2c22fa66d4d14b97b299fe88ba0342f924cc948bf20df159c5cee8bf");
 assert.deepEqual(proof.evidence.map(row=>row.name),["EncodeURIComponentProbe.as","README.md","browser-air.json","browser-pin.json","native-air.json","run-browser.mjs","scenario.json"]);

 fs.writeFileSync(path.join(source,"BadArity.as"),'package {public class BadArity {public function run():String {return encodeURIComponent("a","b");}}}');
 fs.writeFileSync(path.join(source,"BadType.as"),'package {public class BadType {public function run():String {return encodeURIComponent(7);}}}');
 fs.writeFileSync(path.join(source,"Own.as"),'package {public class Own {private function encodeURIComponent(value:String):String{return "own";} public function run():String{return encodeURIComponent("a");}}}');
 fs.rmSync(profile,{recursive:true,force:true});make();compile("qualify","negative");
 const rows=JSON.parse(fs.readFileSync(path.join(dir,"negative/manifest.json"))).files;
 assert.equal(rows.find(row=>row.sourcePath==="BadArity.as").code,"HARDENED_URI_COMPONENT_ARITY");
 assert.equal(rows.find(row=>row.sourcePath==="BadType.as").code,"HARDENED_URI_COMPONENT_ARGUMENT");
 assert.equal(rows.find(row=>row.sourcePath==="Own.as").status,"admitted");
});
