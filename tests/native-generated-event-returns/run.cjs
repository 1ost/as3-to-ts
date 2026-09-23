const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const compiler=path.resolve(__dirname,'../..'),root=path.resolve(compiler,'../op2-html5'),engine=path.resolve(compiler,'../LayaAir-op2');
const api=require(path.join(compiler,'lib')),parse=require(path.join(compiler,'lib/parse')),emit=require(path.join(compiler,'lib/emit')),ts=require(path.join(compiler,'node_modules/typescript'));
const modern=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const evidence=path.join(engine,'tests/nativeFlashOracle/op2-collection-events'),captured=require(path.join(evidence,'verify.cjs'));
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const base=path.join(compiler,'.cache/native-generated-event-returns');fs.mkdirSync(base,{recursive:true});const run=fs.mkdtempSync(path.join(base,'run-'));
const modulePath=file=>{let r=path.relative(run,file).replaceAll('\\','/').replace(/\.ts$/,'');return r.startsWith('.')?r:'./'+r;};
const provider=name=>modulePath(path.join(engine,'src/layaAir/flash/utils',name+'.ts'));
const sources={};
for(const q of ['cn.kyiax.yare.ui.event.CollectionEvent','cn.kyiax.yare.ui.event.PropertyChangeEvent','cn.kyiax.yare.ui.event.PropertyChangeEventKind','cases.EventReturns']){
 const source=fs.readFileSync(path.join(evidence,'source',q.replaceAll('.','/')+'.as'),'utf8');sources[q]={source,sourceSha256:hash(source)};
 if(q.startsWith('cn.'))assert.equal(source,fs.readFileSync(path.join(root,'game-client-flash/src',q.replaceAll('.','/')+'.as'),'utf8'));
}
const nativeProviders={'flash.events.Event':{module:provider('AS3CanonicalEventConstruction'),exportName:'Event',nativeBase:'Event'}};
const plan=api.createNativeGeneratedDeclarationPlan({scope:'native-generated-event-returns',providers:nativeProviders,providerModule:provider('AS3GeneratedClass'),sources});
const helpers=Object.fromEntries(['bound','classBound','nativeClass','callableClass'].map(name=>[name,modulePath(path.join(compiler,'utils',name+'.ts'))]));
const fileFor=q=>q.split('.').pop(),definitionsByNamespace={};
for(const q of Object.keys(sources)){const i=q.lastIndexOf('.');(definitionsByNamespace[q.slice(0,i)]??=[]).push(q.slice(i+1));}
const options={customVisitors:[],nativeGlobalModules:{Date:provider("AS3Date")},importModules:{"compiler.AS3Invocation":provider("AS3Invocation"),"compiler.AS3Class":provider("AS3Class"),...Object.fromEntries(Object.keys(sources).map(q=>[q,'./'+fileFor(q)])),...Object.fromEntries(Object.entries(nativeProviders).map(([q,b])=>[q,b.module]))},definitionsByNamespace,
 decoratorModules:{bound:helpers.bound,classBound:helpers.classBound},nativeClassHelperModules:{nativeClass:helpers.nativeClass,callableClass:helpers.callableClass},
 nativeGeneratedDeclarations:{plan,module:'./declarationDomain'},nativeClassTraitsModule:provider('AS3GeneratedClass'),nativeLexicalMembersModule:provider('AS3LexicalMembers'),nativeGeneratedPropertyModule:provider('AS3Property'),
 nativeCallableMethodBindingModule:provider('AS3MethodBinding'),nativeCallableCoercionModule:provider('AS3Coercion'),nativeCallableStringModule:provider('AS3String'),
 nativeSourceErrorModule:modulePath(path.join(engine,'src/layaAir/flash/errors/AS3SourceError.ts')),nativeDynamicPropertyWritesModule:provider('AS3Property'),nativeDynamicPropertyReadsModule:provider('AS3Property'),nativeJSONModule:provider('AS3JSON'),nativeComputedTypeTestModule:provider('AS3Type'),nativeDictionaryPropertyModule:provider('AS3Property'),nativeEnumeration:{dictionaryModule:provider("Dictionary"),coercionModule:provider("AS3Coercion"),stringModule:provider("AS3String")},nativeObjectCreationModule:provider("AS3Class"),nativeTypedLocals:true,nativeTypedLocalReferenceModule:provider('AS3Type'),nativeTypedLocalAdditionModule:provider('AS3Addition'),nativeArrayCreationModule:provider('AS3ArrayCreation')};
const combined=true;if(combined)Object.assign(options,{nativeReferenceCoercion:{plan,module:'./declarationDomain',coercionModule:provider('AS3Type')},nativeNumericMethodParametersModule:provider('AS3Coercion'),nativeSignaturePropertyModule:provider('AS3Property')});
let guards=0;
for(const [name,bindings] of [
 ['flash.events.Event',{'flash.events.Event':{module:provider('AS3CanonicalEventConstruction'),exportName:'Event'}}],
 ['Date',{Date:{module:provider('AS3Date'),exportName:'AS3Date'}}]
]) {
 const type=name.split('.').pop(),source='package {'+(name.includes('.')?'import '+name+';':'')+'public class Guard {public function Guard(){super();} public function echo(value:*):'+type+' {return value;}}}';
 const p=api.createNativeGeneratedDeclarationPlan({scope:'guard-native-return',providerModule:provider('AS3GeneratedClass'),sources:{Guard:{source,sourceSha256:hash(source)}},providers:bindings});
 assert.throws(()=>emit(parse('Guard.as',source),source,{...options,nativeGlobalModules:{},importModules:{...options.importModules,...Object.fromEntries(Object.entries(bindings).map(([q,b])=>[q,b.module]))},nativeGeneratedDeclarations:{plan:p,module:'./guard'},nativeReferenceCoercion:{plan:p,module:'./guard',coercionModule:provider('AS3Type')}}),/generated native return type requires separate qualification/);
 guards++;
}
fs.writeFileSync(path.join(run,'declarationDomain.ts'),plan.moduleSource);const emitted=[];
for(const binding of [...plan.bindings,...plan.interfaces]){const source=sources[binding.qname].source,file=path.join(run,fileFor(binding.qname)+'.ts');fs.mkdirSync(path.dirname(file),{recursive:true});
 const opts={...options};
 if(plan.interfaces.some(i=>i.qname===binding.qname)){for(const k of Object.keys(opts))if(k.startsWith('native'))delete opts[k];}
 const output=emit(parse(binding.qname+'.as',source),source,opts);fs.writeFileSync(file,output);emitted.push({qname:binding.qname,file,sourceSha256:hash(source),outputSha256:hash(output)});
}
const files=[path.join(run,'declarationDomain.ts'),...emitted.map(e=>e.file),...['glsl.d.ts','spine.d.ts'].map(f=>path.join(engine,'src/layaAir/tslibs',f))];
const program=modern.createProgram(files,{target:modern.ScriptTarget.ES2020,module:modern.ModuleKind.CommonJS,strict:true,strictNullChecks:false,experimentalDecorators:true,noEmit:true,skipLibCheck:true,lib:['lib.es2020.d.ts','lib.dom.d.ts']});
const diagnostics=modern.getPreEmitDiagnostics(program).map(d=>({file:d.file&&path.relative(run,d.file.fileName),code:d.code,text:modern.flattenDiagnosticMessageText(d.messageText,'\n')}));fs.writeFileSync(path.join(run,'types.json'),JSON.stringify(diagnostics,null,2));
const names=['AS3JSON','ByteArray','AS3Date','AS3MethodBinding','AS3Coercion','AS3String','AS3Type','AS3Property','AS3Class','AS3Invocation','AS3DeclarationType','FlashTypeMetadata','AS3LexicalMembers','AS3ArrayCreation','AS3Addition','QName','AS3DynamicObject','AS3SourceError','AS3ScriptGlobal','AS3GeneratedClass','AS3CanonicalEventConstruction'];
const moduleFor=n=>'src/layaAir/flash/'+(['AS3SourceError','IllegalOperationError'].includes(n)?'errors':'utils')+'/'+n;
const built=esbuild.buildSync({absWorkingDir:engine,stdin:{contents:names.map(n=>'export * from "./'+moduleFor(n)+'";').join('\n'),resolveDir:engine,loader:'ts'},bundle:true,write:false,format:'cjs',platform:'browser',target:'es2020',loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'},metafile:true});
const providerGraph=Object.keys(built.metafile.inputs).filter(f=>f!=='<stdin>').map(f=>({file:f,sha256:hash(fs.readFileSync(path.resolve(engine,f)))}));
const driverFile=path.join(__dirname,'runtime-driver.js'),observer=fs.readFileSync(driverFile,'utf8');
const wanted=captured;assert.equal(wanted.length,24);
for(const mutate of [v=>v.pop(),v=>v.reverse(),v=>v.find(r=>r.id==='return-identity').value[0]=0]){const bad=structuredClone(wanted);mutate(bad);assert.throws(()=>assert.deepEqual(bad,wanted));}
(async()=>{const {chromium}=require(require.resolve('playwright',{paths:[path.join(root,'game-client-laya'),engine]}));const browser=await chromium.launch({headless:true});const results=[];
try{for(const target of [ts.ScriptTarget.ES5,ts.ScriptTarget.ES2015]){
 const specs=[];for(const file of files.filter(f=>!f.endsWith('.d.ts'))){const source=fs.readFileSync(file,'utf8'),out=ts.transpileModule(source,{compilerOptions:{target,module:ts.ModuleKind.CommonJS,experimentalDecorators:true},reportDiagnostics:true});assert.deepEqual(out.diagnostics,[]);const relative=path.relative(run,file).replaceAll('\\','/').replace(/\.ts$/,'');specs.push({name:relative,code:out.outputText});}
 for(const name of ['bound','classBound','nativeClass','callableClass'])specs.push({name,code:modern.transpileModule(fs.readFileSync(path.join(compiler,'utils',name+'.ts'),'utf8'),{compilerOptions:{target,module:modern.ModuleKind.CommonJS}}).outputText});
 const script='{if(typeof window==="undefined"){globalThis.window=globalThis;globalThis.document={};}const api=(()=>{const module={exports:{}};'+built.outputFiles[0].text+';return module.exports;})();const shared=new Map(),specs=new Map('+JSON.stringify(specs)+'.map(s=>[s.name,s.code])),providers=new Set('+JSON.stringify(names)+'),localNames=new Set('+JSON.stringify(['declarationDomain',...emitted.map(e=>fileFor(e.qname))])+');function createDomainLoader(){const local=new Map();function load(name){if(providers.has(name))return api;const modules=localNames.has(name)?local:shared;if(modules.has(name))return modules.get(name);if(!specs.has(name))throw Error("unresolved module "+name);const output={};modules.set(name,output);new Function("exports","require",specs.get(name))(output,r=>load(r.split("/").pop()));return output;}load.loaded=local;return load;}const load=createDomainLoader();'+observer+'}';
 fs.writeFileSync(path.join(run,'bundle-'+target+'.js'),script);const node=JSON.parse(JSON.stringify(new Function(script+';return globalThis.result;')()));
 const page=await browser.newPage();await page.addScriptTag({content:script});const web=await page.evaluate(()=>JSON.parse(JSON.stringify(globalThis.result)));await page.close();
 const compare=actual=>wanted.flatMap((expected,index)=>{try{assert.deepEqual(actual[index],expected);return [];}catch{return [{id:expected.id,expected,actual:actual[index]}];}});
 assert.equal(node.length,wanted.length);assert.equal(web.length,wanted.length);assert.deepEqual(node,web);
 const mismatches=compare(node);
 results.push({target,node,web,mismatches});
}}finally{await browser.close();}
const status=diagnostics.length||results.some(r=>r.mismatches.length)?'failed':'passed';
fs.writeFileSync(path.join(run,'report.json'),JSON.stringify({status,guards,emitted,results,providerGraph,
 declarationDomain:{file:path.join(run,'declarationDomain.ts'),sha256:hash(plan.moduleSource)},
 helpers:['bound','classBound','nativeClass','callableClass'].map(name=>{const file=path.join(compiler,'utils',name+'.ts');return {name,file,sha256:hash(fs.readFileSync(file))};}),
 observer:{file:driverFile,sha256:hash(observer)},typecheck:{files:program.getSourceFiles().length,diagnostics},comparisonNegativeControls:3,scope:'Four complete subjects and 24 AIR rows for canonical Event returns and original OP2 collection events. Other native return profiles remain held.'},null,2));
console.log(JSON.stringify({run,status,guards,sources:emitted.length,airRows:wanted.length,typeErrors:diagnostics.length,mismatches:results.map(r=>({target:r.target,ids:r.mismatches.map(m=>m.id)}))}));if(status!=='passed')process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
