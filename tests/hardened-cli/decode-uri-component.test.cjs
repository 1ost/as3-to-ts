"use strict";
const assert=require("node:assert/strict"),test=require("node:test"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),cp=require("node:child_process");
const root=path.resolve(__dirname,"../.."),air=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA,ffdec=process.env.HARDENED_FIXTURE_FFDEC;
const configured=!!(air&&laya&&ffdec);

test("authenticated shared Laya decoder lowers a source URIError catch without host URIError identity",{skip:!configured},t=>{
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"decode-uri-component-")));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const source=path.join(dir,"source");fs.mkdirSync(source);
 fs.writeFileSync(path.join(source,"UriDecodeProbe.as"),
  'package {public class UriDecodeProbe {public function run(value:String):String {try {return decodeURIComponent(value);} catch(error:URIError) {return value;} return value;}}}');
 const run=(command,args,expected=0)=>{const result=cp.spawnSync(command,args,{cwd:root,encoding:"utf8",timeout:240000});
  assert.equal(result.status,expected,result.stdout+result.stderr);return result;};
 const profile=path.join(dir,"profile");
 const make=()=>run("python3",["-B","tools/create-fixture-profile.py","--source",source,"--entry","UriDecodeProbe",
  "--air-sdk",air,"--laya",laya,"--ffdec-jar",ffdec,"--native-uri-component","--output",profile]);
 const compile=name=>run(process.execPath,["bin/as3-frontend","transpile",source,path.join(dir,name),
  "--source-census",path.join(profile,"census.json"),"--target-capabilities",path.join(laya,"docTool/architecture/authored-content-capabilities.json"),
  "--profile-lock",path.join(profile,"profile-lock.json")]);
 make();compile("first");compile("second");
 const relative="__as3_runtime/application/UriDecodeProbe.ts";
 const first=fs.readFileSync(path.join(dir,"first",relative),"utf8");
 assert.equal(first,fs.readFileSync(path.join(dir,"second",relative),"utf8"));
 assert.match(first,/as3DecodeURIComponent as __as3DecodeURIComponent/);
 assert.match(first,/from "laya\/flash\/utils\/AS3URI"/);
 assert.match(first,/as3IsSourceURIErrorInstance as __as3IsSourceURIErrorInstance/);
 assert.match(first,/__as3IsSourceURIErrorInstance\(__as3Caught/);
 assert.doesNotMatch(first,/instanceof URIError/);
 const lock=JSON.parse(fs.readFileSync(path.join(profile,"profile-lock.json")));
 const proof=JSON.parse(fs.readFileSync(path.join(profile,lock.files.nativeUriComponent.path)));
 assert.equal(proof.decode.declarationSha256,"fb3c28c303631a83e412a2f00f2e33563a116b76e6551316cb42593edb55cb90");
 assert.equal(proof.decode.runtimeSourceSha256,"2f5a8b644405350d04a72c768270d0fd7a29323b5642e2ff5b1e0b5e5b052f02");
});
