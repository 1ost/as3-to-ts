const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),laya=process.env.HARDENED_FIXTURE_LAYA;
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
test('String indices use shared Laya operations and preserve dynamic numeric conversion order',async()=>{
 assert.ok(laya&&process.env.HARDENED_FIXTURE_AIR_SDK&&process.env.HARDENED_FIXTURE_FFDEC,'AIR, Laya and FFDec required');
 const evidence=path.join(laya,'tests/nativeFlashOracle/string-range-shared-profile'),read=name=>fs.readFileSync(path.join(evidence,name));
 for(const [file,expected] of Object.entries(JSON.parse(read('evidence-pin.json'))))assert.equal(hash(read(file)),expected);
 const receipt=JSON.parse(read('native-receipt.json')),captured=JSON.parse(read('native-capture.json'));
 assert.equal(receipt.status,'passed');assert.equal(receipt.capture.runs,2);assert.equal(receipt.capture.identical,true);
 assert.equal(receipt.capture.observationCount,18);assert.equal(captured.runtime.version,'MAC 51,3,3,2');
 assert.equal(hash(read('source/StringRangeSharedProbe.as')),receipt.artifacts['source/StringRangeSharedProbe.as']);
 assert.equal(hash(read('scenario.json')),receipt.scenario.sha256);
 for(const run of [1,2])assert.equal(hash(read('native-capture.json')),receipt.artifacts[`run-${run}/capture.json`]);
 const base=path.join(root,'.cache/string-range-shared-profile');fs.mkdirSync(base,{recursive:true});
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(base,'run-'))),profile=path.join(dir,'profile');
 const run=(cmd,args)=>{const r=cp.spawnSync(cmd,args,{cwd:root,encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stdout+r.stderr);return r;};
 const source=path.join(dir,'source');fs.mkdirSync(source);fs.writeFileSync(path.join(source,'StringRangeSharedProbe.as'),read('source/StringRangeSharedProbe.as'));
 const make=()=>run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','StringRangeSharedProbe',
  '--air-sdk',process.env.HARDENED_FIXTURE_AIR_SDK,'--laya',laya,'--ffdec-jar',process.env.HARDENED_FIXTURE_FFDEC,'--shared-string-ranges','--output',profile]);
 const args=out=>[source,path.join(dir,out),'--source-census',path.join(profile,'census.json'),
  '--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(profile,'profile-lock.json')];
 make();run(process.execPath,['bin/as3-frontend','transpile',...args('emitted')]);
 const output=path.join(dir,'emitted/__as3_runtime'),steps=JSON.parse(read('scenario.json')).steps,wanted=captured.state.observations;
 const esbuild=require('esbuild'),entry=`import {startAS3Application} from ${JSON.stringify(path.join(output,'ApplicationEntry.generated.js'))};
const probe=startAS3Application(new AbortController().signal);
globalThis.stringRangeShared=${JSON.stringify(steps)}.map(step=>{for(const call of step.calls)probe[call.method](...call.args);return {id:step.id,result:probe.result};});`;
 const manifest=JSON.parse(fs.readFileSync(path.join(dir,'emitted/manifest.json')));
 const applicationSource=fs.readFileSync(path.join(dir,'emitted',manifest.files.find(row=>row.sourcePath==='StringRangeSharedProbe.as').typescriptPath),'utf8');
 assert.match(applicationSource,/sourceStringCharAt as __sharedStringCharAt/);assert.match(applicationSource,/__sharedStringSlice\(/);assert.match(applicationSource,/__sharedStringSubstring\(/);
 const typeConfig=path.join(dir,'generated-tsconfig.json');
 fs.writeFileSync(typeConfig,JSON.stringify({compilerOptions:{target:'ES2020',module:'CommonJS',moduleResolution:'node',strict:true,skipLibCheck:true,noEmit:true,types:[],lib:['ES2020','DOM'],baseUrl:root,paths:{'@laya/as3-runtime/*':['src/hardened-runtime/*'],'laya/*':[path.join(laya,'src/layaAir/*')]}},files:[path.join(dir,'emitted',manifest.files.find(row=>row.sourcePath==='StringRangeSharedProbe.as').typescriptPath)]}));
 run(process.execPath,[path.join(root,'node_modules/typescript-4-9/bin/tsc'),'-p',typeConfig,'--pretty','false']);
 const built=await esbuild.build({plugins:[{name:'shared-laya',setup(build){build.onResolve({filter:/^laya\//},args=>({path:path.join(laya,'src/layaAir',args.path.slice(5)+'.ts')}));}}],stdin:{contents:entry,resolveDir:root,loader:'js'},bundle:true,write:false,format:'iife',platform:'browser',target:'es2020'});
 const bundle=built.outputFiles[0].text;fs.writeFileSync(path.join(dir,'bundle.js'),bundle);
 const node=JSON.parse(JSON.stringify(new Function(bundle+';return globalThis.stringRangeShared;')()));assert.deepEqual(node,wanted);
 const {chromium}=require(process.env.LAYA_PLAYWRIGHT_MODULE||'playwright'),browser=await chromium.launch({headless:true});
 let web;try{const page=await browser.newPage({timezoneId:'Europe/Rome'});await page.addScriptTag({content:bundle});web=await page.evaluate(()=>JSON.parse(JSON.stringify(globalThis.stringRangeShared)));assert.deepEqual(web,wanted);}finally{await browser.close();}
 // Removing the verified provider must hold the newly requested shared String range surface.
 const canonical=value=>value===null||typeof value!=='object'?JSON.stringify(value):Array.isArray(value)?'['+value.map(canonical).join(',')+']':'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
 const lockPath=path.join(profile,'profile-lock.json'),lock=JSON.parse(fs.readFileSync(lockPath));
 const originalLock=fs.readFileSync(lockPath);delete lock.files.stringRangeProvider;
 fs.writeFileSync(lockPath,canonical(lock)+"\n");run(process.execPath,['bin/as3-frontend','qualify',...args('legacy')]);
 const legacy=JSON.parse(fs.readFileSync(path.join(dir,'legacy/manifest.json'))).files.find(row=>row.sourcePath==='StringRangeSharedProbe.as');
 assert.equal(legacy.status,'held');assert.equal(legacy.code,'HARDENED_STRING_ARGUMENT');fs.writeFileSync(lockPath,originalLock);
 // A changed provider source closure is rejected even when an attacker rehashes the profile file.
 const providerFile=path.join(profile,JSON.parse(originalLock).files.stringRangeProvider.path),proof=JSON.parse(fs.readFileSync(providerFile));
 proof.targetSources['src/layaAir/flash/utils/AS3StringIntrinsics.ts']='0'.repeat(64);
 fs.writeFileSync(providerFile,canonical(proof)+'\n');const forged=JSON.parse(originalLock);forged.files.stringRangeProvider.sha256=hash(fs.readFileSync(providerFile));fs.writeFileSync(lockPath,canonical(forged)+'\n');
 const rejected=cp.spawnSync(process.execPath,['bin/as3-frontend','qualify',...args('forged')],{cwd:root,encoding:'utf8',timeout:120000});
 assert.notEqual(rejected.status,0);assert.match(rejected.stdout+rejected.stderr,/String range provider|STRING_RANGE_PROVIDER/);
 assert.equal(hash(fs.readFileSync(path.join(source,'StringRangeSharedProbe.as'))),hash(read('source/StringRangeSharedProbe.as')));
 fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify({rows:18,node,web,sourceUnchanged:true,applicationStart:true,negativeControls:2},null,2)+'\n');
 console.log(JSON.stringify({dir,rows:18,realms:['Node','Chromium'],status:'passed'}));
});
