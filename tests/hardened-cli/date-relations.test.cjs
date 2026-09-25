"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),cp=require("node:child_process"),crypto=require("node:crypto"),esbuild=require("esbuild");
const root=path.resolve(__dirname,"../.."),air=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA,ffdec=process.env.HARDENED_FIXTURE_FFDEC;
const sha=bytes=>crypto.createHash("sha256").update(bytes).digest("hex");

test("ordered Date relations agree with AIR through the shared Laya bridge",{skip:!air||!laya||!ffdec},async t=>{
 const fixture=path.join(fs.realpathSync(laya),"tests/nativeFlashOracle/date-relations");
 for(const [name,hash] of Object.entries({"DateRelationsProbe.as":"1764dd60cabc9191c0611ca02ab71eb9a9d59931ef2c34ad642e2ca34ac6e297","scenario.json":"61d0213ccc89d8ef80814aea20f8d40a99d8c07f3a5dcf9a015d55873605dea2","native-air.json":"d5a56c703242bc671691094fcd13a1d22976fc5cd5c9e23183ee7bd3a9f83cb8"}))
  assert.equal(sha(fs.readFileSync(path.join(fixture,name))),hash,name);
 const capture=JSON.parse(fs.readFileSync(path.join(fixture,"native-air.json")));
 assert.equal(capture.runtime.playerType,"Desktop");assert.equal(capture.state.ready,true);assert.equal(capture.state.failure,"");assert.equal(capture.state.observations.length,8);
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"date-relations-")));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const source=path.join(dir,"source"),profile=path.join(dir,"profile"),output=path.join(dir,"output");fs.mkdirSync(source);
 fs.copyFileSync(path.join(fixture,"DateRelationsProbe.as"),path.join(source,"DateRelationsProbe.as"));
 const run=(command,args)=>{const result=cp.spawnSync(command,args,{cwd:root,encoding:"utf8",timeout:240000});assert.equal(result.status,0,result.stdout+result.stderr);};
 run("python3",["-B","tools/create-fixture-profile.py","--source",source,"--entry","DateRelationsProbe","--air-sdk",air,"--laya",laya,"--ffdec-jar",ffdec,"--native-date","--shared-date","--output",profile]);
 run(process.execPath,["bin/as3-frontend","transpile",source,output,"--source-census",path.join(profile,"census.json"),"--target-capabilities",path.join(laya,"docTool/architecture/authored-content-capabilities.json"),"--profile-lock",path.join(profile,"profile-lock.json")]);
 const generated=fs.readFileSync(path.join(output,"__as3_runtime/application/DateRelationsProbe.ts"),"utf8");
 assert.match(generated,/__as3DateRelation\(/);
 const steps=JSON.parse(fs.readFileSync(path.join(fixture,"scenario.json"))).steps;
 const entry=`import {startAS3Application} from ${JSON.stringify(path.join(output,"__as3_runtime/ApplicationEntry.generated.js"))};
const probe=startAS3Application(new AbortController().signal);
globalThis.dateRelations=${JSON.stringify(steps)}.map(step=>{for(const call of step.calls)probe[call.method](...call.args);return {id:step.id,result:probe.result};});`;
 const built=await esbuild.build({plugins:[{name:"shared-laya",setup(build){build.onResolve({filter:/^laya\//},args=>({path:path.join(laya,"src/layaAir",args.path.slice(5)+".ts")}));}}],
  stdin:{contents:entry,resolveDir:root,loader:"js"},bundle:true,write:false,format:"iife",platform:"node",target:"node24"});
 const actual=JSON.parse(JSON.stringify(new Function(built.outputFiles[0].text+";return globalThis.dateRelations;")()));
 assert.deepEqual(actual,capture.state.observations);
});
