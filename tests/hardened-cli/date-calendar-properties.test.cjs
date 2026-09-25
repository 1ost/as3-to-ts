const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),laya=process.env.HARDENED_FIXTURE_LAYA;
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
test('Date calendar properties use the shared provider with native rollover and DST semantics',async()=>{
 assert.ok(laya&&process.env.HARDENED_FIXTURE_AIR_SDK&&process.env.HARDENED_FIXTURE_FFDEC,'AIR, Laya and FFDec required');
 const evidence=path.join(laya,'tests/nativeFlashOracle/date-calendar-properties'),read=name=>fs.readFileSync(path.join(evidence,name));
 for(const [file,expected] of Object.entries(JSON.parse(read('evidence-pin.json'))))assert.equal(hash(read(file)),expected);
 const receipt=JSON.parse(read('native-receipt.json')),captured=JSON.parse(read('native-capture.json'));
 assert.equal(receipt.status,'passed');assert.equal(receipt.capture.runs,2);assert.equal(receipt.capture.identical,true);
 assert.equal(receipt.capture.observationCount,12);assert.equal(captured.runtime.version,'MAC 51,3,3,2');
 assert.equal(hash(read('source/DateCalendarProbe.as')),receipt.artifacts['source/DateCalendarProbe.as']);
 assert.equal(hash(read('scenario.json')),receipt.scenario.sha256);
 for(const run of [1,2])assert.equal(hash(read('native-capture.json')),receipt.artifacts[`run-${run}/capture.json`]);
 const base=path.join(root,'.cache/date-calendar-properties');fs.mkdirSync(base,{recursive:true});
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(base,'run-'))),profile=path.join(dir,'profile');
 const run=(cmd,args)=>{const r=cp.spawnSync(cmd,args,{cwd:root,encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stdout+r.stderr);return r;};
 const source=path.join(dir,'source');fs.mkdirSync(source);fs.writeFileSync(path.join(source,'DateCalendarProbe.as'),read('source/DateCalendarProbe.as'));
 const make=()=>run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','DateCalendarProbe',
  '--air-sdk',process.env.HARDENED_FIXTURE_AIR_SDK,'--laya',laya,'--ffdec-jar',process.env.HARDENED_FIXTURE_FFDEC,'--native-date','--shared-date','--output',profile]);
 const args=out=>[source,path.join(dir,out),'--source-census',path.join(profile,'census.json'),
  '--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(profile,'profile-lock.json')];
 make();run(process.execPath,['bin/as3-frontend','transpile',...args('emitted')]);
 const output=path.join(dir,'emitted/__as3_runtime'),steps=JSON.parse(read('scenario.json')).steps,wanted=captured.state.observations;
 const esbuild=require('esbuild'),entry=`import {startAS3Application} from ${JSON.stringify(path.join(output,'ApplicationEntry.generated.js'))};
const probe=startAS3Application(new AbortController().signal);
globalThis.dateCalendar=${JSON.stringify(steps)}.map(step=>{for(const call of step.calls)probe[call.method](...call.args);return {id:step.id,result:probe.result};});`;
 const manifest=JSON.parse(fs.readFileSync(path.join(dir,'emitted/manifest.json')));
 const applicationSource=fs.readFileSync(path.join(dir,'emitted',manifest.files.find(row=>row.sourcePath==='DateCalendarProbe.as').typescriptPath),'utf8');
 assert.match(applicationSource,/laya\/flash\/utils\/AS3Date/);assert.doesNotMatch(applicationSource,/@bleach\/as3-runtime\/AS3Date/);
 const typeConfig=path.join(dir,'generated-tsconfig.json');
 fs.writeFileSync(typeConfig,JSON.stringify({compilerOptions:{target:'ES2020',module:'CommonJS',moduleResolution:'node',strict:true,skipLibCheck:true,noEmit:true,types:[],lib:['ES2020','DOM'],baseUrl:root,paths:{'@laya/as3-runtime/*':['src/hardened-runtime/*'],'laya/*':[path.join(laya,'src/layaAir/*')]}},files:[path.join(dir,'emitted',manifest.files.find(row=>row.sourcePath==='DateCalendarProbe.as').typescriptPath)]}));
 run(process.execPath,[path.join(root,'node_modules/typescript-4-9/bin/tsc'),'-p',typeConfig,'--pretty','false']);
 const built=await esbuild.build({plugins:[{name:'shared-laya',setup(build){build.onResolve({filter:/^laya\//},args=>({path:path.join(laya,'src/layaAir',args.path.slice(5)+'.ts')}));}}],stdin:{contents:entry,resolveDir:root,loader:'js'},bundle:true,write:false,format:'iife',platform:'browser',target:'es2020'});
 const bundle=built.outputFiles[0].text;fs.writeFileSync(path.join(dir,'bundle.js'),bundle);
 const node=JSON.parse(JSON.stringify(new Function(bundle+';return globalThis.dateCalendar;')()));assert.deepEqual(node,wanted);
 const {chromium}=require(process.env.LAYA_PLAYWRIGHT_MODULE||'playwright'),browser=await chromium.launch({headless:true});
 let web;try{const page=await browser.newPage({timezoneId:'Europe/Rome'});await page.addScriptTag({content:bundle});web=await page.evaluate(()=>JSON.parse(JSON.stringify(globalThis.dateCalendar)));assert.deepEqual(web,wanted);}finally{await browser.close();}
 // Removing the verified provider must hold the newly requested shared Date surface.
 const canonical=value=>value===null||typeof value!=='object'?JSON.stringify(value):Array.isArray(value)?'['+value.map(canonical).join(',')+']':'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
 const lockPath=path.join(profile,'profile-lock.json'),lock=JSON.parse(fs.readFileSync(lockPath));
 const originalLock=fs.readFileSync(lockPath);delete lock.files.dateProvider;
 fs.writeFileSync(lockPath,canonical(lock)+"\n");run(process.execPath,['bin/as3-frontend','qualify',...args('legacy')]);
 const legacy=JSON.parse(fs.readFileSync(path.join(dir,'legacy/manifest.json'))).files.find(row=>row.sourcePath==='DateCalendarProbe.as');
 assert.equal(legacy.status,'held');assert.equal(legacy.code,'HARDENED_DATE_MEMBER');fs.writeFileSync(lockPath,originalLock);
 // A changed provider source closure is rejected even when an attacker rehashes the profile file.
 const providerFile=path.join(profile,JSON.parse(originalLock).files.dateProvider.path),proof=JSON.parse(fs.readFileSync(providerFile));
 const savedProof=fs.readFileSync(providerFile);
 try {
 proof.targetSources['src/layaAir/flash/utils/AS3Date.ts']='0'.repeat(64);
 fs.writeFileSync(providerFile,canonical(proof)+'\n');const forged=JSON.parse(originalLock);forged.files.dateProvider.sha256=hash(fs.readFileSync(providerFile));fs.writeFileSync(lockPath,canonical(forged)+'\n');
 const rejected=cp.spawnSync(process.execPath,['bin/as3-frontend','qualify',...args('forged')],{cwd:root,encoding:'utf8',timeout:120000});
 assert.notEqual(rejected.status,0);assert.match(rejected.stdout+rejected.stderr,/Date provider|DATE_PROVIDER/);
 } finally { fs.writeFileSync(providerFile,savedProof);fs.writeFileSync(lockPath,originalLock); }
 assert.equal(hash(fs.readFileSync(path.join(source,'DateCalendarProbe.as'))),hash(read('source/DateCalendarProbe.as')));
 fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify({rows:12,node,web,sourceUnchanged:true,applicationStart:true,negativeControls:2},null,2)+'\n');
 console.log(JSON.stringify({dir,rows:12,realms:['Node','Chromium'],status:'passed'}));
});
