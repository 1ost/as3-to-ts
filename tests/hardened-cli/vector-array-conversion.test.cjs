const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),laya=process.env.HARDENED_FIXTURE_LAYA;
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
test('authenticated Array-to-Vector conversion preserves native copies, coercion, identity and errors',async()=>{
 assert.ok(laya&&process.env.HARDENED_FIXTURE_AIR_SDK&&process.env.HARDENED_FIXTURE_FFDEC,'AIR, Laya and FFDec required');
 const evidence=path.join(laya,'tests/nativeFlashOracle/vector-array-conversion'),read=name=>fs.readFileSync(path.join(evidence,name));
 for(const [file,expected] of Object.entries(JSON.parse(read('evidence-pin.json'))))assert.equal(hash(read(file)),expected);
 const receipt=JSON.parse(read('native-receipt.json')),captured=JSON.parse(read('native-capture.json'));
 assert.equal(receipt.status,'passed');assert.equal(receipt.capture.runs,2);assert.equal(receipt.capture.identical,true);
 assert.equal(receipt.capture.observationCount,12);assert.equal(captured.runtime.version,'MAC 51,3,3,2');
 assert.equal(hash(read('source/VectorArrayProbe.as')),receipt.artifacts['source/VectorArrayProbe.as']);
 assert.equal(hash(read('scenario.json')),receipt.scenario.sha256);
 for(const run of [1,2])assert.equal(hash(read('native-capture.json')),receipt.artifacts[`run-${run}/capture.json`]);
 const base=path.join(root,'.cache/vector-array-conversion');fs.mkdirSync(base,{recursive:true});
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(base,'run-'))),profile=path.join(dir,'profile');
 const run=(cmd,args)=>{const r=cp.spawnSync(cmd,args,{cwd:root,encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stdout+r.stderr);return r;};
 const source=path.join(dir,'source');fs.mkdirSync(source);fs.writeFileSync(path.join(source,'VectorArrayProbe.as'),read('source/VectorArrayProbe.as'));
 const make=()=>run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','VectorArrayProbe',
  '--native-regexp','--air-sdk',process.env.HARDENED_FIXTURE_AIR_SDK,'--laya',laya,'--ffdec-jar',process.env.HARDENED_FIXTURE_FFDEC,'--output',profile]);
 const args=out=>[source,path.join(dir,out),'--source-census',path.join(profile,'census.json'),
  '--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(profile,'profile-lock.json')];
 make();run(process.execPath,['bin/as3-frontend','transpile',...args('emitted')]);
 const output=path.join(dir,'emitted/__as3_runtime'),steps=JSON.parse(read('scenario.json')).steps,wanted=captured.state.observations;
 const esbuild=require('esbuild'),entry=`import {startAS3Application} from ${JSON.stringify(path.join(output,'ApplicationEntry.generated.js'))};
const probe=startAS3Application(new AbortController().signal);
globalThis.vectorArrayResult=${JSON.stringify(steps)}.map(step=>{for(const call of step.calls)probe[call.method](...call.args);return {id:step.id,result:probe.result};});`;
 const built=await esbuild.build({stdin:{contents:entry,resolveDir:root,loader:'js'},bundle:true,write:false,format:'iife',platform:'browser',target:'es2020',loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'},plugins:[{name:'laya-provider',setup(build){build.onResolve({filter:/^laya\//},args=>({path:path.join(laya,'src/layaAir',args.path.slice(5)+'.ts')}));}}]});
 const bundle=built.outputFiles[0].text;fs.writeFileSync(path.join(dir,'bundle.js'),bundle);
 const node=JSON.parse(JSON.stringify(new Function(bundle+';return globalThis.vectorArrayResult;')()));assert.deepEqual(node,wanted);
 const {chromium}=require(process.env.LAYA_PLAYWRIGHT_MODULE||'playwright'),browser=await chromium.launch({headless:true});
 let web;try{const page=await browser.newPage();await page.addScriptTag({content:bundle});web=await page.evaluate(()=>JSON.parse(JSON.stringify(globalThis.vectorArrayResult)));assert.deepEqual(web,wanted);}finally{await browser.close();}
 const controls={ObjectSource:'public function f(value:Object):Vector.<String>{return Vector.<String>(value);}',
  WildcardSource:'public function f(value:*):Vector.<String>{return Vector.<String>(value);}'};
 for(const [name,body] of Object.entries(controls))fs.writeFileSync(path.join(source,name+'.as'),`package {public class ${name} {${body}}}`);
 fs.rmSync(profile,{recursive:true,force:true});make();run(process.execPath,['bin/as3-frontend','qualify',...args('negative')]);
 const rows=JSON.parse(fs.readFileSync(path.join(dir,'negative/manifest.json'))).files;
 for(const name of Object.keys(controls)){const row=rows.find(row=>row.sourcePath===name+'.as');assert.equal(row.status,'held',JSON.stringify(row));assert.match(row.code,/HARDENED_VECTOR_CONVERSION_SOURCE/);}
 assert.equal(hash(fs.readFileSync(path.join(source,'VectorArrayProbe.as'))),hash(read('source/VectorArrayProbe.as')));
 fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify({rows:12,node,web,sourceUnchanged:true,applicationStart:true,negativeControls:2},null,2)+'\n');
 console.log(JSON.stringify({dir,rows:12,realms:['Node','Chromium'],status:'passed'}));
});
