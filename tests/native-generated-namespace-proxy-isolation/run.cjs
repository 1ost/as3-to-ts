const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const api=require('../../lib'),engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2-namespace-traits-review');
const ts=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const engineCommit='a95bd3034b5a57493366d845b582204f1449300f',evidencePath='tests/nativeFlashOracle/namespaced-constructor-initializer/';
const frozen=file=>require('child_process').execFileSync('git',['show',engineCommit+':'+evidencePath+file],{cwd:engine,maxBuffer:16*1024*1024});
const receipt=JSON.parse(frozen('evidence/receipt.json'));assert.equal(receipt.status,'passed');assert.equal(receipt.capture.identical,true);assert.equal(receipt.capture.observationCount,20);
const captures=[1,2].map(n=>{const file='run-'+n+'/capture.json',bytes=frozen('evidence/'+file);assert.equal(hash(bytes),receipt.artifacts[file]);return JSON.parse(bytes);});assert.deepEqual(captures[0],captures[1]);const expected=captures[0].state.observations;assert.equal(expected.length,20);
const compilerInputs=fs.readdirSync(path.resolve('src'),{recursive:true}).filter(f=>f.endsWith('.ts')).map(f=>{const file=path.resolve('src',f);return {file,sha256:hash(fs.readFileSync(file))};});
const cache=path.resolve('.cache/native-generated-namespace-proxy-isolation');fs.mkdirSync(cache,{recursive:true});
const out=fs.mkdtempSync(path.join(cache,'run-'));
const read=(folder,names)=>Object.fromEntries(names.map(q=>{const file=folder+'/'+q.replaceAll('.','/')+'.as',bytes=frozen(file);assert.equal(hash(bytes),receipt.artifacts[file.replace(/^evidence\//,'')]);const source=bytes.toString('utf8');return [q,{source,sourceSha256:hash(source)}];}));
const cohorts={parent:read('evidence/source',['retrycases.Trace','retrycases.Retry','retrycases.Scratch','retrycases.scratch_ns'])};
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
  const modules=['AS3CanonicalDisplayReference','AS3CanonicalEventConstruction','AS3CanonicalErrorConstruction','AS3CanonicalXMLReference','AS3XML','AS3ReflectionQuery','describeType','AS3Vector','AS3StringIntrinsics','Dictionary','AS3SourceNamespace','AS3GeneratedClass','AS3ScriptGlobal','AS3Type','AS3Class','AS3Invocation','AS3LexicalMembers','AS3Property','AS3MethodBinding','AS3Coercion','AS3String','AS3Addition','AS3ArrayCreation','NativeSourceClassLoadingSession'];
  const externalModules=[...Object.values(helpers),sourceError,...modules.map(provider)];
   const nativeProviders={'flash.utils.Proxy':{module:provider('AS3CanonicalProxyConstruction'),exportName:'Proxy',nativeBase:'Proxy'}};
   const trace=modulePath(path.join(engine,'src/layaAir/flash/debug/trace.ts'));externalModules.push(trace,...Object.values(nativeProviders).map(p=>p.module));
   const input={scope:'class-script-retry-'+cohort,sources,providers:nativeProviders,vectorProviderModule:provider('AS3Vector'),patternProviderModule:provider('AS3StringIntrinsics'),providerModule:provider('AS3GeneratedClass'),interfaceProviderModule:provider('AS3Type'),scriptGlobalProviderModule:provider('AS3ScriptGlobal'),scriptDomainProvider:{module:'./cohortDomain',exportName:'scriptDomain'},inheritScriptClasses:true,...(process.argv.includes('--internal')?{lexicalProviderModule:provider('AS3LexicalMembers')}:{ }),classScriptSources:Object.keys(sources).filter(q=>!q.endsWith('.scratch_ns'))};

   const plan=api.createNativeGeneratedDeclarationPlan(input);
   const definitionsByNamespace={};for(const q of Object.keys(sources)){const parts=q.split('.'),n=parts.pop();(definitionsByNamespace[parts.join('.')]??=[]).push(n);}
   const options={customVisitors:[],definitionsByNamespace,nativeGlobalModules:{trace},nativeVectorTypes:{plan,module:'./__native_declarations'},nativeStringIntrinsicsModule:provider('AS3StringIntrinsics'),nativeStringLocalCoercionModule:provider('AS3String'),nativeEnumeration:{dictionaryModule:provider('Dictionary'),coercionModule:provider('AS3Coercion'),stringModule:provider('AS3String')},importModules:{...Object.fromEntries(Object.entries(nativeProviders).map(([q,p])=>[q,p.module])),'flash.utils.describeType':provider('describeType'),'compiler.AS3Class':provider('AS3Class'),'compiler.AS3Invocation':provider('AS3Invocation')},
    decoratorModules:{bound:helpers.bound,classBound:helpers.classBound},nativeClassHelperModules:{nativeClass:helpers.nativeClass,callableClass:helpers.callableClass},
    nativeClassTraitsModule:provider('AS3GeneratedClass'),nativeLexicalMembersModule:provider('AS3LexicalMembers'),nativeGeneratedPropertyModule:provider('AS3Property'),
    nativeCallableMethodBindingModule:provider('AS3MethodBinding'),nativeCallableCoercionModule:provider('AS3Coercion'),nativeCallableStringModule:provider('AS3String'),
    nativeSourceErrorModule:sourceError,nativeDynamicPropertyReadsModule:provider('AS3Property'),nativeDynamicPropertyWritesModule:provider('AS3Property'),
    nativeComputedTypeTestModule:provider('AS3Type'),nativeDictionaryPropertyModule:provider('AS3Property'),nativeObjectCreationModule:provider('AS3Class'),
    nativeTypedLocals:true,nativeTypedLocalReferenceModule:provider('AS3Type'),nativeTypedLocalAdditionModule:provider('AS3Addition'),nativeArrayCreationModule:provider('AS3ArrayCreation'),
    nativeReferenceCoercion:{plan,module:'./unused',coercionModule:provider('AS3Type')},nativeNumericMethodParametersModule:provider('AS3Coercion'),nativeSignaturePropertyModule:provider('AS3Property')};
   const config={plan,target,emitterOptions:options,externalModules:[...new Set(externalModules)],loadingSessionModule:provider('NativeSourceClassLoadingSession'),sourceNamespaceProviderModule:provider('AS3SourceNamespace')};
   const emitPlan=p=>api.emitNativeSourceClassModule({...config,plan:p,emitterOptions:{...options,nativeVectorTypes:{...options.nativeVectorTypes,plan:p},nativeReferenceCoercion:{...options.nativeReferenceCoercion,plan:p}}});
   for(const change of [
    {classScriptSources:[]},{classScriptSources:['retrycases.Retry','retrycases.Retry']},
    {classScriptSources:['retrycases.Missing']},{classScriptSources:['retrycases.scratch_ns']},{scriptDomainProvider:undefined,inheritScriptClasses:undefined},
    {scriptGlobalProviderModule:undefined},{scriptGlobalSources:['retrycases.Trace'],inheritScriptClasses:undefined},
    {lexicalProviderModule:provider('AS3LexicalMembers'),inheritScriptClasses:undefined}
   ]){assert.throws(()=>api.createNativeGeneratedDeclarationPlan({...input,...change}),/AS3_GENERATED_DECLARATIONS_UNSUPPORTED/);rejectionGuards++;}
   const oldPlan=api.createNativeGeneratedDeclarationPlan({...input,classScriptSources:undefined});
   assert.throws(()=>emitPlan(oldPlan),/script global with static initializer requires retry identity authority/);rejectionGuards++;
   const parentSource='package retrycases {public class Parent extends MissingRoot {}}',childSource=sources['retrycases.Retry'].source.replace('class Retry {','class Retry extends Parent {');
   assert.throws(()=>api.createNativeGeneratedDeclarationPlan({...input,sources:{...sources,'retrycases.Parent':{source:parentSource,sourceSha256:hash(parentSource)},'retrycases.Retry':{source:childSource,sourceSha256:hash(childSource)}}}),/non-retrying source root parent|base requires a planned source declaration/);rejectionGuards++;
   const bodySource=sources['retrycases.Retry'].source.replace('class Retry {','class Retry { initial=[];');
   const bodyPlan=api.createNativeGeneratedDeclarationPlan({...input,sources:{...sources,'retrycases.Retry':{source:bodySource,sourceSha256:hash(bodySource)}}});
   assert.throws(()=>emitPlan(bodyPlan),/script global with class-body initializer requires retry identity authority/);rejectionGuards++;
   // Apply the old compiler branch in memory: an unrelated Proxy provider
   // used to construct a resolver without the authenticated source namespaces.
   assert.ok(plan.nativeBindings.some(b=>b.qname==='flash.utils.Proxy'&&b.nativeBaseExport));
   const initializerPath=require.resolve('../../lib/emit/native-class-initializers');
   const initializerModule=require(initializerPath),savedInitializer=initializerModule.NativeClassInitializers;
   const originalCode=fs.readFileSync(initializerPath,'utf8');
   const mutatedCode=originalCode.replace('(namespaces || new native_namespaces_1.NativeNamespaces(root, source, undefined, true))','new native_namespaces_1.NativeNamespaces(root, source, undefined, true)');
   assert.notEqual(mutatedCode,originalCode);
   const Module=require('node:module'),mutant=new Module(initializerPath,module);
   mutant.filename=initializerPath;mutant.paths=module.paths;mutant._compile(mutatedCode,initializerPath);
   try{initializerModule.NativeClassInitializers=mutant.exports.NativeClassInitializers;
    assert.throws(()=>api.emitNativeSourceClassModule(config),/AS3_NAMESPACE_UNSUPPORTED: unresolved or ambiguous namespace: scratch_ns/);
   }finally{initializerModule.NativeClassInitializers=savedInitializer;}
   const artifact=api.emitNativeSourceClassModule(config);assert.deepEqual(artifact,api.emitNativeSourceClassModule(config));artifacts[cohort]=artifact;
   assert.equal(artifact.generatedSources.length,5);
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
  const observer=fs.readFileSync(path.join(__dirname,'observer.ts'),'utf8').replaceAll('@FLASH@',modulePath(path.join(engine,'src/layaAir/flash')));
  fs.writeFileSync(path.join(dir,'observer.ts'),observer);
  const entry=path.join(dir,'entry.ts');fs.writeFileSync(entry,"import {run} from './observer';import {nativeSourceClassModule as parent} from './parent/parent-factory.js';globalThis.completion=run(parent).then(value=>{globalThis.result=value;});");
  const build=()=>esbuild.build({entryPoints:[entry],bundle:true,write:false,format:'iife',platform:'browser',target:'es2020',metafile:true,loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'}});
  const built=await build();
  const code=built.outputFiles[0].text;fs.writeFileSync(path.join(dir,'bundle.js'),code);
  const vm=require('node:vm');const execute=async code=>{const context=vm.createContext({console,setTimeout,clearTimeout,AbortController,AbortSignal,DOMException,performance});context.window=context;context.document={};new vm.Script(code).runInContext(context);await context.completion;return JSON.parse(JSON.stringify(context.result));};
  const node=await execute(code);assert.deepEqual(node.rows,expected);
  const page=await browser.newPage();await page.route('http://loaded-generated.test/**',route=>route.request().url().endsWith('/bundle.js')?route.fulfill({contentType:'text/javascript',body:code}):route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"script-src 'self'"},body:'<!doctype html><body><script src="/bundle.js"></script></body>'}));
  await page.goto('http://loaded-generated.test/');await page.evaluate(()=>globalThis.completion);const web=await page.evaluate(()=>JSON.parse(JSON.stringify(globalThis.result)));await page.close();assert.deepEqual(web,node);
  const factoryFile=path.join(dir,'parent/parent-factory.js'),originalFactory=fs.readFileSync(factoryFile,'utf8');
  const mutation=originalFactory.replaceAll('.instantiateAS3ClassScriptUnit(','.instantiateAS3ScriptUnit(');assert.notEqual(mutation,originalFactory);
  const mutationResults={node:'',web:''};
  try{fs.writeFileSync(factoryFile,mutation);const changed=await build(),changedCode=changed.outputFiles[0].text;
   try{await execute(changedCode);}catch(error){mutationResults.node=String(error);}assert.match(mutationResults.node,/failed source function creation context/);
   const mutatedPage=await browser.newPage();try{
    await mutatedPage.route('http://retry-control.test/**',route=>route.request().url().endsWith('/bundle.js')?route.fulfill({contentType:'text/javascript',body:changedCode}):route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"script-src 'self'"},body:'<script src="/bundle.js"></script>'}));
    await mutatedPage.goto('http://retry-control.test/');mutationResults.web=await mutatedPage.evaluate(async()=>{try{await globalThis.completion;return '';}catch(error){return String(error);}});assert.match(mutationResults.web,/failed source function creation context/);
   }finally{await mutatedPage.close();}
  }finally{fs.writeFileSync(factoryFile,originalFactory);}
  results.push({target,node,web,typechecks,artifacts,rejectionGuards,namespaceIsolationControl:'old resolver rejects scratch_ns',mutations:1,mutationResults,inputs:Object.keys(built.metafile.inputs).map(file=>({file,sha256:hash(fs.readFileSync(file))}))});
  console.log(JSON.stringify({target,observations:node.rows.length,typeErrors:0,rejectionGuards,domainChecks:node.domainChecks.length,mutations:1}));
 }}finally{await browser.close();}
 for(const item of compilerInputs)assert.equal(hash(fs.readFileSync(item.file)),item.sha256,item.file);
 for(const result of results)for(const item of [...result.inputs,...result.typechecks.flatMap(check=>check.inputs)])assert.equal(hash(fs.readFileSync(item.file)),item.sha256,item.file);
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({engineCommit,receiptSha256:hash(frozen('evidence/receipt.json')),results,cohorts,compilerInputs,runnerSha256:hash(fs.readFileSync(__filename)),observerSha256:hash(fs.readFileSync(path.join(__dirname,'observer.ts'))),held:['Complete FlowElement dependencies and factory runtime','Full startup and game account flow']},null,2));
 console.log(JSON.stringify({out,status:'passed',observations:expected.length,targets:2,realms:2}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
