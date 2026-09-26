"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),cp=require("node:child_process"),crypto=require("node:crypto"),esbuild=require("esbuild");
const root=path.resolve(__dirname,"../.."),air=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA;
const sha=bytes=>crypto.createHash("sha256").update(bytes).digest("hex");

test("String.fromCharCode.apply uses the shared UTF-16 bridge and matches AIR",{skip:!air||!laya},async t=>{
 const fixture=path.join(fs.realpathSync(laya),"tests/nativeFlashOracle/string-from-char-codes");
 for(const [name,hash] of Object.entries({"StringFromCharCodesProbe.as":"58f95193c9d748b936cef6f1f8a99313fd3c262ea525031c22b4e3871ad5d2ea","scenario.json":"4988da5286e708572108e568f0b2e256f844572aae08bd410163a72f457489d0","native-air.json":"5fb310d3c5daca91cbc70492b4c85dcee3af2871e751530f1a94d88856eecf70"}))
  assert.equal(sha(fs.readFileSync(path.join(fixture,name))),hash,name);
 const capture=JSON.parse(fs.readFileSync(path.join(fixture,"native-air.json")));
 assert.equal(capture.runtime.playerType,"Desktop");assert.equal(capture.state.ready,true);assert.equal(capture.state.failure,"");
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"string-from-char-codes-")));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const source=path.join(dir,"source"),profile=path.join(dir,"profile"),output=path.join(dir,"output");fs.mkdirSync(source);
 fs.copyFileSync(path.join(fixture,"StringFromCharCodesProbe.as"),path.join(source,"StringFromCharCodesProbe.as"));
 const run=(command,args)=>{const result=cp.spawnSync(command,args,{cwd:root,encoding:"utf8",timeout:240000});assert.equal(result.status,0,result.stdout+result.stderr);};
 run("python3",["-B","tools/create-fixture-profile.py","--source",source,"--entry","StringFromCharCodesProbe","--air-sdk",air,"--laya",laya,"--shared-string-ranges","--output",profile]);
 run(process.execPath,["bin/as3-frontend","transpile",source,output,"--source-census",path.join(profile,"census.json"),"--target-capabilities",path.join(laya,"docTool/architecture/authored-content-capabilities.json"),"--profile-lock",path.join(profile,"profile-lock.json")]);
 const generated=fs.readFileSync(path.join(output,"__as3_runtime/application/StringFromCharCodesProbe.ts"),"utf8");
 assert.match(generated,/__sharedStringFromCharCodes\(/);
 const steps=JSON.parse(fs.readFileSync(path.join(fixture,"scenario.json"))).steps;
 const entry=`import {startAS3Application} from ${JSON.stringify(path.join(output,"__as3_runtime/ApplicationEntry.generated.js"))};
const probe=startAS3Application(new AbortController().signal);
globalThis.fromCharCodes=${JSON.stringify(steps)}.map(step=>{for(const call of step.calls)probe[call.method](...call.args);return {id:step.id,result:probe.result};});`;
 const built=await esbuild.build({plugins:[{name:"shared-laya",setup(build){build.onResolve({filter:/^laya\//},args=>({path:path.join(laya,"src/layaAir",args.path.slice(5)+".ts")}));}}],
  stdin:{contents:entry,resolveDir:root,loader:"js"},bundle:true,write:false,format:"iife",platform:"browser",target:"es2020",loader:{".glsl":"text",".vs":"text",".fs":"text",".wgsl":"text"}});
 const bundle=built.outputFiles[0].text,expected=capture.state.observations;
 assert.deepEqual(JSON.parse(JSON.stringify(new Function(bundle+";return globalThis.fromCharCodes;")())),expected);
 if(process.env.LAYA_PLAYWRIGHT_MODULE){const {chromium}=require(process.env.LAYA_PLAYWRIGHT_MODULE),browser=await chromium.launch({headless:true});
  try{const page=await browser.newPage();await page.addScriptTag({content:bundle});assert.deepEqual(await page.evaluate(()=>JSON.parse(JSON.stringify(globalThis.fromCharCodes))),expected);}finally{await browser.close();}}
});
