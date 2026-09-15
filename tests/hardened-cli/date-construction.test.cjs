'use strict';
const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const canonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
test('Date native proof gates original zeroarg and six-number calendar construction, methods, property and identity',t=>{
 const air=process.env.HARDENED_FIXTURE_AIR_SDK,laya=process.env.HARDENED_FIXTURE_LAYA,ffdec=process.env.HARDENED_FIXTURE_FFDEC;assert.ok(air&&laya&&ffdec);
 const calendarEvidenceRevision='da111701143e44ac03a060cad5c269c301f32fa9';
 const retainedRevision=cp.spawnSync('git',['merge-base','--is-ancestor',calendarEvidenceRevision,'HEAD'],{cwd:laya,encoding:'utf8'});
 assert.equal(retainedRevision.status,0,retainedRevision.stderr||'Date evidence revision is not retained by the selected Laya commit');
 const fixture=process.env.HARDENED_FIXTURE_SOURCE||path.join(laya,'tests/nativeFlashOracle/date-construction'),retained=JSON.parse(fs.readFileSync(path.join(fixture,'native-air.json')));
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'date-cli-')));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const source=path.join(dir,'source'),profile=path.join(dir,'profile');fs.mkdirSync(source);
 const name='DateConstructionProbe.as',bytes=fs.readFileSync(path.join(fixture,name));assert.equal(sha(bytes),retained.sourceFiles[name]);fs.writeFileSync(path.join(source,name),bytes);
	 const nullFixture=process.env.HARDENED_DATE_NULL_FIXTURE||path.join(laya,'tests/nativeFlashOracle/date-null-receiver');
	 const nullEvidence=JSON.parse(fs.readFileSync(path.join(nullFixture,'native-air.json'))),nullName='DateNullReceiverProbe.as',nullBytes=fs.readFileSync(path.join(nullFixture,nullName));
	 assert.equal(sha(nullBytes),nullEvidence.sourceFiles[nullName]);assert.equal(sha(fs.readFileSync(path.join(nullFixture,'scenario.json'))),nullEvidence.scenarioSha256);fs.writeFileSync(path.join(source,nullName),nullBytes);
	 const calendarFixture=process.env.HARDENED_DATE_CALENDAR_FIXTURE||path.join(laya,'tests/nativeFlashOracle/date-calendar-construction');
	 const calendarEvidencePath=path.join(calendarFixture,'native-air.json');assert.equal(sha(fs.readFileSync(calendarEvidencePath)),'60c05a273193620d08577b1b49b141e4352b91a4bb474784ed993132875ce3b3');
	 const calendarEvidence=JSON.parse(fs.readFileSync(calendarEvidencePath)),calendarEvidenceName='DateCalendarConstructionProbe.as',calendarEvidenceBytes=fs.readFileSync(path.join(calendarFixture,calendarEvidenceName));
	 assert.equal(calendarEvidence.receipt.status,'passed');assert.equal(calendarEvidence.receipt.capture.identical,true);assert.equal(calendarEvidence.receipt.capture.observationCount,9);
	 assert.equal(calendarEvidence.nativeReceiptSha256,'b1396b071bff429530c7a50f8236fa91485184cd3867d1a03aa9d436c698e7ba');assert.equal(calendarEvidence.captureSha256,'64939fda62a69bd0ad3632e416ba8102891a7f98153e82d08cbeb5b5594856de');
	 assert.equal(sha(calendarEvidenceBytes),'679e829bfdc783b994c612a396c418e7512a52a8b32d72c680ccaf5de4effa41');assert.equal(sha(calendarEvidenceBytes),calendarEvidence.sourceFiles[calendarEvidenceName]);assert.equal(sha(fs.readFileSync(path.join(calendarFixture,'scenario.json'))),'0ac08177cdfa0add3fb14cc7689aa73ff860464212da338085422f7632db4cb1');assert.equal(sha(fs.readFileSync(path.join(calendarFixture,'scenario.json'))),calendarEvidence.scenarioSha256);assert.equal(sha(fs.readFileSync(path.join(calendarFixture,'sdk-authority.json'))),'0d0228cec7c0a8e4b8543397a79dff02bc3b09f2e0666a4736ce6e0e73186252');
	 fs.writeFileSync(path.join(source,calendarEvidenceName),calendarEvidenceBytes);
	 const calendarName='CalendarConstruction.as',calendarText='package { public class CalendarConstruction { public function make(year:Number,month:Number,date:Number,hours:Number,minutes:Number,seconds:Number):Date { return new Date(year,month,date,hours,minutes,seconds); } public function makeMain(parts:Array):Date { return new Date(Number(parts[0]),Number(parts[1])-1,Number(parts[2]),Number(parts[3]),Number(parts[4]),Number(parts[5])); } public function isDate(value:*):Boolean { return value is Date; } } }',calendarBytes=Buffer.from(calendarText);fs.writeFileSync(path.join(source,calendarName),calendarBytes);
	 const updateName='ArrayUpdateBoundary.as',updateText='package { public class ArrayUpdateBoundary { public function before(values:Array,key:Number):Number {return --values[key];} public function after(values:Array,key:Number):Number {return values[key]++;} public function dynamic(value:*,key:Number):Number {return ++value[key];} } }',updateBytes=Buffer.from(updateText);fs.writeFileSync(path.join(source,updateName),updateBytes);
 const run=(cmd,args)=>{const r=cp.spawnSync(cmd,args,{cwd:root,encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stdout+r.stderr);};
 const make=()=>run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','DateConstructionProbe','--air-sdk',air,'--laya',laya,'--ffdec-jar',ffdec,'--native-date','--output',profile]);
 const args=(op,out)=>['bin/as3-frontend',op,source,path.join(dir,out),'--source-census',path.join(profile,'census.json'),'--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(profile,'profile-lock.json')];
 const compile=(op,out)=>run(process.execPath,args(op,out));make();const snapshots=[];
 const authorityBundle=path.join(dir,'date-authority.cjs');require('esbuild').buildSync({stdin:{contents:'export * from "./src/hardened/native-date-authority"; export {loadSourceMemberAuthority} from "./src/hardened/source-member-authority";',resolveDir:root},outfile:authorityBundle,bundle:true,platform:'node',format:'cjs',logLevel:'silent'});
 const api=require(authorityBundle),profileLock=JSON.parse(fs.readFileSync(path.join(profile,'profile-lock.json')));
 const readProfile=name=>fs.readFileSync(path.join(profile,profileLock.files[name].path),'utf8');
 const sourceJson=readProfile('sourceMemberAuthority'),loaded=api.loadSourceMemberAuthority(sourceJson,sha(sourceJson),sha);
 assert.equal(api.hasNativeDateAuthority(loaded),false);assert.equal(api.hasNativeDateAuthority({...loaded}),false);
 assert.throws(()=>api.verifyNativeDateAuthority({...loaded},profile,readProfile('nativeDate'),readProfile('sourceManifest')));
 api.verifyNativeDateAuthority(loaded,profile,readProfile('nativeDate'),readProfile('sourceManifest'));assert.equal(api.hasNativeDateAuthority(loaded),true);assert.equal(api.hasNativeDateAuthority({...loaded}),false);

 for(const out of ['first','second']){
	  compile('transpile',out);const rows=JSON.parse(fs.readFileSync(path.join(dir,out,'manifest.json'))).files;assert.equal(rows.find(row=>row.sourcePath===name).sourceSha256,sha(bytes));assert.equal(rows.find(row=>row.sourcePath===nullName).sourceSha256,sha(nullBytes));assert.equal(rows.find(row=>row.sourcePath===calendarEvidenceName).sourceSha256,sha(calendarEvidenceBytes));assert.equal(rows.find(row=>row.sourcePath===calendarName).sourceSha256,sha(calendarBytes));assert.equal(rows.find(row=>row.sourcePath===updateName).sourceSha256,sha(updateBytes));
	  const code=fs.readFileSync(path.join(dir,out,'__as3_runtime/application/DateConstructionProbe.ts'),'utf8');assert.match(code,/new AS3Date\(\)/);const nullCode=fs.readFileSync(path.join(dir,out,'__as3_runtime/application/DateNullReceiverProbe.ts'),'utf8');assert.match(nullCode,/__as3DateReceiver\(/);const evidenceCode=fs.readFileSync(path.join(dir,out,'__as3_runtime/application/DateCalendarConstructionProbe.ts'),'utf8');assert.match(evidenceCode,/__as3ArrayUpdate\(parts, 1, 0, true\)/);const calendarCode=fs.readFileSync(path.join(dir,out,'__as3_runtime/application/CalendarConstruction.ts'),'utf8');assert.match(calendarCode,/new AS3Date\(year, month, date, hours, minutes, seconds\)/);const updateCode=fs.readFileSync(path.join(dir,out,'__as3_runtime/application/ArrayUpdateBoundary.ts'),'utf8');assert.match(updateCode,/__as3ArrayUpdate\(values, key, 0, true\)/);assert.match(updateCode,/__as3ArrayUpdate\(values, key, 1, false\)/);assert.match(updateCode,/__as3ObjectUpdate\(value, key, 1, true,/);snapshots.push([rows,code,nullCode,evidenceCode,calendarCode,updateCode]);
  const runtime=path.join(dir,out,'__as3_runtime');assert.ok(JSON.parse(fs.readFileSync(path.join(runtime,'package.json'))).exports['./AS3Date']);
  const ts=require('typescript-4-9'),Module=require('node:module');
  const emittedManifest=JSON.parse(fs.readFileSync(path.join(dir,out,'manifest.json')));
  const entryPath=path.join(dir,out,emittedManifest.applicationEntryPath);
  const entryCode=fs.readFileSync(entryPath,'utf8');assert.equal(sha(entryCode),emittedManifest.applicationEntrySha256);
  // Preserve generated module paths and load its authority-first entry. A copied
  // class at another path has a different identity and must not be constructible.
	  for(const [sourcePath,text] of [[path.join(runtime,'application/DateConstructionProbe.ts'),code],[path.join(runtime,'application/DateNullReceiverProbe.ts'),nullCode],[path.join(runtime,'application/DateCalendarConstructionProbe.ts'),evidenceCode],[path.join(runtime,'application/CalendarConstruction.ts'),calendarCode],[path.join(runtime,'application/ArrayUpdateBoundary.ts'),updateCode],[entryPath,entryCode]])
   fs.writeFileSync(sourcePath.replace(/\.ts$/,'.js'),ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText);
  const outputEntry=entryPath.replace(/\.ts$/,'.js'),requireGenerated=Module.createRequire(outputEntry),application=requireGenerated(outputEntry);
  assert.match(application.AS3_APPLICATION_TYPE_AUTHORITY_SHA256,/^[a-f0-9]{64}$/);
  const Probe=application.AS3_APPLICATION_MODULES.find(module=>module.DateConstructionProbe).DateConstructionProbe;
  assert.equal(Probe,requireGenerated('./application/DateConstructionProbe.js').DateConstructionProbe);
  const probe=new Probe();probe.exercise();
  assert.deepEqual(probe.result,retained.captures.construction.capture.state.observations[0].result);
	  const NullProbe=application.AS3_APPLICATION_MODULES.find(module=>module.DateNullReceiverProbe).DateNullReceiverProbe;
	  const nullProbe=new NullProbe();
	  for(const [mode,observation] of nullEvidence.capture.state.observations.entries()){nullProbe.exercise(mode);assert.deepEqual(nullProbe.result,observation.result,observation.id);}
	  const EvidenceProbe=application.AS3_APPLICATION_MODULES.find(module=>module.DateCalendarConstructionProbe).DateCalendarConstructionProbe;
	  const evidenceProbe=new EvidenceProbe();
	  for(const [mode,observation] of calendarEvidence.capture.state.observations.entries()){evidenceProbe.exercise(mode);assert.deepEqual(evidenceProbe.result,observation.result,observation.id);}
	  const CalendarProbe=application.AS3_APPLICATION_MODULES.find(module=>module.CalendarConstruction).CalendarConstruction;
	  const calendarProbe=new CalendarProbe();
	  const make=(...args)=>calendarProbe.make(...args),same=(left,right)=>left.getTime()===right.getTime(),observed=[];
	  const launch=calendarProbe.makeMain(['2026','08','07','10','00','00']),launchRepeat=make(2026,7,7,10,0,0);
	  observed.push([calendarProbe.isDate(launch),typeof launch,typeof launch.getTime(),launch.getTime()===launch.valueOf(),launch.time===launch.getTime(),same(launch,launchRepeat)]);
	  observed.push([same(make(2025,12,1,0,0,0),make(2026,0,1,0,0,0))]);
	  observed.push([same(make(2024,1,30,0,0,0),make(2024,2,1,0,0,0)),same(make(2023,1,29,0,0,0),make(2023,2,1,0,0,0))]);
	  const delta=make(2026,0,15,10,20,30);observed.push([make(2026,0,15,10,20,31).getTime()-delta.getTime(),make(2026,0,15,10,21,30).getTime()-delta.getTime()]);
	  observed.push([same(make(0,0,1,0,0,0),make(1900,0,1,0,0,0)),same(make(99,0,1,0,0,0),make(1999,0,1,0,0,0))]);
	  const fractional=make(2026.9,2.9,3.9,4.9,5.9,6.9);observed.push([same(fractional,make(2026,2,3,4,5,6)),fractional.getTime()===fractional.time]);
	  observed.push([[NaN,0,1,0,0,0],[2026,NaN,1,0,0,0],[2026,0,NaN,0,0,0],[2026,0,1,NaN,0,0],[2026,0,1,0,NaN,0],[2026,0,1,0,0,NaN]].map(args=>Number.isNaN(make(...args).getTime())));
	  observed.push([[Infinity,0,1,0,0,0],[-Infinity,0,1,0,0,0],[2026,Infinity,1,0,0,0],[2026,0,1,0,0,-Infinity]].map(args=>Number.isNaN(make(...args).getTime())));
	  observed.push([same(make(2026,-1,1,0,0,0),make(2025,11,1,0,0,0)),same(make(2026,0,0,0,0,0),make(2025,11,31,0,0,0)),same(make(2026,0,1,-1,0,0),make(2025,11,31,23,0,0))]);
	  assert.deepEqual(observed,calendarEvidence.capture.state.observations.map(row=>row.result));
 }
 assert.deepEqual(snapshots[0],snapshots[1]);
 const lockFile=path.join(profile,'profile-lock.json'),original=fs.readFileSync(lockFile),lock=JSON.parse(original);
 delete lock.files.nativeDate;fs.writeFileSync(lockFile,canonical(lock)+'\n');compile('qualify','absent');const absent=JSON.parse(fs.readFileSync(path.join(dir,'absent/manifest.json'))).files.find(row=>row.sourcePath===name);assert.equal(absent.status,'held');fs.writeFileSync(lockFile,original);
 const proofPath=path.join(profile,JSON.parse(original).files.nativeDate.path),saved=fs.readFileSync(proofPath),proof=JSON.parse(saved);proof.declarationSha256='0'.repeat(64);fs.writeFileSync(proofPath,canonical(proof)+'\n');const forged=JSON.parse(original);forged.files.nativeDate.sha256=sha(fs.readFileSync(proofPath));fs.writeFileSync(lockFile,canonical(forged)+'\n');const rejected=cp.spawnSync(process.execPath,args('qualify','forged'),{cwd:root,encoding:'utf8'});assert.notEqual(rejected.status,0);assert.match(rejected.stdout+rejected.stderr,/Date|SDK/);fs.writeFileSync(proofPath,saved);fs.writeFileSync(lockFile,original);
	 const holds={StringCoercion:'var d:Date=new Date();var s:String=String(d);',Addition:'var d:Date=new Date();var n:Number=d+1;',OneArgument:'var d:Date=new Date(0);',TwoArguments:'var d:Date=new Date(2026,0);',ThreeArguments:'var d:Date=new Date(2026,0,1);',FourArguments:'var d:Date=new Date(2026,0,1,0);',FiveArguments:'var d:Date=new Date(2026,0,1,0,0);',SevenArguments:'var d:Date=new Date(2026,0,1,0,0,0,0);',SixStringArgument:'var d:Date=new Date(2026,0,1,0,0,"0");',Mutation:'var d:Date=new Date();d.time=0;',OtherMember:'var d:Date=new Date();d.getFullYear();',Closure:'var d:Date=new Date();var f:Function=d.getTime;',Shadow:'var Date:Function=null;new Date();',ArrayStringIndex:'var values:Array=[1];var key:*=\"name\";--values[key];'};
 for(const [cls,body] of Object.entries(holds))fs.writeFileSync(path.join(source,cls+'.as'),`package {public class ${cls} {public function run():void {${body}}}}`);
 fs.rmSync(profile,{recursive:true,force:true});make();compile('qualify','holds');const rows=JSON.parse(fs.readFileSync(path.join(dir,'holds/manifest.json'))).files;
	 for(const cls of Object.keys(holds).filter(cls=>!['SixStringArgument','Mutation'].includes(cls))){const row=rows.find(r=>r.sourcePath===cls+'.as');assert.equal(row?.status,'held',JSON.stringify(row));}
	 for(const cls of ['OneArgument','TwoArguments','ThreeArguments','FourArguments','FiveArguments','SevenArguments'])assert.equal(rows.find(r=>r.sourcePath===cls+'.as').code,'HARDENED_DATE_CONSTRUCTOR_ARITY');
	 for(const cls of ['SixStringArgument','Mutation'])assert.equal(rows.find(r=>r.sourcePath===cls+'.as').status,'admitted');
	 assert.equal(rows.find(r=>r.sourcePath==='ArrayStringIndex.as').code,'HARDENED_ARRAY_INDEX_TYPE');
 assert.equal(sha(fs.readFileSync(path.join(source,name))),sha(bytes));
});
