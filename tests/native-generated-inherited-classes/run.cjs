const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const api=require('../../lib'),parse=require('../../lib/parse'),emit=require('../../lib/emit'),ts=require('typescript');
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2');
const modern=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const evidence=path.join(engine,'tests/nativeFlashOracle',process.argv.includes('--layout')?'generated-inherited-layout':'generated-inherited-classes');const captured=require(path.join(evidence,'verify.cjs'));
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const root=path.resolve('.cache/native-generated-inherited-classes');fs.mkdirSync(root,{recursive:true});const run=fs.mkdtempSync(path.join(root,'run-'));
const modulePath=file=>{let r=path.relative(run,file).replaceAll('\\','/').replace(/\.ts$/,'');return r.startsWith('.')?r:'./'+r;};
const provider=name=>modulePath(path.join(engine,'src/layaAir/flash/utils',name+'.ts'));
const readSource=file=>{const source=fs.readFileSync(path.join(evidence,file),'utf8');return {source,sourceSha256:hash(source)};};
const cohorts={parent:{'shared.Shared':readSource('source/shared/Shared.as')},child:{
 'shared.Shared':readSource('child-source/shared/Shared.as'),'child.Reader':readSource('child-source/child/Reader.as'),
 'child.Derived':readSource('child-source/child/Derived.as')}};
const applicationDomain=modulePath(path.join(engine,'src/layaAir/flash/system/ApplicationDomain.ts'));
const input={scope:'generated-inherited-classes',providerModule:provider('AS3GeneratedClass'),scriptGlobalProviderModule:provider('AS3ScriptGlobal'),
 scriptDomainProvider:{module:'./cohortDomain',exportName:'scriptDomain'},inheritScriptClasses:true,sources:cohorts.child};
fs.writeFileSync(path.join(run,'cohortDomain.ts'),'import {AS3ScriptDomain} from '+JSON.stringify(provider('AS3ScriptGlobal'))+';export declare const scriptDomain: AS3ScriptDomain;');
const sources=cohorts.child, nativeProviders={};
const helpers=Object.fromEntries(['bound','classBound','nativeClass','callableClass'].map(name=>[name,modulePath(path.resolve('utils',name+'.ts'))]));
const fileFor=q=>q.split('.').pop(),definitionsByNamespace={};
for(const q of Object.keys(sources)){const i=q.lastIndexOf('.');(definitionsByNamespace[q.slice(0,i)]??=[]).push(q.slice(i+1));}
const options={customVisitors:[],nativeDynamicPropertyReadsModule:provider("AS3Property"),importModules:{"compiler.AS3Invocation":provider("AS3Invocation"),"compiler.AS3Class":provider("AS3Class"),...Object.fromEntries(Object.keys(sources).map(q=>[q,'./'+fileFor(q)])),...Object.fromEntries(Object.entries(nativeProviders).map(([q,b])=>[q,b.module]))},definitionsByNamespace,
 decoratorModules:{bound:helpers.bound,classBound:helpers.classBound},nativeClassHelperModules:{nativeClass:helpers.nativeClass,callableClass:helpers.callableClass},
 nativeClassTraitsModule:provider('AS3GeneratedClass'),nativeLexicalMembersModule:provider('AS3LexicalMembers'),nativeGeneratedPropertyModule:provider('AS3Property'),
 nativeCallableMethodBindingModule:provider('AS3MethodBinding'),nativeCallableCoercionModule:provider('AS3Coercion'),nativeCallableStringModule:provider('AS3String'),
 nativeSourceErrorModule:modulePath(path.join(engine,'src/layaAir/flash/errors/AS3SourceError.ts')),nativeDynamicPropertyWritesModule:provider('AS3Property'),nativeComputedTypeTestModule:provider('AS3Type'),nativeDictionaryPropertyModule:provider('AS3Property'),nativeObjectCreationModule:provider("AS3Class"),nativeTypedLocals:true,nativeTypedLocalReferenceModule:provider('AS3Type'),nativeTypedLocalAdditionModule:provider('AS3Addition'),nativeArrayCreationModule:provider('AS3ArrayCreation')};
const combined=process.argv.includes('--combined');
let rejectionGuards=0;
const guarded=patch=>{assert.throws(()=>api.createNativeGeneratedDeclarationPlan({...input,...patch}),/AS3_[A-Z_]+UNSUPPORTED/);rejectionGuards++;};
for(const patch of [{inheritScriptClasses:false},{inheritScriptClasses:'true'},{scriptDomainProvider:undefined},
 {scriptGlobalProviderModule:undefined},{scriptGlobalSources:['child.Reader']},{lexicalProviderModule:provider('AS3LexicalMembers')},
 {sources:{...sources,'child.I':{source:'package child {public interface I {}}',sourceSha256:hash('package child {public interface I {}}')}}}])guarded(patch);
const overrideSources=Object.fromEntries(Object.entries({
 'check.Base':'package check {public class Base {public function read(value:Object=null):int {return 1;}}}',
 'check.Child':'package check {public class Child extends Base {override public function read(value:Object=null):int {return 2;}}}'
}).map(([name,source])=>[name,{source,sourceSha256:hash(source)}]));
const overridePlan=api.createNativeGeneratedDeclarationPlan({...input,sources:overrideSources});
assert.throws(()=>new (require('../../lib/emit/native-generated-traits').NativeGeneratedClassTraits)(overridePlan,input.scope,'check.Child',overrideSources['check.Child'].source),/selected parent override requires matching fixed intrinsic method signature/);rejectionGuards++;
const emitted=[],plans={},files=[path.join(run,'cohortDomain.ts'),...['glsl.d.ts','spine.d.ts'].map(f=>path.join(engine,'src/layaAir/tslibs',f))];
for(const [cohort,sources] of Object.entries(cohorts)){
 const plan=api.createNativeGeneratedDeclarationPlan({...input,scope:cohort,sources});plans[cohort]=plan;
 const declaration='./'+cohort+'_declarationDomain';const domainFile=path.join(run,cohort+'_declarationDomain.ts');fs.writeFileSync(domainFile,plan.moduleSource);files.push(domainFile);
 for(const binding of plan.bindings){
  const source=sources[binding.qname].source,file=path.join(run,cohort+'_'+fileFor(binding.qname)+'.ts');
  const opts={...options,nativeGeneratedDeclarations:{plan,module:declaration},
   importModules:{...options.importModules,...Object.fromEntries(Object.keys(sources).map(q=>[q,'./'+cohort+'_'+fileFor(q)]))},
   nativeReferenceCoercion:{plan,module:declaration,coercionModule:provider('AS3Type')}};
  if(combined)Object.assign(opts,{nativeNumericMethodParametersModule:provider('AS3Coercion'),nativeSignaturePropertyModule:provider('AS3Property')});
  if(cohort==='child'&&binding.qname==='child.Reader') {
   assert.throws(()=>emit(parse(binding.qname+'.as',source),source,{...opts,nativeObjectCreationModule:undefined,
    importModules:{...opts.importModules,'compiler.AS3Class':undefined}}),/AS3_[A-Z_]+UNSUPPORTED/);rejectionGuards++;
  }
  const output=emit(parse(binding.qname+'.as',source),source,opts);fs.writeFileSync(file,output);files.push(file);
  emitted.push({cohort,qname:binding.qname,file,sourceSha256:hash(source),outputSha256:hash(output)});
 }
}
const program=modern.createProgram(files,{target:modern.ScriptTarget.ES2020,module:modern.ModuleKind.CommonJS,strict:true,strictNullChecks:false,useUnknownInCatchVariables:false,experimentalDecorators:true,noEmit:true,skipLibCheck:true,lib:['lib.es2020.d.ts','lib.dom.d.ts']});
const diagnostics=modern.getPreEmitDiagnostics(program).map(d=>({file:d.file&&path.relative(run,d.file.fileName),code:d.code,text:modern.flattenDiagnosticMessageText(d.messageText,'\n')}));fs.writeFileSync(path.join(run,'types.json'),JSON.stringify(diagnostics,null,2));assert.deepEqual(diagnostics.filter(d=>!d.file.startsWith('..')),[]);
assert.deepEqual(diagnostics,[]);
const names=['ApplicationDomain','AS3MethodBinding','AS3Coercion','AS3String','AS3Type','AS3Property','AS3Class','AS3Invocation','AS3DeclarationType','FlashTypeMetadata','AS3LexicalMembers','AS3ArrayCreation','AS3Addition','QName','AS3DynamicObject','AS3SourceError','AS3ScriptGlobal','AS3GeneratedClass','DefinitionRegistry','NativeSourceClassLoadingSession'];
const moduleFor=n=>'src/layaAir/flash/'+(n==='ApplicationDomain'?'system':['AS3SourceError','IllegalOperationError'].includes(n)?'errors':'utils')+'/'+n;
const built=esbuild.buildSync({absWorkingDir:engine,stdin:{contents:names.map(n=>'export * from "./'+moduleFor(n)+'";').join('\n'),resolveDir:engine,loader:'ts'},bundle:true,write:false,format:'cjs',platform:'browser',target:'es2020',loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'},metafile:true});
const providerGraph=Object.keys(built.metafile.inputs).filter(f=>f!=='<stdin>').map(f=>({file:f,sha256:hash(fs.readFileSync(path.resolve(engine,f)))}));
const driverFile=path.resolve('tests/native-generated-inherited-classes/'+(process.argv.includes('--session')?'runtime-driver-session.js':'runtime-driver.js')),observer=fs.readFileSync(driverFile,'utf8');
const wanted=captured;assert.equal(wanted.length,47);
for(const mutate of [v=>v.pop(),v=>v.reverse(),v=>v.find(r=>r.id==='mode-0-parent-identity').value=false]){const bad=structuredClone(wanted);mutate(bad);assert.throws(()=>assert.deepEqual(bad,wanted));}
if(process.argv.includes('--factory'))require('./factory.cjs')({api,ts,modern,esbuild,engine,run,plans,options,combined,names,moduleFor,modulePath,provider,helpers,wanted,rejectionGuards}).catch(e=>{console.error(e);process.exitCode=1;});
else (async()=>{const {chromium}=require(require.resolve('playwright',{paths:[path.resolve('../op2-html5/game-client-laya'),engine]}));const browser=await chromium.launch({headless:true});const results=[];
try{for(const target of [ts.ScriptTarget.ES5,ts.ScriptTarget.ES2015]){
 const specs=[];for(const file of files.filter(f=>!f.endsWith('.d.ts'))){const source=fs.readFileSync(file,'utf8'),out=ts.transpileModule(source,{compilerOptions:{target,module:ts.ModuleKind.CommonJS,experimentalDecorators:true},reportDiagnostics:true});assert.deepEqual(out.diagnostics,[]);const relative=path.relative(run,file).replaceAll('\\','/').replace(/\.ts$/,'');specs.push({name:relative,code:out.outputText});}
 for(const name of ['bound','classBound','nativeClass','callableClass'])specs.push({name,code:modern.transpileModule(fs.readFileSync(path.resolve('utils',name+'.ts'),'utf8'),{compilerOptions:{target,module:modern.ModuleKind.CommonJS}}).outputText});
 const script='{if(typeof window==="undefined"){globalThis.window=globalThis;globalThis.document={};}const api=(()=>{const module={exports:{}};'+built.outputFiles[0].text+';return module.exports;})();const shared=new Map(),specs=new Map('+JSON.stringify(specs)+'.map(s=>[s.name,s.code])),providers=new Set('+JSON.stringify(names)+');const plans='+JSON.stringify(Object.fromEntries(Object.entries(plans).map(([k,p])=>[k,p.bindings])))+';const instantiations=[];const runtime={...api,instantiateAS3ScriptUnit:(domain,input,factory)=>{instantiations.push(input.sourceId);return api.instantiateAS3ScriptUnit(domain,input,factory);}};function createDomainLoader(domain){const local=new Map();function load(name){if(name==="cohortDomain")return {scriptDomain:domain};if(providers.has(name))return runtime;const modules=/^(bound|classBound|nativeClass|callableClass)$/.test(name)?shared:local;if(modules.has(name))return modules.get(name);if(!specs.has(name))throw Error("unresolved module "+name);const output={};modules.set(name,output);new Function("exports","require",specs.get(name))(output,r=>load(r.split("/").pop()));return output;}return load;}'+'globalThis.completion=(async()=>{'+observer+'})();}';
 fs.writeFileSync(path.join(run,'bundle-'+target+'.js'),script);await new Function(script+';return globalThis.completion;')();const node=JSON.parse(JSON.stringify(globalThis.result.rows));
 const page=await browser.newPage();await page.addScriptTag({content:script});await page.evaluate(()=>globalThis.completion);const web=await page.evaluate(()=>JSON.parse(JSON.stringify(globalThis.result.rows)));const browserChecks=await page.evaluate(()=>globalThis.result.guards);assert.equal(browserChecks,globalThis.result.guards);await page.close();
 for(const actual of [node,web]){assert.deepEqual(actual,wanted);}
 assert.equal(globalThis.result.guards,15);
 const runtimeGuards=globalThis.result.guards;
 const marker='const runtime={...api,';assert.equal(script.split(marker).length,2);
 await assert.rejects(async()=>{await new Function(script.replace(marker,marker+'selectAS3ScriptDomainClass:()=>undefined,')+';return globalThis.completion;')();},process.argv.includes('--session')?/cohort did not reuse selected declaration/:/Child allocated an inherited type token/);
 await new Function(script.replace(marker,marker+'as3CoerceClass:value=>value,')+';return globalThis.completion;')();const uncoerced=JSON.parse(JSON.stringify(globalThis.result.rows));
 assert.equal(uncoerced.find(row=>row.id==='mode-0-class-wrong').value,'returned');assert.throws(()=>assert.deepEqual(uncoerced,wanted));
 const negatives=['missing-inheritance','uncoerced-Class-return'];
 if(process.argv.includes('--layout')) {
  // Recreate the old discarded-child String projection without touching subject bodies.
  const mutation='registerAS3GeneratedClass:(ctor,definition)=>{if(definition.instanceBase){definition={...definition,metadata:{...definition.metadata,instance:{...definition.metadata.instance,variables:[{name:"tag",type:"String",declaredBy:"shared::Shared"},...definition.metadata.instance.variables]}},instanceTraits:[{name:"tag",kind:"variable",type:"String"},...definition.instanceTraits]};delete definition.instanceBase;}return api.registerAS3GeneratedClass(ctor,definition);},';
  await new Function(script.replace(marker,marker+mutation)+';return globalThis.completion;')();const wrong=JSON.parse(JSON.stringify(globalThis.result.rows));
  assert.equal(wrong.find(row=>row.id==='mode-0-derived').value[0],'123');assert.throws(()=>assert.deepEqual(wrong,wanted));
  negatives.push('discarded-child-field-layout');
 }
 results.push({target,node,web,runtimeGuards,implementationNegatives:negatives});
}}finally{await browser.close();}
fs.writeFileSync(path.join(run,'report.json'),JSON.stringify({session:process.argv.includes('--session'),layout:process.argv.includes('--layout'),combined,emitted,results,providerGraph,observer:{file:driverFile,sha256:hash(observer)},typecheck:{files:program.getSourceFiles().length,diagnostics},rejectionGuards,comparisonNegativeControls:3,held:['Source static initializers; Loader/Sprite host port; interfaces and package-internal aliases; automatic cohort header publication; whole-client flows']},null,2));console.log(JSON.stringify({run,sourceClasses:4,airRows:wanted.length,rejectionGuards,runtimeGuards:results.map(r=>r.runtimeGuards),implementationNegatives:process.argv.includes('--layout')?3:2,targets:['ES5','ES2015'],runtimes:['Node','Chromium'],generatedTypeErrors:0,dependencyTypeErrors:diagnostics.length}));
})().catch(e=>{console.error(e);process.exitCode=1;});
