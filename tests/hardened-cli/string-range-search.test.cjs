"use strict";
const assert=require("node:assert/strict"),test=require("node:test"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),cp=require("node:child_process"),crypto=require("node:crypto"),Module=require("node:module");
const root=path.resolve(__dirname,"../.."),air=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA;
const layaRevision="ef6b67611ee494ab8711d22444f5a9a3ff6aa91e",sha=bytes=>crypto.createHash("sha256").update(bytes).digest("hex");

test("authenticated String range/search calls lower to exact compiler-owned helpers",{skip:!air||!laya},t=>{
 const layaRoot=fs.realpathSync(laya),fixture=path.join(layaRoot,"tests/nativeFlashOracle/string-range-search");
 const retainedRevision=cp.spawnSync("git",["merge-base","--is-ancestor",layaRevision,"HEAD"],{cwd:layaRoot,encoding:"utf8"});assert.equal(retainedRevision.status,0,retainedRevision.stderr||"String oracle revision is not retained by the selected Laya commit");
 const evidence={"StringRangeSearchProbe.as":"cd8f0aee13fdf02b5c7c84670ef028676eac0393662ecb466ce3766ca07cfe42","scenario.json":"90045875a4e4b337fea079e6fb30bd99e9981bb007def4a7a85ad8816c46dc7f","sdk-authority.json":"2907bd62934615cd6d0b1687ef1d90e7bbd11129c72ea8e43f94a832e40a2175","native-air.json":"5c5d55fd2561b752076271685bedf2fcea25376dff531b955798627e304dfc96","browser-air.json":"8dbc8259f231cc1a1cb05e4b0033ace71f89a63f47e336022b6e3327567915f3"};
 for(const [name,expected] of Object.entries(evidence))assert.equal(sha(fs.readFileSync(path.join(fixture,name))),expected,name);
 const native=JSON.parse(fs.readFileSync(path.join(fixture,"native-air.json"))),expected=new Map(native.capture.state.observations.map(row=>[row.id,row.result]));assert.equal(expected.size,20);
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"string-range-search-cli-")));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const source=path.join(dir,"source"),profile=path.join(dir,"profile");fs.mkdirSync(source);
 const good=["package {public class StringRangeSearchCompiled {",
  "public function ap(config:String,dateText:String):Array {var marker:int=config.lastIndexOf(\"_items_\");return [marker,config.substring(0,marker),dateText.slice(0,4),dateText.slice(4,6),dateText.slice(6,8),dateText.slice(8,10),dateText.slice(10,12),dateText.slice(12,14)];}",
  "public function omitted(text:String):Array {return [text.lastIndexOf(),text.lastIndexOf(\"a\"),text.substring(),text.substring(2),text.slice(),text.slice(2)];}",
  "public function explicit(text:String):Array {return [text.lastIndexOf(undefined),text.lastIndexOf(\"a\",undefined),text.lastIndexOf(null),text.substring(undefined),text.substring(1,undefined),text.substring(null),text.slice(undefined),text.slice(1,undefined),text.slice(null)];}",
  "public function bounds(text:String):Array {return [text.lastIndexOf(\"a\",-1),text.lastIndexOf(\"a\",NaN),text.lastIndexOf(\"a\",Infinity),text.lastIndexOf(\"a\",-Infinity),text.substring(4,1),text.substring(4,-1),text.slice(-4,-1),text.slice(-1,-4)];}",
  "public function unicode(text:String):Array {return [text.length,text.substring(1,2)==\"\\uD83D\",text.substring(2,3)==\"\\uDE00\",text.slice(1,3),text.slice(-2),text.substring(3,5),text.slice(3,5)];}",
  "}}\n"].join("");
 fs.writeFileSync(path.join(source,"StringRangeSearchCompiled.as"),good);
 const run=(command,args)=>{const result=cp.spawnSync(command,args,{cwd:root,encoding:"utf8",timeout:180000});assert.equal(result.status,0,result.stdout+result.stderr);return result;};
 const make=()=>run("python3",["-B","tools/create-fixture-profile.py","--source",source,"--entry","StringRangeSearchCompiled","--air-sdk",air,"--laya",laya,"--output",profile]);
 const compile=(operation,name)=>run(process.execPath,["bin/as3-frontend",operation,source,path.join(dir,name),"--source-census",path.join(profile,"census.json"),"--target-capabilities",path.join(layaRoot,"docTool/architecture/authored-content-capabilities.json"),"--profile-lock",path.join(profile,"profile-lock.json")]);
 make();const snapshots=[];
 for(const name of ["first","second"]){
  compile("transpile",name);const output=path.join(dir,name),manifest=JSON.parse(fs.readFileSync(path.join(output,"manifest.json"))),row=manifest.files.find(item=>item.sourcePath==="StringRangeSearchCompiled.as");assert.ok(row,JSON.stringify(manifest.files));assert.equal(row.sourceSha256,sha(good));
  const relative=row.typescriptPath,code=fs.readFileSync(path.join(output,relative),"utf8");snapshots.push([manifest.files,code]);
  for(const helper of ["LastIndexOf","Substring","Slice"]){assert.match(code,new RegExp(`__as3String${helper}\\(`));assert.match(code,new RegExp(`as3String${helper} as __as3String${helper}`));}
  assert.doesNotMatch(code,/\.lastIndexOf\(/);assert.doesNotMatch(code,/\.substring\(/);assert.doesNotMatch(code,/\.slice\(/);
  const packageRoot=path.join(output,"__as3_runtime"),packageInfo=JSON.parse(fs.readFileSync(path.join(packageRoot,"package.json")));
  const tsconfig=path.join(output,"strict-tsconfig.json");fs.writeFileSync(tsconfig,JSON.stringify({compilerOptions:{target:"ES2020",module:"CommonJS",moduleResolution:"node",strict:true,skipLibCheck:true,noEmit:true,types:[],lib:["ES2020","DOM"],baseUrl:root,paths:{[packageInfo.name+"/*"]:["src/hardened-runtime/*"],"@laya/as3-runtime/*":["src/hardened-runtime/*"]}},files:[path.join(output,relative)]}));
  run(process.execPath,[path.join(root,"node_modules/typescript-4-9/bin/tsc"),"-p",tsconfig,"--pretty","false"]);
  const ts=require("typescript-4-9"),entryPath=path.join(output,manifest.applicationEntryPath);
  for(const [typescriptPath,text] of [[path.join(output,relative),code],[entryPath,fs.readFileSync(entryPath,"utf8")]])fs.writeFileSync(typescriptPath.replace(/\.ts$/,".js"),ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText);
  const entry=Module.createRequire(entryPath.replace(/\.ts$/,".js"))(entryPath.replace(/\.ts$/,".js")),Probe=entry.AS3_APPLICATION_MODULES.find(module=>module.StringRangeSearchCompiled).StringRangeSearchCompiled,probe=new Probe();
  assert.deepEqual(probe.ap("client_items_12","20260907100506"),expected.get("ap-exact-shapes"));assert.deepEqual(probe.omitted("ababa"),expected.get("omitted-arguments"));assert.deepEqual(probe.explicit("ababa"),expected.get("explicit-undefined-null"));assert.deepEqual(probe.bounds("ababa"),[-1,4,4,-1,"bab","abab","bab",""]);assert.deepEqual(probe.unicode("A\uD83D\uDE00\u00E9\u4E2DZ"),expected.get("utf16-boundaries"));
 }
 assert.deepEqual(snapshots[0],snapshots[1]);

 const hostile={Extra:"text.slice(0,1,2)",WrongSearch:"text.lastIndexOf(1)",WrongBound:"text.substring(\"1\")",Dynamic:"value.lastIndexOf(\"a\")",Foreign:"value.slice(0,1)",MethodValue:"text.substring",Computed:"text[\"slice\"](0,1)"};
 for(const [name,expression] of Object.entries(hostile)){const parameter=name==="Dynamic"?"value:*":name==="Foreign"?"value:Object":"text:String",returnType=name==="MethodValue"?"Function":"*";fs.writeFileSync(path.join(source,name+".as"),`package {public class ${name} {public function run(${parameter}):${returnType} {return ${expression};}}}`);}
 fs.rmSync(profile,{recursive:true,force:true});make();compile("qualify","hostile");const rows=JSON.parse(fs.readFileSync(path.join(dir,"hostile/manifest.json"))).files;
 for(const name of Object.keys(hostile)){const row=rows.find(item=>item.sourcePath===name+".as");assert.equal(row.status,"held",JSON.stringify(row));assert.ok(row.code&&row.code.startsWith("HARDENED_"),JSON.stringify(row));}
 assert.equal(rows.find(row=>row.sourcePath==="Extra.as").code,"HARDENED_STRING_ARITY");assert.equal(rows.find(row=>row.sourcePath==="WrongSearch.as").code,"HARDENED_STRING_ARGUMENT");assert.equal(rows.find(row=>row.sourcePath==="WrongBound.as").code,"HARDENED_STRING_ARGUMENT");assert.equal(rows.find(row=>row.sourcePath==="MethodValue.as").code,"HARDENED_MEMBER_TARGET");
});
