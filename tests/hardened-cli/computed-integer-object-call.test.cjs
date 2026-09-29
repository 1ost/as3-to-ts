"use strict";
const assert=require("node:assert/strict"),test=require("node:test"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),cp=require("node:child_process");
const root=path.resolve(__dirname,"../.."),air=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA;

test("source int/uint keys call Object-held method closures in Node and Chromium",{skip:!air||!laya},async t=>{
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"computed-integer-object-call-")));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const source=path.join(dir,"source"),profile=path.join(dir,"profile");fs.mkdirSync(source);
 const original=fs.readFileSync(path.join(__dirname,"fixtures/computed-integer-object-call/NumericObjectCallProbe.as"),"utf8");
 fs.writeFileSync(path.join(source,"NumericObjectCallProbe.as"),original);
 const run=(cmd,args)=>{const result=cp.spawnSync(cmd,args,{cwd:root,encoding:"utf8",timeout:120000});assert.equal(result.status,0,result.stdout+result.stderr);};
 const makeProfile=(sourceDir,profileDir)=>run("python3",["-B","tools/create-fixture-profile.py","--source",sourceDir,
  "--entry","NumericObjectCallProbe","--air-sdk",air,"--laya",laya,"--output",profileDir]);
 const args=(sourceDir,profileDir,output)=>[sourceDir,output,"--source-census",path.join(profileDir,"census.json"),
  "--target-capabilities",path.join(laya,"docTool/architecture/authored-content-capabilities.json"),
  "--profile-lock",path.join(profileDir,"profile-lock.json")];
 makeProfile(source,profile);
 const output=path.join(dir,"output");run(process.execPath,["bin/as3-frontend","transpile",...args(source,profile,output)]);
 const manifest=JSON.parse(fs.readFileSync(path.join(output,"manifest.json")));
 assert.ok(manifest.files[0].typescriptPath);
 const generated=fs.readFileSync(path.join(output,"__as3_runtime/application/NumericObjectCallProbe.ts"),"utf8");
 assert.equal((generated.match(/__as3PrepareObjectCall\(/g)||[]).length,2);
 const entry=`import {startAS3Application} from ${JSON.stringify(path.join(output,"__as3_runtime/ApplicationEntry.generated.js"))};
globalThis.numericObjectCalls=startAS3Application(new AbortController().signal).snapshot();`;
 const bundle=(await require("esbuild").build({stdin:{contents:entry,resolveDir:root,loader:"js"},bundle:true,platform:"browser",format:"iife",target:"es2020",write:false})).outputFiles[0].text;
 const wanted=["first:A","second:B"];
 assert.deepEqual(new Function(bundle+";return globalThis.numericObjectCalls")(),wanted);
 const {chromium}=require(process.env.LAYA_PLAYWRIGHT_MODULE||path.join(laya,"node_modules/playwright"));
 const browser=await chromium.launch({headless:true});
 try{const page=await browser.newPage();await page.addScriptTag({content:bundle});assert.deepEqual(await page.evaluate(()=>globalThis.numericObjectCalls),wanted);}finally{await browser.close();}
 const negative=path.join(dir,"negative-source"),negativeProfile=path.join(dir,"negative-profile");fs.mkdirSync(negative);
 fs.writeFileSync(path.join(negative,"NumericObjectCallProbe.as"),original);
 fs.writeFileSync(path.join(negative,"UnprovedKey.as"),"package { public class UnprovedKey { public function call(value:Object,key:Object):* {return value[key]();} } }\n");
 makeProfile(negative,negativeProfile);
 const negativeOutput=path.join(dir,"negative-output");run(process.execPath,["bin/as3-frontend","qualify",...args(negative,negativeProfile,negativeOutput)]);
 const held=JSON.parse(fs.readFileSync(path.join(negativeOutput,"manifest.json"))).files.find(row=>row.sourcePath==="UnprovedKey.as");
 assert.equal(held.status,"held");assert.equal(held.code,"HARDENED_OBJECT_CALL_TARGET");
 assert.equal(fs.readFileSync(path.join(source,"NumericObjectCallProbe.as"),"utf8"),original);
});
