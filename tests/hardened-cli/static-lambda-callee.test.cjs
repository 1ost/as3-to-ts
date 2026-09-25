"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),cp=require("node:child_process"),crypto=require("node:crypto"),esbuild=require("esbuild");
const root=path.resolve(__dirname,"../.."),air=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA;
const sha=bytes=>crypto.createHash("sha256").update(bytes).digest("hex");

test("source lambda in static method retains AIR arguments.callee callback identity",{skip:!air||!laya},async t=>{
 const fixture=path.join(fs.realpathSync(laya),"tests/nativeFlashOracle/static-lambda-callee");
 for(const [name,hash] of Object.entries({"StaticLambdaCalleeProbe.as":"9847937eae45cd414e7afba5119f72619d040f0eaa7e3113d0428a1dabdcc34d","native-air.json":"54d7e2d6d6f63cc1f00e271047736dab0b5c85b3ae5659186a15fecc3a2b13cd"}))
  assert.equal(sha(fs.readFileSync(path.join(fixture,name))),hash,name);
 const capture=JSON.parse(fs.readFileSync(path.join(fixture,"native-air.json")));
 assert.equal(capture.runtime.playerType,"Desktop");assert.equal(capture.state.ready,true);assert.equal(capture.state.failure,"");
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"static-lambda-callee-")));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const source=path.join(dir,"source"),profile=path.join(dir,"profile"),output=path.join(dir,"output");fs.mkdirSync(source);
 fs.copyFileSync(path.join(fixture,"StaticLambdaCalleeProbe.as"),path.join(source,"StaticLambdaCalleeProbe.as"));
 const run=(command,args)=>{const result=cp.spawnSync(command,args,{cwd:root,encoding:"utf8",timeout:240000});assert.equal(result.status,0,result.stdout+result.stderr);};
 run("python3",["-B","tools/create-fixture-profile.py","--source",source,"--entry","StaticLambdaCalleeProbe","--air-sdk",air,"--laya",laya,"--output",profile]);
 run(process.execPath,["bin/as3-frontend","transpile",source,output,"--source-census",path.join(profile,"census.json"),"--target-capabilities",path.join(laya,"docTool/architecture/authored-content-capabilities.json"),"--profile-lock",path.join(profile,"profile-lock.json")]);
 const generated=fs.readFileSync(path.join(output,"__as3_runtime/application/StaticLambdaCalleeProbe.ts"),"utf8");
 assert.match(generated,/__as3LambdaSelf1 === listener/);assert.match(generated,/__as3LambdaSelf1 === __as3ClassMemberReceiver/);
 const entry=`import {startAS3Application} from ${JSON.stringify(path.join(output,"__as3_runtime/ApplicationEntry.generated.js"))};
import {ILaya} from 'laya/ILaya';import {LayaGL} from 'laya/laya/layagl/LayaGL';
import {NoRender2DProcess} from 'laya/laya/RenderDriver/NoRenderDriver/2DRenderPass/NoRender2DProcess';
import {NoRenderDeviceFactory} from 'laya/laya/RenderDriver/NoRenderDriver/DriverDevice/NoRenderDeviceFactory';import 'laya/laya/ModuleDef';
LayaGL.render2DRenderPassFactory=new NoRender2DProcess();LayaGL.renderDeviceFactory=new NoRenderDeviceFactory();
ILaya.stage={_graphicUpdateList:new Set(),_tranMatrixUpdateList:new Set(),_componentDriver:{_toDestroys:new Set()}};ILaya.timer={delta:0};
const probe=startAS3Application(new AbortController().signal);globalThis.staticLambdaCallee=probe.snapshot();`;
 const built=await esbuild.build({plugins:[{name:"shared-laya",setup(build){build.onResolve({filter:/^laya\//},args=>({path:path.join(laya,"src/layaAir",args.path.slice(5)+".ts")}));}}],
  stdin:{contents:entry,resolveDir:root,loader:"js"},bundle:true,write:false,format:"iife",platform:"browser",target:"es2020",loader:{".glsl":"text",".vs":"text",".fs":"text",".wgsl":"text"}});
 const bundle=built.outputFiles[0].text,expected=capture.state;
 assert.deepEqual(JSON.parse(JSON.stringify(new Function(bundle+";return globalThis.staticLambdaCallee;")())),expected);
 if(process.env.LAYA_PLAYWRIGHT_MODULE){const {chromium}=require(process.env.LAYA_PLAYWRIGHT_MODULE),browser=await chromium.launch({headless:true});
  try{const page=await browser.newPage();await page.addScriptTag({content:bundle});assert.deepEqual(await page.evaluate(()=>JSON.parse(JSON.stringify(globalThis.staticLambdaCallee))),expected);}finally{await browser.close();}}
});
