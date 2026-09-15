"use strict";
const assert=require("node:assert/strict"),test=require("node:test"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),cp=require("node:child_process"),crypto=require("node:crypto"),Module=require("node:module");
const ROOT=path.resolve(__dirname,"../.."),AIR=process.env.HARDENED_FIXTURE_AIR_SDK,LAYA=process.env.HARDENED_FIXTURE_LAYA,FFDEC=process.env.HARDENED_FIXTURE_FFDEC;
const LAYA_REVISION="8900d073b4cb42effae8b4985a7c678890d0306c",sha=bytes=>crypto.createHash("sha256").update(bytes).digest("hex");
const canonical=value=>value===null||typeof value!=="object"?JSON.stringify(value):Array.isArray(value)?"["+value.map(canonical).join(",")+"]":"{"+Object.keys(value).sort().map(key=>JSON.stringify(key)+":"+canonical(value[key])).join(",")+"}";

test("bounded AP Date surface is evidence-bound, executable, type-safe, and fail-closed",{skip:!AIR||!LAYA||!FFDEC},t=>{
 const laya=fs.realpathSync(LAYA),fixture=path.join(laya,"tests/nativeFlashOracle/date-ap-surface");
 const ancestor=cp.spawnSync("git",["merge-base","--is-ancestor",LAYA_REVISION,"HEAD"],{cwd:laya,encoding:"utf8"});assert.equal(ancestor.status,0,ancestor.stderr||"AP Date evidence revision is not retained");
 const evidence={
  "DateApSurfaceProbe.as":"ea407c1db2127e6f240713703a327f114bb55a9e6dd199203239063b97b63af1",
  "scenario.json":"071212f379299c1fa82cdae69ed47e74baf3981456584565cee0e1bf78e6936c",
  "native-air.json":"606910a7b0508c71d8946067570d5b26494c91dfeec0d7b6ff3028510205ad7f",
  "native-receipt.json":"c784ada3c13b4f916cb58473344c3f3e8b44c1c51cfcf2ca0504e635bc985d0d",
  "browser-pin.json":"d0b3ff9c28b738c43cf874cb62c442866e3047e20e7690272471d7137e0cb5b0",
  "laya-date-model.js":"c9f437c39c05813ecae08b23c5597da0913be82d94c4ab74d3f24d852fce6ea2",
  "run-browser.mjs":"14914865734a7161a5c2ea70f2ad8bce74ee53346a56009fcb87faba06a3195f",
  "browser-air.json":"9fad39b8f1662e71c6d881d001ade0fff0405a3cd67b83a2e162079b5498288f",
 };
 for(const [name,expected] of Object.entries(evidence)){
  const object=cp.execFileSync("git",["show",`${LAYA_REVISION}:tests/nativeFlashOracle/date-ap-surface/${name}`],{cwd:laya});assert.equal(sha(object),expected,`Git object ${name}`);assert.equal(sha(fs.readFileSync(path.join(fixture,name))),expected,name);
 }
 for(const [revision,file,expected] of [
  ["da111701143e44ac03a060cad5c269c301f32fa9","date-calendar-construction/native-air.json","60c05a273193620d08577b1b49b141e4352b91a4bb474784ed993132875ce3b3"],
  ["676d8c2a9a80b171709e13c9fcad18230624fdb8","date-construction/native-air.json","5229dec95ee4b59602b67b9c3c121322aa6d84df39ac3b4a415adafa0eda19fd"],
 ]){assert.equal(cp.spawnSync("git",["merge-base","--is-ancestor",revision,"HEAD"],{cwd:laya}).status,0);assert.equal(sha(cp.execFileSync("git",["show",`${revision}:tests/nativeFlashOracle/${file}`],{cwd:laya})),expected);}
 const retained=JSON.parse(fs.readFileSync(path.join(fixture,"native-air.json"))),relation=JSON.parse(fs.readFileSync(path.join(fixture,"browser-air.json")));assert.equal(retained.runtime.version,"MAC 51,3,3,2");assert.equal(retained.state.observations.length,23);assert.equal(relation.status,"match");assert.equal(relation.exactMatches,23);assert.equal(relation.exactMismatches,0);assert.deepEqual(relation.differences,[]);

 const temporary=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"date-ap-surface-cli-")));t.after(()=>fs.rmSync(temporary,{recursive:true,force:true}));const source=path.join(temporary,"source"),profile=path.join(temporary,"profile");fs.mkdirSync(source);
 const sources={
  DateApCompiled:["package {public class DateApCompiled {private var events:Array=[];",
   "private function marked(label:String,value:String):String {events.push(label);return value;}",
   "public function order():Array {events=[];var d:Date=new Date(marked(\"year\",\"2026\").slice(0),marked(\"month\",\"7\").slice(0),marked(\"date\",\"7\").slice(0),marked(\"hours\",\"10\").slice(0),marked(\"minutes\",\"20\").slice(0),marked(\"seconds\",\"30\").slice(0));return [events.join(\"|\"),d.time];}",
   "public function mixed(month:Number,date:int,hours:uint):Number {return new Date(\"2026\",month,\"7\",hours,date,30).time;}",
   "public function mutate(epoch:Number):Array {var d:Date=new Date();var a:Number=d.setTime(epoch);var b:Number=d.setHours(4,5,6);var bMatches:Boolean=b===d.time;var direct:Number=(d.minutes=61.9);var compound:Number=(d.minutes-=61.9);var zone:Number=d.timezoneOffset;var assigned:Number=(d.time=0.75);return [a,bMatches,direct,compound,zone,assigned,d.time,d.getTime()];}",
   "public function nullableReceiver(d:Date):Number {return d.getTime();}",
   "}}"].join(""),
  ModelUtilitiesDateChain:["package {public class ModelUtilitiesDateChain {public static function hoursMinSecTimeStringToNumber(param1:String,param2:Number):Number {",
   "var h:Number=Number(param1.substring(0,2));var m:Number=Number(param1.substring(2,4));var s:Number=Number(param1.substring(4,6));var d:Date=new Date();d.setTime(param2);d.setHours(h,m,s);return d.time;}}}"].join(""),
  TimeManagerDateChain:["package {public class TimeManagerDateChain {private static var _offset:int=-480;public static function get offset():int {return _offset;}",
   "public static function getNormalDate(param1:String):Number {var d:Date=new Date(param1.slice(0,4),int(param1.slice(4,6))-1,param1.slice(6,8),param1.slice(8,10),param1.slice(10,12),param1.slice(12,14));setDateTimezoneOffset(d);return d.getTime();}",
   "public static function setDateTimezoneOffset(param1:Date):void {param1.minutes-=offset-param1.timezoneOffset;}}}"].join(""),
 };
	 const hostile={
	  NullableString:"var d:Date=new Date(value,0,1,0,0,0);",DynamicComponent:"var d:Date=new Date(value,0,1,0,0,0);",ObjectComponent:"var d:Date=new Date(value,0,1,0,0,0);",BooleanComponent:"var d:Date=new Date(true,0,1,0,0,0);",NullComponent:"var d:Date=new Date(null,0,1,0,0,0);",UndefinedComponent:"var d:Date=new Date(undefined,0,1,0,0,0);",SevenArguments:"var d:Date=new Date(2026,0,1,0,0,0,0);",
	  SetTimeString:"var d:Date=new Date();d.setTime(\"0\");",SetTimeDynamic:"var d:Date=new Date();d.setTime(value);",SetTimeInt:"var d:Date=new Date();d.setTime(value);",SetTimeNoArgs:"var d:Date=new Date();d.setTime();",SetTimeTwo:"var d:Date=new Date();d.setTime(0,1);",SetHoursString:"var d:Date=new Date();d.setHours(1,\"2\",3);",SetHoursUint:"var d:Date=new Date();d.setHours(1,value,3);",SetHoursTwo:"var d:Date=new Date();d.setHours(1,2);",SetHoursFour:"var d:Date=new Date();d.setHours(1,2,3,4);",WriteTimezone:"var d:Date=new Date();d.timezoneOffset=0;",WriteMinutesBoolean:"var d:Date=new Date();d.minutes=true;",OtherMember:"var d:Date=new Date();d.getFullYear();",MethodClosure:"var d:Date=new Date();var f:Function=d.setTime;",
	 };
	 const hostileParameters={NullableString:"value:String",DynamicComponent:"value:*",ObjectComponent:"value:Object",SetTimeDynamic:"value:*",SetTimeInt:"value:int",SetHoursUint:"value:uint"};
	for(const [name,text] of Object.entries(sources))fs.writeFileSync(path.join(source,name+".as"),text);
	const run=(command,args)=>{const result=cp.spawnSync(command,args,{cwd:ROOT,encoding:"utf8",timeout:180000});assert.equal(result.status,0,result.stdout+result.stderr);return result;};
	const makeProfile=()=>run("python3",["-B","tools/create-fixture-profile.py","--source",source,"--entry","DateApCompiled","--air-sdk",AIR,"--laya",laya,"--ffdec-jar",FFDEC,"--native-date","--output",profile]);makeProfile();
 const compile=(operation,name)=>run(process.execPath,["bin/as3-frontend",operation,source,path.join(temporary,name),"--source-census",path.join(profile,"census.json"),"--target-capabilities",path.join(laya,"docTool/architecture/authored-content-capabilities.json"),"--profile-lock",path.join(profile,"profile-lock.json")]);
 compile("transpile","output");const output=path.join(temporary,"output"),manifest=JSON.parse(fs.readFileSync(path.join(output,"manifest.json")));
 for(const name of Object.keys(sources)){const row=manifest.files.find(item=>item.sourcePath===name+".as");assert.ok(row&&row.typescriptPath,JSON.stringify(row));assert.equal(row.sourceSha256,sha(sources[name]));}
 const code=Object.fromEntries(Object.keys(sources).map(name=>[name,fs.readFileSync(path.join(output,manifest.files.find(item=>item.sourcePath===name+".as").typescriptPath),"utf8")]));
 assert.match(code.DateApCompiled,/new AS3Date\(/);assert.match(code.DateApCompiled,/__as3DateReceiver\(/);assert.match(code.DateApCompiled,/\.setTime\(/);assert.match(code.DateApCompiled,/\.setHours\(/);assert.match(code.DateApCompiled,/\.minutes/);assert.match(code.DateApCompiled,/\.timezoneOffset/);assert.match(code.TimeManagerDateChain,/new AS3Date\(__as3StringSlice/);assert.match(code.ModelUtilitiesDateChain,/\.setTime\(param2\)/);
 const packageRoot=path.join(output,"__as3_runtime"),packageInfo=JSON.parse(fs.readFileSync(path.join(packageRoot,"package.json"))),files=Object.keys(sources).map(name=>path.join(output,manifest.files.find(item=>item.sourcePath===name+".as").typescriptPath));
 const tsconfig=path.join(output,"strict-tsconfig.json");fs.writeFileSync(tsconfig,JSON.stringify({compilerOptions:{target:"ES2020",module:"CommonJS",moduleResolution:"node",strict:true,skipLibCheck:true,noEmit:true,types:[],lib:["ES2020","DOM"],baseUrl:ROOT,paths:{[packageInfo.name+"/*"]:["src/hardened-runtime/*"],"@laya/as3-runtime/*":["src/hardened-runtime/*"]}},files}));run(process.execPath,[path.join(ROOT,"node_modules/typescript-4-9/bin/tsc"),"-p",tsconfig,"--pretty","false"]);
 const ts=require("typescript-4-9"),entryPath=path.join(output,manifest.applicationEntryPath);for(const name of Object.keys(sources)){const typePath=files[Object.keys(sources).indexOf(name)];fs.writeFileSync(typePath.replace(/\.ts$/,".js"),ts.transpileModule(code[name],{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText);}fs.writeFileSync(entryPath.replace(/\.ts$/,".js"),ts.transpileModule(fs.readFileSync(entryPath,"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText);
 const application=Module.createRequire(entryPath.replace(/\.ts$/,".js"))(entryPath.replace(/\.ts$/,".js")),moduleFor=name=>application.AS3_APPLICATION_MODULES.find(module=>module[name])[name];
 const Probe=moduleFor("DateApCompiled"),probe=new Probe(),ordered=probe.order(),expectedOrder=new Date(2026,7,7,10,20,30).getTime();assert.deepEqual(ordered,["year|month|date|hours|minutes|seconds",expectedOrder]);assert.equal(probe.mixed(7,20,10),new Date(2026,7,7,10,20,30).getTime());assert.throws(()=>probe.nullableReceiver(null),error=>error.name==="TypeError"&&error.errorID===1009);
 const baseline=new Date(2026,6,15,10,20,30).getTime(),mutation=probe.mutate(baseline),native=new Date();const nativeA=native.setTime(baseline),nativeB=native.setHours(4,5,6),nativeBMatches=nativeB===native.getTime(),nativeDirect=61.9;native.setMinutes(nativeDirect);const nativeCompound=native.getMinutes()-61.9;native.setMinutes(nativeCompound);const nativeZone=native.getTimezoneOffset(),nativeAssigned=.75;native.setTime(nativeAssigned);assert.deepEqual(mutation,[nativeA,nativeBMatches,nativeDirect,nativeCompound,nativeZone,nativeAssigned,native.getTime(),native.getTime()]);
 const Model=moduleFor("ModelUtilitiesDateChain"),modelEpoch=new Date(2026,6,15,4,5,6).getTime(),modelNative=new Date(modelEpoch);modelNative.setHours(10,20,30);assert.equal(Model.hoursMinSecTimeStringToNumber("102030",modelEpoch),modelNative.getTime());
	const Time=moduleFor("TimeManagerDateChain"),input="20260807102030",timeNative=new Date(2026,7,7,10,20,30);timeNative.setMinutes(timeNative.getMinutes()-(-480-timeNative.getTimezoneOffset()));assert.equal(Time.getNormalDate(input),timeNative.getTime());

	for(const [name,body] of Object.entries(hostile))fs.writeFileSync(path.join(source,name+".as"),`package {public class ${name} {public function run(${hostileParameters[name]||""}):void {${body}}}}`);
	fs.rmSync(profile,{recursive:true,force:true});makeProfile();compile("qualify","hostile");const hostileManifest=JSON.parse(fs.readFileSync(path.join(temporary,"hostile/manifest.json")));
	for(const [name] of Object.entries(hostile)){const row=hostileManifest.files.find(item=>item.sourcePath===name+".as");assert.equal(row?.status,"held",JSON.stringify(row));assert.ok(row.code?.startsWith("HARDENED_"),JSON.stringify(row));}
	for(const name of ["NullableString","DynamicComponent","ObjectComponent"])assert.equal(hostileManifest.files.find(row=>row.sourcePath===name+".as").code,"HARDENED_DATE_CONSTRUCTOR_TYPE");
	for(const name of ["BooleanComponent","NullComponent","UndefinedComponent"])assert.ok(["HARDENED_DATE_CONSTRUCTOR_TYPE","HARDENED_LITERAL"].includes(hostileManifest.files.find(row=>row.sourcePath===name+".as").code));
	assert.equal(hostileManifest.files.find(row=>row.sourcePath==="SevenArguments.as").code,"HARDENED_DATE_CONSTRUCTOR_ARITY");
	for(const name of ["SetTimeNoArgs","SetTimeTwo","SetHoursTwo","SetHoursFour"])assert.equal(hostileManifest.files.find(row=>row.sourcePath===name+".as").code,"HARDENED_DATE_CALL");
	for(const name of ["SetTimeString","SetTimeDynamic","SetTimeInt","SetHoursString","SetHoursUint"])assert.equal(hostileManifest.files.find(row=>row.sourcePath===name+".as").code,"HARDENED_DATE_CALL_TYPE");
	assert.equal(hostileManifest.files.find(row=>row.sourcePath==="WriteTimezone.as").code,"HARDENED_ASSIGNMENT_TARGET");assert.equal(hostileManifest.files.find(row=>row.sourcePath==="OtherMember.as").code,"HARDENED_DATE_MEMBER");assert.equal(hostileManifest.files.find(row=>row.sourcePath==="MethodClosure.as").code,"HARDENED_DATE_MEMBER");

 const authorityBundle=path.join(temporary,"date-authority.cjs");require("esbuild").buildSync({stdin:{contents:'export * from "./src/hardened/native-date-authority"; export {loadSourceMemberAuthority} from "./src/hardened/source-member-authority";',resolveDir:ROOT},outfile:authorityBundle,bundle:true,platform:"node",format:"cjs",logLevel:"silent"});const api=require(authorityBundle),lock=JSON.parse(fs.readFileSync(path.join(profile,"profile-lock.json"))),readProfile=name=>fs.readFileSync(path.join(profile,lock.files[name].path),"utf8"),sourceJson=readProfile("sourceMemberAuthority"),loaded=api.loadSourceMemberAuthority(sourceJson,sha(sourceJson),sha),proof=JSON.parse(readProfile("nativeDate")),sourceManifest=JSON.parse(readProfile("sourceManifest")),signaturesPath=path.join(profile,proof.signaturesPath),signatures=JSON.parse(fs.readFileSync(signaturesPath,"utf8"));signatures.classes.Date.members.find(member=>member.name==="minutes"&&member.access==="write").type="String";const forgedSignatures=canonical(signatures)+"\n";fs.writeFileSync(signaturesPath,forgedSignatures);proof.signaturesSha256=sha(forgedSignatures);sourceManifest.nativeSignaturesSha256=proof.signaturesSha256;assert.throws(()=>api.verifyNativeDateAuthority(loaded,profile,canonical(proof)+"\n",canonical(sourceManifest)+"\n"),error=>error.code==="HARDENED_DATE_AUTHORITY");
});
