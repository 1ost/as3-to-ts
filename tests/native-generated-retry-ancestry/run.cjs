const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const api=require('../../lib'),engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2-retry-ancestry-review');
const ts=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const evidence=path.join(engine,'tests/nativeFlashOracle/retry-ancestry'),expected=require(path.join(evidence,'verify.cjs'));
const cache=path.resolve('.cache/native-generated-retry-ancestry');fs.mkdirSync(cache,{recursive:true});
const out=fs.mkdtempSync(path.join(cache,'run-'));
const read=(folder,names)=>Object.fromEntries(names.map(q=>{const source=fs.readFileSync(path.join(evidence,folder,q.replaceAll('.','/')+'.as'),'utf8');return [q,{source,sourceSha256:hash(source)}];}));
const cohorts={subject:read('source',['cases.Probe','cases.Leaf','cases.Middle','cases.Root','cases.Log'])};
const callable=require('../../lib/emit/native-callable-classes').NativeCallableClasses;
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
  const modules=['AS3SourceNamespace','AS3GeneratedClass','AS3ScriptGlobal','AS3Type','AS3Class','AS3Invocation','AS3LexicalMembers','AS3Property','AS3MethodBinding','AS3Coercion','AS3String','AS3Addition','AS3ArrayCreation','AS3Vector','Dictionary','AS3CanonicalErrorConstruction','NativeSourceClassLoadingSession','getQualifiedClassName','DefinitionRegistry','describeType','AS3ReflectionQuery','AS3XML','AS3CanonicalRegExpReference','AS3StringIntrinsics'];
  const externalModules=[...Object.values(helpers),sourceError,...modules.map(provider)];
   const nativeProviders={RegExp:{module:provider('AS3CanonicalRegExpReference'),exportName:'RegExp'},Error:{module:provider('AS3CanonicalErrorConstruction'),exportName:'Error',nativeBase:'Error'}};
   const input={providers:nativeProviders,vectorProviderModule:provider('AS3Vector'),lexicalProviderModule:provider('AS3LexicalMembers'),scope:'retry-ancestry-'+cohort,sources,classScriptSources:['cases.Log','cases.Root','cases.Leaf'],providerModule:provider('AS3GeneratedClass'),interfaceProviderModule:provider('AS3Type'),scriptGlobalProviderModule:provider('AS3ScriptGlobal'),scriptDomainProvider:{module:'./cohortDomain',exportName:'scriptDomain'},inheritScriptClasses:true};
   const plan=api.createNativeGeneratedDeclarationPlan(input);
   const definitionsByNamespace={};for(const q of Object.keys(sources)){const parts=q.split('.'),n=parts.pop();(definitionsByNamespace[parts.join('.')]??=[]).push(n);}
   const options={nativeStringIntrinsicsModule:provider('AS3StringIntrinsics'),customVisitors:[],definitionsByNamespace,nativeReflectionQueryModule:provider('AS3ReflectionQuery'),nativeReflectionXMLModule:provider('AS3ReflectionQuery'),nativeVectorTypes:{plan,module:'./__native_declarations'},nativeEnumeration:{dictionaryModule:provider('Dictionary'),coercionModule:provider('AS3Coercion'),stringModule:provider('AS3String')},importModules:{'flash.utils.getQualifiedClassName':provider('getQualifiedClassName'),'flash.utils.getDefinitionByName':provider('DefinitionRegistry'),'flash.utils.describeType':provider('describeType'),Error:provider('AS3CanonicalErrorConstruction'),'compiler.AS3Class':provider('AS3Class'),'compiler.AS3Invocation':provider('AS3Invocation')},
    decoratorModules:{bound:helpers.bound,classBound:helpers.classBound},nativeClassHelperModules:{nativeClass:helpers.nativeClass,callableClass:helpers.callableClass},
    nativeClassTraitsModule:provider('AS3GeneratedClass'),nativeLexicalMembersModule:provider('AS3LexicalMembers'),nativeGeneratedPropertyModule:provider('AS3Property'),
    nativeCallableMethodBindingModule:provider('AS3MethodBinding'),nativeCallableCoercionModule:provider('AS3Coercion'),nativeCallableStringModule:provider('AS3String'),
    nativeSourceErrorModule:sourceError,nativeDynamicPropertyReadsModule:provider('AS3Property'),nativeDynamicPropertyWritesModule:provider('AS3Property'),
    nativeComputedTypeTestModule:provider('AS3Type'),nativeDictionaryPropertyModule:provider('AS3Property'),nativeObjectCreationModule:provider('AS3Class'),
    nativeTypedLocals:true,nativeTypedLocalReferenceModule:provider('AS3Type'),nativeTypedLocalAdditionModule:provider('AS3Addition'),nativeArrayCreationModule:provider('AS3ArrayCreation'),
    nativeReferenceCoercion:{plan,module:'./unused',coercionModule:provider('AS3Type')},nativeNumericMethodParametersModule:provider('AS3Coercion'),nativeSignaturePropertyModule:provider('AS3Property')};
   const config={plan,target,emitterOptions:options,externalModules,loadingSessionModule:provider('NativeSourceClassLoadingSession'),sourceNamespaceProviderModule:provider('AS3SourceNamespace')};
   assert.ok(plan.references.filter(r=>r.kind==='unresolved').every(r=>r.identity==='Error'));

   let guards=0;const reject=(fn,re)=>{assert.throws(fn,re);guards++;};
   reject(()=>api.emitNativeSourceClassModule({...config,plan:{...plan}}),/exact planned/);
   const replan=changed=>{const p=api.createNativeGeneratedDeclarationPlan({...input,sources:changed});return {...config,plan:p,emitterOptions:{...options,nativeVectorTypes:{...options.nativeVectorTypes,plan:p},nativeReferenceCoercion:{...options.nativeReferenceCoercion,plan:p}}};};
   const replace=(q,before,after)=>{assert.ok(sources[q].source.includes(before));const source=sources[q].source.replace(before,after);return {...sources,[q]:{source,sourceSha256:hash(source)}};};
   const withoutRetry=api.createNativeGeneratedDeclarationPlan({...input,classScriptSources:undefined});
   reject(()=>api.emitNativeSourceClassModule({...config,plan:withoutRetry,emitterOptions:{...options,nativeVectorTypes:{...options.nativeVectorTypes,plan:withoutRetry},nativeReferenceCoercion:{...options.nativeReferenceCoercion,plan:withoutRetry}}}),/static initializer requires retry/);
   reject(()=>replan(replace('cases.Root','class Root {','class Root extends Error {')),/non-retrying source root parent/);
   reject(()=>replan(replace('cases.Root','class Root {','class Root extends Leaf {')),/non-retrying source root parent|cyclic source inheritance/);
   reject(()=>replan(replace('cases.Root','protected var label:String','internal var label:String')),/internal declarations/);
   const plannerPath=require.resolve('../../lib/emit/native-generated-declarations'),Module=require('node:module');
   const originalPlanner=fs.readFileSync(plannerPath,'utf8'),boundary='while (parent && parent.scriptGlobalExport && !seen.has(parent.qname)) {';
   assert.equal(originalPlanner.split(boundary).length,2);
   const reverted=new Module(plannerPath,module);reverted.filename=plannerPath;reverted.paths=Module._nodeModulePaths(path.dirname(plannerPath));
   reverted._compile(originalPlanner.replace(boundary,'while (parent && parent.scriptGlobalExport && !seen.has(parent.qname) && data.classScriptSources.indexOf(parent.qname)<0) {'),plannerPath);
   reject(()=>reverted.exports.createNativeGeneratedDeclarationPlan(input),/non-retrying source root parent/);
   assert.equal(guards,6);
   const artifact=api.emitNativeSourceClassModule(config);assert.deepEqual(artifact,api.emitNativeSourceClassModule(config));artifacts[cohort]=artifact;
   assert.equal(artifact.generatedSources.length,Object.keys(sources).length+1+plan.privateBindings.length);
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
  const entry=path.join(dir,'entry.ts');fs.writeFileSync(entry,"import {run} from './observer';import {nativeSourceClassModule as subject} from './subject/subject-factory.js';globalThis.completion=run(subject).then(value=>{globalThis.result=value;});");

  const built=await esbuild.build({entryPoints:[entry],bundle:true,write:false,format:'iife',platform:'browser',target:'es2020',metafile:true});
  const code=built.outputFiles[0].text;fs.writeFileSync(path.join(dir,'bundle.js'),code);
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('http://loaded-generated.test/**',route=>route.request().url().endsWith('/bundle.js')?route.fulfill({contentType:'text/javascript',body:code}):route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"script-src 'self'"},body:'<!doctype html><body><script src="/bundle.js"></script></body>'}));
  await page.goto('http://loaded-generated.test/');await page.evaluate(()=>globalThis.completion);const web=await page.evaluate(()=>globalThis.result);await page.close();assert.deepEqual(errors,[]);assert.deepEqual(web.rows,expected);
  const nodeEntry=path.join(dir,'node-entry.ts');fs.writeFileSync(nodeEntry,"import {run} from './observer';import {nativeSourceClassModule as subject} from './subject/subject-factory.js';export const completion=run(subject);");
  await esbuild.build({entryPoints:[nodeEntry],outfile:path.join(dir,'node.cjs'),bundle:true,format:'cjs',platform:'node',target:'es2020'});
  const node=await require(path.join(dir,'node.cjs')).completion;assert.deepEqual(node,web);
  const mutations=1,control={status:'rejected',reason:'Restoring the non-retrying ancestor boundary rejects this exact source cohort'};
  results.push({target,web,node,control,mutations,typechecks,artifacts,inputs:Object.keys(built.metafile.inputs).map(file=>({file,sha256:hash(fs.readFileSync(file))})),rejectionGuards:typechecks.reduce((n,t)=>n+t.guards,0)});
  console.log(JSON.stringify({target,observations:web.rows.length,domainChecks:web.checks,typeErrors:0}));
 }}finally{await browser.close();}
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({results,cohorts,runnerSha256:hash(fs.readFileSync(__filename)),observerSha256:hash(fs.readFileSync(path.join(__dirname,'observer.ts')))},null,2));
 console.log(JSON.stringify({out,status:'passed',observations:expected.length,targets:2}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
