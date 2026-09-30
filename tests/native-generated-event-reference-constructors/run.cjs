const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const api=require('../../lib'),engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2');
const ts=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const compilerGraph=require('node:child_process').execFileSync('git',['ls-files','src','utils','package.json','package-lock.json','tsconfig.json'],{encoding:'utf8'}).trim().split(/\r?\n/).map(file=>({file,sha256:hash(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'))}));
const evidence=path.join(engine,'tests/nativeFlashOracle/generated-event-reference-constructors'),expected=require(path.join(evidence,'verify.cjs'));
const sources={};for(const q of ['eventctors.OptionalEvent','eventctors.RequiredEvent','eventctors.OptionalMouseEvent','eventctors.RequiredMouseEvent','eventctors.DerivedMouse']){const source=fs.readFileSync(path.join(evidence,'source',q.replaceAll('.','/')+'.as'),'utf8');sources[q]={source,sourceSha256:hash(source)};}
const cache=path.resolve('.cache/native-generated-event-reference-constructors');fs.mkdirSync(cache,{recursive:true});const out=fs.mkdtempSync(path.join(cache,'run-'));
async function main(){
 const {createLayaSourceAliasPlugin}=await import(require('node:url').pathToFileURL(path.join(engine,'tests/nativeCanonicalSpriteClass/laya-source-alias.mjs')).href);
 const {chromium}=require(require.resolve('playwright',{paths:[path.resolve('../op2-html5/game-client-laya'),engine]}));
 const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']}),results=[];
 try{for(const target of ['ES5','ES2015']){
  const dir=path.join(out,target);fs.mkdirSync(dir);
  const modulePath=file=>{const r=path.relative(dir,file).replaceAll('\\','/').replace(/\.ts$/,'');return r.startsWith('.')?r:'./'+r;};
  const provider=n=>modulePath(path.join(engine,'src/layaAir/flash/utils',n+'.ts'));
  const helpers=Object.fromEntries(['bound','classBound','nativeClass','callableClass'].map(n=>[n,modulePath(path.resolve('utils',n+'.ts'))]));
  const sourceError=modulePath(path.join(engine,'src/layaAir/flash/errors/AS3SourceError.ts'));
  const modules=['AS3GeneratedClass','AS3ScriptGlobal','AS3Type','AS3Class','AS3Invocation','AS3LexicalMembers','AS3Property','AS3MethodBinding','AS3Coercion','AS3String','AS3Addition','AS3ArrayCreation','AS3Vector','Dictionary','AS3CanonicalEventDispatcherConstruction','AS3CanonicalEventConstruction','NativeSourceClassLoadingSession','AS3XML'];
  const nativeProviders={'flash.events.Event':{module:provider('AS3CanonicalEventConstruction'),exportName:'Event',nativeBase:'Event'},'flash.events.MouseEvent':{module:provider('AS3GeneratedMouseEventConstruction'),exportName:'MouseEvent',nativeBase:'MouseEvent'}};
  modules.push('AS3GeneratedMouseEventConstruction','AS3CanonicalInteractiveReference');
  nativeProviders['flash.display.InteractiveObject']={module:provider('AS3CanonicalInteractiveReference'),exportName:'InteractiveObject'};
  const input={providers:nativeProviders,vectorProviderModule:provider('AS3Vector'),scope:'event-reference-constructors',sources,providerModule:provider('AS3GeneratedClass'),interfaceProviderModule:provider('AS3Type'),scriptGlobalProviderModule:provider('AS3ScriptGlobal'),scriptDomainProvider:{module:'./cohortDomain',exportName:'scriptDomain'},inheritScriptClasses:true};
  const plan=api.createNativeGeneratedDeclarationPlan(input);
  const options={nativeInteractiveObjectReferenceModule:provider('AS3CanonicalInteractiveReference'),customVisitors:[],definitionsByNamespace:{eventctors:['OptionalEvent','RequiredEvent','OptionalMouseEvent','RequiredMouseEvent','DerivedMouse']},nativeVectorTypes:{plan,module:'./__native_declarations'},nativeEnumeration:{dictionaryModule:provider('Dictionary'),coercionModule:provider('AS3Coercion'),stringModule:provider('AS3String')},importModules:{'compiler.AS3Class':provider('AS3Class'),'compiler.AS3Invocation':provider('AS3Invocation')},
   decoratorModules:{bound:helpers.bound,classBound:helpers.classBound},nativeClassHelperModules:{nativeClass:helpers.nativeClass,callableClass:helpers.callableClass},
   nativeClassTraitsModule:provider('AS3GeneratedClass'),nativeLexicalMembersModule:provider('AS3LexicalMembers'),nativeGeneratedPropertyModule:provider('AS3Property'),
   nativeCallableMethodBindingModule:provider('AS3MethodBinding'),nativeCallableCoercionModule:provider('AS3Coercion'),nativeCallableStringModule:provider('AS3String'),
   nativeSourceErrorModule:sourceError,nativeDynamicPropertyReadsModule:provider('AS3Property'),nativeDynamicPropertyWritesModule:provider('AS3Property'),
   nativeComputedTypeTestModule:provider('AS3Type'),nativeDictionaryPropertyModule:provider('AS3Property'),nativeObjectCreationModule:provider('AS3Class'),
   nativeTypedLocals:true,nativeTypedLocalReferenceModule:provider('AS3Type'),nativeTypedLocalAdditionModule:provider('AS3Addition'),nativeArrayCreationModule:provider('AS3ArrayCreation'),
   nativeReferenceCoercion:{plan,module:'./unused',coercionModule:provider('AS3Type')},nativeNumericMethodParametersModule:provider('AS3Coercion'),nativeSignaturePropertyModule:provider('AS3Property')};
  Object.assign(options.importModules,Object.fromEntries(Object.entries(nativeProviders).map(([q,b])=>[q,b.module])));
  const config={plan,target,emitterOptions:options,externalModules:[...new Set([...Object.values(helpers),sourceError,...modules.map(provider),...Object.values(nativeProviders).map(p=>p.module)])],loadingSessionModule:provider('NativeSourceClassLoadingSession')};
  assert.deepEqual(plan.references.filter(r=>r.kind==='unresolved'),[]);
  let guards=0;
  assert.throws(()=>api.emitNativeSourceClassModule({...config,emitterOptions:{...options,nativeReferenceCoercion:undefined}}),/AS3_.*UNSUPPORTED/);guards++;
  assert.throws(()=>api.emitNativeSourceClassModule({...config,plan:{...plan}}),/AS3_.*UNSUPPORTED/);guards++;
  for(const q of ['flash.events.Event','flash.events.MouseEvent'])for(const patch of [{nativeBase:undefined},{exportName:'Wrong'}]){
   assert.throws(()=>{const guardPlan=api.createNativeGeneratedDeclarationPlan({...input,providers:{...nativeProviders,[q]:{...nativeProviders[q],...patch}}});
    api.emitNativeSourceClassModule({...config,plan:guardPlan,emitterOptions:{...options,nativeVectorTypes:{...options.nativeVectorTypes,plan:guardPlan},nativeReferenceCoercion:{...options.nativeReferenceCoercion,plan:guardPlan}}});},/AS3_.*UNSUPPORTED/);guards++;
  }
  for(const q of ['eventctors.OptionalEvent','eventctors.OptionalMouseEvent']){
   const changed=sources[q].source.replace('=null','=1');assert.notEqual(changed,sources[q].source);
   const guardPlan=api.createNativeGeneratedDeclarationPlan({...input,sources:{...sources,[q]:{source:changed,sourceSha256:hash(changed)}}});
   assert.throws(()=>api.emitNativeSourceClassModule({...config,plan:guardPlan,emitterOptions:{...options,nativeVectorTypes:{...options.nativeVectorTypes,plan:guardPlan},nativeReferenceCoercion:{...options.nativeReferenceCoercion,plan:guardPlan}}}),/AS3_.*UNSUPPORTED/);guards++;
  }
  const artifact=api.emitNativeSourceClassModule(config);assert.equal(artifact.generatedSources.length,6);
  const files=[];for(const item of artifact.generatedSources){const file=path.join(dir,item.module+'.ts');fs.writeFileSync(file,item.source);files.push(file);}
  const domain=path.join(dir,'cohortDomain.ts');fs.writeFileSync(domain,'import {AS3ScriptDomain} from '+JSON.stringify(provider('AS3ScriptGlobal'))+';export declare const scriptDomain:AS3ScriptDomain;');files.push(domain);
  fs.writeFileSync(path.join(dir,'subject-factory.js'),artifact.moduleSource);fs.writeFileSync(path.join(dir,'subject-factory.d.ts'),artifact.declarationSource);files.push(path.join(dir,'subject-factory.d.ts'));
  const observer=fs.readFileSync(path.join(__dirname,'observer.ts'),'utf8').replaceAll('@FLASH@',modulePath(path.join(engine,'src/layaAir/flash'))).replaceAll('@ENGINE@',modulePath(engine));
  fs.writeFileSync(path.join(dir,'observer.ts'),observer);files.push(path.join(dir,'observer.ts'));
  files.push(...['glsl.d.ts','spine.d.ts'].map(f=>path.join(engine,'src/layaAir/tslibs',f)));
  const program=ts.createProgram(files,{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,strict:true,strictNullChecks:false,resolveJsonModule:true,esModuleInterop:true,baseUrl:engine,paths:{"@laya/engine/*":["src/layaAir/*"],"@laya/flash/*":["src/layaAir/flash/*"]},useUnknownInCatchVariables:false,experimentalDecorators:true,noEmit:true,skipLibCheck:true,lib:['lib.es2020.d.ts','lib.dom.d.ts','lib.dom.iterable.d.ts']});
  const diagnostics=ts.getPreEmitDiagnostics(program).map(d=>({file:d.file?.fileName,code:d.code,text:ts.flattenDiagnosticMessageText(d.messageText,'\n')}));
  fs.writeFileSync(path.join(dir,'types.json'),JSON.stringify(diagnostics,null,2));assert.deepEqual(diagnostics,[]);
  const entry=path.join(dir,'entry.ts');fs.writeFileSync(entry,"import {run} from './observer';import {nativeSourceClassModule} from './subject-factory.js';globalThis.completion=run(nativeSourceClassModule).then(value=>{globalThis.result=value;});");
  const built=await esbuild.build({entryPoints:[entry],bundle:true,write:false,format:'iife',platform:'browser',target:'es2020',metafile:true,plugins:[createLayaSourceAliasPlugin(engine)],loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'},tsconfigRaw:{compilerOptions:{useDefineForClassFields:false}}});
  const code=built.outputFiles[0].text;fs.writeFileSync(path.join(dir,'bundle.js'),code);
  const execute=async script=>{
   const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
   try{await page.route('http://implicit-native.test/**',route=>route.request().url().endsWith('/bundle.js')?route.fulfill({contentType:'text/javascript',body:script}):route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"script-src 'self'"},body:'<!doctype html><body><script src="/bundle.js"></script></body>'}));
    await page.goto('http://implicit-native.test/');await page.evaluate(()=>globalThis.completion);const result=await page.evaluate(()=>globalThis.result);assert.deepEqual(errors,[]);return result;
   }finally{await page.close();}
  };
  const web=await execute(code),errors=[];assert.deepEqual(web.rows,expected);
  assert.equal(guards,8);assert.equal(web.guards,12);
  results.push({target,web,artifact,diagnostics,errors,guards,providerGraph:Object.keys(built.metafile.inputs).map(file=>({file,sha256:hash(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'))}))});
  console.log(JSON.stringify({target,rows:web.rows.length,errors:errors.length}));
 }}finally{await browser.close();}
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({results,sources,compilerGraph,runnerSha256:hash(fs.readFileSync(__filename,'utf8').replace(/\r\n/g,'\n')),observerSha256:hash(fs.readFileSync(path.join(__dirname,'observer.ts'),'utf8').replace(/\r\n/g,'\n'))},null,2));
 console.log(JSON.stringify({out,status:'passed'}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
