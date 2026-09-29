const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),laya=process.env.HARDENED_FIXTURE_LAYA;
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const canonical=value=>value===null||typeof value!=='object'?JSON.stringify(value):Array.isArray(value)?'['+value.map(canonical).join(',')+']':'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';

test('Shared Error.getStackTrace retains AIR first lines and native allocation context',async()=>{
 assert.ok(laya&&process.env.HARDENED_FIXTURE_AIR_SDK&&process.env.HARDENED_FIXTURE_FFDEC,'AIR, Laya and FFDec required');
 const evidence=path.join(laya,'tests/nativeFlashOracle/error-stack-generated'),mutationEvidence=path.join(laya,'tests/nativeFlashOracle/error-stack-bridge');
 const verifyPacket=dir=>{const read=name=>fs.readFileSync(path.join(dir,name));for(const [file,expected] of Object.entries(JSON.parse(read('evidence-pin.json'))))assert.equal(hash(read(file)),expected);const receipt=JSON.parse(read('native-receipt.json'));assert.equal(receipt.status,'passed');assert.equal(receipt.capture.runs,2);assert.equal(receipt.capture.identical,true);return {read,receipt,capture:JSON.parse(read('native-capture.json'))};};
 const packet=verifyPacket(evidence),mutationPacket=verifyPacket(mutationEvidence);
 assert.equal(packet.receipt.capture.observationCount,5);assert.equal(mutationPacket.receipt.capture.observationCount,9);
 assert.equal(packet.capture.runtime.version,'MAC 51,3,3,2');
 const base=path.join(root,'.cache/error-stack-bridge');fs.mkdirSync(base,{recursive:true});
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(base,'run-'))),profile=path.join(dir,'profile'),source=path.join(dir,'source');fs.mkdirSync(source);
 for(const file of ['ErrorStackGeneratedProbe.as'])fs.writeFileSync(path.join(source,file),packet.read(file));
 fs.writeFileSync(path.join(source,'ErrorIdentityProbe.as'),'package {public function ErrorIdentityProbe(value:*):Array{var cast:Error=value as Error;return [value is Error,cast===null];}}');
 const run=(cmd,args)=>{const r=cp.spawnSync(cmd,args,{cwd:root,encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stdout+r.stderr);return r;};
 run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','ErrorStackGeneratedProbe',
  '--air-sdk',process.env.HARDENED_FIXTURE_AIR_SDK,'--laya',laya,'--ffdec-jar',process.env.HARDENED_FIXTURE_FFDEC,
  '--shared-type-error','--shared-error-stack','--output',profile]);
 const args=out=>[source,path.join(dir,out),'--source-census',path.join(profile,'census.json'),
  '--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(profile,'profile-lock.json')];
 run(process.execPath,['bin/as3-frontend','transpile',...args('emitted')]);
 const generated=fs.readFileSync(path.join(dir,'emitted/__as3_runtime/application/ErrorStackGeneratedProbe.ts'),'utf8');
 assert.match(generated,/__as3ErrorGetStackTrace/);assert.match(generated,/__sharedErrorStack/);
 const identityGenerated=fs.readFileSync(path.join(dir,'emitted/__as3_runtime/application/ErrorIdentityProbe.ts'),'utf8');
 assert.match(identityGenerated,/__as3ClassType\("Error", __AS3Error\)/);assert.match(identityGenerated,/AS3Error as __AS3Error/);
 const output=path.join(dir,'emitted/__as3_runtime'),steps=JSON.parse(packet.read('scenario.json')).steps,wanted=packet.capture.state.observations;
 const mutationWanted=mutationPacket.capture.state.observations.find(row=>row.id==='mutation-after-first-call').result;
 const esbuild=require('esbuild'),entry=`import {startAS3Application} from ${JSON.stringify(path.join(output,'ApplicationEntry.generated.js'))};
import {ErrorIdentityProbe} from ${JSON.stringify(path.join(output,'application/ErrorIdentityProbe.js'))};
import {as3ErrorGetStackTrace} from ${JSON.stringify(path.join(root,'src/hardened-runtime/AS3Coerce.ts'))};
import {sourceErrorStack} from ${JSON.stringify(path.join(laya,'src/layaAir/flash/utils/AS3ErrorStack.ts'))};
import {as3CreateError} from ${JSON.stringify(path.join(laya,'src/layaAir/flash/errors/AS3SourceError.ts'))};
const probe=startAS3Application(new AbortController().signal);
globalThis.errorStackBridge=${JSON.stringify(steps)}.map(step=>{for(const call of step.calls)probe[call.method](...call.args);return {id:step.id,result:probe.result};});
globalThis.errorTypeBridge=[ErrorIdentityProbe(as3CreateError('source')),ErrorIdentityProbe(new Error('host')),ErrorIdentityProbe(null)];
const mutation=new Error('first'),before=as3ErrorGetStackTrace(mutation,sourceErrorStack);mutation.name='ChangedError';mutation.message='second';const after=as3ErrorGetStackTrace(mutation,sourceErrorStack),line=value=>value.substring(0,value.indexOf('\\n'));
globalThis.errorStackMutation=[line(before),line(after),before===after,before.includes('\\n'),after.includes('\\n')];
globalThis.errorStackGuards=[()=>as3ErrorGetStackTrace(null,sourceErrorStack),()=>as3ErrorGetStackTrace({},sourceErrorStack),()=>{const e=new Error('x');Object.defineProperty(e,'getStackTrace',{value(){}});return as3ErrorGetStackTrace(e,sourceErrorStack);},()=>sourceErrorStack(new Error('x'),42)];`;
 const manifest=JSON.parse(fs.readFileSync(path.join(dir,'emitted/manifest.json')));assert.equal(manifest.files.length,2);for(const row of manifest.files)assert.ok(row.typescriptPath,JSON.stringify(row));
 const files=manifest.files.map(row=>path.join(dir,'emitted',row.typescriptPath)),typeConfig=path.join(dir,'generated-tsconfig.json');
 fs.writeFileSync(typeConfig,JSON.stringify({compilerOptions:{target:'ES2020',module:'CommonJS',moduleResolution:'node',strict:true,strictNullChecks:true,strictPropertyInitialization:true,experimentalDecorators:true,resolveJsonModule:true,allowSyntheticDefaultImports:true,skipLibCheck:true,noEmit:true,types:[],lib:['ES2020','DOM','DOM.Iterable'],baseUrl:root,paths:{'@laya/as3-runtime/*':['src/hardened-runtime/*'],'laya/*':[path.join(laya,'src/layaAir/*')]}},files:[...files,path.join(laya,'src/layaAir/tslibs/glsl.d.ts'),path.join(laya,'src/layaAir/tslibs/spine.d.ts')]}));
 run(process.execPath,[path.join(root,'node_modules/typescript-4-9/bin/tsc'),'-p',typeConfig,'--pretty','false']);
 const built=await esbuild.build({plugins:[{name:'shared-laya',setup(build){build.onResolve({filter:/^laya\//},args=>({path:path.join(laya,'src/layaAir',args.path.slice(5)+'.ts')}));}}],stdin:{contents:entry,resolveDir:root,loader:'js'},bundle:true,write:false,format:'iife',platform:'browser',target:'es2020',loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'}});
 const bundle=built.outputFiles[0].text;fs.writeFileSync(path.join(dir,'bundle.js'),bundle);
 const node=new Function(bundle+';return {rows:JSON.parse(JSON.stringify(globalThis.errorStackBridge)),types:JSON.parse(JSON.stringify(globalThis.errorTypeBridge)),mutation:globalThis.errorStackMutation,guards:globalThis.errorStackGuards.map(run=>{try{run();return false}catch{return true}})};')();
 assert.deepEqual(node.types,[[true,false],[false,true],[false,true]]);
 assert.deepEqual(node.rows,wanted);assert.deepEqual(node.mutation,mutationWanted);assert.deepEqual(node.guards,[true,true,true,true]);
 const {chromium}=require(process.env.LAYA_PLAYWRIGHT_MODULE||'playwright'),browser=await chromium.launch({headless:true});
 let web;try{const page=await browser.newPage({timezoneId:'Europe/Rome'});await page.addScriptTag({content:bundle});web=await page.evaluate(()=>({rows:JSON.parse(JSON.stringify(globalThis.errorStackBridge)),types:JSON.parse(JSON.stringify(globalThis.errorTypeBridge)),mutation:globalThis.errorStackMutation,guards:globalThis.errorStackGuards.map(run=>{try{run();return false}catch{return true}})}));}finally{await browser.close();}
 assert.deepEqual(web.types,node.types);
 assert.deepEqual(web.rows,wanted);assert.deepEqual(web.mutation,mutationWanted);assert.deepEqual(web.guards,[true,true,true,true]);
 assert.equal(hash(fs.readFileSync(path.join(source,'ErrorStackGeneratedProbe.as'))),hash(packet.read('ErrorStackGeneratedProbe.as')));

 const lockPath=path.join(profile,'profile-lock.json'),originalLock=fs.readFileSync(lockPath),lock=JSON.parse(originalLock);delete lock.files.errorStackProvider;
 fs.writeFileSync(lockPath,canonical(lock)+'\n');run(process.execPath,['bin/as3-frontend','qualify',...args('without-provider')]);
 const heldFiles=JSON.parse(fs.readFileSync(path.join(dir,'without-provider/manifest.json'))).files,held=heldFiles.find(row=>row.sourcePath==='ErrorStackGeneratedProbe.as'),heldType=heldFiles.find(row=>row.sourcePath==='ErrorIdentityProbe.as');assert.equal(held.status,'held');assert.equal(held.code,'HARDENED_MEMBER_TARGET');assert.equal(heldType.status,'held');assert.equal(heldType.code,'HARDENED_RUNTIME_TYPE_IDENTITY');fs.writeFileSync(lockPath,originalLock);
 const providerPath=path.join(profile,JSON.parse(originalLock).files.errorStackProvider.path),savedProvider=fs.readFileSync(providerPath),proof=JSON.parse(savedProvider);
 try{proof.stackTarget.targetSources['src/layaAir/flash/utils/AS3ErrorStack.ts']='0'.repeat(64);fs.writeFileSync(providerPath,canonical(proof)+'\n');const forged=JSON.parse(originalLock);forged.files.errorStackProvider.sha256=hash(fs.readFileSync(providerPath));fs.writeFileSync(lockPath,canonical(forged)+'\n');const rejected=cp.spawnSync(process.execPath,['bin/as3-frontend','qualify',...args('forged-provider')],{cwd:root,encoding:'utf8',timeout:120000});assert.notEqual(rejected.status,0);assert.match(rejected.stdout+rejected.stderr,/Error stack provider|ERROR_STACK_PROVIDER/);}finally{fs.writeFileSync(providerPath,savedProvider);fs.writeFileSync(lockPath,originalLock);}
 fs.writeFileSync(path.join(source,'ExtraArgument.as'),'package {public class ExtraArgument{public function call(error:Error):String{return error.getStackTrace(1);}}}');
 const boundaryProfile=path.join(dir,'boundary-profile');run('python3',['-B','tools/create-fixture-profile.py','--source',source,'--entry','ErrorStackGeneratedProbe','--air-sdk',process.env.HARDENED_FIXTURE_AIR_SDK,'--laya',laya,'--ffdec-jar',process.env.HARDENED_FIXTURE_FFDEC,'--shared-type-error','--shared-error-stack','--output',boundaryProfile]);
 run(process.execPath,['bin/as3-frontend','qualify',source,path.join(dir,'boundary-output'),'--source-census',path.join(boundaryProfile,'census.json'),'--target-capabilities',path.join(laya,'docTool/architecture/authored-content-capabilities.json'),'--profile-lock',path.join(boundaryProfile,'profile-lock.json')]);
 const extra=JSON.parse(fs.readFileSync(path.join(dir,'boundary-output/manifest.json'))).files.find(row=>row.sourcePath==='ExtraArgument.as');assert.equal(extra.status,'held');assert.equal(extra.code,'HARDENED_ERROR_CALL_ARITY');
 fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify({rows:5,typeRows:3,mutationRows:1,node:node.rows,web:web.rows,sourceUnchanged:true,applicationStart:true,rejectionGuards:1,providerGuards:2,runtimeGuards:4,typecheck:{strict:true,strictNullChecks:true,diagnostics:0}},null,2)+'\n');
 console.log(JSON.stringify({dir,rows:5,realms:['Node','Chromium'],status:'passed'}));
});
