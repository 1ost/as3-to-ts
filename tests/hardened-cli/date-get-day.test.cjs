"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),cp=require("node:child_process"),crypto=require("node:crypto"),esbuild=require("esbuild");
const root=path.resolve(__dirname,"../.."),air=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA,ffdec=process.env.HARDENED_FIXTURE_FFDEC;
const sha=file=>crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

test("Date.getDay direct calls use the shared Laya bridge and match AIR",{skip:!(air&&laya&&ffdec)},async t=>{
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"date-get-day-")));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const evidence=path.join(laya,"tests/nativeFlashOracle/date-get-day");
 const receipt=JSON.parse(fs.readFileSync(path.join(evidence,"native-receipt.json")));
 assert.equal(receipt.status,"passed");assert.equal(receipt.capture.identical,true);
 assert.equal(sha(path.join(evidence,"DateGetDayProbe.as")),receipt.artifacts["source/DateGetDayProbe.as"]);
 assert.equal(sha(path.join(evidence,"native-capture.json")),receipt.artifacts["run-1/capture.json"]);
 const source=path.join(dir,"source");fs.mkdirSync(source);
 fs.copyFileSync(path.join(evidence,"DateGetDayProbe.as"),path.join(source,"DateGetDayProbe.as"));
 const run=(command,args)=>{const result=cp.spawnSync(command,args,{cwd:root,encoding:"utf8",timeout:240000});
  assert.equal(result.status,0,result.stdout+result.stderr);return result;};
 const profile=path.join(dir,"profile");
 run("python3",["-B","tools/create-fixture-profile.py","--source",source,"--entry","DateGetDayProbe",
  "--air-sdk",air,"--laya",laya,"--ffdec-jar",ffdec,"--native-date","--shared-date","--output",profile]);
 const output=path.join(dir,"output");
 const cli=[source,output,"--source-census",path.join(profile,"census.json"),
  "--target-capabilities",path.join(laya,"docTool/architecture/authored-content-capabilities.json"),
  "--profile-lock",path.join(profile,"profile-lock.json")];
 run(process.execPath,["bin/as3-frontend","transpile",...cli]);
 const code=fs.readFileSync(path.join(output,"__as3_runtime/application/DateGetDayProbe.ts"),"utf8");
 assert.match(code,/laya\/flash\/utils\/AS3Date/);assert.match(code,/\.getDay\(\)/);
 const steps=JSON.parse(fs.readFileSync(path.join(evidence,"scenario.json"))).steps;
 const entry=`import {startAS3Application} from ${JSON.stringify(path.join(output,"__as3_runtime/ApplicationEntry.generated.js"))};
const probe=startAS3Application(new AbortController().signal);
globalThis.dateGetDay=${JSON.stringify(steps)}.map(step=>{for(const call of step.calls)probe[call.method](...call.args);return {id:step.id,result:probe.result};});`;
 const built=await esbuild.build({plugins:[{name:"shared-laya",setup(build){build.onResolve({filter:/^laya\//},args=>({path:path.join(laya,"src/layaAir",args.path.slice(5)+".ts")}));}}],
  stdin:{contents:entry,resolveDir:root,loader:"js"},bundle:true,write:false,format:"iife",platform:"node",target:"node24"});
 const previous=process.env.TZ;process.env.TZ="Europe/Rome";
 try {
  const actual=JSON.parse(JSON.stringify(new Function(built.outputFiles[0].text+";return globalThis.dateGetDay;")()));
  const expected=JSON.parse(fs.readFileSync(path.join(evidence,"native-capture.json"))).state.observations;
  assert.deepEqual(actual,expected);
 } finally { if(previous===undefined) delete process.env.TZ; else process.env.TZ=previous; }
});
