const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const api=require('../../lib'),engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2');
const ts=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const evidence=path.resolve('../op2-html5/game-client-laya/tests/sprite-script-retry'),air=require(path.join(evidence,'verify.cjs'));
const expected=air;
const compilerInputs=fs.readdirSync(path.resolve('src'),{recursive:true}).filter(f=>f.endsWith('.ts')).map(f=>{const file=path.resolve('src',f);return {file,sha256:hash(fs.readFileSync(file))};});
const cache=path.resolve('.cache/native-generated-sprite-script-retry');fs.mkdirSync(cache,{recursive:true});
const out=fs.mkdtempSync(path.join(cache,'run-'));
const read=(folder,names)=>Object.fromEntries(names.map(q=>{const source=fs.readFileSync(path.join(evidence,folder,q.replaceAll('.','/')+'.as'),'utf8');return [q,{source,sourceSha256:hash(source)}];}));
const cohorts={parent:read('source',['retrycases.Trace','retrycases.Retry','cn.kyiax.base.impl.BaseModule','cn.kyiax.base.IBaseModule'])};
async function main(){
 const {chromium}=require(require.resolve('playwright',{paths:[path.resolve('../op2-html5/game-client-laya'),engine]}));
 const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']}),results=[];
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
   const probe=JSON.parse(require('node:child_process').execFileSync(process.execPath,['../op2-html5/as3-to-layaair-porting-kit/tools/probe_sprite_ancestry.mjs'],{encoding:'utf8'}));
   assert.equal(probe.status,'plan-only');
   const sprite=JSON.parse(fs.readFileSync(path.join(probe.out,'report.json')));
   const nativeProviders=Object.fromEntries(Object.entries(sprite.input.providers).map(([q,b])=>[q,{...b,module:modulePath(path.resolve(probe.out,b.module))}]));
   const trace=modulePath(path.join(engine,'src/layaAir/flash/debug/trace.ts'));externalModules.push(trace,...Object.values(nativeProviders).map(p=>p.module));
   const input={scope:'class-script-retry-'+cohort,sources,providers:nativeProviders,vectorProviderModule:provider('AS3Vector'),patternProviderModule:provider('AS3StringIntrinsics'),providerModule:provider('AS3GeneratedClass'),interfaceProviderModule:provider('AS3Type'),scriptGlobalProviderModule:provider('AS3ScriptGlobal'),scriptDomainProvider:{module:'./cohortDomain',exportName:'scriptDomain'},inheritScriptClasses:true,lexicalProviderModule:provider('AS3LexicalMembers'),classScriptSources:['retrycases.Trace','retrycases.Retry']};

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
   const config={plan,target,emitterOptions:options,externalModules:[...new Set(externalModules)],loadingSessionModule:provider('NativeSourceClassLoadingSession')};
   const emitPlan=p=>api.emitNativeSourceClassModule({...config,plan:p,emitterOptions:{...options,nativeVectorTypes:{...options.nativeVectorTypes,plan:p},nativeReferenceCoercion:{...options.nativeReferenceCoercion,plan:p}}});
   for(const change of [
    {classScriptSources:['retrycases.Trace','retrycases.Retry','cn.kyiax.base.impl.BaseModule']},
    {inheritScriptClasses:undefined},
    {classScriptSources:['cn.kyiax.base.IBaseModule']}
   ]){assert.throws(()=>api.createNativeGeneratedDeclarationPlan({...input,...change}),/AS3_GENERATED_DECLARATIONS_UNSUPPORTED/);rejectionGuards++;}
   for(const [q,source] of [
    ['retrycases.Retry',sources['retrycases.Retry'].source.replace('import cn.kyiax.base.impl.BaseModule;','import flash.display.Sprite;').replace('extends BaseModule','extends Sprite')],
    ['cn.kyiax.base.impl.BaseModule',sources['cn.kyiax.base.impl.BaseModule'].source.replace('import flash.display.Sprite;','import retrycases.Trace;').replace('extends Sprite','extends Trace')]
   ]){assert.throws(()=>api.createNativeGeneratedDeclarationPlan({...input,sources:{...sources,[q]:{source,sourceSha256:hash(source)}}}),/non-retrying source root parent/);rejectionGuards++;}
   assert.throws(()=>emitPlan(api.createNativeGeneratedDeclarationPlan({...input,classScriptSources:undefined})),/script global with static initializer requires retry identity authority/);rejectionGuards++;
   const artifact=api.emitNativeSourceClassModule(config);assert.deepEqual(artifact,api.emitNativeSourceClassModule(config));artifacts[cohort]=artifact;
   assert.equal(artifact.generatedSources.length,Object.keys(sources).length+1);
   const files=[];
   for(const item of artifact.generatedSources){const file=path.join(dir,item.module+'.ts');fs.writeFileSync(file,item.source);files.push(file);}
   const domain=path.join(dir,'cohortDomain.ts');fs.writeFileSync(domain,'import {AS3ScriptDomain} from '+JSON.stringify(provider('AS3ScriptGlobal'))+';export declare const scriptDomain:AS3ScriptDomain;');files.push(domain);
   fs.writeFileSync(path.join(dir,cohort+'-factory.js'),artifact.moduleSource);
   const declaration=path.join(dir,cohort+'-factory.d.ts');fs.writeFileSync(declaration,artifact.declarationSource);files.push(declaration);
   files.push(...['glsl.d.ts','spine.d.ts'].map(f=>path.join(engine,'src/layaAir/tslibs',f)));
   const program=ts.createProgram(files,{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,strict:true,strictNullChecks:false,useUnknownInCatchVariables:false,experimentalDecorators:true,resolveJsonModule:true,esModuleInterop:true,noEmit:true,skipLibCheck:true,lib:['lib.es2020.d.ts','lib.dom.d.ts','lib.dom.iterable.d.ts']});
   const diagnostics=ts.getPreEmitDiagnostics(program).map(d=>({file:d.file?.fileName,code:d.code,text:ts.flattenDiagnosticMessageText(d.messageText,'\n')}));
   fs.writeFileSync(path.join(dir,cohort+'-types.json'),JSON.stringify(diagnostics,null,2));assert.deepEqual(diagnostics,[]);
   typechecks.push({cohort,diagnostics,inputs:program.getSourceFiles().map(f=>({file:f.fileName,sha256:hash(fs.readFileSync(f.fileName))}))});
  }
  const observer=fs.readFileSync(path.join(__dirname,'observer.ts'),'utf8').replaceAll('@FLASH@',modulePath(path.join(engine,'src/layaAir/flash')));
  fs.writeFileSync(path.join(dir,'observer.ts'),observer);
  const entry=path.join(dir,'entry.ts');fs.writeFileSync(entry,"import "+JSON.stringify(modulePath(path.join(engine,'tests/nativeCanonicalSpriteClass/init-imports.ts')))+";import {Laya} from "+JSON.stringify(modulePath(path.join(engine,'src/layaAir/Laya.ts')))+";import {Render} from "+JSON.stringify(modulePath(path.join(engine,'src/layaAir/laya/renders/Render.ts')))+";import {run} from './observer';import {nativeSourceClassModule as parent} from './parent/parent-factory.js';globalThis.completion=Laya.init(160,100).then(()=>{Render.paused=true;return run(parent);}).then(value=>{globalThis.result=value;});");
  const {createLayaSourceAliasPlugin}=await import(require('node:url').pathToFileURL(path.join(engine,'tests/nativeCanonicalSpriteClass/laya-source-alias.mjs')));
  const build=()=>esbuild.build({entryPoints:[entry],bundle:true,write:false,format:'iife',platform:'browser',target:'es2020',metafile:true,plugins:[createLayaSourceAliasPlugin(engine)],loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'}});
  const built=await build();
  const code=built.outputFiles[0].text;fs.writeFileSync(path.join(dir,'bundle.js'),code);
  const execute=async code=>{
   const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
   try{await page.route('http://sprite-retry.test/**',r=>r.request().url().endsWith('/bundle.js')?r.fulfill({contentType:'text/javascript',body:code}):r.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"script-src 'self'"},body:'<!doctype html><body><script src="/bundle.js"></script></body>'}));
    await page.goto('http://sprite-retry.test/');await page.evaluate(()=>globalThis.completion);assert.deepEqual(errors,[]);return await page.evaluate(()=>JSON.parse(JSON.stringify(globalThis.result)));
   }finally{await page.close();}
  };
  const web=await execute(code);assert.deepEqual(web.rows,expected);
  const factoryFile=path.join(dir,'parent/parent-factory.js'),originalFactory=fs.readFileSync(factoryFile,'utf8');
  const mutation=originalFactory.replaceAll('.instantiateAS3ClassScriptUnit(','.instantiateAS3ScriptUnit(');assert.notEqual(mutation,originalFactory);
  try{fs.writeFileSync(factoryFile,mutation);const changed=await build();await assert.rejects(()=>execute(changed.outputFiles[0].text),/failed source function creation context/);}finally{fs.writeFileSync(factoryFile,originalFactory);}
  results.push({target,web,typechecks,artifacts,rejectionGuards,mutations:1,inputs:Object.keys(built.metafile.inputs).map(file=>({file,sha256:hash(fs.readFileSync(file))}))});
  console.log(JSON.stringify({target,observations:web.rows.length,typeErrors:0,rejectionGuards,domainChecks:web.domainChecks.length,mutations:1}));
 }}finally{await browser.close();}
 for(const item of compilerInputs)assert.equal(hash(fs.readFileSync(item.file)),item.sha256,item.file);
 for(const result of results)for(const item of [...result.inputs,...result.typechecks.flatMap(check=>check.inputs)])assert.equal(hash(fs.readFileSync(item.file)),item.sha256,item.file);
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({results,cohorts,compilerInputs,runnerSha256:hash(fs.readFileSync(__filename)),observerSha256:hash(fs.readFileSync(path.join(__dirname,'observer.ts'))),held:['CfgItem/ContextUtil/DataStoreProxy integration','Complete Game dependency closure','Full startup and game account flow']},null,2));
 console.log(JSON.stringify({out,status:'passed',observations:expected.length,targets:2,realms:1}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
