"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),cp=require("node:child_process"),crypto=require("node:crypto"),esbuild=require("esbuild");
const root=path.resolve(__dirname,"../.."),air=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA;
const sha=bytes=>crypto.createHash("sha256").update(bytes).digest("hex");
const ts=require("typescript-4-9"),moduleCache=new Map();
function loadTypeScript(file){
 if(moduleCache.has(file))return moduleCache.get(file).exports;
 const record={exports:{}};moduleCache.set(file,record);
 const code=ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
 Function("require","module","exports",code)(name=>name.startsWith(".")?loadTypeScript(path.resolve(path.dirname(file),name+".ts")):require(name),record,record.exports);
 return record.exports;
}
const good=`package {
 import flash.display.DisplayObject;
 import flash.display.Sprite;
 import flash.display.MovieClip;
 public final class Good {
  public var result:*;
  public var sprite:Sprite;
  public var clip:MovieClip;
  public function make():DisplayObject {return new ProbePositionSprite();}
  public function run(value:DisplayObject):void {result=value["postionType"];}
 }
}
`;

test("sealed DisplayObject literal read follows AIR runtime-subtype traits in Node and Chromium",{skip:!air||!laya},async t=>{
 const fixture=path.join(fs.realpathSync(laya),"tests/nativeFlashOracle/sealed-display-literal-read");
 for(const [name,hash] of Object.entries({"ProbePositionSprite.as":"ab8d6dd1dda2da6a12ab05168d08b7b7b490f30c38754eee7593ea665a82f3be","SealedDisplayLiteralReadProbe.as":"857b62a645a6bdeb678c2ab04ca2e9a2a3f1427d24d6319d3ddf7ec44754b94b","scenario.json":"638c34fb94a8bc274484954919b70b4294432f8e74e3c371f4ca40fa02ef62e3","native-air.json":"47494e93eb23d4fd5bd2c399fa26f93d96383857c126edb9dea21d5cbbeacdb3"}))
  assert.equal(sha(fs.readFileSync(path.join(fixture,name))),hash,name);
 const capture=JSON.parse(fs.readFileSync(path.join(fixture,"native-air.json")));
 assert.equal(capture.runtime.playerType,"Desktop");assert.equal(capture.state.ready,true);assert.equal(capture.state.failure,"");
 const expected=capture.state.observations.map(row=>row.result);
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"mapped-native-display-read-")));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const source=path.join(dir,"source"),profile=path.join(dir,"profile"),output=path.join(dir,"output");fs.mkdirSync(source);
 fs.writeFileSync(path.join(source,"Good.as"),good);
 fs.copyFileSync(path.join(fixture,"ProbePositionSprite.as"),path.join(source,"ProbePositionSprite.as"));
 const run=(command,args)=>{const result=cp.spawnSync(command,args,{cwd:root,encoding:"utf8",timeout:240000});assert.equal(result.status,0,result.stdout+result.stderr);};
 run("python3",["-B","tools/create-fixture-profile.py","--source",source,"--entry","Good","--air-sdk",air,"--laya",laya,"--output",profile]);
 run(process.execPath,["bin/as3-frontend","transpile",source,output,"--source-census",path.join(profile,"census.json"),"--target-capabilities",path.join(laya,"docTool/architecture/authored-content-capabilities.json"),"--profile-lock",path.join(profile,"profile-lock.json")]);
 const rows=JSON.parse(fs.readFileSync(path.join(output,"manifest.json"))).files;
 assert.equal(rows.length,2);assert(rows.every(row=>row.typescriptSha256));
 const generated=fs.readFileSync(path.join(output,"__as3_runtime/application/Good.ts"),"utf8");
 assert.match(generated,/__as3ObjectRead\(__as3Cast\(value, __as3NamedReferenceType\("flash\.display\.DisplayObject"\)\), "postionType", "Good"\)/);
 const entry=`import {startAS3Application} from ${JSON.stringify(path.join(output,"__as3_runtime/ApplicationEntry.generated.js"))};
import {Sprite} from 'laya/flash/display/Sprite';import {MovieClip} from 'laya/flash/display/MovieClip';
import {ILaya} from 'laya/ILaya';import {LayaGL} from 'laya/laya/layagl/LayaGL';
import {NoRender2DProcess} from 'laya/laya/RenderDriver/NoRenderDriver/2DRenderPass/NoRender2DProcess';
import {NoRenderDeviceFactory} from 'laya/laya/RenderDriver/NoRenderDriver/DriverDevice/NoRenderDeviceFactory';
import 'laya/laya/ModuleDef';
LayaGL.render2DRenderPassFactory=new NoRender2DProcess();LayaGL.renderDeviceFactory=new NoRenderDeviceFactory();
ILaya.stage={_graphicUpdateList:new Set(),_tranMatrixUpdateList:new Set(),_componentDriver:{_toDestroys:new Set()}};ILaya.timer={delta:0};
const probe=startAS3Application(new AbortController().signal);
const clip=new MovieClip();clip.postionType='dynamic';
globalThis.displayLiteralResults=[probe.make(),new Sprite(),clip,null].map(value=>{try{probe.run(value);return ['value',probe.result];}catch(error){return ['error',error.name,error.errorID]}});`;
 const built=await esbuild.build({plugins:[{name:"shared-laya",setup(build){build.onResolve({filter:/^laya\//},args=>({path:path.join(laya,"src/layaAir",args.path.slice(5)+".ts")}));}}],
  stdin:{contents:entry,resolveDir:root,loader:"js"},bundle:true,write:false,format:"iife",platform:"browser",target:"es2020",loader:{".glsl":"text",".vs":"text",".fs":"text",".wgsl":"text"}});
 const bundle=built.outputFiles[0].text;
 assert.deepEqual(JSON.parse(JSON.stringify(new Function(bundle+";return globalThis.displayLiteralResults;")())),expected);
 if(process.env.LAYA_PLAYWRIGHT_MODULE){const {chromium}=require(process.env.LAYA_PLAYWRIGHT_MODULE),browser=await chromium.launch({headless:true});
  try{const page=await browser.newPage();await page.addScriptTag({content:bundle});assert.deepEqual(await page.evaluate(()=>JSON.parse(JSON.stringify(globalThis.displayLiteralResults))),expected);}finally{await browser.close();}}
});

test("sealed DisplayObject read authority requires an exact source class and mapping",{skip:!laya},()=>{
 const api=loadTypeScript(path.join(root,"src/hardened/mapped-native-dynamic-literal-read-authority.ts"));
 const members=loadTypeScript(path.join(root,"src/hardened/source-member-authority.ts"));
 const authority=api.MAPPED_NATIVE_DISPLAY_LITERAL_READ_AUTHORITY;
 assert.equal(cp.spawnSync("git",["merge-base","--is-ancestor",authority.evidenceRevision,"HEAD"],{cwd:laya}).status,0);
 assert.equal(sha(fs.readFileSync(path.join(laya,"tests/nativeFlashOracle/sealed-display-literal-read/native-air.json"))),authority.nativeEvidenceSha256);
 for(const [file,hash] of [["src/hardened-runtime/AS3ObjectDispatch.ts",authority.runtimeObjectDispatchSourceSha256],["src/hardened-runtime/AS3Type.ts",authority.runtimeTypeSourceSha256],["src/hardened-runtime/internal/AS3TypeRegistry.ts",authority.runtimeTypeRegistrySourceSha256]])
  assert.equal(sha(fs.readFileSync(path.join(root,file))),hash,file);
 const document=(dynamic=false,artifact=authority.sourceArtifactSha256,names=[])=>({schema:"as3-source-member-authority@2",generator:"air-sdk-swfdump-abc@1",sourceArtifactSha256:artifact,entryCount:2,
  entries:[{qname:"flash.display.DisplayObject",baseQName:"flash.events.EventDispatcher",ownInstanceMemberNames:names,dynamic},{qname:"flash.events.EventDispatcher",baseQName:null,ownInstanceMemberNames:[],dynamic:false}]});
 const load=value=>{const json=JSON.stringify(value);return members.loadSourceMemberAuthority(json,sha(json),sha);};
 const args=["flash.display.DisplayObject","postionType","laya/flash/display/DisplayObject","DisplayObject"];
 const proof=api.mappedNativeDisplayLiteralReadProof(load(document()),...args);
 assert.equal(Object.isFrozen(proof),true);api.assertMappedNativeDisplayLiteralReadProof(proof,...args);
 for(const source of [document(true),document(false,"a".repeat(64)),document(false,authority.sourceArtifactSha256,["postionType"])])
  assert.throws(()=>api.mappedNativeDisplayLiteralReadProof(load(source),...args),error=>error.code==="HARDENED_MAPPED_NATIVE_DISPLAY_LITERAL_READ_AUTHORITY");
 for(const bad of [["flash.display.Sprite",...args.slice(1)],[args[0],"not-valid!",...args.slice(2)],[args[0],args[1],"laya/flash/display/Sprite",args[3]]])
  assert.throws(()=>api.mappedNativeDisplayLiteralReadProof(load(document()),...bad),error=>error.code==="HARDENED_MAPPED_NATIVE_DISPLAY_LITERAL_READ_AUTHORITY");
 assert.throws(()=>api.assertMappedNativeDisplayLiteralReadProof({...proof,propertyName:"other"},...args),error=>error.code==="HARDENED_MAPPED_NATIVE_DISPLAY_LITERAL_READ_AUTHORITY");
});

test("computed, write, call and another sealed class remain held",{skip:!air||!laya},t=>{
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"mapped-native-display-negative-")));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const source=path.join(dir,"source"),profile=path.join(dir,"profile"),output=path.join(dir,"output");fs.mkdirSync(source);
 const cases={
  "Computed.as":`package {import flash.display.DisplayObject; public final class Computed {public function run(value:DisplayObject,key:String):* {return value[key];}}}`,
  "Write.as":`package {import flash.display.DisplayObject; public final class Write {public function run(value:DisplayObject):void {value["postionType"]="wrong";}}}`,
  "Call.as":`package {import flash.display.DisplayObject; public final class Call {public function run(value:DisplayObject):* {return value["postionType"]();}}}`,
  "OtherSealed.as":`package {import flash.display.Sprite; public final class OtherSealed {public function run(value:Sprite):* {return value["postionType"];}}}`,
 };
 for(const [name,value] of Object.entries(cases))fs.writeFileSync(path.join(source,name),value);
 const run=(command,args)=>{const result=cp.spawnSync(command,args,{cwd:root,encoding:"utf8",timeout:240000});assert.equal(result.status,0,result.stdout+result.stderr);};
 run("python3",["-B","tools/create-fixture-profile.py","--source",source,"--entry","Computed","--air-sdk",air,"--laya",laya,"--output",profile]);
 run(process.execPath,["bin/as3-frontend","qualify",source,output,"--source-census",path.join(profile,"census.json"),"--target-capabilities",path.join(laya,"docTool/architecture/authored-content-capabilities.json"),"--profile-lock",path.join(profile,"profile-lock.json")]);
 const rows=Object.fromEntries(JSON.parse(fs.readFileSync(path.join(output,"manifest.json"))).files.map(row=>[row.sourcePath,row]));
 for(const name of Object.keys(cases))assert.equal(rows[name].status,"held",name);
 assert.equal(rows["Computed.as"].code,"HARDENED_MAPPED_NATIVE_DYNAMIC_LITERAL_READ_KEY");
 assert.equal(rows["Write.as"].code,"HARDENED_MAPPED_NATIVE_DYNAMIC_LITERAL_READ_CONTEXT");
 assert.equal(rows["Call.as"].code,"HARDENED_MAPPED_NATIVE_DYNAMIC_LITERAL_READ_CONTEXT");
 assert.equal(rows["OtherSealed.as"].code,"HARDENED_MAPPED_NATIVE_DYNAMIC_LITERAL_READ_AUTHORITY");
});
