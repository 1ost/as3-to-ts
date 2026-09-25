const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const api=require('../../lib'),parse=require('../../lib/parse'),emit=require('../../lib/emit'),ts=require('typescript');
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2');
const modern=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const evidence=path.join(engine,'tests/nativeFlashOracle','generated-lexical-domain');const captured=require(path.join(evidence,'verify.cjs'));
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const root=path.resolve('.cache/native-generated-application-domain');fs.mkdirSync(root,{recursive:true});const run=fs.mkdtempSync(path.join(root,'run-'));
const modulePath=file=>{let r=path.relative(run,file).replaceAll('\\','/').replace(/\.ts$/,'');return r.startsWith('.')?r:'./'+r;};
const provider=name=>modulePath(path.join(engine,'src/layaAir/flash/utils',name+'.ts'));
const sources=Object.fromEntries([['host.ParentCallbacks','source/host/ParentCallbacks.as'],['host.ParentKnown','source/host/ParentKnown.as'],['child.ChildCallbacks','child-source/child/ChildCallbacks.as'],['child.ChildKnown','child-source/child/ChildKnown.as']].map(([name,file])=>{const source=fs.readFileSync(path.join(evidence,file),'utf8');return [name,{source,sourceSha256:hash(source)}];}));
const source=sources['host.ParentCallbacks'].source;
const applicationDomain=modulePath(path.join(engine,'src/layaAir/flash/system/ApplicationDomain.ts'));
const nativeProviders={'flash.system.ApplicationDomain':{module:applicationDomain,exportName:'ApplicationDomain'}};
const input={scope:'generated-lexical-domain',providers:nativeProviders,providerModule:provider('AS3GeneratedClass'),scriptGlobalProviderModule:provider('AS3ScriptGlobal'),scriptDomainProvider:{module:'./cohortDomain',exportName:'scriptDomain'},sources};
const plan=api.createNativeGeneratedDeclarationPlan(input);
fs.writeFileSync(path.join(run,'cohortDomain.ts'),'import {AS3ScriptDomain} from '+JSON.stringify(provider('AS3ScriptGlobal'))+';export declare const scriptDomain: AS3ScriptDomain;');
const helpers=Object.fromEntries(['bound','classBound','nativeClass','callableClass'].map(name=>[name,modulePath(path.resolve('utils',name+'.ts'))]));
const fileFor=q=>q.split('.').pop(),definitionsByNamespace={};
for(const q of Object.keys(sources)){const i=q.lastIndexOf('.');(definitionsByNamespace[q.slice(0,i)]??=[]).push(q.slice(i+1));}
const options={customVisitors:[],nativeDynamicPropertyReadsModule:provider("AS3Property"),importModules:{"compiler.AS3Invocation":provider("AS3Invocation"),"compiler.AS3Class":provider("AS3Class"),...Object.fromEntries(Object.keys(sources).map(q=>[q,'./'+fileFor(q)])),...Object.fromEntries(Object.entries(nativeProviders).map(([q,b])=>[q,b.module]))},definitionsByNamespace,
 decoratorModules:{bound:helpers.bound,classBound:helpers.classBound},nativeClassHelperModules:{nativeClass:helpers.nativeClass,callableClass:helpers.callableClass},
 nativeGeneratedDeclarations:{plan,module:'./declarationDomain'},nativeClassTraitsModule:provider('AS3GeneratedClass'),nativeLexicalMembersModule:provider('AS3LexicalMembers'),nativeGeneratedPropertyModule:provider('AS3Property'),
 nativeCallableMethodBindingModule:provider('AS3MethodBinding'),nativeCallableCoercionModule:provider('AS3Coercion'),nativeCallableStringModule:provider('AS3String'),
 nativeSourceErrorModule:modulePath(path.join(engine,'src/layaAir/flash/errors/AS3SourceError.ts')),nativeDynamicPropertyWritesModule:provider('AS3Property'),nativeComputedTypeTestModule:provider('AS3Type'),nativeDictionaryPropertyModule:provider('AS3Property'),nativeObjectCreationModule:provider("AS3Class"),nativeTypedLocals:true,nativeTypedLocalReferenceModule:provider('AS3Type'),nativeTypedLocalAdditionModule:provider('AS3Addition'),nativeArrayCreationModule:provider('AS3ArrayCreation')};
const combined=process.argv.includes('--combined');if(combined)Object.assign(options,{nativeReferenceCoercion:{plan,module:'./declarationDomain',coercionModule:provider('AS3Type')},nativeNumericMethodParametersModule:provider('AS3Coercion'),nativeSignaturePropertyModule:provider('AS3Property')});
let rejectionGuards=0;
const guarded=(patch,optionPatch={})=>{
 assert.throws(()=>{const altered=api.createNativeGeneratedDeclarationPlan({...input,...patch});const subject=(patch.sources||sources)['host.ParentCallbacks'].source;emit(parse('ParentCallbacks.as',subject),subject,{...options,nativeGeneratedDeclarations:{plan:altered,module:'./declarationDomain'},...(combined?{nativeReferenceCoercion:{...options.nativeReferenceCoercion,plan:altered}}:{}),...optionPatch});},/AS3_[A-Z_]+UNSUPPORTED/);rejectionGuards++;
};
guarded({scriptDomainProvider:undefined});guarded({scriptGlobalProviderModule:undefined});guarded({scriptGlobalSources:['host.ParentKnown']});
for(const scriptDomainProvider of [{},{module:'./cohortDomain'},{module:'./cohortDomain',exportName:null},{module:'./cohortDomain',exportName:7},{module:'./cohortDomain',exportName:'x.y'},{module:'bad\nmodule',exportName:'scriptDomain'},{module:'./cohortDomain',exportName:'scriptDomain',extra:true}])guarded({scriptDomainProvider});
guarded({providers:{}});guarded({providers:{'flash.system.ApplicationDomain':{module:applicationDomain,exportName:'Other'}}});
guarded({}, {importModules:{...options.importModules,'flash.system.ApplicationDomain':'./different'}});
for(const expr of ['ApplicationDomain.currentDomain = null','delete ApplicationDomain.currentDomain','ApplicationDomain.currentDomain()']){
 const changed=source.replace('return ApplicationDomain.currentDomain;','return '+expr+';');
 guarded({sources:{...sources,'host.ParentCallbacks':{source:changed,sourceSha256:hash(changed)}}});
}
// Lexically shadowed names must never acquire a native domain read.
let shadowGuards=0;
for(const [parameter,body] of [['ApplicationDomain:Object','return ApplicationDomain.currentDomain;'],['flash:Object','return flash.system.ApplicationDomain.currentDomain;']]){
 const shadow='package host { import flash.system.ApplicationDomain; public class ParentCallbacks { public function current('+parameter+'):* {'+body+'} } }';
 const altered=api.createNativeGeneratedDeclarationPlan({...input,sources:{...sources,'host.ParentCallbacks':{source:shadow,sourceSha256:hash(shadow)}}});
 try {
  const output=emit(parse('ParentCallbacks.as',shadow),shadow,{...options,nativeGeneratedDeclarations:{plan:altered,module:'./declarationDomain'},...(combined?{nativeReferenceCoercion:{...options.nativeReferenceCoercion,plan:altered}}:{})});
  assert.ok(!output.includes('getAS3ScriptApplicationDomain'));
 } catch(error) {assert.match(error.message,/AS3_[A-Z_]+UNSUPPORTED/);}
 shadowGuards++;
}
fs.writeFileSync(path.join(run,'declarationDomain.ts'),plan.moduleSource);const emitted=[];
for(const binding of [...plan.bindings,...plan.interfaces]){const source=sources[binding.qname].source,file=path.join(run,fileFor(binding.qname)+'.ts');fs.mkdirSync(path.dirname(file),{recursive:true});
 const opts={...options};
 if(plan.interfaces.some(i=>i.qname===binding.qname)){for(const k of Object.keys(opts))if(k.startsWith('native'))delete opts[k];}
 const output=emit(parse(binding.qname+'.as',source),source,opts);fs.writeFileSync(file,output);emitted.push({qname:binding.qname,file,sourceSha256:hash(source),outputSha256:hash(output)});
}
const files=[path.join(run,'declarationDomain.ts'),path.join(run,'cohortDomain.ts'),...emitted.map(e=>e.file),...['glsl.d.ts','spine.d.ts'].map(f=>path.join(engine,'src/layaAir/tslibs',f))];
const program=modern.createProgram(files,{target:modern.ScriptTarget.ES2020,module:modern.ModuleKind.CommonJS,strict:true,strictNullChecks:false,useUnknownInCatchVariables:false,experimentalDecorators:true,noEmit:true,skipLibCheck:true,lib:['lib.es2020.d.ts','lib.dom.d.ts']});
const diagnostics=modern.getPreEmitDiagnostics(program).map(d=>({file:d.file&&path.relative(run,d.file.fileName),code:d.code,text:modern.flattenDiagnosticMessageText(d.messageText,'\n')}));fs.writeFileSync(path.join(run,'types.json'),JSON.stringify(diagnostics,null,2));assert.deepEqual(diagnostics.filter(d=>!d.file.startsWith('..')),[]);
assert.deepEqual(diagnostics,[]);
const names=['ApplicationDomain','AS3MethodBinding','AS3Coercion','AS3String','AS3Type','AS3Property','AS3Class','AS3Invocation','AS3DeclarationType','FlashTypeMetadata','AS3LexicalMembers','AS3ArrayCreation','AS3Addition','QName','AS3DynamicObject','AS3SourceError','AS3ScriptGlobal','AS3GeneratedClass'];
const moduleFor=n=>'src/layaAir/flash/'+(n==='ApplicationDomain'?'system':['AS3SourceError','IllegalOperationError'].includes(n)?'errors':'utils')+'/'+n;
const built=esbuild.buildSync({absWorkingDir:engine,stdin:{contents:names.map(n=>'export * from "./'+moduleFor(n)+'";').join('\n'),resolveDir:engine,loader:'ts'},bundle:true,write:false,format:'cjs',platform:'browser',target:'es2020',loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'},metafile:true});
const providerGraph=Object.keys(built.metafile.inputs).filter(f=>f!=='<stdin>').map(f=>({file:f,sha256:hash(fs.readFileSync(path.resolve(engine,f)))}));
const driverFile=path.resolve('tests/native-generated-application-domain/runtime-driver.js'),observer=fs.readFileSync(driverFile,'utf8');
const wanted=captured;assert.equal(wanted.length,14);
for(const mutate of [v=>v.pop(),v=>v.reverse(),v=>v.find(r=>r.id==='child-direct').value[4]=false]){const bad=structuredClone(wanted);mutate(bad);assert.throws(()=>assert.deepEqual(bad,wanted));}
(async()=>{const {chromium}=require(require.resolve('playwright',{paths:[path.resolve('../op2-html5/game-client-laya'),engine]}));const browser=await chromium.launch({headless:true});const results=[];
try{for(const target of [ts.ScriptTarget.ES5,ts.ScriptTarget.ES2015]){
 const specs=[];for(const file of files.filter(f=>!f.endsWith('.d.ts'))){const source=fs.readFileSync(file,'utf8'),out=ts.transpileModule(source,{compilerOptions:{target,module:ts.ModuleKind.CommonJS,experimentalDecorators:true},reportDiagnostics:true});assert.deepEqual(out.diagnostics,[]);const relative=path.relative(run,file).replaceAll('\\','/').replace(/\.ts$/,'');specs.push({name:relative,code:out.outputText});}
 for(const name of ['bound','classBound','nativeClass','callableClass'])specs.push({name,code:modern.transpileModule(fs.readFileSync(path.resolve('utils',name+'.ts'),'utf8'),{compilerOptions:{target,module:modern.ModuleKind.CommonJS}}).outputText});
 const script='{if(typeof window==="undefined"){globalThis.window=globalThis;globalThis.document={};}const api=(()=>{const module={exports:{}};'+built.outputFiles[0].text+';return module.exports;})();const shared=new Map(),specs=new Map('+JSON.stringify(specs)+'.map(s=>[s.name,s.code])),providers=new Set('+JSON.stringify(names)+'),localNames=new Set('+JSON.stringify(['declarationDomain',...emitted.map(e=>fileFor(e.qname))])+');function createDomainLoader(domain){const local=new Map();function load(name){if(name==="cohortDomain")return {scriptDomain:domain};if(providers.has(name))return api;const modules=localNames.has(name)?local:shared;if(modules.has(name))return modules.get(name);if(!specs.has(name))throw Error("unresolved module "+name);const output={};modules.set(name,output);new Function("exports","require",specs.get(name))(output,r=>load(r.split("/").pop()));return output;}load.loaded=local;return load;}'+observer+'}';
 fs.writeFileSync(path.join(run,'bundle-'+target+'.js'),script);const node=JSON.parse(JSON.stringify(new Function(script+';return globalThis.result.rows;')()));
 const page=await browser.newPage();await page.addScriptTag({content:script});const web=await page.evaluate(()=>JSON.parse(JSON.stringify(globalThis.result.rows)));const browserChecks=await page.evaluate(()=>globalThis.result.guards);assert.equal(browserChecks,globalThis.result.guards);await page.close();
 for(const actual of [node,web]){assert.deepEqual(actual,wanted);}
 assert.equal(globalThis.result.guards,4);
 results.push({target,node,web,runtimeGuards:globalThis.result.guards});
}}finally{await browser.close();}
fs.writeFileSync(path.join(run,'report.json'),JSON.stringify({combined,emitted,results,providerGraph,observer:{file:driverFile,sha256:hash(observer)},typecheck:{files:program.getSourceFiles().length,diagnostics},rejectionGuards,shadowGuards,comparisonNegativeControls:3,held:['Typed ApplicationDomain signatures; source static initializer retry; Loader/Sprite host port; inherited Class collisions; whole-client flows']},null,2));console.log(JSON.stringify({run,sourceClasses:4,airRows:wanted.length,rejectionGuards,shadowGuards,runtimeGuards:results.map(r=>r.runtimeGuards),targets:['ES5','ES2015'],runtimes:['Node','Chromium'],generatedTypeErrors:0,dependencyTypeErrors:diagnostics.length}));
})().catch(e=>{console.error(e);process.exitCode=1;});
