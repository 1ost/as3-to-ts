"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),cp=require("node:child_process"),crypto=require("node:crypto"),esbuild=require("esbuild");
const root=path.resolve(__dirname,"../.."),air=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA;
const sha=bytes=>crypto.createHash("sha256").update(bytes).digest("hex");

test("two-field numeric sortOn uses the authenticated Laya bridge and AIR order",{skip:!air||!laya},async t=>{
 const fixture=path.join(fs.realpathSync(laya),"tests/nativeFlashOracle/array-sort-on-pair");
 for(const [name,hash] of Object.entries({"ArraySortOnPairProbe.as":"001db441d05dd623ec5823c019ca44bbaa2b30bfe4868f2b4a1adccd221a5802","scenario.json":"8db0f94980210ba4ff63cfbded4f2abf9b2085a6dc2caa294a2d2cccbc1eaaaa","native-air.json":"894b767090b7e13e467a7be9cb15994f58806813d7d14b8632c74618c8522c9c"}))
  assert.equal(sha(fs.readFileSync(path.join(fixture,name))),hash,name);
 const capture=JSON.parse(fs.readFileSync(path.join(fixture,"native-air.json")));
 assert.equal(capture.runtime.playerType,"Desktop");assert.equal(capture.state.ready,true);assert.equal(capture.state.failure,"");
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"array-sort-on-pair-")));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const source=path.join(dir,"source"),profile=path.join(dir,"profile"),output=path.join(dir,"output");fs.mkdirSync(source);
 fs.writeFileSync(path.join(source,"ArraySortOnPair.as"),"package {public class ArraySortOnPair {public function run(values:Array):Array {return values.sortOn([\"a\",\"b\"],[Array.NUMERIC,Array.NUMERIC]);}}}");
 const run=(command,args)=>{const result=cp.spawnSync(command,args,{cwd:root,encoding:"utf8",timeout:240000});assert.equal(result.status,0,result.stdout+result.stderr);};
 run("python3",["-B","tools/create-fixture-profile.py","--source",source,"--entry","ArraySortOnPair","--air-sdk",air,"--laya",laya,"--shared-array-sort","--output",profile]);
 run(process.execPath,["bin/as3-frontend","transpile",source,output,"--source-census",path.join(profile,"census.json"),"--target-capabilities",path.join(laya,"docTool/architecture/authored-content-capabilities.json"),"--profile-lock",path.join(profile,"profile-lock.json")]);
 const generated=fs.readFileSync(path.join(output,"__as3_runtime/application/ArraySortOnPair.ts"),"utf8");
 assert.match(generated,/__sharedArraySortOn\(/);
 const entry=`import {startAS3Application} from ${JSON.stringify(path.join(output,"__as3_runtime/ApplicationEntry.generated.js"))};
const probe=startAS3Application(new AbortController().signal);
const rows=[[{id:"a",a:2,b:3},{id:"b",a:1,b:9},{id:"c",a:2,b:1},{id:"d",a:1,b:2}],[{id:"a",a:2,b:1},{id:"b",a:2,b:1},{id:"c",a:1,b:0},{id:"d",a:2,b:2}],[]];
globalThis.pairSort=rows.map((values,index)=>{const returned=probe.run(values);return {id:["primary-secondary","duplicate-keys","empty"][index],result:[returned===values,...values.map(item=>item.id)]};});`;
 const built=await esbuild.build({plugins:[{name:"shared-laya",setup(build){build.onResolve({filter:/^laya\//},args=>({path:path.join(laya,"src/layaAir",args.path.slice(5)+".ts")}));}}],
  stdin:{contents:entry,resolveDir:root,loader:"js"},bundle:true,write:false,format:"iife",platform:"node",target:"node24"});
 const actual=JSON.parse(JSON.stringify(new Function(built.outputFiles[0].text+";return globalThis.pairSort;")()));
 assert.deepEqual(actual,capture.state.observations);
});
