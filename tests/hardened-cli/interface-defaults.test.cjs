"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),cp=require("node:child_process"),crypto=require("node:crypto"),esbuild=require("esbuild");
const root=path.resolve(__dirname,"../.."),air=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA;
const sha=bytes=>crypto.createHash("sha256").update(bytes).digest("hex");

test("interface defaults convey optionality while AIR implementation defaults control calls",{skip:!air||!laya},async t=>{
 const fixture=path.join(fs.realpathSync(laya),"tests/nativeFlashOracle/interface-defaults");
 const files={"IInterfaceDefaultProbe.as":"71abee5c6caec55add88ac039fef452faa8100b5fc9d5be55daf7116ef926b5b","InterfaceDefaultImpl.as":"d4b35981af166d5bd4dde94d0284630466ad4b5478ec55f365ce50b3767d6d3b","InterfaceDefaultProbe.as":"40ef50711d01508457459f4438a56024d765b42d5ba8fefc3e698d5f7587c552","IDifferentDefault.as":"366cd6de42c9e404108c17bad25e28a7c5e9c28eeb118ef832268349772d3b67","DifferentDefaultImpl.as":"70e30681e0d779531af434bb45f4c610189fe79937e068fdcc6538ae820f8cd3"};
 for(const [name,hash] of Object.entries({...files,"native-air.json":"100c0cd304231b7b04b98e15b385025e4e86374ccf27678c7c2da1ebb764eca3"}))
  assert.equal(sha(fs.readFileSync(path.join(fixture,name))),hash,name);
 const capture=JSON.parse(fs.readFileSync(path.join(fixture,"native-air.json")));
 assert.equal(capture.runtime.playerType,"Desktop");assert.equal(capture.state.ready,true);assert.equal(capture.state.failure,"");
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"interface-defaults-")));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const source=path.join(dir,"source"),profile=path.join(dir,"profile"),output=path.join(dir,"output");fs.mkdirSync(source);
 for(const name of Object.keys(files))fs.copyFileSync(path.join(fixture,name),path.join(source,name));
 const run=(command,args)=>{const result=cp.spawnSync(command,args,{cwd:root,encoding:"utf8",timeout:240000});assert.equal(result.status,0,result.stdout+result.stderr);};
 run("python3",["-B","tools/create-fixture-profile.py","--source",source,"--entry","InterfaceDefaultProbe","--air-sdk",air,"--laya",laya,"--output",profile]);
 run(process.execPath,["bin/as3-frontend","transpile",source,output,"--source-census",path.join(profile,"census.json"),"--target-capabilities",path.join(laya,"docTool/architecture/authored-content-capabilities.json"),"--profile-lock",path.join(profile,"profile-lock.json")]);
 const generated=path.join(output,"__as3_runtime/application");
 assert.match(fs.readFileSync(path.join(generated,"IInterfaceDefaultProbe.ts"),"utf8"),/read\(value\?: unknown\): string \| null;/);
 assert.match(fs.readFileSync(path.join(generated,"IDifferentDefault.ts"),"utf8"),/read\(value\?: number\): number;/);
 assert.match(fs.readFileSync(path.join(generated,"DifferentDefaultImpl.ts"),"utf8"),/read\(value: number = __as3Int\(9\)\)/);
 const entry=`import {startAS3Application} from ${JSON.stringify(path.join(output,"__as3_runtime/ApplicationEntry.generated.js"))};
import {ILaya} from 'laya/ILaya';import {LayaGL} from 'laya/laya/layagl/LayaGL';
import {NoRender2DProcess} from 'laya/laya/RenderDriver/NoRenderDriver/2DRenderPass/NoRender2DProcess';
import {NoRenderDeviceFactory} from 'laya/laya/RenderDriver/NoRenderDriver/DriverDevice/NoRenderDeviceFactory';import 'laya/laya/ModuleDef';
LayaGL.render2DRenderPassFactory=new NoRender2DProcess();LayaGL.renderDeviceFactory=new NoRenderDeviceFactory();
ILaya.stage={_graphicUpdateList:new Set(),_tranMatrixUpdateList:new Set(),_componentDriver:{_toDestroys:new Set()}};ILaya.timer={delta:0};
const probe=startAS3Application(new AbortController().signal);globalThis.interfaceDefaults=probe.snapshot();`;
 const built=await esbuild.build({plugins:[{name:"shared-laya",setup(build){build.onResolve({filter:/^laya\//},args=>({path:path.join(laya,"src/layaAir",args.path.slice(5)+".ts")}));}}],
  stdin:{contents:entry,resolveDir:root,loader:"js"},bundle:true,write:false,format:"iife",platform:"browser",target:"es2020",loader:{".glsl":"text",".vs":"text",".fs":"text",".wgsl":"text"}});
 const bundle=built.outputFiles[0].text,expected=capture.state;
 assert.deepEqual(JSON.parse(JSON.stringify(new Function(bundle+";return globalThis.interfaceDefaults;")())),expected);
 if(process.env.LAYA_PLAYWRIGHT_MODULE){const {chromium}=require(process.env.LAYA_PLAYWRIGHT_MODULE),browser=await chromium.launch({headless:true});
  try{const page=await browser.newPage();await page.addScriptTag({content:bundle});assert.deepEqual(await page.evaluate(()=>JSON.parse(JSON.stringify(globalThis.interfaceDefaults))),expected);}finally{await browser.close();}}
});
