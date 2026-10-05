const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const api=require('../../lib'),engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2');
const ts=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const evidence=path.join(path.resolve(process.env.AIR_EVIDENCE_REPOSITORY||engine),'tests/nativeFlashOracle/source-unit-mouse-retry'),air=require(path.join(evidence,'verify.cjs'));
const expected=air;
const compilerInputs=['src','lib','utils'].flatMap(dir=>fs.readdirSync(path.resolve(dir),{recursive:true}).filter(f=>/\.(ts|js)$/.test(f)).map(f=>{const file=path.resolve(dir,f);return {file,sha256:hash(fs.readFileSync(file))};}));
const cache=path.resolve('.cache/native-generated-source-unit-mouse-retry');fs.mkdirSync(cache,{recursive:true});
const out=fs.mkdtempSync(path.join(cache,'run-'));
const read=(folder,names)=>Object.fromEntries(names.map(q=>{const source=fs.readFileSync(path.join(evidence,folder,q.replaceAll('.','/')+'.as'),'utf8');return [q,{source,sourceSha256:hash(source)}];}));
const cohorts={parent:read('source',['unitretry.Trace','unitretry.OwnerRetry','unitretry.HelperRetry','unitretry.LateOwnerRetry','unitretry.LateHelperRetry'])};
async function main(){
 const {chromium}=require(require.resolve('playwright',{paths:[path.resolve('../op2-html5/game-client-laya'),engine]}));
 const browser=await chromium.launch({headless:true}),results=[];
 try{for(const target of ['ES5','ES2015']){
  const dir=path.join(out,target);fs.mkdirSync(dir);
  const modulePath=file=>{const r=path.relative(dir,file).replaceAll('\\','/').replace(/\.ts$/,'');return r.startsWith('.')?r:'./'+r;};
  const artifacts={},typechecks=[];let rejectionGuards=0;
  for(const [cohort,sources]of Object.entries(cohorts)){
  const dir=path.join(out,target,cohort);fs.mkdirSync(dir);
  const modulePath=file=>{const r=path.relative(dir,file).replaceAll('\\','/').replace(/\.ts$/,'');return r.startsWith('.')?r:'./'+r;};
  const provider=n=>modulePath(path.join(engine,'src/layaAir/flash/utils',n+'.ts'));
  const helpers=Object.fromEntries(['bound','classBound','nativeClass','callableClass'].map(n=>[n,modulePath(path.resolve('utils',n+'.ts'))]));
  const sourceError=modulePath(path.join(engine,'src/layaAir/flash/errors/AS3SourceError.ts'));
  const modules=['AS3CanonicalDisplayReference','AS3CanonicalEventConstruction','AS3CanonicalErrorConstruction','AS3CanonicalXMLReference','AS3XML','AS3ReflectionQuery','describeType','AS3Vector','AS3StringIntrinsics','Dictionary','AS3GeneratedClass','AS3ScriptGlobal','AS3Type','AS3Class','AS3Invocation','AS3LexicalMembers','AS3Property','AS3MethodBinding','AS3Coercion','AS3String','AS3Addition','AS3ArrayCreation','NativeSourceClassLoadingSession'];
  const externalModules=[...Object.values(helpers),sourceError,...modules.map(provider)];
   const nativeProviders={'flash.events.MouseEvent':{module:provider('AS3GeneratedMouseEventConstruction'),exportName:'MouseEvent',nativeBase:'MouseEvent'},'flash.display.InteractiveObject':{module:provider('AS3CanonicalInteractiveReference'),exportName:'InteractiveObject'}};
   const trace=modulePath(path.join(engine,'src/layaAir/flash/debug/trace.ts'));externalModules.push(trace,...Object.values(nativeProviders).map(p=>p.module));
   const input={scope:'class-script-retry-'+cohort,sources,providers:nativeProviders,vectorProviderModule:provider('AS3Vector'),patternProviderModule:provider('AS3StringIntrinsics'),providerModule:provider('AS3GeneratedClass'),interfaceProviderModule:provider('AS3Type'),scriptGlobalProviderModule:provider('AS3ScriptGlobal'),scriptDomainProvider:{module:'./cohortDomain',exportName:'scriptDomain'},inheritScriptClasses:true,...(process.argv.includes('--internal')?{lexicalProviderModule:provider('AS3LexicalMembers')}:{ }),classScriptSources:Object.keys(sources)};

   const plan=api.createNativeGeneratedDeclarationPlan(input);
   const definitionsByNamespace={};for(const q of Object.keys(sources)){const parts=q.split('.'),n=parts.pop();(definitionsByNamespace[parts.join('.')]??=[]).push(n);}
   const options={nativeInteractiveObjectReferenceModule:provider('AS3CanonicalInteractiveReference'),customVisitors:[],definitionsByNamespace,nativeGlobalModules:{trace},nativeVectorTypes:{plan,module:'./__native_declarations'},nativeStringIntrinsicsModule:provider('AS3StringIntrinsics'),nativeStringLocalCoercionModule:provider('AS3String'),nativeEnumeration:{dictionaryModule:provider('Dictionary'),coercionModule:provider('AS3Coercion'),stringModule:provider('AS3String')},importModules:{...Object.fromEntries(Object.entries(nativeProviders).map(([q,p])=>[q,p.module])),'flash.utils.describeType':provider('describeType'),'compiler.AS3Class':provider('AS3Class'),'compiler.AS3Invocation':provider('AS3Invocation')},
    decoratorModules:{bound:helpers.bound,classBound:helpers.classBound},nativeClassHelperModules:{nativeClass:helpers.nativeClass,callableClass:helpers.callableClass},
    nativeClassTraitsModule:provider('AS3GeneratedClass'),nativeLexicalMembersModule:provider('AS3LexicalMembers'),nativeGeneratedPropertyModule:provider('AS3Property'),
    nativeCallableMethodBindingModule:provider('AS3MethodBinding'),nativeCallableCoercionModule:provider('AS3Coercion'),nativeCallableStringModule:provider('AS3String'),
    nativeSourceErrorModule:sourceError,nativeDynamicPropertyReadsModule:provider('AS3Property'),nativeDynamicPropertyWritesModule:provider('AS3Property'),
    nativeComputedTypeTestModule:provider('AS3Type'),nativeDictionaryPropertyModule:provider('AS3Property'),nativeObjectCreationModule:provider('AS3Class'),
    nativeTypedLocals:true,nativeTypedLocalReferenceModule:provider('AS3Type'),nativeTypedLocalAdditionModule:provider('AS3Addition'),nativeArrayCreationModule:provider('AS3ArrayCreation'),
    nativeReferenceCoercion:{plan,module:'./unused',coercionModule:provider('AS3Type')},nativeNumericMethodParametersModule:provider('AS3Coercion'),nativeSignaturePropertyModule:provider('AS3Property')};
   const config={plan,target,emitterOptions:options,externalModules:[...new Set(externalModules)],loadingSessionModule:provider('NativeSourceClassLoadingSession')};
   const emitPlan=p=>api.emitNativeSourceClassModule({...config,plan:p,emitterOptions:{...options,nativeVectorTypes:{...options.nativeVectorTypes,plan:p},nativeReferenceCoercion:{...options.nativeReferenceCoercion,plan:p}}});
   for(const change of [{classScriptSources:['unitretry.Missing']},{scriptGlobalProviderModule:undefined}]){
    assert.throws(()=>api.createNativeGeneratedDeclarationPlan({...input,...change}),/AS3_GENERATED_DECLARATIONS_UNSUPPORTED/);rejectionGuards++;
   }
   const oldPlan=api.createNativeGeneratedDeclarationPlan({...input,classScriptSources:undefined});
   assert.throws(()=>emitPlan(oldPlan),/script global with static initializer requires retry identity authority/);rejectionGuards++;
   for(const source of [sources['unitretry.OwnerRetry'].source+'\nclass Extra {}',sources['unitretry.OwnerRetry'].source.replace('class LocalHelper extends MouseEvent {','class LocalHelper extends Trace {'),sources['unitretry.OwnerRetry'].source+'\ninterface Extra {}']){
    assert.throws(()=>api.createNativeGeneratedDeclarationPlan({...input,sources:{...sources,'unitretry.OwnerRetry':{source,sourceSha256:hash(source)}}}),/multi-declaration Class script retry .*requires qualification/);rejectionGuards++;
   }
   for(const patch of [{nativeBase:undefined},{exportName:'Event'}]){
    assert.throws(()=>api.createNativeGeneratedDeclarationPlan({...input,providers:{...nativeProviders,'flash.events.MouseEvent':{...nativeProviders['flash.events.MouseEvent'],...patch}}}),/AS3_.*UNSUPPORTED/);rejectionGuards++;
   }
   assert.throws(()=>api.emitNativeSourceClassModule({...config,externalModules:config.externalModules.filter(m=>m!==provider('AS3GeneratedMouseEventConstruction'))}),/AS3_.*UNSUPPORTED/);rejectionGuards++;
   const artifact=api.emitNativeSourceClassModule(config);assert.deepEqual(artifact,api.emitNativeSourceClassModule(config));artifacts[cohort]=artifact;
   assert.equal(artifact.generatedSources.length,Object.keys(sources).length+plan.privateBindings.length+1);
   const files=[];
   for(const item of artifact.generatedSources){const file=path.join(dir,item.module+'.ts');fs.writeFileSync(file,item.source);files.push(file);}
   const domain=path.join(dir,'cohortDomain.ts');fs.writeFileSync(domain,'import {AS3ScriptDomain} from '+JSON.stringify(provider('AS3ScriptGlobal'))+';export declare const scriptDomain:AS3ScriptDomain;');files.push(domain);
   fs.writeFileSync(path.join(dir,cohort+'-factory.js'),artifact.moduleSource);
   const declaration=path.join(dir,cohort+'-factory.d.ts');fs.writeFileSync(declaration,artifact.declarationSource);files.push(declaration);
   files.push(...['glsl.d.ts','spine.d.ts'].map(f=>path.join(engine,'src/layaAir/tslibs',f)));
   const program=ts.createProgram(files,{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,strict:true,strictNullChecks:false,useUnknownInCatchVariables:false,experimentalDecorators:true,noEmit:true,skipLibCheck:true,lib:['lib.es2020.d.ts','lib.dom.d.ts','lib.dom.iterable.d.ts']});
   const diagnostics=ts.getPreEmitDiagnostics(program).map(d=>({file:d.file?.fileName,code:d.code,text:ts.flattenDiagnosticMessageText(d.messageText,'\n')}));
   fs.writeFileSync(path.join(dir,cohort+'-types.json'),JSON.stringify(diagnostics,null,2));assert.deepEqual(diagnostics,[]);
   typechecks.push({cohort,diagnostics,inputs:program.getSourceFiles().map(f=>({file:f.fileName,sha256:hash(fs.readFileSync(f.fileName))}))});
  }
  const observer=fs.readFileSync(path.join(__dirname,'observer.ts'),'utf8').replaceAll('@FLASH@',modulePath(path.join(engine,'src/layaAir/flash'))).replaceAll('@ENGINE@',modulePath(engine));
  fs.writeFileSync(path.join(dir,'observer.ts'),observer);
  const entry=path.join(dir,'entry.ts');fs.writeFileSync(entry,"import {run} from './observer';import {nativeSourceClassModule as parent} from './parent/parent-factory.js';globalThis.completion=run(parent).then(value=>{globalThis.result=value;});");
  const build=(overrides={})=>esbuild.build({plugins:[{name:'applied-control',setup(build){build.onLoad({filter:/\.(ts|js)$/},args=>overrides[args.path]===undefined?undefined:{contents:overrides[args.path],loader:args.path.endsWith('.ts')?'ts':'js'});}}],entryPoints:[entry],bundle:true,write:false,format:'iife',platform:'browser',target:'es2020',metafile:true,loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'}});
  const built=await build();
  const code=built.outputFiles[0].text;fs.writeFileSync(path.join(dir,'bundle.js'),code);
  const vm=require('node:vm');const execute=async code=>{const context=vm.createContext({console,setTimeout,clearTimeout,AbortController,AbortSignal,DOMException,performance});context.window=context;context.document={};new vm.Script(code).runInContext(context);await context.completion;return JSON.parse(JSON.stringify(context.result));};
  const node=await execute(code);assert.deepEqual(node.rows,expected);
  const executeWeb=async code=>{const page=await browser.newPage();try{
   await page.route('http://loaded-generated.test/**',route=>route.request().url().endsWith('/bundle.js')?route.fulfill({contentType:'text/javascript',body:code}):route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"script-src 'self'"},body:'<!doctype html><body><script src="/bundle.js"></script></body>'}));
   await page.goto('http://loaded-generated.test/');return await page.evaluate(async()=>{try{await globalThis.completion;return {value:JSON.parse(JSON.stringify(globalThis.result))};}catch(error){return {error:String(error)};}});
  }finally{await page.close();}};
  const webOutcome=await executeWeb(code);assert.deepEqual(webOutcome,{value:node});const web=webOutcome.value;
  const helperFile=path.resolve('utils/nativeClass.ts'),engineFile=path.join(engine,'src/layaAir/flash/utils/AS3ScriptGlobal.ts'),factoryFile=path.join(dir,'parent/parent-factory.js');
  const controls=[
   {name:'forget-early-helper-lookup',file:helperFile,from:'unit.helperLookups.set(index,value)',to:'void 0'},
   {name:'discard-failed-source-global',file:engineFile,from:'classScript && factoryThrew && !invalidPublication',to:'classScript && !sourceClasses && factoryThrew && !invalidPublication'},
   {name:'erase-Function-parameter-intrinsic',file:factoryFile,from:'AS3Property_1.as3CallNamedProperty(fn,',to:'(function(f){return f.call(null);})(fn,'},
   {name:'change-native-mouse-localX',file:path.join(engine,'src/layaAir/flash/utils/AS3GeneratedMouseEventConstruction.ts'),from:'initializeFlashMouseEventStorage(receiver, localX, localY, related,',to:'initializeFlashMouseEventStorage(receiver, localX+1, localY, related,'}
  ],mutations=[];
  for(const control of controls){
   const original=fs.readFileSync(control.file,'utf8');assert.equal(original.split(control.from).length-1,1,control.name);
   const changed=await build({[control.file]:original.replace(control.from,control.to)}),changedCode=changed.outputFiles[0].text;
   fs.writeFileSync(path.join(dir,control.name+'.js'),changedCode);
   let outcome;try{outcome={value:await execute(changedCode)};}catch(error){outcome={error:String(error)};}
   const webChanged=await executeWeb(changedCode);assert.deepEqual(webChanged,outcome);
   if(control.name==='discard-failed-source-global')assert.match(outcome.error,/failed source function creation context/);
   else{assert.equal(outcome.error,undefined);assert.notDeepEqual(outcome.value.rows,expected);}
   mutations.push({name:control.name,node:outcome,web:webChanged,bundleSha256:hash(changedCode)});
  }
  results.push({target,node,web,typechecks,artifacts,rejectionGuards,mutations,inputs:Object.keys(built.metafile.inputs).map(file=>({file,sha256:hash(fs.readFileSync(file))}))});
  console.log(JSON.stringify({target,observations:node.rows.length,typeErrors:0,rejectionGuards,domainChecks:node.domainChecks.length,mutations:mutations.length}));
 }}finally{await browser.close();}
 for(const item of compilerInputs)assert.equal(hash(fs.readFileSync(item.file)),item.sha256,item.file);
 for(const result of results)for(const item of [...result.inputs,...result.typechecks.flatMap(check=>check.inputs)])assert.equal(hash(fs.readFileSync(item.file)),item.sha256,item.file);
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({results,cohorts,compilerInputs,runnerSha256:hash(fs.readFileSync(__filename)),observerSha256:hash(fs.readFileSync(path.join(__dirname,'observer.ts'))),engine,evidence,receiptSha256:hash(fs.readFileSync(path.join(evidence,'capture-qualified/receipt.json'))),held:['ContainerController integration','Full startup and game account flow']},null,2));
 console.log(JSON.stringify({out,status:'passed',observations:expected.length,targets:2,realms:2}));
}
main().catch(error=>{fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({message:error.message,stack:String(error.stack),compilerInputs,runnerSha256:hash(fs.readFileSync(__filename)),cohorts,engine,evidence},null,2));console.error(error);console.log(JSON.stringify({out}));process.exitCode=1;});
