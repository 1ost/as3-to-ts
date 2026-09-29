const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),laya=process.env.HARDENED_FIXTURE_LAYA;
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
test('Original ConfigLoadRegistry sorts tasks unchanged through the shared Array provider',async()=>{
 assert.ok(laya&&process.env.HARDENED_FIXTURE_AIR_SDK&&process.env.HARDENED_FIXTURE_FFDEC,'AIR, Laya and FFDec required');
 const evidence=path.join(laya,'tests/nativeFlashOracle/original-config-load-registry'),read=name=>fs.readFileSync(path.join(evidence,name));
 for(const [file,expected] of Object.entries(JSON.parse(read('evidence-pin.json'))))assert.equal(hash(read(file)),expected);
 const receipt=JSON.parse(read('native-receipt.json')),captured=JSON.parse(read('native-capture.json'));
 assert.equal(receipt.status,'passed');assert.equal(receipt.capture.runs,2);assert.equal(receipt.capture.identical,true);
 assert.equal(receipt.capture.observationCount,10);assert.equal(captured.runtime.version,'MAC 51,3,3,2');
 assert.equal(hash(read('OriginalConfigLoadRegistryProbe.as')),receipt.artifacts['source/OriginalConfigLoadRegistryProbe.as']);
 assert.equal(hash(read('scenario.json')),receipt.scenario.sha256);
 for(const run of [1,2])assert.equal(hash(read('native-capture.json')),receipt.artifacts[`run-${run}/capture.json`]);
 const base=path.join(root,'.cache/original-config-load-registry');fs.mkdirSync(base,{recursive:true});
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(base,'run-'))),profile=path.join(dir,'profile');
 const run=(cmd,args)=>{const r=cp.spawnSync(cmd,args,{cwd:root,encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stdout+r.stderr);return r;};
 const source=path.join(dir,'source');fs.mkdirSync(source);for(const file of ['OriginalConfigLoadRegistryProbe.as','game/manager/configLoader/ConfigLoadRegistry.as','game/manager/configLoader/ConfigLoadTask.as','game/manager/configLoader/ConfigLoadStatus.as','game/manager/configLoader/ConfigLoadPriority.as']){fs.mkdirSync(path.dirname(path.join(source,file)),{recursive:true});fs.writeFileSync(path.join(source,file),read(file));assert.equal(hash(read(file)),receipt.artifacts['source/'+file]);}
 const make=()=>run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','OriginalConfigLoadRegistryProbe',
  '--air-sdk',process.env.HARDENED_FIXTURE_AIR_SDK,'--laya',laya,'--ffdec-jar',process.env.HARDENED_FIXTURE_FFDEC,'--shared-array-sort','--output',profile]);
 const args=out=>[source,path.join(dir,out),'--source-census',path.join(profile,'census.json'),
  '--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(profile,'profile-lock.json')];
 make();run(process.execPath,['bin/as3-frontend','transpile',...args('emitted')]);
 const output=path.join(dir,'emitted/__as3_runtime'),steps=JSON.parse(read('scenario.json')).steps,wanted=captured.state.observations;
 const esbuild=require('esbuild'),entry=`import {startAS3Application} from ${JSON.stringify(path.join(output,'ApplicationEntry.generated.js'))};
const probe=startAS3Application(new AbortController().signal);
globalThis.originalConfigLoadRegistry=${JSON.stringify(steps)}.map(step=>{for(const call of step.calls)probe[call.method](...call.args);return {id:step.id,result:probe.result};});`;
 const manifest=JSON.parse(fs.readFileSync(path.join(dir,'emitted/manifest.json')));
 assert.equal(manifest.files.length,5);for(const row of manifest.files)assert.ok(row.typescriptPath,JSON.stringify(row));
 const files=manifest.files.map(row=>path.join(dir,'emitted',row.typescriptPath));
 const engineOptions=require("typescript-4-9").readConfigFile(path.join(laya,"src/layaAir/tsconfig.json"),file=>fs.readFileSync(file,"utf8")).config.compilerOptions;
 assert.equal(engineOptions.strict,true);assert.equal(engineOptions.strictNullChecks,false);
 // Full Laya dependencies use the engine's declared TypeScript nullability/JSON contract.
 const typeConfig=path.join(dir,'generated-tsconfig.json');
 fs.writeFileSync(typeConfig,JSON.stringify({compilerOptions:{target:'ES2020',module:'CommonJS',moduleResolution:'node',strict:true,strictNullChecks:false,strictPropertyInitialization:false,experimentalDecorators:true,resolveJsonModule:true,allowSyntheticDefaultImports:true,skipLibCheck:true,noEmit:true,types:[],lib:['ES2020','DOM','DOM.Iterable'],baseUrl:root,paths:{'@laya/as3-runtime/*':['src/hardened-runtime/*'],'laya/*':[path.join(laya,'src/layaAir/*')]}},files:[...files,path.join(laya,'src/layaAir/tslibs/glsl.d.ts'),path.join(laya,'src/layaAir/tslibs/spine.d.ts')]}));
 run(process.execPath,[path.join(root,'node_modules/typescript-4-9/bin/tsc'),'-p',typeConfig,'--pretty','false']);
 const built=await esbuild.build({plugins:[{name:'shared-laya',setup(build){build.onResolve({filter:/^laya\//},args=>({path:path.join(laya,'src/layaAir',args.path.slice(5)+'.ts')}));}}],stdin:{contents:entry,resolveDir:root,loader:'js'},bundle:true,write:false,format:'iife',platform:'browser',target:'es2020',loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'}});
 const bundle=built.outputFiles[0].text;fs.writeFileSync(path.join(dir,'bundle.js'),bundle);
 const node=JSON.parse(JSON.stringify(new Function(bundle+';return globalThis.originalConfigLoadRegistry;')()));assert.deepEqual(node,wanted);
 const {chromium}=require(process.env.LAYA_PLAYWRIGHT_MODULE||'playwright'),browser=await chromium.launch({headless:true});
 let web;try{const page=await browser.newPage({timezoneId:'Europe/Rome'});await page.addScriptTag({content:bundle});web=await page.evaluate(()=>JSON.parse(JSON.stringify(globalThis.originalConfigLoadRegistry)));assert.deepEqual(web,wanted);}finally{await browser.close();}
 const canonical=value=>value===null||typeof value!=='object'?JSON.stringify(value):Array.isArray(value)?'['+value.map(canonical).join(',')+']':'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
 const lockPath=path.join(profile,'profile-lock.json'),savedLock=fs.readFileSync(lockPath),lock=JSON.parse(savedLock);
 try {
 delete lock.files.arraySortProvider;fs.writeFileSync(lockPath,canonical(lock)+'\n');
 run(process.execPath,['bin/as3-frontend','qualify',...args('without-array-sort-provider')]);
 const held=JSON.parse(fs.readFileSync(path.join(dir,'without-array-sort-provider/manifest.json'))).files.find(row=>row.sourcePath==='game/manager/configLoader/ConfigLoadRegistry.as');assert.equal(held.status,'held');assert.equal(held.code,'HARDENED_ARRAY_SORT');
 } finally { fs.writeFileSync(lockPath,savedLock); }
 assert.equal(hash(fs.readFileSync(path.join(source,'OriginalConfigLoadRegistryProbe.as'))),hash(read('OriginalConfigLoadRegistryProbe.as')));
 fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify({rows:10,node,web,sourceUnchanged:true,applicationStart:true,originalClasses:4,negativeControls:['Missing shared Array sort provider held'],typecheck:{strict:true,strictNullChecks:false,diagnostics:0}},null,2)+'\n');
 console.log(JSON.stringify({dir,rows:10,realms:['Node','Chromium'],status:'passed'}));
});
