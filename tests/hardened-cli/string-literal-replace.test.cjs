"use strict";
const assert=require("node:assert/strict"),test=require("node:test"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),cp=require("node:child_process"),crypto=require("node:crypto"),Module=require("node:module");
const root=path.resolve(__dirname,"../.."),air=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA;
const sha=bytes=>crypto.createHash("sha256").update(bytes).digest("hex");

test("String search replacement matches AIR literal token and evaluation behavior",{skip:!air||!laya},t=>{
 const fixture=path.join(fs.realpathSync(laya),"tests/nativeFlashOracle/string-literal-replace");
 for(const [name,hash] of Object.entries({"StringLiteralReplaceProbe.as":"368565f19d0127401d85c19a906b1842d49a89d91b786f6dcad06f5a03e477c6","scenario.json":"bdfa10bb72baad325789bf5fe1ae90f33790b0715edd44b133a454264e8f8bf6","native-air.json":"c4d3d66ae5c41fbcca130926cd8b8527b6018d168ed3fea9f4cb4e0b1cf83045"}))
  assert.equal(sha(fs.readFileSync(path.join(fixture,name))),hash,name);
 const capture=JSON.parse(fs.readFileSync(path.join(fixture,"native-air.json")));
 assert.equal(capture.runtime.playerType,"Desktop");assert.equal(capture.state.ready,true);assert.equal(capture.state.failure,"");
 const expected=new Map(capture.state.observations.map(row=>[row.id,row.result]));assert.equal(expected.size,12);
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"string-literal-replace-")));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const source=path.join(dir,"source"),profile=path.join(dir,"profile"),out=path.join(dir,"out");fs.mkdirSync(source);
 fs.writeFileSync(path.join(source,"StringLiteralReplace.as"),"package {public class StringLiteralReplace {public function run(value:String,search:String,replacement:String):String {return value.replace(search,replacement);}}}");
 const run=(command,args)=>{const result=cp.spawnSync(command,args,{cwd:root,encoding:"utf8",timeout:180000});assert.equal(result.status,0,result.stdout+result.stderr);};
 const make=()=>run("python3",["-B","tools/create-fixture-profile.py","--source",source,"--entry","StringLiteralReplace","--air-sdk",air,"--laya",laya,"--output",profile]);make();
 const compile=(op,target)=>run(process.execPath,["bin/as3-frontend",op,source,target,"--source-census",path.join(profile,"census.json"),"--target-capabilities",path.join(fixture,"../../../docTool/architecture/authored-content-capabilities.json"),"--profile-lock",path.join(profile,"profile-lock.json")]);
 compile("transpile",out);
 const manifest=JSON.parse(fs.readFileSync(path.join(out,"manifest.json"))),row=manifest.files.find(file=>file.sourcePath==="StringLiteralReplace.as");
 assert.ok(row.typescriptPath,JSON.stringify(row));const generated=fs.readFileSync(path.join(out,row.typescriptPath),"utf8");
 assert.match(generated,/__as3StringReplaceLiteral\(/);assert.doesNotMatch(generated,/\.replace\(/);
 const ts=require("typescript-4-9"),entryPath=path.join(out,manifest.applicationEntryPath),modulePath=path.join(out,row.typescriptPath);
 for(const file of [modulePath,entryPath])fs.writeFileSync(file.replace(/\.ts$/,".js"),ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText);
 const entry=Module.createRequire(entryPath.replace(/\.ts$/,".js"))(entryPath.replace(/\.ts$/,".js"));
 const Probe=entry.AS3_APPLICATION_MODULES.find(module=>module.StringLiteralReplace).StringLiteralReplace,probe=new Probe();
 for(const [subject,search,replacement,id] of [["game123","game","","ap-server-id"],["gamegame","game","X","first-only"],["abc","","X","empty-search"],["abc","b","$&","match-token"],["abc","b","$`|$'|$$","replacement-tokens"],["A\uD83D\uDE00Z","\uD83D\uDE00","X","unicode"],["a\u0000game","game","X","nul-subject"],["game","g\u0000ame","X","nul-search"],["a\uD83Db","\uD83D","X","lone-surrogate"],["game","g","X\u0000Y","nul-replacement"]])
  assert.equal(probe.run(subject,search,replacement),expected.get(id)[0],id);
 assert.throws(()=>probe.run(null,"game",""),error=>error.name===expected.get("null-receiver")[0][0]&&error.errorID===expected.get("null-receiver")[0][1]);
 assert.throws(()=>probe.run("abc",null,""),error=>error.name==="AS3ObjectDispatchUnavailable");
 fs.writeFileSync(path.join(source,"ForeignReplace.as"),"package {public class ForeignReplace {public function run(value:String,search:Object):String {return value.replace(search,\"b\");}}}");
 fs.rmSync(profile,{recursive:true,force:true});make();compile("qualify",path.join(dir,"negative"));
 const foreign=JSON.parse(fs.readFileSync(path.join(dir,"negative/manifest.json"))).files.find(file=>file.sourcePath==="ForeignReplace.as");
 assert.equal(foreign.status,"held");assert.equal(foreign.code,"HARDENED_STRING_ARGUMENT");
});
