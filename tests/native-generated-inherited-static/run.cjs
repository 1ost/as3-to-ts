const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const api=require('../../lib'),engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2-inherited-static-review');
const ts=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const evidence=path.join(path.resolve(process.env.AIR_EVIDENCE_REPOSITORY||engine),'tests/nativeFlashOracle/inherited-static');
const original=require(path.join(evidence,'verify.cjs'));
const expected=original.map(row=>row.id.startsWith('metadata-')?{...row,value:row.value.replace(/>\s+</g,'><')}:row);
const receipt=JSON.parse(fs.readFileSync(path.join(evidence,'evidence/receipt.json')));
const frozen=file=>fs.readFileSync(path.join(evidence,file));
const compilerInputs=['src','lib','utils'].flatMap(dir=>fs.readdirSync(path.resolve(dir),{recursive:true}).map(f=>path.resolve(dir,f)).filter(f=>fs.statSync(f).isFile()).map(file=>({file,sha256:hash(fs.readFileSync(file))})));
const cache=path.resolve('.cache/native-generated-inherited-static');fs.mkdirSync(cache,{recursive:true});
const out=fs.mkdtempSync(path.join(cache,'run-'));
const read=(folder,names)=>Object.fromEntries(names.map(q=>{const file=folder+'/'+q.replaceAll('.','/')+'.as',bytes=frozen(file);assert.equal(hash(bytes),receipt.artifacts[file.replace(/^evidence\//,'')]);const source=bytes.toString('utf8');return [q,{source,sourceSha256:hash(source)}];}));
const cohorts={parent:read('evidence/source',['staticfields.Cell','staticfields.Base','staticfields.Child','far.Grand','staticfields.Factory'])};
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
   const nativeProviders={Error:{module:provider('AS3CanonicalErrorConstruction'),exportName:'Error',nativeBase:'Error'}};
   const trace=modulePath(path.join(engine,'src/layaAir/flash/debug/trace.ts'));externalModules.push(trace,...Object.values(nativeProviders).map(p=>p.module));
   const input={scope:'class-script-retry-'+cohort,sources,providers:nativeProviders,vectorProviderModule:provider('AS3Vector'),patternProviderModule:provider('AS3StringIntrinsics'),providerModule:provider('AS3GeneratedClass'),interfaceProviderModule:provider('AS3Type'),scriptGlobalProviderModule:provider('AS3ScriptGlobal'),scriptDomainProvider:{module:'./cohortDomain',exportName:'scriptDomain'},inheritScriptClasses:true,classScriptSources:['staticfields.Base'],lexicalProviderModule:provider('AS3LexicalMembers')};

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
   if(!process.argv.includes('--baseline')){
    const reject=(fn,pattern)=>{assert.throws(fn,pattern);rejectionGuards++;};
    const emitChanged=(q,from,to,pattern)=>{const source=sources[q].source.replace(from,to);assert.notEqual(source,sources[q].source);reject(()=>emitPlan(api.createNativeGeneratedDeclarationPlan({...input,sources:{...sources,[q]:{source,sourceSha256:hash(source)}}})),pattern);};
    reject(()=>api.emitNativeSourceClassModule({...config,emitterOptions:{...options,nativeReferenceCoercion:{...options.nativeReferenceCoercion,plan:{...plan}}}}),/exact|plan/);
    reject(()=>api.emitNativeSourceClassModule({...config,plan:{...plan}}),/exact planned/);
    emitChanged('staticfields.Base','count:int=7','count:Number=7',/inherited static lexical ownership|static lexical primitive initializer/);
    assert.equal(rejectionGuards,3);
   }
   const artifact=api.emitNativeSourceClassModule(config);assert.deepEqual(artifact,api.emitNativeSourceClassModule(config));artifacts[cohort]=artifact;
   assert.equal(plan.bindings.length,5);assert.equal(plan.interfaces.length,0);assert.equal(plan.privateBindings.length,1);
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
  if(process.argv.includes('--baseline'))continue;
  const observer=fs.readFileSync(path.join(__dirname,'observer.ts'),'utf8').replaceAll('@FLASH@',modulePath(path.join(engine,'src/layaAir/flash')));
  fs.writeFileSync(path.join(dir,'observer.ts'),observer);
  const entry=path.join(dir,'entry.ts');fs.writeFileSync(entry,"import {run} from './observer';import {nativeSourceClassModule as parent} from './parent/parent-factory.js';globalThis.completion=run(parent).then(value=>{globalThis.result=value;},error=>{globalThis.result={failure:{name:error.name,errorID:error.errorID,message:error.message}};});");
  const build=()=>esbuild.build({entryPoints:[entry],bundle:true,write:false,format:'iife',platform:'browser',target:'es2020',metafile:true,loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'}});
  const built=await build();
  const code=built.outputFiles[0].text;fs.writeFileSync(path.join(dir,'bundle.js'),code);
  const vm=require('node:vm');const execute=async code=>{const context=vm.createContext({console,setTimeout,clearTimeout,AbortController,AbortSignal,DOMException,performance});context.window=context;context.document={};new vm.Script(code).runInContext(context);await context.completion;return JSON.parse(JSON.stringify(context.result));};
  const node=await execute(code);assert.deepEqual(node.rows,expected);
  const executeWeb=async body=>{const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));try{
   await page.route('http://loaded-generated.test/**',route=>route.request().url().endsWith('/bundle.js')?route.fulfill({contentType:'text/javascript',body}):route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"script-src 'self'"},body:'<!doctype html><body><script src="/bundle.js"></script></body>'}));
   await page.goto('http://loaded-generated.test/');await page.evaluate(()=>globalThis.completion);const result=await page.evaluate(()=>JSON.parse(JSON.stringify(globalThis.result)));assert.deepEqual(errors,[]);return result;
  }finally{await page.close();}};
  const web=await executeWeb(code);assert.deepEqual(web,node);
  const controls=[];
  for(const [mutation,from,to,id]of [
   ['wrong-static-owner','callableClass_1.callableClassIntrinsics.getPrototypeOf(__as3_callable_base)','__as3_callable_base','initial'],
   ['discard-reference-write','return __as3_generated_lexicalProvider_0.as3SetLexicalMember(__as3_generated_key_5, __as3_generated_access_6, v);','return v;','reference:2']
  ]){
   let applied=0;
   const mutated=await esbuild.build({entryPoints:[entry],bundle:true,write:false,format:'iife',platform:'browser',target:'es2020',loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'},plugins:[{name:mutation,setup(build){build.onLoad({filter:/parent-factory\.js$/},args=>{
    const source=fs.readFileSync(args.path,'utf8');assert.ok(source.includes(from),mutation);applied++;return {contents:source.replace(from,to),loader:'js'};
   });}}]});
   assert.equal(applied,1);const code=mutated.outputFiles[0].text;fs.writeFileSync(path.join(dir,'mutant-'+mutation+'.js'),code);
   const control=await execute(code),browserControl=await executeWeb(code);assert.deepEqual(browserControl,control);
   if(control.failure){assert.equal(mutation,'wrong-static-owner');assert.deepEqual(control.failure,{name:'ReferenceError',errorID:1069,message:'Error #1069'});}
   else assert.notDeepEqual(control.rows.find(row=>row.id===id),expected.find(row=>row.id===id));
   controls.push({mutation,applied,detectedAt:id,control,browserControl});
  }
  results.push({target,node,web,typechecks,artifacts,rejectionGuards,mutations:2,controls,inputs:Object.keys(built.metafile.inputs).map(file=>({file,sha256:hash(fs.readFileSync(file))}))});
  console.log(JSON.stringify({target,observations:node.rows.length,typeErrors:0,rejectionGuards,mutations:2}));
 }}finally{await browser.close();}
 if(process.argv.includes('--baseline')){console.log(JSON.stringify({out,status:'baseline-held',targets:2,runtimeComparisons:0}));return;}
 for(const item of compilerInputs)assert.equal(hash(fs.readFileSync(item.file)),item.sha256,item.file);
 for(const result of results)for(const item of [...result.inputs,...result.typechecks.flatMap(check=>check.inputs)])assert.equal(hash(fs.readFileSync(item.file)),item.sha256,item.file);
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({receiptSha256:hash(frozen('evidence/receipt.json')),results,cohorts,compilerInputs,runnerSha256:hash(fs.readFileSync(__filename)),observerSha256:hash(fs.readFileSync(path.join(__dirname,'observer.ts'))),comparison:{generatedSourceRows:14,commonEngineRows:0},held:['Other inherited static field types remain unqualified','Full source factory and startup integration','Real H5 game account acceptance']},null,2));
 console.log(JSON.stringify({out,status:'passed',observations:expected.length,targets:2,realms:2}));
}
main().catch(error=>{fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({message:error.message,stack:String(error.stack),cohorts,compilerInputs,runnerSha256:hash(fs.readFileSync(__filename))},null,2));console.error(error);console.log(JSON.stringify({out,status:'held'}));process.exitCode=1;});
