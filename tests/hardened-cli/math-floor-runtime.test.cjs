const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),laya=process.env.HARDENED_FIXTURE_LAYA;
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
test('Generated Math.floor uses the authenticated shared numeric provider and matches native double bits',async()=>{
 assert.ok(laya&&process.env.HARDENED_FIXTURE_AIR_SDK&&process.env.HARDENED_FIXTURE_FFDEC,'AIR, Laya and FFDec required');
 const evidence=path.join(laya,'tests/nativeFlashOracle/math-floor-bridge'),read=name=>fs.readFileSync(path.join(evidence,name));
 for(const [file,expected] of Object.entries(JSON.parse(read('evidence-pin.json'))))assert.equal(hash(read(file)),expected);
 const receipt=JSON.parse(read('native-receipt.json')),captured=JSON.parse(read('native-capture.json'));
 assert.equal(receipt.status,'passed');assert.equal(receipt.capture.runs,2);assert.equal(receipt.capture.identical,true);
 assert.equal(receipt.capture.observationCount,17);assert.equal(captured.runtime.version,'MAC 51,3,3,2');
 assert.equal(hash(read('MathFloorProbe.as')),receipt.artifacts['source/MathFloorProbe.as']);
 assert.equal(hash(read('scenario.json')),receipt.scenario.sha256);
 assert.match(read('sdk-Math.as.txt').toString(),/public static native function floor\(param1:Number\) : Number;/);
 assert.equal(hash(read('OracleHost.retained.as.txt')),receipt.artifacts['host/OracleHost.as']);
 for(const run of [1,2])assert.equal(hash(read('native-capture.json')),receipt.artifacts[`run-${run}/capture.json`]);
 const base=path.join(root,'.cache/math-floor-bridge');fs.mkdirSync(base,{recursive:true});
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(base,'run-'))),profile=path.join(dir,'profile');
 const run=(cmd,args)=>{const r=cp.spawnSync(cmd,args,{cwd:root,encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stdout+r.stderr);return r;};
 const source=path.join(dir,'source');fs.mkdirSync(source);for(const file of ['MathFloorProbe.as']){fs.mkdirSync(path.dirname(path.join(source,file)),{recursive:true});fs.writeFileSync(path.join(source,file),read(file));assert.equal(hash(read(file)),receipt.artifacts['source/'+file]);}
 const make=()=>run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','MathFloorProbe',
  '--air-sdk',process.env.HARDENED_FIXTURE_AIR_SDK,'--laya',laya,'--ffdec-jar',process.env.HARDENED_FIXTURE_FFDEC,'--intrinsic-type','flash.utils.ByteArray','--shared-math-floor','--output',profile]);
 const args=out=>[source,path.join(dir,out),'--source-census',path.join(profile,'census.json'),
  '--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(profile,'profile-lock.json')];
 make();run(process.execPath,['bin/as3-frontend','transpile',...args('emitted')]);
 const emittedProbe=fs.readFileSync(path.join(dir,'emitted/__as3_runtime/application/MathFloorProbe.ts'),'utf8');assert.match(emittedProbe,/laya\/flash\/utils\/AS3Math/);assert.match(emittedProbe,/__as3SharedMathFloor/);assert.doesNotMatch(emittedProbe,/Math\.floor/);
 const output=path.join(dir,'emitted/__as3_runtime'),steps=JSON.parse(read('scenario.json')).steps,wanted=captured.state.observations;
 const esbuild=require('esbuild'),entry=`import {startAS3Application} from ${JSON.stringify(path.join(output,'ApplicationEntry.generated.js'))};
const probe=startAS3Application(new AbortController().signal);
globalThis.mathFloorProvider=${JSON.stringify(steps)}.map(step=>{for(const call of step.calls)probe[call.method](...call.args);return {id:step.id,result:probe.result};});`;
 const manifest=JSON.parse(fs.readFileSync(path.join(dir,'emitted/manifest.json')));
 assert.equal(manifest.files.length,1);for(const row of manifest.files)assert.ok(row.typescriptPath,JSON.stringify(row));
 const files=manifest.files.map(row=>path.join(dir,'emitted',row.typescriptPath));
 const typeConfig=path.join(dir,'generated-tsconfig.json');
 fs.writeFileSync(typeConfig,JSON.stringify({compilerOptions:{target:'ES2020',module:'CommonJS',moduleResolution:'node',strict:true,strictNullChecks:true,strictPropertyInitialization:true,experimentalDecorators:true,resolveJsonModule:true,allowSyntheticDefaultImports:true,skipLibCheck:true,noEmit:true,types:[],lib:['ES2020','DOM','DOM.Iterable'],baseUrl:root,paths:{'@laya/as3-runtime/*':['src/hardened-runtime/*'],'laya/*':[path.join(laya,'src/layaAir/*')]}},files:[...files,path.join(laya,'src/layaAir/tslibs/glsl.d.ts'),path.join(laya,'src/layaAir/tslibs/spine.d.ts')]}));
 run(process.execPath,[path.join(root,'node_modules/typescript-4-9/bin/tsc'),'-p',typeConfig,'--pretty','false']);
 const built=await esbuild.build({plugins:[{name:'shared-laya',setup(build){build.onResolve({filter:/^laya\//},args=>({path:path.join(laya,'src/layaAir',args.path.slice(5)+'.ts')}));}}],stdin:{contents:entry,resolveDir:root,loader:'js'},bundle:true,write:false,format:'iife',platform:'browser',target:'es2020',loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'}});
 const bundle=built.outputFiles[0].text;fs.writeFileSync(path.join(dir,'bundle.js'),bundle);
 const node=JSON.parse(JSON.stringify(new Function(bundle+';return globalThis.mathFloorProvider;')()));assert.deepEqual(node,wanted);
 const {chromium}=require(process.env.LAYA_PLAYWRIGHT_MODULE||'playwright'),browser=await chromium.launch({headless:true});
 let web;try{const page=await browser.newPage({timezoneId:'Europe/Rome'});await page.addScriptTag({content:bundle});web=await page.evaluate(()=>JSON.parse(JSON.stringify(globalThis.mathFloorProvider)));assert.deepEqual(web,wanted);}finally{await browser.close();}
 const canonical=value=>value===null||typeof value!=='object'?JSON.stringify(value):Array.isArray(value)?'['+value.map(canonical).join(',')+']':'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
 const lockPath=path.join(profile,'profile-lock.json'),savedLock=fs.readFileSync(lockPath),lock=JSON.parse(savedLock);
 try {
 delete lock.files.mathFloorProvider;fs.writeFileSync(lockPath,canonical(lock)+'\n');
 run(process.execPath,['bin/as3-frontend','qualify',...args('without-floor-provider')]);
 const held=JSON.parse(fs.readFileSync(path.join(dir,'without-floor-provider/manifest.json'))).files.find(row=>row.sourcePath==='MathFloorProbe.as');assert.equal(held.status,'held');assert.equal(held.code,'HARDENED_MATH_MEMBER');
 } finally { fs.writeFileSync(lockPath,savedLock); }
 const positiveLock=JSON.parse(savedLock),providerPath=path.join(profile,positiveLock.files.mathFloorProvider.path),savedProvider=fs.readFileSync(providerPath);
 try {
  const forged=JSON.parse(savedProvider);forged.targetSources['src/layaAir/flash/utils/AS3Math.ts']='0'.repeat(64);
  fs.writeFileSync(providerPath,canonical(forged)+'\n');const changed=JSON.parse(savedLock);changed.files.mathFloorProvider.sha256=hash(fs.readFileSync(providerPath));fs.writeFileSync(lockPath,canonical(changed)+'\n');
  const rejected=cp.spawnSync(process.execPath,['bin/as3-frontend','qualify',...args('forged-floor-provider')],{cwd:root,encoding:'utf8',timeout:120000});
  assert.equal(rejected.status,6);assert.match(rejected.stderr,/Math floor provider/);
 } finally {fs.writeFileSync(providerPath,savedProvider);fs.writeFileSync(lockPath,savedLock);}
 const boundaries={
  FloorZero:['public function value():Number{return Math.floor();}', 'HARDENED_MATH_ARITY'],
  FloorExtra:['public function value():Number{return Math.floor(1,2);}', 'HARDENED_MATH_ARITY'],
  FloorString:['public function value(input:String):Number{return Math.floor(input);}', 'HARDENED_MATH_ARGUMENT'],
  FloorObject:['public function value(input:Object):Number{return Math.floor(input);}', 'HARDENED_MATH_ARGUMENT'],
  FloorDynamic:['public function value(input:*):Number{return Math.floor(input);}', 'HARDENED_MATH_ARGUMENT'],
  FloorNull:['public function value():Number{return Math.floor(null);}', 'HARDENED_MATH_ARGUMENT'],
  FloorShadow:['public function value(Math:Object):Number{return Math.floor(1);}', 'HARDENED_MATH_SHADOW'],
  FloorHelperShadow:['public function value(__as3SharedMathFloor:Function):Number{return Math.floor(1);}', 'HARDENED_IDENTIFIER'],
  FloorClosure:['public function value():Function{return Math.floor;}', 'HARDENED_MATH_MEMBER']
 };
 for(const [name,[body]] of Object.entries(boundaries))fs.writeFileSync(path.join(source,name+'.as'),'package {public class '+name+'{'+body+'}}');
 fs.writeFileSync(path.join(source,'NumericFloor.as'),'package {public class NumericFloor {public function integer(value:int):Number{return Math.floor(value);} public function unsigned(value:uint):Number{return Math.floor(value);}}}');
 const boundaryProfile=path.join(dir,'boundary-profile');
 run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','MathFloorProbe',
  '--air-sdk',process.env.HARDENED_FIXTURE_AIR_SDK,'--laya',laya,'--ffdec-jar',process.env.HARDENED_FIXTURE_FFDEC,'--intrinsic-type','flash.utils.ByteArray','--shared-math-floor','--output',boundaryProfile]);
 run(process.execPath,['bin/as3-frontend','qualify',source,path.join(dir,'boundary-output'),'--source-census',path.join(boundaryProfile,'census.json'),
  '--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(boundaryProfile,'profile-lock.json')]);
 const boundaryRows=JSON.parse(fs.readFileSync(path.join(dir,'boundary-output/manifest.json'))).files;
 for(const [name,[,code]] of Object.entries(boundaries)) {const row=boundaryRows.find(row=>row.sourcePath===name+'.as');assert.equal(row.status,'held',name);assert.equal(row.code,code,name);}
 for(const name of ['NumericFloor','MathFloorProbe'])assert.equal(boundaryRows.find(row=>row.sourcePath===name+'.as').status,'admitted',name);
 assert.equal(hash(fs.readFileSync(path.join(source,'MathFloorProbe.as'))),hash(read('MathFloorProbe.as')));
 fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify({rows:17,node,web,sourceUnchanged:true,applicationStart:true,probeClasses:1,compilerRejectionGuards:9,numericInputTypes:["Number","int","uint"],negativeControls:['Missing shared floor proof held','Forged provider closure rejected'],typecheck:{strict:true,strictNullChecks:true,diagnostics:0}},null,2)+'\n');
 console.log(JSON.stringify({dir,rows:17,realms:['Node','Chromium'],status:'passed'}));
});
