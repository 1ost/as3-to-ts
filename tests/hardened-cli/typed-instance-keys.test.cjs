const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),laya=process.env.HARDENED_FIXTURE_LAYA;
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
test('Typed local instance keys reuse source Object key conversion and lexical member dispatch',async()=>{
 assert.ok(laya&&process.env.HARDENED_FIXTURE_AIR_SDK&&process.env.HARDENED_FIXTURE_FFDEC,'AIR, Laya and FFDec required');
 const evidence=path.join(laya,'tests/nativeFlashOracle/typed-instance-keys'),read=name=>fs.readFileSync(path.join(evidence,name));
 for(const [file,expected] of Object.entries(JSON.parse(read('evidence-pin.json'))))assert.equal(hash(read(file)),expected);
 const receipt=JSON.parse(read('native-receipt.json')),captured=JSON.parse(read('native-capture.json'));
 assert.equal(receipt.status,'passed');assert.equal(receipt.capture.runs,2);assert.equal(receipt.capture.identical,true);
 assert.equal(receipt.capture.observationCount,14);assert.equal(captured.runtime.version,'MAC 51,3,3,2');
 assert.equal(hash(read('TypedInstanceKeysProbe.as')),receipt.artifacts['source/TypedInstanceKeysProbe.as']);
 assert.equal(hash(read('scenario.json')),receipt.scenario.sha256);
 assert.equal(hash(read('OracleHost.retained.as.txt')),receipt.artifacts['host/OracleHost.as']);
 for(const run of [1,2])assert.equal(hash(read('native-capture.json')),receipt.artifacts[`run-${run}/capture.json`]);
 const base=path.join(root,'.cache/typed-instance-keys');fs.mkdirSync(base,{recursive:true});
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(base,'run-'))),profile=path.join(dir,'profile');
 const run=(cmd,args)=>{const r=cp.spawnSync(cmd,args,{cwd:root,encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stdout+r.stderr);return r;};
 const source=path.join(dir,'source');fs.mkdirSync(source);for(const file of ['TypedInstanceKeysProbe.as','KeyRecord.as']){fs.mkdirSync(path.dirname(path.join(source,file)),{recursive:true});fs.writeFileSync(path.join(source,file),read(file));assert.equal(hash(read(file)),receipt.artifacts['source/'+file]);}
 const make=()=>run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','TypedInstanceKeysProbe',
  '--air-sdk',process.env.HARDENED_FIXTURE_AIR_SDK,'--laya',laya,'--ffdec-jar',process.env.HARDENED_FIXTURE_FFDEC,'--output',profile]);
 const args=out=>[source,path.join(dir,out),'--source-census',path.join(profile,'census.json'),
  '--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(profile,'profile-lock.json')];
 make();run(process.execPath,['bin/as3-frontend','transpile',...args('emitted')]);
 const emittedRecord=fs.readFileSync(path.join(dir,'emitted/__as3_runtime/application/KeyRecord.ts'),'utf8');assert.match(emittedRecord,/__as3ObjectWrite/);assert.match(emittedRecord,/__as3ObjectRead/);assert.match(emittedRecord,/"KeyRecord"/);

 const output=path.join(dir,'emitted/__as3_runtime'),steps=JSON.parse(read('scenario.json')).steps,wanted=captured.state.observations;
 const esbuild=require('esbuild'),entry=`import {startAS3Application} from ${JSON.stringify(path.join(output,'ApplicationEntry.generated.js'))};
const probe=startAS3Application(new AbortController().signal);
globalThis.typeErrorProvider=${JSON.stringify(steps)}.map(step=>{for(const call of step.calls)probe[call.method](...call.args);return {id:step.id,result:probe.result};});`;
 const manifest=JSON.parse(fs.readFileSync(path.join(dir,'emitted/manifest.json')));
 assert.equal(manifest.files.length,2);for(const row of manifest.files)assert.ok(row.typescriptPath,JSON.stringify(row));
 const files=manifest.files.map(row=>path.join(dir,'emitted',row.typescriptPath));
 const typeConfig=path.join(dir,'generated-tsconfig.json');
 fs.writeFileSync(typeConfig,JSON.stringify({compilerOptions:{target:'ES2020',module:'CommonJS',moduleResolution:'node',strict:true,strictNullChecks:true,strictPropertyInitialization:true,experimentalDecorators:true,resolveJsonModule:true,allowSyntheticDefaultImports:true,skipLibCheck:true,noEmit:true,types:[],lib:['ES2020','DOM','DOM.Iterable'],baseUrl:root,paths:{'@laya/as3-runtime/*':['src/hardened-runtime/*'],'laya/*':[path.join(laya,'src/layaAir/*')]}},files:[...files,path.join(laya,'src/layaAir/tslibs/glsl.d.ts'),path.join(laya,'src/layaAir/tslibs/spine.d.ts')]}));
 run(process.execPath,[path.join(root,'node_modules/typescript-4-9/bin/tsc'),'-p',typeConfig,'--pretty','false']);
 const built=await esbuild.build({plugins:[{name:'shared-laya',setup(build){build.onResolve({filter:/^laya\//},args=>({path:path.join(laya,'src/layaAir',args.path.slice(5)+'.ts')}));}}],stdin:{contents:entry,resolveDir:root,loader:'js'},bundle:true,write:false,format:'iife',platform:'browser',target:'es2020',loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'}});
 const bundle=built.outputFiles[0].text;fs.writeFileSync(path.join(dir,'bundle.js'),bundle);
 const node=JSON.parse(JSON.stringify(new Function(bundle+';return globalThis.typeErrorProvider;')()));assert.deepEqual(node,wanted);
 const {chromium}=require(process.env.LAYA_PLAYWRIGHT_MODULE||'playwright'),browser=await chromium.launch({headless:true});
 let web;try{const page=await browser.newPage({timezoneId:'Europe/Rome'});await page.addScriptTag({content:bundle});web=await page.evaluate(()=>JSON.parse(JSON.stringify(globalThis.typeErrorProvider)));assert.deepEqual(web,wanted);}finally{await browser.close();}
 assert.equal(hash(fs.readFileSync(path.join(source,'TypedInstanceKeysProbe.as'))),hash(read('TypedInstanceKeysProbe.as')));
 assert.equal(hash(fs.readFileSync(path.join(source,'KeyRecord.as'))),hash(read('KeyRecord.as')));
 const boundaries={
  ClassKey:['public function read(key:Class):* {return this[key];}','HARDENED_OBJECT_KEY'],
  TypedReferenceKey:['public function read(key:KeyRecord):* {return this[key];}','HARDENED_OBJECT_KEY'],
  VoidKey:['private function empty():void {} public function read():* {return this[empty()];}',null]
 };
 for(const [name,[body]] of Object.entries(boundaries))fs.writeFileSync(path.join(source,name+'.as'),'package {public dynamic class '+name+'{'+body+'}}');
 const boundaryProfile=path.join(dir,'boundary-profile');
 run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','TypedInstanceKeysProbe',
  '--air-sdk',process.env.HARDENED_FIXTURE_AIR_SDK,'--laya',laya,'--ffdec-jar',process.env.HARDENED_FIXTURE_FFDEC,'--output',boundaryProfile]);
 run(process.execPath,['bin/as3-frontend','qualify',source,path.join(dir,'boundary-output'),'--source-census',path.join(boundaryProfile,'census.json'),
  '--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(boundaryProfile,'profile-lock.json')]);
 const rows=JSON.parse(fs.readFileSync(path.join(dir,'boundary-output/manifest.json'))).files;
 for(const [name,[,code]] of Object.entries(boundaries)){const row=rows.find(row=>row.sourcePath===name+'.as');assert.equal(row.status,'held',name);if(code)assert.equal(row.code,code,name);}
 for(const name of ['TypedInstanceKeysProbe','KeyRecord'])assert.equal(rows.find(row=>row.sourcePath===name+'.as').status,'admitted',name);
 fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify({rows:14,node,web,sourceUnchanged:true,applicationStart:true,probeClasses:2,rejectionGuards:3,typecheck:{strict:true,strictNullChecks:true,diagnostics:0}},null,2)+'\n');
 console.log(JSON.stringify({dir,rows:14,realms:['Node','Chromium'],status:'passed'}));
});
