import {isDeepStrictEqual} from 'node:util';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const test=path.dirname(fileURLToPath(import.meta.url)),compiler=path.resolve(test,'../..'),repo=path.resolve(process.env.OP2_EVIDENCE_REPOSITORY||path.join(compiler,'../op2-html5'));
const here=path.join(repo,'game-client-laya/tests/custom-ease-review'),require=createRequire(import.meta.url),hash=b=>createHash('sha256').update(b).digest('hex');
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||path.join(compiler,'../LayaAir-op2-source-unit-retry-review'));
const {build}=require(path.join(engine,'node_modules/esbuild')),{chromium}=require(require.resolve('playwright',{paths:[path.join(repo,'game-client-laya')]}));
const fieldReceipt=require(path.join(test,'capture/receipt.json'));for(const [file,digest] of Object.entries(fieldReceipt.artifacts))assert.equal(hash(fs.readFileSync(path.join(test,'capture',file))),digest,file);
const fieldCaptures=[1,2].map(n=>require(path.join(test,'capture/run-'+n+'/capture.json')));assert.deepEqual(fieldCaptures[0],fieldCaptures[1]);
const expected=require(path.join(here,'expected.json')).concat(fieldCaptures[0].state.observations),results=[];require(path.join(here,'verify.cjs'));assert.equal(expected.length,52);
const pins={engine:execFileSync('git',['rev-parse','HEAD'],{cwd:engine,encoding:'utf8'}).trim(),compilerBase:execFileSync('git',['rev-parse','HEAD'],{cwd:compiler,encoding:'utf8'}).trim()};
const cache=path.join(compiler,'.cache/native-generated-storage-reads');fs.mkdirSync(cache,{recursive:true});const run=fs.mkdtempSync(path.join(cache,'run-'));
const snapshot=path.join(run,'lib');execFileSync(process.execPath,[path.join(compiler,'node_modules/typescript/lib/tsc.js'),'--project',path.join(compiler,'tsconfig.json'),'--outDir',snapshot,'--pretty','false'],{cwd:compiler,stdio:'pipe'});
const compilerInputs=[];for(const folder of ['src','utils',path.relative(compiler,snapshot)])for(const name of fs.readdirSync(path.join(compiler,folder),{recursive:true})){const file=path.join(compiler,folder,name);if(fs.statSync(file).isFile())compilerInputs.push({file,sha256:hash(fs.readFileSync(file))});}
function prepareFixture({target}){
 const out=path.join(run,target);fs.mkdirSync(out);const api=require(snapshot),ts=require(path.join(engine,'node_modules/typescript'));
 const modulePath=file=>{const relative=path.relative(out,file).replaceAll('\\','/').replace(/\.ts$/,'');return relative.startsWith('.')?relative:'./'+relative;};
 const provider=n=>modulePath(path.join(engine,'src/layaAir/flash/utils',n+'.ts'));
 const helpers=Object.fromEntries(['bound','classBound','nativeClass','callableClass'].map(n=>[n,modulePath(path.join(compiler,'utils',n+'.ts'))]));
 const sourceError=modulePath(path.join(engine,'src/layaAir/flash/errors/AS3SourceError.ts'));
 const modules=['AS3GeneratedClass','AS3ScriptGlobal','AS3Type','AS3Class','AS3Invocation','AS3LexicalMembers','AS3Property','AS3MethodBinding','AS3Coercion','AS3String','AS3Addition','AS3ArrayCreation','NativeSourceClassLoadingSession'];
 const externalModules=[...Object.values(helpers),sourceError,...modules.map(provider)];
 const options={customVisitors:[],importModules:{'compiler.AS3Class':provider('AS3Class'),'compiler.AS3Invocation':provider('AS3Invocation')},
  decoratorModules:{bound:helpers.bound,classBound:helpers.classBound},nativeClassHelperModules:{nativeClass:helpers.nativeClass,callableClass:helpers.callableClass},
  nativeClassTraitsModule:provider('AS3GeneratedClass'),nativeLexicalMembersModule:provider('AS3LexicalMembers'),nativeGeneratedPropertyModule:provider('AS3Property'),
  nativeCallableMethodBindingModule:provider('AS3MethodBinding'),nativeCallableCoercionModule:provider('AS3Coercion'),nativeCallableStringModule:provider('AS3String'),
  nativeReferenceCoercion:{module:'./unused',coercionModule:provider('AS3Type')},nativeNumericMethodParametersModule:provider('AS3Coercion'),nativeSignaturePropertyModule:provider('AS3Property'),
  nativeComputedTypeTestModule:provider('AS3Type'),nativeDictionaryPropertyModule:provider('AS3Property'),nativeDynamicPropertyWritesModule:provider('AS3Property'),nativeDynamicPropertyReadsModule:provider('AS3Property'),
  nativeSourceErrorModule:sourceError,nativeEnumeration:{dictionaryModule:provider('Dictionary'),coercionModule:provider('AS3Coercion'),stringModule:provider('AS3String')},
  nativeObjectCreationModule:provider('AS3Class'),nativeTypedLocals:true,nativeTypedLocalReferenceModule:provider('AS3Type'),nativeTypedLocalAdditionModule:provider('AS3Addition'),nativeArrayCreationModule:provider('AS3ArrayCreation')};
 return {api,out,provider,modern:ts,engine,options,externalModules,compilerInputs,verifyPins:()=>{for(const item of compilerInputs)assert.equal(hash(fs.readFileSync(item.file)),item.sha256,item.file);}};
}
const browser=await chromium.launch({headless:true});
try {for(const target of ['ES5','ES2015']) {
 const ctx=prepareFixture({target}),{api,out,provider,modern:ts,engine}=ctx;
 const modulePath=file=>{let relative=path.relative(out,file).replaceAll('\\','/').replace(/\.ts$/,'');return relative.startsWith('.')?relative:'./'+relative;};
 const tweenModule=modulePath(path.join(engine,'src/extensions/greensock/FlashTweenRuntime.ts'));
 const sourceFile=path.join(here,'source/CustomEaseSubject.as'),source=fs.readFileSync(sourceFile,'utf8'),sources={CustomEaseSubject:{source,sourceSha256:hash(source)}};
 const curve=fs.readFileSync(path.join(here,'source/com/greensock/easing/CustomEase.as'),'utf8');sources['com.greensock.easing.CustomEase']={source:curve,sourceSha256:hash(curve)};
 const fieldSource=fs.readFileSync(path.join(test,'source/FieldReads.as'),'utf8');assert.equal(hash(fieldSource),fieldReceipt.artifacts['source/FieldReads.as']);sources.FieldReads={source:fieldSource,sourceSha256:hash(fieldSource)};
 const input={scope:'custom-ease',classScriptSources:['com.greensock.easing.CustomEase'],sources,providers:{},tweenHandleProviderModule:tweenModule,providerModule:provider('AS3GeneratedClass'),interfaceProviderModule:provider('AS3Type'),scriptGlobalProviderModule:provider('AS3ScriptGlobal'),scriptDomainProvider:{module:'./cohortDomain',exportName:'scriptDomain'},inheritScriptClasses:true};
 const emit=selectedSources=>{const plan=api.createNativeGeneratedDeclarationPlan({...input,sources:selectedSources});return api.emitNativeSourceClassModule({plan,target,emitterOptions:{...ctx.options,nativeTweenModule:tweenModule,definitionsByNamespace:{'':['CustomEaseSubject','FieldReads'],'com.greensock.easing':['CustomEase']},nativeReferenceCoercion:{...ctx.options.nativeReferenceCoercion,plan},importModules:{...ctx.options.importModules,'migration.FlashTweenRuntime':tweenModule}},externalModules:[...new Set([...ctx.externalModules,tweenModule])],loadingSessionModule:provider('NativeSourceClassLoadingSession')});};
 assert.throws(()=>emit({CustomEaseSubject:sources.CustomEaseSubject}),/Class script selection requires a planned class/);
 const guardResults=[];
 for(const [name,guardSource,extra] of [
  ['local-shadow','package {public class Guard {private var items:Array;public function read(items:Array):uint{return items.length;}}}',{}],
  ['class-shadow','package {public class Guard {private static var items:Array;public function read(Guard:Object):*{return Guard.items.length;}}}',{}],
  ['string-field','package {public class Guard {private var items:String;public function read():uint{return items.length;}}}',{}],
  ['source-array','package {public class Guard {private var items:Array;public function read():uint{return items.length;}}}',{Array:'package {public class Array {public var length:uint;}}'}]
 ]){
  const guardSources=Object.fromEntries(Object.entries({Guard:guardSource,...extra}).map(([q,source])=>[q,{source,sourceSha256:hash(source)}]));
  if(name==='source-array'){assert.throws(()=>api.createNativeGeneratedDeclarationPlan({...input,sources:guardSources,classScriptSources:undefined}),/ambiguous builtin type/);guardResults.push({name,source:guardSource,extra,rejected:true});continue;}
  const plan=api.createNativeGeneratedDeclarationPlan({...input,sources:guardSources,classScriptSources:undefined});
  const artifact=api.emitNativeSourceClassModule({plan,target,emitterOptions:{...ctx.options,definitionsByNamespace:{'':Object.keys(guardSources)},nativeReferenceCoercion:{...ctx.options.nativeReferenceCoercion,plan}},externalModules:ctx.externalModules,loadingSessionModule:provider('NativeSourceClassLoadingSession')});
  assert.ok(artifact.generatedSources.every(item=>!item.source.includes('__as3_generated_storageRead')),name);guardResults.push({name,source:guardSource,extra,artifact});
 }
 const artifact=emit(sources),outputs=[],write=(name,text)=>{const file=path.join(out,name);fs.writeFileSync(file,text);outputs.push({file,sha256:hash(text),source:text});return file;};
 const files=artifact.generatedSources.map(item=>write(item.module.slice(2)+'.ts',item.source));
 write('custom-ease.js',artifact.moduleSource);files.push(write('custom-ease.d.ts',artifact.declarationSource));
 files.push(write('cohortDomain.ts','import {AS3ScriptDomain} from '+JSON.stringify(provider('AS3ScriptGlobal'))+';export declare const scriptDomain:AS3ScriptDomain;'));
 files.push(...['glsl.d.ts','spine.d.ts'].map(file=>path.join(engine,'src/layaAir/tslibs',file)));
 write('field-observer.ts',fs.readFileSync(path.join(test,'field-observer.ts'),'utf8'));
 const driver="import {observe} from './field-observer';\n"+fs.readFileSync(path.join(here,'candidate-driver.ts'),'utf8').replace('return rows;',"return rows.concat(observe(domain.getDefinition('FieldReads')));").replaceAll('@TWEEN@',tweenModule).replaceAll('@SESSION@',provider('NativeSourceClassLoadingSession')).replaceAll('@DOMAIN@',modulePath(path.join(engine,'src/layaAir/flash/system/ApplicationDomain.ts')));
 write('candidate-driver.ts',driver);const entry=write('entry.ts',"import {run} from './candidate-driver';globalThis.completion=run();"),nodeEntry=write('node-entry.ts',"import {run} from './candidate-driver';export const completion=run();");
 files.push(path.join(out,'field-observer.ts'),path.join(out,'candidate-driver.ts'));
 const program=ts.createProgram(files,{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,strict:true,strictNullChecks:false,useUnknownInCatchVariables:false,experimentalDecorators:true,noEmit:true,skipLibCheck:true,resolveJsonModule:true,esModuleInterop:true,lib:['lib.es2020.d.ts','lib.dom.d.ts','lib.dom.iterable.d.ts']});
 const diagnostics=ts.getPreEmitDiagnostics(program).map(d=>({code:d.code,file:d.file?.fileName,message:ts.flattenDiagnosticMessageText(d.messageText,'\n')}));assert.deepEqual(diagnostics,[]);
 const variants=[];
 for(const mutation of [false,'ease','storage']) {
  let replacements=0;
  const plugins=mutation==='storage'?[{name:'raw-storage-reads',setup(b){b.onLoad({filter:/custom-ease\.js$/},args=>{
   const text=fs.readFileSync(args.path,'utf8');let lengths=0,registry=0;
   const changed=text.replace(/AS3Property_\d+\.as3GetProperty\((__as3_generated_lexicalProvider_\d+\.as3GetLexicalMember\([^()]+\)), "length"\)/g,(_,receiver)=>{lengths++;return receiver+'.length';})
    .replace(/(AS3Property_\d+)\.as3GetProperty\((\1\.as3GetProperty\(__as3_generated_lexicalProvider_\d+\.as3GetLexicalMember\([^()]+\), param1\)), "ease"\)/g,(_,provider,receiver)=>{registry++;return receiver+'.ease';});
   assert.equal(lengths,6);assert.equal(registry,1);assert.notEqual(text,changed);replacements++;return {contents:changed,loader:'js'};
  });}}]:mutation?[{name:'ignore-source-ease',setup(b){b.onLoad({filter:/[\\/]greensock[\\/]FlashTweenRuntime\.ts$/},args=>{const text=fs.readFileSync(args.path,'utf8'),changed=text.replace('if (selectedEase) return selectedEase(elapsed, 0, 1, duration);','if (selectedEase) return elapsed * elapsed / (duration * duration);');assert.notEqual(text,changed);replacements++;return {contents:changed,loader:'ts'};});}}]:[];
  const bundled=await build({entryPoints:[entry],bundle:true,write:false,metafile:true,format:'iife',platform:'browser',plugins});
  write(mutation?'browser-'+mutation+'.js':'browser.js',bundled.outputFiles[0].text);
  const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(String(error)));
  await page.route('http://linear.test/**',route=>route.request().url().endsWith('/bundle.js')?route.fulfill({contentType:'text/javascript',body:bundled.outputFiles[0].text}):route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"script-src 'self'"},body:'<!doctype html><body><script src="/bundle.js"></script></body>'}));
  await page.goto('http://linear.test/');const web=await page.evaluate(()=>globalThis.completion);await page.close();assert.deepEqual(errors,[]);
  const nodeFile=path.join(out,mutation?'node-'+mutation+'.cjs':'node.cjs');await build({entryPoints:[nodeEntry],outfile:nodeFile,bundle:true,format:'cjs',platform:'node',plugins});
  const nodeBytes=fs.readFileSync(nodeFile,'utf8');outputs.push({file:nodeFile,sha256:hash(nodeBytes),source:nodeBytes});
  const node=await require(nodeFile).completion;assert.deepEqual(node,web);
  const mismatches=web.flatMap((row,index)=>isDeepStrictEqual(row,expected[index])?[]:[{index,id:row.id,actual:row.value,expected:expected[index].value}]);
  if(mutation){assert.equal(replacements,2);assert.notDeepEqual(web,expected);if(mutation==='storage')assert.deepEqual(mismatches.map(row=>row.id),['destroyed-name','destroyed-bound-call','field-null-size','field-null-explicit-size','field-null-shared','field-null-explicit-shared']);}else assert.deepEqual(web,expected);
  variants.push({mutation,web,node,errors,replacements,mismatches,bundleInputs:Object.keys(bundled.metafile.inputs).map(file=>({file:path.resolve(file),sha256:hash(fs.readFileSync(file))}))});
  if(!mutation&&mismatches.length)break;
 }
 ctx.verifyPins();results.push({target,out,guardResults,diagnostics,variants,outputs,compilerInputs:ctx.compilerInputs,typeInputs:program.getSourceFiles().map(f=>({file:f.fileName,sha256:hash(fs.readFileSync(f.fileName))})),source:{file:sourceFile,sha256:hash(source)}});
 console.log(JSON.stringify({target,rows:expected.length,matches:expected.length-variants[0].mismatches.length,mismatches:variants[0].mismatches,typeErrors:0,realms:2}));
}}finally{await browser.close();}
const passed=results.every(result=>result.variants[0].mismatches.length===0);
for(const result of results)for(const item of [...result.compilerInputs,...result.typeInputs,...result.variants.flatMap(v=>v.bundleInputs)])assert.equal(hash(fs.readFileSync(item.file)),item.sha256,item.file);
assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:engine,encoding:'utf8'}).trim(),pins.engine);
const report={wholeClientQualified:false,status:passed?'passed':'held',nativeRuntimeQualified:passed,pins,results,inputs:['verify.cjs','expected.json','oracle-pin.json','source-library.json','candidate-driver.ts'].map(name=>{const file=path.join(here,name);return{file,sha256:hash(fs.readFileSync(file))};})};
report.fieldInputs=['source/FieldReads.as','source/FieldReadsProbe.as','field-observer.ts','capture/receipt.json'].map(name=>{const file=path.join(test,name);return{file,sha256:hash(fs.readFileSync(file))};});report.runner={file:fileURLToPath(import.meta.url),sha256:hash(fs.readFileSync(fileURLToPath(import.meta.url)))};const destination=path.join(run,'report.json');fs.writeFileSync(destination,JSON.stringify(report,null,2));console.log(JSON.stringify({report:destination,status:report.status}));if(!passed)process.exitCode=1;
