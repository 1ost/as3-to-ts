const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const api=require('../../lib'),engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2');
const ts=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const evidence=__dirname,expected=require(path.join(evidence,'verify.cjs'));
const cache=path.resolve('.cache/native-generated-delayed-params');fs.mkdirSync(cache,{recursive:true});
const out=fs.mkdtempSync(path.join(cache,'run-'));
const read=(folder,names)=>Object.fromEntries(names.map(q=>{const source=fs.readFileSync(path.join(evidence,folder,q.replaceAll('.','/')+'.as'),'utf8');return [q,{source,sourceSha256:hash(source)}];}));
const cohorts={subject:read('source',['DelayedParamsSubject'])};
async function main(){
 const {chromium}=require(require.resolve('playwright',{paths:[path.resolve('../op2-html5/game-client-laya'),engine]}));
 const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']}),results=[];
 try{for(const target of ['ES5','ES2015']){
  const dir=path.join(out,target);fs.mkdirSync(dir);
  const modulePath=file=>{const r=path.relative(dir,file).replaceAll('\\','/').replace(/\.ts$/,'');return r.startsWith('.')?r:'./'+r;};
  const artifacts={},typechecks=[];
  for(const [cohort,sources]of Object.entries(cohorts)){
  const dir=path.join(out,target,cohort);fs.mkdirSync(dir);
  const modulePath=file=>{const r=path.relative(dir,file).replaceAll('\\','/').replace(/\.ts$/,'');return r.startsWith('.')?r:'./'+r;};
  const provider=n=>modulePath(path.join(engine,'src/layaAir/flash/utils',n+'.ts'));
  const helpers=Object.fromEntries(['bound','classBound','nativeClass','callableClass'].map(n=>[n,modulePath(path.resolve('utils',n+'.ts'))]));
  const sourceError=modulePath(path.join(engine,'src/layaAir/flash/errors/AS3SourceError.ts'));
  const modules=['AS3StringIntrinsics','AS3GeneratedClass','AS3ScriptGlobal','AS3Type','AS3Class','AS3Invocation','AS3LexicalMembers','AS3Property','AS3MethodBinding','AS3Coercion','AS3String','AS3Addition','AS3ArrayCreation','AS3Vector','Dictionary','AS3CanonicalErrorConstruction','NativeSourceClassLoadingSession'];
  const tweenModule=modulePath(path.join(engine,'src/extensions/greensock/FlashTweenRuntime.ts'));
  const externalModules=[tweenModule,...Object.values(helpers),sourceError,...modules.map(provider)];
   const nativeProviders={Error:{module:provider('AS3CanonicalErrorConstruction'),exportName:'Error',nativeBase:'Error'}};
   const input={classScriptSources:['DelayedParamsSubject'],tweenHandleProviderModule:tweenModule,providers:nativeProviders,vectorProviderModule:provider('AS3Vector'),scope:'delayed-call-'+cohort,sources,providerModule:provider('AS3GeneratedClass'),interfaceProviderModule:provider('AS3Type'),scriptGlobalProviderModule:provider('AS3ScriptGlobal'),scriptDomainProvider:{module:'./cohortDomain',exportName:'scriptDomain'},inheritScriptClasses:true};
   const plan=api.createNativeGeneratedDeclarationPlan(input);
   const definitionsByNamespace={};for(const q of [...Object.keys(sources),...Object.keys(nativeProviders)]){const parts=q.split('.'),n=parts.pop();(definitionsByNamespace[parts.join('.')]??=[]).push(n);}
   const options={nativeTweenModule:tweenModule,nativeStringIntrinsicsModule:provider("AS3StringIntrinsics"),customVisitors:[],definitionsByNamespace,nativeVectorTypes:{plan,module:'./__native_declarations'},nativeEnumeration:{dictionaryModule:provider('Dictionary'),coercionModule:provider('AS3Coercion'),stringModule:provider('AS3String')},importModules:{Error:provider('AS3CanonicalErrorConstruction'),'compiler.AS3Class':provider('AS3Class'),'compiler.AS3Invocation':provider('AS3Invocation')},
    decoratorModules:{bound:helpers.bound,classBound:helpers.classBound},nativeClassHelperModules:{nativeClass:helpers.nativeClass,callableClass:helpers.callableClass},
    nativeClassTraitsModule:provider('AS3GeneratedClass'),nativeLexicalMembersModule:provider('AS3LexicalMembers'),nativeGeneratedPropertyModule:provider('AS3Property'),
    nativeCallableMethodBindingModule:provider('AS3MethodBinding'),nativeCallableCoercionModule:provider('AS3Coercion'),nativeCallableStringModule:provider('AS3String'),
    nativeSourceErrorModule:sourceError,nativeDynamicPropertyReadsModule:provider('AS3Property'),nativeDynamicPropertyWritesModule:provider('AS3Property'),
    nativeComputedTypeTestModule:provider('AS3Type'),nativeDictionaryPropertyModule:provider('AS3Property'),nativeObjectCreationModule:provider('AS3Class'),
    nativeTypedLocals:true,nativeTypedLocalReferenceModule:provider('AS3Type'),nativeTypedLocalAdditionModule:provider('AS3Addition'),nativeArrayCreationModule:provider('AS3ArrayCreation'),
    nativeReferenceCoercion:{plan,module:'./unused',coercionModule:provider('AS3Type')},nativeNumericMethodParametersModule:provider('AS3Coercion'),nativeSignaturePropertyModule:provider('AS3Property')};
   const config={plan,target,emitterOptions:options,externalModules,loadingSessionModule:provider('NativeSourceClassLoadingSession')};
   assert.deepEqual(plan.references.filter(r=>r.kind==='unresolved'),[]);

   const guards=require('./guards.cjs')();
   const artifact=api.emitNativeSourceClassModule(config);assert.deepEqual(artifact,api.emitNativeSourceClassModule(config));artifacts[cohort]=artifact;
   assert.equal(artifact.generatedSources.length,Object.keys(sources).length+1);
   const files=[];
   for(const item of artifact.generatedSources){const file=path.join(dir,item.module+'.ts');fs.writeFileSync(file,item.source);files.push(file);}
   const domain=path.join(dir,'cohortDomain.ts');fs.writeFileSync(domain,'import {AS3ScriptDomain} from '+JSON.stringify(provider('AS3ScriptGlobal'))+';export declare const scriptDomain:AS3ScriptDomain;');files.push(domain);
   fs.writeFileSync(path.join(dir,cohort+'-factory.js'),artifact.moduleSource);
   const declaration=path.join(dir,cohort+'-factory.d.ts');fs.writeFileSync(declaration,artifact.declarationSource);files.push(declaration);
   files.push(...['glsl.d.ts','spine.d.ts'].map(f=>path.join(engine,'src/layaAir/tslibs',f)));
   const program=ts.createProgram(files,{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,strict:true,strictNullChecks:false,useUnknownInCatchVariables:false,experimentalDecorators:true,noEmit:true,skipLibCheck:true,resolveJsonModule:true,esModuleInterop:true,lib:['lib.es2020.d.ts','lib.dom.d.ts','lib.dom.iterable.d.ts']});
   const diagnostics=ts.getPreEmitDiagnostics(program).map(d=>({file:d.file?.fileName,code:d.code,text:ts.flattenDiagnosticMessageText(d.messageText,'\n')}));
   fs.writeFileSync(path.join(dir,cohort+'-types.json'),JSON.stringify(diagnostics,null,2));assert.deepEqual(diagnostics,[]);
   typechecks.push({cohort,guards,diagnostics,inputs:program.getSourceFiles().map(f=>({file:f.fileName,sha256:hash(fs.readFileSync(f.fileName))}))});
  }
  const observer=fs.readFileSync(path.join(__dirname,'observer.ts'),'utf8').replaceAll('@FLASH@',modulePath(path.join(engine,'src/layaAir/flash'))).replaceAll('@ENGINE@',modulePath(engine));
  fs.writeFileSync(path.join(dir,'observer.ts'),observer);
  const entry=path.join(dir,'entry.ts');fs.writeFileSync(entry,"import {run} from './observer';import {nativeSourceClassModule as subject} from './subject/subject-factory.js';globalThis.completion=(async()=>{globalThis.result=await run(subject);globalThis.controls=[];for(const mode of ['zero-delay','ignore-cancellation','copy-params','erase-params'])globalThis.controls.push({mode,result:await run(subject,mode)});})();");

  const built=await esbuild.build({entryPoints:[entry],bundle:true,write:false,format:'iife',platform:'browser',target:'es2020',metafile:true,loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'}});
  const code=built.outputFiles[0].text;fs.writeFileSync(path.join(dir,'bundle.js'),code);
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('http://loaded-generated.test/**',route=>route.request().url().endsWith('/bundle.js')?route.fulfill({contentType:'text/javascript',body:code}):route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"script-src 'self'"},body:'<!doctype html><body><script src="/bundle.js"></script></body>'}));
  await page.goto('http://loaded-generated.test/');await page.evaluate(()=>globalThis.completion);const web=await page.evaluate(()=>globalThis.result);const webControls=await page.evaluate(()=>globalThis.controls);await page.close();assert.deepEqual(errors,[]);assert.deepEqual(web.rows,expected);
  const nodeEntry=path.join(dir,'node-entry.ts');fs.writeFileSync(nodeEntry,"import {run} from './observer';import {nativeSourceClassModule as subject} from './subject/subject-factory.js';export const completion=(async()=>{const result=await run(subject),controls=[];for(const mode of ['zero-delay','ignore-cancellation','copy-params','erase-params'])controls.push({mode,result:await run(subject,mode)});return {result,controls};})();");
  await esbuild.build({entryPoints:[nodeEntry],outfile:path.join(dir,'node.cjs'),bundle:true,format:'cjs',platform:'node',target:'es2020',loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'}});
  const execution=await require(path.join(dir,'node.cjs')).completion,node=execution.result;assert.deepEqual(node,web);assert.deepEqual(execution.controls,webControls);
  for(const control of webControls)assert.notDeepEqual(control.result.rows,expected,control.mode);
  const mutations=webControls.length;
  results.push({target,web,node,typechecks,artifacts,rejectionGuards:15,mutations,controls:webControls,bundleInputs:Object.keys(built.metafile.inputs).map(file=>({file:path.resolve(file),sha256:hash(fs.readFileSync(file))}))});
  console.log(JSON.stringify({target,observations:web.rows.length,typeErrors:0}));
 }}finally{await browser.close();}
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({results,cohorts,dependencyPins:['package.json','package-lock.json','node_modules/gsap/package.json'].map(name=>{const file=path.join(engine,'src/extensions/greensock',name);return {file,sha256:hash(fs.readFileSync(file))};}),compilerInputs:fs.readdirSync('src',{recursive:true}).filter(f=>f.endsWith('.ts')).map(file=>({file:'src/'+file.replaceAll('\\','/'),sha256:hash(fs.readFileSync(path.join('src',file),'utf8').replace(/\r\n/g,'\n'))})),guardsSha256:hash(fs.readFileSync(path.join(__dirname,"guards.cjs"))),runnerSha256:hash(fs.readFileSync(__filename)),observerSha256:hash(fs.readFileSync(path.join(__dirname,'observer.ts')))},null,2));
 console.log(JSON.stringify({out,status:'passed',observations:expected.length,targets:2}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
