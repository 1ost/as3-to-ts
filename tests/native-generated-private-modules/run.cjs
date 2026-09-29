const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const api=require('../../lib'),engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2');
const ts=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const evidence=path.join(engine,'tests/nativeFlashOracle/file-local-classes'),expected=require(path.join(evidence,'verify.cjs'));
const cache=path.resolve('.cache/native-generated-file-local-classes');fs.mkdirSync(cache,{recursive:true});
const out=fs.mkdtempSync(path.join(cache,'run-'));
const read=(folder,names)=>Object.fromEntries(names.map(q=>{const source=fs.readFileSync(path.join(evidence,folder,q.replaceAll('.','/')+'.as'),'utf8');return [q,{source,sourceSha256:hash(source)}];}));
const expectedLifetime=require(path.join(engine,'tests/nativeFlashOracle/file-local-lifetime/verify.cjs'));
const cohorts={subject:read('source',['FileLocalClassesProbe','localcases.First','localcases.Second','choices.inside.Value','choices.outside.Value']),lifetime:read('../file-local-lifetime/source',['FileLocalLifetimeProbe','lifetime.Unit','lifetime.Other'])};
const callable=require('../../lib/emit/native-callable-classes').NativeCallableClasses;
const lower=callable.prototype.lower;callable.prototype.lower=function(source){try{return lower.call(this,source);}catch(error){fs.writeFileSync(path.join(out,'failed-intermediate.ts'),source);console.error('Failed declaration',this.own&&this.own.qname);throw error;}};
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
  const modules=['AS3GeneratedClass','AS3ScriptGlobal','AS3Type','AS3Class','AS3Invocation','AS3LexicalMembers','AS3Property','AS3MethodBinding','AS3Coercion','AS3String','AS3Addition','AS3ArrayCreation','AS3Vector','Dictionary','AS3CanonicalErrorConstruction','NativeSourceClassLoadingSession','getQualifiedClassName','DefinitionRegistry','describeType','AS3ReflectionQuery','AS3XML'];
  const externalModules=[...Object.values(helpers),sourceError,...modules.map(provider)];
   const nativeProviders={Error:{module:provider('AS3CanonicalErrorConstruction'),exportName:'Error',nativeBase:'Error'}};
   const input={providers:nativeProviders,vectorProviderModule:provider('AS3Vector'),scope:'file-local-classes-'+cohort,sources,providerModule:provider('AS3GeneratedClass'),interfaceProviderModule:provider('AS3Type'),scriptGlobalProviderModule:provider('AS3ScriptGlobal'),scriptDomainProvider:{module:'./cohortDomain',exportName:'scriptDomain'},inheritScriptClasses:true};
   const plan=api.createNativeGeneratedDeclarationPlan(input);
   const definitionsByNamespace={};for(const q of Object.keys(sources)){const parts=q.split('.'),n=parts.pop();(definitionsByNamespace[parts.join('.')]??=[]).push(n);}
   const options={customVisitors:[],definitionsByNamespace,nativeReflectionQueryModule:provider('AS3ReflectionQuery'),nativeReflectionXMLModule:provider('AS3ReflectionQuery'),nativeVectorTypes:{plan,module:'./__native_declarations'},nativeEnumeration:{dictionaryModule:provider('Dictionary'),coercionModule:provider('AS3Coercion'),stringModule:provider('AS3String')},importModules:{'flash.utils.getQualifiedClassName':provider('getQualifiedClassName'),'flash.utils.getDefinitionByName':provider('DefinitionRegistry'),'flash.utils.describeType':provider('describeType'),Error:provider('AS3CanonicalErrorConstruction'),'compiler.AS3Class':provider('AS3Class'),'compiler.AS3Invocation':provider('AS3Invocation')},
    decoratorModules:{bound:helpers.bound,classBound:helpers.classBound},nativeClassHelperModules:{nativeClass:helpers.nativeClass,callableClass:helpers.callableClass},
    nativeClassTraitsModule:provider('AS3GeneratedClass'),nativeLexicalMembersModule:provider('AS3LexicalMembers'),nativeGeneratedPropertyModule:provider('AS3Property'),
    nativeCallableMethodBindingModule:provider('AS3MethodBinding'),nativeCallableCoercionModule:provider('AS3Coercion'),nativeCallableStringModule:provider('AS3String'),
    nativeSourceErrorModule:sourceError,nativeDynamicPropertyReadsModule:provider('AS3Property'),nativeDynamicPropertyWritesModule:provider('AS3Property'),
    nativeComputedTypeTestModule:provider('AS3Type'),nativeDictionaryPropertyModule:provider('AS3Property'),nativeObjectCreationModule:provider('AS3Class'),
    nativeTypedLocals:true,nativeTypedLocalReferenceModule:provider('AS3Type'),nativeTypedLocalAdditionModule:provider('AS3Addition'),nativeArrayCreationModule:provider('AS3ArrayCreation'),
    nativeReferenceCoercion:{plan,module:'./unused',coercionModule:provider('AS3Type')},nativeNumericMethodParametersModule:provider('AS3Coercion'),nativeSignaturePropertyModule:provider('AS3Property')};
   const config={plan,target,emitterOptions:options,externalModules,loadingSessionModule:provider('NativeSourceClassLoadingSession')};
   assert.ok(plan.references.filter(r=>r.kind==='unresolved').every(r=>r.identity==='Error'));

   let guards=0;const reject=(fn,re)=>{assert.throws(fn,re);guards++;};
   reject(()=>api.emitNativeSourceClassModule({...config,plan:{...plan}}),/exact planned/);
   if(cohort==='subject')reject(()=>api.emitNativeSourceClassModule({...config,emitterOptions:{...options,nativeEnumeration:undefined}}),/explicit common enumeration/);
   reject(()=>api.createNativeGeneratedDeclarationPlan({...input,classScriptSources:[cohort==='subject'?'localcases.First':'lifetime.Unit']}),/multi-declaration Class script retry/);
   if(cohort==='subject') {
   const original=sources['localcases.First'].source,source=original.replace('count:int=0','count:int=initCount()');assert.notEqual(source,original);
   const changed=api.createNativeGeneratedDeclarationPlan({...input,sources:{...sources,'localcases.First':{source,sourceSha256:hash(source)}}});
   reject(()=>api.emitNativeSourceClassModule({...config,plan:changed,emitterOptions:{...options,nativeVectorTypes:{...options.nativeVectorTypes,plan:changed},nativeReferenceCoercion:{...options.nativeReferenceCoercion,plan:changed}}}),/static initializer requires retry/);
   }
   reject(()=>api.emitNativeSourceClassModule({...config,externalModules:externalModules.filter(m=>m!==provider('AS3ScriptGlobal'))}),/unbound TypeScript dependency|script provider must be explicit/);
   assert.equal(guards,cohort==='subject'?5:3);
   const artifact=api.emitNativeSourceClassModule(config);assert.deepEqual(artifact,api.emitNativeSourceClassModule(config));artifacts[cohort]=artifact;
   assert.equal(artifact.generatedSources.length,Object.keys(sources).length+1+plan.privateBindings.length);
   const files=[];
   for(const item of artifact.generatedSources){const file=path.join(dir,item.module+'.ts');fs.writeFileSync(file,item.source);files.push(file);}
   const domain=path.join(dir,'cohortDomain.ts');fs.writeFileSync(domain,'import {AS3ScriptDomain} from '+JSON.stringify(provider('AS3ScriptGlobal'))+';export declare const scriptDomain:AS3ScriptDomain;');files.push(domain);
   fs.writeFileSync(path.join(dir,cohort+'-factory.js'),artifact.moduleSource);
   const declaration=path.join(dir,cohort+'-factory.d.ts');fs.writeFileSync(declaration,artifact.declarationSource);files.push(declaration);
   files.push(...['glsl.d.ts','spine.d.ts'].map(f=>path.join(engine,'src/layaAir/tslibs',f)));
   const program=ts.createProgram(files,{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,strict:true,strictNullChecks:false,useUnknownInCatchVariables:false,experimentalDecorators:true,noEmit:true,skipLibCheck:true,resolveJsonModule:true,esModuleInterop:true,types:[],lib:['lib.es2020.d.ts','lib.dom.d.ts','lib.dom.iterable.d.ts']});
   const diagnostics=ts.getPreEmitDiagnostics(program).map(d=>({file:d.file?.fileName,code:d.code,text:ts.flattenDiagnosticMessageText(d.messageText,'\n')}));
   fs.writeFileSync(path.join(dir,cohort+'-types.json'),JSON.stringify(diagnostics,null,2));assert.deepEqual(diagnostics,[]);
   typechecks.push({cohort,guards,diagnostics,inputs:program.getSourceFiles().map(f=>({file:f.fileName,sha256:hash(fs.readFileSync(f.fileName))}))});
  }
  const observer=fs.readFileSync(path.join(__dirname,'observer.ts'),'utf8').replaceAll('@FLASH@',modulePath(path.join(engine,'src/layaAir/flash'))).replaceAll('@ENGINE@',modulePath(engine));
  fs.writeFileSync(path.join(dir,'observer.ts'),observer);
  const entry=path.join(dir,'entry.ts');fs.writeFileSync(entry,"import {run} from './observer';import {nativeSourceClassModule as subject} from './subject/subject-factory.js';import {nativeSourceClassModule as lifetime} from './lifetime/lifetime-factory.js';globalThis.completion=run(subject,lifetime).then(value=>{globalThis.result=value;});");

  const built=await esbuild.build({entryPoints:[entry],bundle:true,write:false,format:'iife',platform:'browser',target:'es2020',metafile:true});
  const code=built.outputFiles[0].text;fs.writeFileSync(path.join(dir,'bundle.js'),code);
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('http://loaded-generated.test/**',route=>route.request().url().endsWith('/bundle.js')?route.fulfill({contentType:'text/javascript',body:code}):route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"script-src 'self'"},body:'<!doctype html><body><script src="/bundle.js"></script></body>'}));
  await page.goto('http://loaded-generated.test/');await page.evaluate(()=>globalThis.completion);const web=await page.evaluate(()=>globalThis.result);await page.close();assert.deepEqual(errors,[]);assert.deepEqual(web.rows,expected);assert.deepEqual(web.lifetimeRows,expectedLifetime);
  const nodeEntry=path.join(dir,'node-entry.ts');fs.writeFileSync(nodeEntry,"import {run} from './observer';import {nativeSourceClassModule as subject} from './subject/subject-factory.js';import {nativeSourceClassModule as lifetime} from './lifetime/lifetime-factory.js';export const completion=run(subject,lifetime);");
  await esbuild.build({entryPoints:[nodeEntry],outfile:path.join(dir,'node.cjs'),bundle:true,format:'cjs',platform:'node',target:'es2020'});
  const node=await require(path.join(dir,'node.cjs')).completion;assert.deepEqual(node,web);
  results.push({target,web,node,typechecks,artifacts,rejectionGuards:typechecks.reduce((n,t)=>n+t.guards,0)});
  console.log(JSON.stringify({target,observations:web.rows.length+web.lifetimeRows.length,domainChecks:web.checks,typeErrors:0}));
 }}finally{await browser.close();}
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({results,cohorts,runnerSha256:hash(fs.readFileSync(__filename)),observerSha256:hash(fs.readFileSync(path.join(__dirname,'observer.ts')))},null,2));
 console.log(JSON.stringify({out,status:'passed',observations:34,targets:2}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
