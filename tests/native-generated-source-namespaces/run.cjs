const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const api=require('../../lib'),engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2-source-namespace-review');
const ts=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const oraclePath=path.join(engine,'tests/nativeFlashOracle/source-namespace-publication'),oracle=require(path.join(oraclePath,'verify.cjs'));
const names=['flashx.textLayout.tlf_internal','fixture.same_uri','fixture.alias_uri'];
const sources=Object.fromEntries(names.map(name=>{const source=fs.readFileSync(path.join(oraclePath,'source',name.replaceAll('.','/')+'.as'),'utf8');return [name,{source,sourceSha256:hash(source)}];}));
const extra='package fixture {public class Box {public var value:int=7;public function Box(){}}}';
const cohorts={mixed:{...sources,'fixture.Box':{source:extra,sourceSha256:hash(extra)}},only:sources};
const projected=value=>({uri:value.uri,prefix:value.prefix,prefixType:value.prefixType,type:value.type,qualified:value.qualified,text:value.text});
const ids=['direct','peer','alias',...['flashx.textLayout.tlf_internal','flashx.textLayout::tlf_internal','fixture.same_uri','fixture.alias_uri'].flatMap(name=>[name+'-has',name+'-read',name+'-global']),'names'];
const expected=ids.map(id=>{const row=oracle.find(row=>row.id===id);assert(row,id);
 if(['direct','peer','alias'].includes(id)||id.endsWith('-global'))return {id,value:projected(row.value)};
 if(id.endsWith('-read'))return {id,value:{same:row.value.same,value:projected(row.value.value)}};return row;});
async function main(){
 const cache=path.resolve('.cache/native-generated-source-namespaces');fs.mkdirSync(cache,{recursive:true});const out=fs.mkdtempSync(path.join(cache,'run-'));
 const {chromium}=require(require.resolve('playwright',{paths:[engine,path.resolve('../op2-html5/game-client-laya')]}));
 const browser=await chromium.launch({headless:true}),results=[];
 try{for(const target of ['ES5','ES2015']){
  const dir=path.join(out,target);fs.mkdirSync(dir);const artifacts={},typechecks=[];let guards=0;
  for(const [cohort,sources]of Object.entries(cohorts)){
   const folder=path.join(dir,cohort);fs.mkdirSync(folder);
   const relative=file=>{const value=path.relative(folder,file).replaceAll('\\','/').replace(/\.ts$/,'');return value.startsWith('.')?value:'./'+value;};
   const provider=name=>relative(path.join(engine,'src/layaAir/flash/utils',name+'.ts'));
   const helpers=Object.fromEntries(['bound','classBound','nativeClass','callableClass'].map(name=>[name,relative(path.resolve('utils',name+'.ts'))]));
   const sourceError=relative(path.join(engine,'src/layaAir/flash/errors/AS3SourceError.ts'));
   const modules=['AS3GeneratedClass','AS3ScriptGlobal','AS3SourceNamespace','AS3Type','AS3Class','AS3Invocation','AS3LexicalMembers','AS3Property','AS3MethodBinding','AS3Coercion','AS3String','AS3Addition','AS3ArrayCreation','NativeSourceClassLoadingSession'];
   const externalModules=[...Object.values(helpers),sourceError,...modules.map(provider)];
   const input={scope:'source-namespaces-'+cohort,sources,providerModule:provider('AS3GeneratedClass'),interfaceProviderModule:provider('AS3Type'),scriptGlobalProviderModule:provider('AS3ScriptGlobal'),scriptDomainProvider:{module:'./cohortDomain',exportName:'scriptDomain'},inheritScriptClasses:true};
   const plan=api.createNativeGeneratedDeclarationPlan(input),definitionsByNamespace={};
   for(const q of Object.keys(sources)){const parts=q.split('.'),name=parts.pop();(definitionsByNamespace[parts.join('.')]??=[]).push(name);}
   const options={customVisitors:[],definitionsByNamespace,importModules:{'compiler.AS3Class':provider('AS3Class'),'compiler.AS3Invocation':provider('AS3Invocation')},
    decoratorModules:{bound:helpers.bound,classBound:helpers.classBound},nativeClassHelperModules:{nativeClass:helpers.nativeClass,callableClass:helpers.callableClass},
    nativeClassTraitsModule:provider('AS3GeneratedClass'),nativeLexicalMembersModule:provider('AS3LexicalMembers'),nativeGeneratedPropertyModule:provider('AS3Property'),
    nativeCallableMethodBindingModule:provider('AS3MethodBinding'),nativeCallableCoercionModule:provider('AS3Coercion'),nativeCallableStringModule:provider('AS3String'),
    nativeSourceErrorModule:sourceError,nativeDynamicPropertyReadsModule:provider('AS3Property'),nativeDynamicPropertyWritesModule:provider('AS3Property'),
    nativeComputedTypeTestModule:provider('AS3Type'),nativeDictionaryPropertyModule:provider('AS3Property'),nativeObjectCreationModule:provider('AS3Class'),
    nativeTypedLocals:true,nativeTypedLocalReferenceModule:provider('AS3Type'),nativeTypedLocalAdditionModule:provider('AS3Addition'),nativeArrayCreationModule:provider('AS3ArrayCreation'),
    nativeReferenceCoercion:{plan,module:'./unused',coercionModule:provider('AS3Type')},nativeNumericMethodParametersModule:provider('AS3Coercion'),nativeSignaturePropertyModule:provider('AS3Property')};
   const config={plan,target,emitterOptions:options,externalModules,loadingSessionModule:provider('NativeSourceClassLoadingSession'),sourceNamespaceProviderModule:provider('AS3SourceNamespace')};
   if(cohort==='mixed'){
    const baselineRoot=path.resolve(process.env.AS3_NAMESPACE_BASELINE||'../as3-to-ts-op2');
    const baselineCommit=require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:baselineRoot,encoding:'utf8'}).trim();
    assert.equal(baselineCommit,'59fe4d643835705e04d6ec56b3beb4fb3661536f');
    const baseline=require(path.join(baselineRoot,'lib'));
    const marker='package plain {public interface Marker {}}';
    const noNamespaces={...input,sources:{'fixture.Box':sources['fixture.Box'],'plain.Marker':{source:marker,sourceSha256:hash(marker)}}};
    const emit=compiler=>{const plan=compiler.createNativeGeneratedDeclarationPlan(noNamespaces);return compiler.emitNativeSourceClassModule({
     ...config,plan,sourceNamespaceProviderModule:undefined,emitterOptions:{...options,nativeReferenceCoercion:{...options.nativeReferenceCoercion,plan}}});};
    assert.deepEqual(emit(api),emit(baseline));
   }
   const reject=call=>{assert.throws(call,/AS3_[A-Z_]+UNSUPPORTED/);guards++;};
   reject(()=>api.emitNativeSourceClassModule({...config,sourceNamespaceProviderModule:undefined}));
   reject(()=>api.emitNativeSourceClassModule({...config,externalModules:externalModules.filter(value=>value!==provider('AS3SourceNamespace'))}));
   reject(()=>api.emitNativeSourceClassModule({...config,externalModules:externalModules.filter(value=>value!==provider('AS3ScriptGlobal'))}));
   if(cohort==='mixed')for(const body of ['public static function read():* {return tlf_internal;}','public var ns:Namespace;']){
    const source='package fixture {import flashx.textLayout.tlf_internal;public class Guard {'+body+'}}';
    const p=api.createNativeGeneratedDeclarationPlan({...input,sources:{...sources,'fixture.Guard':{source,sourceSha256:hash(source)}}});
    reject(()=>api.emitNativeSourceClassModule({...config,plan:p,emitterOptions:{...options,nativeReferenceCoercion:{...options.nativeReferenceCoercion,plan:p}}}));
   }
   const artifact=api.emitNativeSourceClassModule(config);assert.deepEqual(artifact,api.emitNativeSourceClassModule(config));artifacts[cohort]=artifact;
   assert.deepEqual({...artifact.sourceHashes},Object.fromEntries(Object.entries(sources).map(([q,value])=>[q,value.sourceSha256])));
   const files=[];for(const item of artifact.generatedSources){const file=path.join(folder,item.module+'.ts');fs.writeFileSync(file,item.source);files.push(file);}
   const domain=path.join(folder,'cohortDomain.ts');fs.writeFileSync(domain,'import {AS3ScriptDomain} from '+JSON.stringify(provider('AS3ScriptGlobal'))+';export declare const scriptDomain:AS3ScriptDomain;');files.push(domain);
   fs.writeFileSync(path.join(folder,'factory.js'),artifact.moduleSource);const declaration=path.join(folder,'factory.d.ts');fs.writeFileSync(declaration,artifact.declarationSource);files.push(declaration);
   files.push(...['glsl.d.ts','spine.d.ts'].map(name=>path.join(engine,'src/layaAir/tslibs',name)));
   const program=ts.createProgram(files,{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,strict:true,strictNullChecks:false,useUnknownInCatchVariables:false,experimentalDecorators:true,noEmit:true,skipLibCheck:true,lib:['lib.es2020.d.ts','lib.dom.d.ts']});
   const diagnostics=ts.getPreEmitDiagnostics(program).map(d=>({file:d.file?.fileName,code:d.code,text:ts.flattenDiagnosticMessageText(d.messageText,'\n')}));
   fs.writeFileSync(path.join(folder,'types.json'),JSON.stringify(diagnostics,null,2));assert.deepEqual(diagnostics,[]);
   typechecks.push({cohort,diagnostics,inputs:program.getSourceFiles().map(file=>({file:file.fileName,sha256:hash(fs.readFileSync(file.fileName))}))});
  }
  const flash=path.relative(dir,path.join(engine,'src/layaAir/flash')).replaceAll('\\','/');
  fs.writeFileSync(path.join(dir,'observer.ts'),fs.readFileSync(path.join(__dirname,'observer.ts'),'utf8').replaceAll('@FLASH@',flash));
  const entry=path.join(dir,'entry.ts');fs.writeFileSync(entry,"import {run} from './observer';import {nativeSourceClassModule as mixed} from './mixed/factory.js';import {nativeSourceClassModule as only} from './only/factory.js';globalThis.completion=run(mixed,only).then(value=>globalThis.result=value);");
  const bundle=mutation=>esbuild.build({entryPoints:[entry],bundle:true,write:false,format:'iife',platform:'browser',target:'es2020',metafile:true,
   loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'},plugins:mutation?[{name:mutation,setup(builder){builder.onLoad({filter:/factory\.js$/},args=>{
    let source=fs.readFileSync(args.path,'utf8');
    // TypeScript's import binding name comes from cohortDomain, not an ambient domain.
    const selected=/AS3ScriptGlobal_\d+\.selectAS3ScriptDomainDefinition\(cohortDomain_\d+\.scriptDomain, name\)/g;
    assert.equal([...source.matchAll(selected)].length,1);source=source.replace(selected,'undefined');return {contents:source,loader:'js'};
   });}}]:[]});
  const built=await bundle(),code=built.outputFiles[0].text;fs.writeFileSync(path.join(dir,'bundle.js'),code);
  const execute=async code=>{const vm=require('node:vm'),context=vm.createContext({console,setTimeout,clearTimeout,AbortController,AbortSignal,DOMException});context.window=context;context.document={};new vm.Script(code).runInContext(context);await context.completion;return JSON.parse(JSON.stringify(context.result));};
  const node=await execute(code);assert.deepEqual(node.rows,expected);assert.equal(node.checks.length,11);
  const page=await browser.newPage();await page.route('http://namespace-generated.test/**',route=>route.request().url().endsWith('/bundle.js')?route.fulfill({contentType:'text/javascript',body:code}):route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"script-src 'self'"},body:'<!doctype html><body><script src="/bundle.js"></script></body>'}));
  await page.goto('http://namespace-generated.test/');await page.evaluate(()=>globalThis.completion);const web=await page.evaluate(()=>globalThis.result);await page.close();assert.deepEqual(web,node);
  const mutated=await bundle('missing-namespace-selection');await assert.rejects(()=>execute(mutated.outputFiles[0].text),/did not reuse selected declaration/);
  results.push({target,node,web,artifacts,typechecks,guards,negatives:['missing-namespace-selection'],inputs:Object.keys(built.metafile.inputs).map(file=>({file,sha256:hash(fs.readFileSync(file))}))});
  console.log(JSON.stringify({target,originalProjectedRows:16,checks:11,compilerGuards:guards,typeErrors:0}));
 }}finally{await browser.close();}
 for(const result of results)for(const input of [...result.inputs,...result.typechecks.flatMap(check=>check.inputs)])assert.equal(hash(fs.readFileSync(input.file)),input.sha256,input.file);
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({qualification:'compiled-standalone-source-namespace-publication',results,cohorts,runnerSha256:hash(fs.readFileSync(__filename)),observerSha256:hash(fs.readFileSync(path.join(__dirname,'observer.ts')))},null,2)+'\n');
 console.log(JSON.stringify({out,status:'passed',targets:2,realms:2}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
