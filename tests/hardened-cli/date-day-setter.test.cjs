"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),cp=require("node:child_process"),esbuild=require("esbuild");
const root=path.resolve(__dirname,"../.."),air=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA,ffdec=process.env.HARDENED_FIXTURE_FFDEC;

test("source Date.date assignment and compound rollover use the shared Laya setter",{skip:!(air&&laya&&ffdec)},async t=>{
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"date-day-setter-")));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const evidence=path.join(laya,"tests/nativeFlashOracle/date-day-setter");
 const source=path.join(dir,"source");fs.mkdirSync(source);
 fs.copyFileSync(path.join(evidence,"DateDaySetterProbe.as"),path.join(source,"DateDaySetterProbe.as"));
 const run=(command,args)=>{const result=cp.spawnSync(command,args,{cwd:root,encoding:"utf8",timeout:240000});
  assert.equal(result.status,0,result.stdout+result.stderr);return result;};
 const profile=path.join(dir,"profile");
 run("python3",["-B","tools/create-fixture-profile.py","--source",source,"--entry","DateDaySetterProbe",
  "--air-sdk",air,"--laya",laya,"--ffdec-jar",ffdec,"--native-date","--shared-date","--output",profile]);
 const output=path.join(dir,"output");
 run(process.execPath,["bin/as3-frontend","transpile",source,output,"--source-census",path.join(profile,"census.json"),
  "--target-capabilities",path.join(laya,"docTool/architecture/authored-content-capabilities.json"),
  "--profile-lock",path.join(profile,"profile-lock.json")]);
 const application=path.join(output,"__as3_runtime/application/DateDaySetterProbe.ts");
 const code=fs.readFileSync(application,"utf8");
 assert.match(code,/laya\/flash\/utils\/AS3Date/);
 assert.match(code,/\.date \+= 1|\.date =/);
 const entry=`import {startAS3Application} from ${JSON.stringify(path.join(output,"__as3_runtime/ApplicationEntry.generated.js"))};
const probe=startAS3Application(new AbortController().signal);
globalThis.dateSetter=${JSON.stringify(JSON.parse(fs.readFileSync(path.join(evidence,"scenario.json"))).steps)}.map(step=>{
 for(const call of step.calls)probe[call.method](...call.args);return {id:step.id,result:probe.result};});`;
 const built=await esbuild.build({plugins:[{name:"shared-laya",setup(build){build.onResolve({filter:/^laya\//},args=>({path:path.join(laya,"src/layaAir",args.path.slice(5)+".ts")}));}}],
  stdin:{contents:entry,resolveDir:root,loader:"js"},bundle:true,write:false,format:"iife",platform:"node",target:"node24"});
 const previous=process.env.TZ;process.env.TZ="Europe/Rome";
 try {
  const actual=JSON.parse(JSON.stringify(new Function(built.outputFiles[0].text+";return globalThis.dateSetter;")()));
  const expected=JSON.parse(fs.readFileSync(path.join(evidence,"native-capture.json"))).state.observations;
  assert.deepEqual(actual,expected);
 } finally { if(previous===undefined) delete process.env.TZ; else process.env.TZ=previous; }
});
