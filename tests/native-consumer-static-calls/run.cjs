const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const api=require('../../lib'),parse=require('../../lib/parse'),emit=require('../../lib/emit'),ts=require('typescript');
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2');
const modern=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const evidence=path.join(engine,'tests/nativeFlashOracle','consumer-static-calls');const captured=require(path.join(evidence,'verify.cjs'));
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const root=path.resolve('.cache/native-consumer-static-calls');fs.mkdirSync(root,{recursive:true});const run=fs.mkdtempSync(path.join(root,'run-'));
const modulePath=file=>{let r=path.relative(run,file).replaceAll('\\','/').replace(/\.ts$/,'');return r.startsWith('.')?r:'./'+r;};
const provider=name=>modulePath(path.join(engine,'src/layaAir/flash/utils',name+'.ts'));
const sources={};
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,item.name);
 if(item.isDirectory())walk(file);else if(item.name.endsWith('.as')&&item.name!=='StaticCallsProbe.as'){
 const qname=path.relative(path.join(evidence,'source'),file).replaceAll('\\','/').slice(0,-3).replaceAll('/','.');
 const source=fs.readFileSync(file,'utf8');sources[qname]={source,sourceSha256:hash(source)};}}}
walk(path.join(evidence,'source'));assert.equal(Object.keys(sources).length,4);
const nativeProviders={};
const plan=api.createNativeGeneratedDeclarationPlan({scope:'consumer-static-calls',providers:nativeProviders,providerModule:provider('AS3GeneratedClass'),interfaceProviderModule:provider('AS3Type'),vectorProviderModule:provider('AS3Vector'),scriptGlobalProviderModule:provider('AS3ScriptGlobal'),scriptGlobalSources:[],sources:Object.fromEntries(Object.entries(sources).filter(([q])=>q!=='staticcalls.Consumer'))});
const helpers=Object.fromEntries(['bound','classBound','nativeClass','callableClass'].map(name=>[name,modulePath(path.resolve('utils',name+'.ts'))]));
const fileFor=q=>q.split('.').pop(),definitionsByNamespace={};
for(const q of Object.keys(sources)){const i=q.lastIndexOf('.');(definitionsByNamespace[q.slice(0,i)]??=[]).push(q.slice(i+1));}
const options={customVisitors:[],importModules:{"compiler.AS3Invocation":provider("AS3Invocation"),"compiler.AS3Class":provider("AS3Class"),...Object.fromEntries(Object.keys(sources).map(q=>[q,'./'+fileFor(q)])),...Object.fromEntries(Object.entries(nativeProviders).map(([q,b])=>[q,b.module]))},definitionsByNamespace,
 decoratorModules:{bound:helpers.bound,classBound:helpers.classBound},nativeClassHelperModules:{nativeClass:helpers.nativeClass,callableClass:helpers.callableClass},
 nativeGeneratedDeclarations:{plan,module:'./declarationDomain'},nativeClassTraitsModule:provider('AS3GeneratedClass'),nativeLexicalMembersModule:provider('AS3LexicalMembers'),nativeGeneratedPropertyModule:provider('AS3Property'),
 nativeCallableMethodBindingModule:provider('AS3MethodBinding'),nativeCallableCoercionModule:provider('AS3Coercion'),nativeCallableStringModule:provider('AS3String'),
 nativeSourceErrorModule:modulePath(path.join(engine,'src/layaAir/flash/errors/AS3SourceError.ts')),nativeDynamicPropertyReadsModule:provider('AS3Property'),nativeDynamicPropertyWritesModule:provider('AS3Property'),nativeComputedTypeTestModule:provider('AS3Type'),nativeDictionaryPropertyModule:provider('AS3Property'),nativeEnumeration:{dictionaryModule:provider("Dictionary"),coercionModule:provider("AS3Coercion"),stringModule:provider("AS3String")},nativeObjectCreationModule:provider("AS3Class"),nativeTypedLocals:true,nativeTypedLocalReferenceModule:provider('AS3Type'),nativeTypedLocalAdditionModule:provider('AS3Addition'),nativeArrayCreationModule:provider('AS3ArrayCreation')};
const combined=process.argv.includes('--combined');if(combined)Object.assign(options,{nativeReferenceCoercion:{plan,module:'./declarationDomain',coercionModule:provider('AS3Type')},nativeNumericMethodParametersModule:provider('AS3Coercion'),nativeSignaturePropertyModule:provider('AS3Property')});
options.nativeReferenceCoercion={plan,module:'./declarationDomain',coercionModule:provider('AS3Type')};
let rejectionGuards=0;
const consumerOptions={...options};
for(const key of ['nativeArrayCreationModule','nativeGeneratedDeclarations','nativeClassTraitsModule','nativeTypedLocals','nativeLexicalMembersModule','nativeGeneratedPropertyModule','nativeCallableMethodBindingModule','nativeCallableCoercionModule','nativeCallableStringModule','nativeTypedLocalReferenceModule'])delete consumerOptions[key];
for(const expression of ['Service.invoke','Service.seed','Service.initialize()','Service.missing()','new Service.invoke(1)','Service.invoke.call(null,1)','Service','staticcalls.Service.invoke(1)']){
 const source='package staticcalls {public class Guard {public function run():* {return '+expression+';}}}';
 assert.throws(()=>emit(parse('Guard.as',source),source,consumerOptions),/AS3_REFERENCE_COERCION_UNSUPPORTED/);rejectionGuards++;
}

fs.writeFileSync(path.join(run,'declarationDomain.ts'),plan.moduleSource);const emitted=[];
for(const binding of Object.keys(sources).map(qname=>({qname}))){const source=sources[binding.qname].source,file=path.join(run,fileFor(binding.qname)+'.ts');fs.mkdirSync(path.dirname(file),{recursive:true});
 const opts={...options};
 if(plan.interfaces.some(i=>i.qname===binding.qname)){for(const k of Object.keys(opts))if(k.startsWith('native'))delete opts[k];}
 if(binding.qname==='staticcalls.Consumer')for(const key of ['nativeArrayCreationModule','nativeGeneratedDeclarations','nativeClassTraitsModule','nativeTypedLocals','nativeLexicalMembersModule','nativeGeneratedPropertyModule','nativeCallableMethodBindingModule','nativeCallableCoercionModule','nativeCallableStringModule','nativeTypedLocalReferenceModule'])delete opts[key];
 const output=emit(parse(binding.qname+'.as',source),source,opts);if(binding.qname==='staticcalls.Consumer'){assert.ok(!output.includes('declareNativeClass'));assert.ok(output.includes('readNativeClass as __as3_reference_readClass'));}fs.writeFileSync(file,output);emitted.push({qname:binding.qname,file,sourceSha256:hash(source),outputSha256:hash(output)});
}
const files=[path.join(run,'declarationDomain.ts'),...emitted.map(e=>e.file),...['glsl.d.ts','spine.d.ts'].map(f=>path.join(engine,'src/layaAir/tslibs',f))];
const program=modern.createProgram(files,{target:modern.ScriptTarget.ES2020,module:modern.ModuleKind.CommonJS,strict:true,strictNullChecks:false,experimentalDecorators:true,noEmit:true,skipLibCheck:true,lib:['lib.es2020.d.ts','lib.dom.d.ts','lib.dom.iterable.d.ts']});
const diagnostics=modern.getPreEmitDiagnostics(program).map(d=>({file:d.file&&path.relative(run,d.file.fileName),code:d.code,text:modern.flattenDiagnosticMessageText(d.messageText,'\n')}));fs.writeFileSync(path.join(run,'types.json'),JSON.stringify(diagnostics,null,2));assert.deepEqual(diagnostics.filter(d=>!d.file.startsWith('..')),[]);
assert.deepEqual(diagnostics,[]);
const names=['AS3ReflectionQuery','AS3XML','getQualifiedClassName','AS3Vector','AS3MethodBinding','AS3Coercion','AS3String','AS3Type','AS3Property','AS3Class','AS3Invocation','AS3DeclarationType','FlashTypeMetadata','AS3LexicalMembers','AS3ArrayCreation','AS3Addition','QName','AS3DynamicObject','AS3SourceError','AS3ScriptGlobal','AS3GeneratedClass'];
const moduleFor=n=>'src/layaAir/flash/'+(['AS3SourceError','IllegalOperationError'].includes(n)?'errors':'utils')+'/'+n;
const built=esbuild.buildSync({absWorkingDir:engine,stdin:{contents:names.map(n=>'export * from "./'+moduleFor(n)+'";').join('\n'),resolveDir:engine,loader:'ts'},bundle:true,write:false,format:'cjs',platform:'browser',target:'es2020',loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'},metafile:true});
const providerGraph=Object.keys(built.metafile.inputs).filter(f=>f!=='<stdin>').map(f=>({file:f,sha256:hash(fs.readFileSync(path.resolve(engine,f)))}));
const driverFile=path.resolve('tests/native-consumer-static-calls/runtime-driver.js'),observer=fs.readFileSync(driverFile,'utf8');
const wanted=captured;assert.equal(wanted.length,15);
for(const mutate of [v=>v.pop(),v=>v.reverse(),v=>v.find(r=>r.id==='identity').value=false]){const bad=structuredClone(wanted);mutate(bad);assert.throws(()=>assert.deepEqual(bad,wanted));}
(async()=>{const {chromium}=require(require.resolve('playwright',{paths:[path.resolve('../op2-html5/game-client-laya'),engine]}));const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});const results=[];const server=require('node:http').createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><body></body></html>');});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
try{for(const target of [ts.ScriptTarget.ES5,ts.ScriptTarget.ES2015]){
 const specs=[];for(const file of files.filter(f=>!f.endsWith('.d.ts'))){const source=fs.readFileSync(file,'utf8'),out=ts.transpileModule(source,{compilerOptions:{target,module:ts.ModuleKind.CommonJS,experimentalDecorators:true},reportDiagnostics:true});assert.deepEqual(out.diagnostics,[]);const relative=path.relative(run,file).replaceAll('\\','/').replace(/\.ts$/,'');specs.push({name:relative,code:out.outputText});}
 for(const name of ['bound','classBound','nativeClass','callableClass'])specs.push({name,code:modern.transpileModule(fs.readFileSync(path.resolve('utils',name+'.ts'),'utf8'),{compilerOptions:{target,module:modern.ModuleKind.CommonJS}}).outputText});
 const script='(async()=>{if(typeof window==="undefined"){globalThis.window=globalThis;globalThis.document={};}const api=(()=>{const module={exports:{}};'+built.outputFiles[0].text+';return module.exports;})();const shared=new Map(),specs=new Map('+JSON.stringify(specs)+'.map(s=>[s.name,s.code])),providers=new Set('+JSON.stringify([...names,'Rectangle'])+'),localNames=new Set('+JSON.stringify(['declarationDomain',...emitted.map(e=>fileFor(e.qname))])+');function createDomainLoader(){const local=new Map();function load(name){if(providers.has(name))return api;const modules=localNames.has(name)?local:shared;if(modules.has(name))return modules.get(name);if(!specs.has(name))throw Error("unresolved module "+name);const output={};modules.set(name,output);new Function("exports","require",specs.get(name))(output,r=>load(r.split("/").pop()));return output;}load.loaded=local;return load;}const load=createDomainLoader();'+observer+'})().catch(e=>{globalThis.failure=String(e.stack||e);});';
 fs.writeFileSync(path.join(run,'bundle-'+target+'.js'),script);await new Function('return '+script.replace(/;$/, ''))();assert.equal(globalThis.failure,undefined);const node=JSON.parse(JSON.stringify(globalThis.result));assert.deepEqual(node,wanted);
 const page=await browser.newPage();await page.goto(origin);await page.addScriptTag({content:script});await page.waitForFunction(()=>globalThis.result||globalThis.failure);assert.equal(await page.evaluate(()=>globalThis.failure),undefined);const web=await page.evaluate(()=>JSON.parse(JSON.stringify(globalThis.result)));await page.close();
 for(const actual of [web]){assert.deepEqual(actual,wanted);}
 results.push({target,node,web});
}}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
fs.writeFileSync(path.join(run,'report.json'),JSON.stringify({combined,emitted,results,providerGraph,observer:{files:[driverFile],sha256:hash(observer)},typecheck:{files:program.getSourceFiles().length,diagnostics},rejectionGuards,comparisonNegativeControls:3,held:['Static property access, extraction, inherited static dispatch','Full application integration']},null,2));console.log(JSON.stringify({run,sourceClasses:plan.bindings.length,consumerClasses:1,airRows:wanted.length,rejectionGuards,targets:['ES5','ES2015'],runtimes:['Node','Chromium'],generatedTypeErrors:0,dependencyTypeErrors:diagnostics.length}));
})().catch(e=>{console.error(e);process.exitCode=1;});
