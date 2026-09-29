"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),cp=require("node:child_process"),crypto=require("node:crypto"),esbuild=require("esbuild");
const root=path.resolve(__dirname,"../.."),air=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA,ffdec=process.env.HARDENED_FIXTURE_FFDEC;
const sha=bytes=>crypto.createHash("sha256").update(bytes).digest("hex");

test("typed Class property construction retains AIR getter order and null error",{skip:!air||!laya||!ffdec},async t=>{
 const fixture=path.join(fs.realpathSync(laya),"tests/nativeFlashOracle/dynamic-class-property-construction");
 for(const [name,hash] of Object.entries({"DynamicClassPropertyConstructionProbe.as":"617393a625ccff648299dbba576e6e64330377cd4eced3eb65dffb54ab794249","scenario.json":"feb3649e8ce64c53be8a78a7e50dd28200f1662ac7a4301adab4e3e83e7e3744","native-air.json":"15e78d022c1c4837c8c77bc9bac18d7d7de311d77fdb548459adc78f8a424a6f"}))
  assert.equal(sha(fs.readFileSync(path.join(fixture,name))),hash,name);
 const capture=JSON.parse(fs.readFileSync(path.join(fixture,"native-air.json")));
 assert.equal(capture.runtime.playerType,"Desktop");assert.equal(capture.state.ready,true);assert.equal(capture.state.failure,"");
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"dynamic-class-property-")));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const source=path.join(dir,"source"),profile=path.join(dir,"profile"),output=path.join(dir,"output");fs.mkdirSync(source);
 fs.copyFileSync(path.join(fixture,"DynamicClassPropertyConstructionProbe.as"),path.join(source,"DynamicClassPropertyConstructionProbe.as"));
 const run=(command,args)=>{const result=cp.spawnSync(command,args,{cwd:root,encoding:"utf8",timeout:240000});assert.equal(result.status,0,result.stdout+result.stderr);};
 run("python3",["-B","tools/create-fixture-profile.py","--source",source,"--entry","DynamicClassPropertyConstructionProbe","--air-sdk",air,"--laya",laya,"--ffdec-jar",ffdec,"--output",profile]);
 run(process.execPath,["bin/as3-frontend","transpile",source,output,"--source-census",path.join(profile,"census.json"),"--target-capabilities",path.join(laya,"docTool/architecture/authored-content-capabilities.json"),"--profile-lock",path.join(profile,"profile-lock.json")]);
 const generated=fs.readFileSync(path.join(output,"__as3_runtime/application/DynamicClassPropertyConstructionProbe.ts"),"utf8");
 assert.match(generated,/__as3ConstructClass\(this\.chosenClass, \[\]\)/);
 const steps=JSON.parse(fs.readFileSync(path.join(fixture,"scenario.json"))).steps;
 const entry=`import {startAS3Application} from ${JSON.stringify(path.join(output,"__as3_runtime/ApplicationEntry.generated.js"))};
const probe=startAS3Application(new AbortController().signal);
globalThis.dynamicClassProperty=${JSON.stringify(steps)}.map(step=>{for(const call of step.calls)probe[call.method](...call.args);return {id:step.id,result:probe.result};});`;
 const built=await esbuild.build({plugins:[{name:"shared-laya",setup(build){build.onResolve({filter:/^laya\//},args=>({path:path.join(laya,"src/layaAir",args.path.slice(5)+".ts")}));}}],
  stdin:{contents:entry,resolveDir:root,loader:"js"},bundle:true,write:false,format:"iife",platform:"browser",target:"es2020",loader:{".glsl":"text",".vs":"text",".fs":"text",".wgsl":"text"}});
 const bundle=built.outputFiles[0].text,expected=capture.state.observations;
 const actual=JSON.parse(JSON.stringify(new Function(bundle+";return globalThis.dynamicClassProperty;")()));assert.deepEqual(actual,expected);
 if(process.env.LAYA_PLAYWRIGHT_MODULE){const {chromium}=require(process.env.LAYA_PLAYWRIGHT_MODULE),browser=await chromium.launch({headless:true});
  try{const page=await browser.newPage();await page.addScriptTag({content:bundle});assert.deepEqual(await page.evaluate(()=>JSON.parse(JSON.stringify(globalThis.dynamicClassProperty))),expected);}finally{await browser.close();}}
});
