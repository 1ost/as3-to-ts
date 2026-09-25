const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),laya=process.env.HARDENED_FIXTURE_LAYA;
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const canonical=value=>value===null||typeof value!=='object'?JSON.stringify(value):Array.isArray(value)?'['+value.map(canonical).join(',')+']':'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
test('authenticated shared RegExp provider emits original fields, Vector references and String replacement',async()=>{
 assert.ok(laya&&process.env.HARDENED_FIXTURE_AIR_SDK&&process.env.HARDENED_FIXTURE_FFDEC,'AIR, Laya and FFDec required');
 const evidence=path.join(laya,'tests/nativeFlashOracle/regexp-shared-profile');
 const read=name=>fs.readFileSync(path.join(evidence,name));
 for(const [file,expected] of Object.entries(JSON.parse(read('evidence-pin.json'))))assert.equal(hash(read(file)),expected);
 const receipt=JSON.parse(read('native-receipt.json')),captured=JSON.parse(read('native-capture.json'));
 assert.equal(receipt.status,'passed');assert.equal(receipt.capture.runs,2);assert.equal(receipt.capture.identical,true);
 assert.equal(receipt.capture.observationCount,13);assert.equal(captured.runtime.version,'MAC 51,3,3,2');
 assert.equal(captured.state.failure,'');assert.equal(captured.state.ready,true);
 assert.equal(hash(read('source/RegExpBridgeProbe.as')),receipt.artifacts['source/RegExpBridgeProbe.as']);
 assert.equal(hash(read('scenario.json')),receipt.scenario.sha256);
 for(const run of [1,2])assert.equal(hash(read('native-capture.json')),receipt.artifacts[`run-${run}/capture.json`]);
 const base=path.join(root,'.cache/shared-regexp-profile');fs.mkdirSync(base,{recursive:true});
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(base,'run-'))),profile=path.join(dir,'profile');
 const run=(cmd,args)=>{const r=cp.spawnSync(cmd,args,{cwd:root,encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stdout+r.stderr);return r;};
 run('python3',['-B','tools/create-fixture-profile.py','--source',path.join(evidence,'source'),'--entry','RegExpBridgeProbe',
  '--native-regexp','--air-sdk',process.env.HARDENED_FIXTURE_AIR_SDK,'--laya',laya,'--ffdec-jar',process.env.HARDENED_FIXTURE_FFDEC,'--output',profile]);
 const args=out=>[path.join(evidence,'source'),path.join(dir,out),'--source-census',path.join(profile,'census.json'),
  '--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(profile,'profile-lock.json')];
 run(process.execPath,['bin/as3-frontend','transpile',...args('emitted')]);
 const output=path.join(dir,'emitted/__as3_runtime'),generated=fs.readFileSync(path.join(output,'application/RegExpBridgeProbe.ts'),'utf8');
 assert.match(generated,/AS3RegExp/);assert.match(generated,/__as3SourceRegExpReplace/);
 const steps=JSON.parse(read('scenario.json')).steps,wanted=captured.state.observations;
 assert.deepEqual(steps.map(step=>step.id),wanted.map(row=>row.id));
 const esbuild=require('esbuild'),entry=`import {startAS3Application} from ${JSON.stringify(path.join(output,'ApplicationEntry.generated.js'))};
const probe=startAS3Application(new AbortController().signal);
globalThis.sharedRegExpResult=${JSON.stringify(steps)}.map(step=>{for(const call of step.calls)probe[call.method](...call.args);return {id:step.id,result:probe.result};});`;
 const built=await esbuild.build({stdin:{contents:entry,resolveDir:root,loader:'js'},bundle:true,write:false,format:'iife',platform:'browser',target:'es2020',
  loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'},plugins:[{name:'laya-provider',setup(build){build.onResolve({filter:/^laya\//},args=>({path:path.join(laya,'src/layaAir',args.path.slice(5)+'.ts')}));}}]});
 const bundle=built.outputFiles[0].text;fs.writeFileSync(path.join(dir,'bundle.js'),bundle);
 const node=JSON.parse(JSON.stringify(new Function(bundle+';return globalThis.sharedRegExpResult;')()));assert.deepEqual(node,wanted);
 const {chromium}=require(process.env.LAYA_PLAYWRIGHT_MODULE||'playwright'),browser=await chromium.launch({headless:true});
 let web;try{const page=await browser.newPage();await page.addScriptTag({content:bundle});web=await page.evaluate(()=>JSON.parse(JSON.stringify(globalThis.sharedRegExpResult)));assert.deepEqual(web,wanted);}finally{await browser.close();}
 const lockPath=path.join(profile,'profile-lock.json'),lockBytes=fs.readFileSync(lockPath),lock=JSON.parse(lockBytes);
 const checkNegative=(name,mutate,pattern,held=false)=>{
  const changed=structuredClone(lock);mutate(changed);fs.writeFileSync(lockPath,canonical(changed)+'\n');
  const r=cp.spawnSync(process.execPath,['bin/as3-frontend','qualify',...args(name)],{cwd:root,encoding:'utf8',timeout:120000});
  if(held){assert.equal(r.status,0,r.stdout+r.stderr);const m=JSON.parse(fs.readFileSync(path.join(dir,name,'manifest.json')));assert.equal(m.files[0].status,'held');assert.match(m.files[0].code,pattern);}
  else {assert.notEqual(r.status,0);assert.match(r.stderr,pattern);}
  fs.writeFileSync(lockPath,lockBytes);
 };
 checkNegative('without-native-regexp',l=>{delete l.files.nativeRegExp;},/HARDENED_TYPE_UNMAPPED/,true);
 checkNegative('without-regexp-provider',l=>{delete l.files.stringPatternProvider;},/HARDENED_TYPE_UNMAPPED/,true);
 const proofPath=path.join(profile,lock.files.nativeRegExp.path),proofBytes=fs.readFileSync(proofPath),proof=JSON.parse(proofBytes);
 proof.declarationSha256='0'.repeat(64);const forged=canonical(proof)+'\n';fs.writeFileSync(proofPath,forged);
 checkNegative('forged-sdk-proof',l=>{l.files.nativeRegExp.sha256=hash(forged);},/RegExp requires exact SDK/);
 fs.writeFileSync(proofPath,proofBytes);
 const providerPath=path.join(profile,lock.files.stringPatternProvider.path),providerBytes=fs.readFileSync(providerPath),provider=JSON.parse(providerBytes);
 delete provider.targetSources[Object.keys(provider.targetSources).find(p=>p.endsWith('/AS3SourceError.ts'))];
 const incomplete=canonical(provider)+'\n';fs.writeFileSync(providerPath,incomplete);
 checkNegative('missing-provider-dependency',l=>{l.files.stringPatternProvider.sha256=hash(incomplete);},/closure|source/);
 fs.writeFileSync(providerPath,providerBytes);
 fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify({rows:13,node,web,sourceSha256:hash(read('source/RegExpBridgeProbe.as')),sourceUnchanged:true,applicationStart:true,negativeControls:4},null,2)+'\n');
 console.log(JSON.stringify({dir,rows:13,realms:['Node','Chromium'],status:'passed'}));
});
