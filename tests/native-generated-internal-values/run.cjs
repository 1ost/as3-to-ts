const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const api=require('../../lib'),parse=require('../../lib/parse'),emit=require('../../lib/emit'),ts=require('typescript');
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2');
const modern=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const evidence=__dirname;const captured=require(path.join(evidence,'verify.cjs'));
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const root=path.resolve('.cache/native-generated-internal-values');fs.mkdirSync(root,{recursive:true});const run=fs.mkdtempSync(path.join(root,'run-'));
const modulePath=file=>{let r=path.relative(run,file).replaceAll('\\','/').replace(/\.ts$/,'');return r.startsWith('.')?r:'./'+r;};
const provider=name=>modulePath(path.join(engine,'src/layaAir/flash/utils',name+'.ts'));
const sources={};
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,item.name);
 if(item.isDirectory())walk(file);else if(item.name.endsWith('.as')&&item.name!=='InternalValueProbe.as'){
 const qname=path.relative(path.join(evidence,'source'),file).replaceAll('\\','/').slice(0,-3).replaceAll('/','.');
 const source=fs.readFileSync(file,'utf8');sources[qname]={source,sourceSha256:hash(source)};}}}
walk(path.join(evidence,'source'));assert.equal(Object.keys(sources).length,5);
const nativeProviders={};
const plan=api.createNativeGeneratedDeclarationPlan({scope:'generated-internal-methods',lexicalProviderModule:provider('AS3LexicalMembers'),providers:nativeProviders,providerModule:provider('AS3GeneratedClass'),interfaceProviderModule:provider('AS3Type'),vectorProviderModule:provider('AS3Vector'),scriptGlobalProviderModule:provider('AS3ScriptGlobal'),scriptGlobalSources:[],sources});
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
options.nativeGlobalModules={trace:modulePath(path.join(engine,'src/layaAir/flash/debug/trace.ts'))};
let rejectionGuards=0;
function rejected(changed,owner='methodcases.Holder',providerEnabled=true){
 const guardSources={...sources,[owner]:{source:changed,sourceSha256:hash(changed)}};
 assert.throws(()=>{const guard=api.createNativeGeneratedDeclarationPlan({scope:'internal-guard',providerModule:provider('AS3GeneratedClass'),...(providerEnabled?{lexicalProviderModule:provider('AS3LexicalMembers')}:{}),sources:guardSources});
 emit(parse(owner+'.as',changed),changed,{...options,nativeGeneratedDeclarations:{plan:guard,module:'./guard'},nativeReferenceCoercion:{plan:guard,module:'./guard',coercionModule:provider('AS3Type')}});
 },/AS3_[A-Z_]+UNSUPPORTED/);rejectionGuards++;
}
const holder=sources['valuecases.Holder'].source;
rejected(holder,'valuecases.Holder',false);
for(const changed of [
 holder.replace('internal function take(', 'internal static function take('),
 holder.replace('take(input:Object):void','take(input:String):void'),
 holder.replace('take(input:Object):void','take(input:*):void'),
 holder.replace('take(input:Object):void','take(input:Object):Boolean'),
 holder.replace('take(input:Object):void','take(input:Object=null):void'),
 holder.replace('take(input:Object):void','take(...input):void'),
 holder.replace('internal function take(', 'customNS function take('),
 holder.replace('take(input);','delete take;'),
 holder.replace('take(input);','take=null;'),
 holder.replace('take(input);','++take;'),
 holder.replace('internal function take(', 'override internal function take(')
])rejected(changed,'valuecases.Holder');
const peer=sources['valuecases.Peer'].source;
for(const expression of ['value.take=null','delete value.take','++value.take'])
 rejected(peer.replace('value.take(input);',expression+';'),'valuecases.Peer');
const child=sources['valuecases.Child'].source;
rejected(child.replace('override internal','internal'),'valuecases.Child');
rejected(child.replace('calls+=10;last=input;','super.take(input);'),'valuecases.Child');
rejected(child.replace('input:Object','input:int'),'valuecases.Child');
rejected('package othervalues {import valuecases.Holder; public class Bad {public function read(value:Holder,input:Object):void{value.take(input);}}}','othervalues.Bad');
assert.equal(rejectionGuards,19);
fs.writeFileSync(path.join(run,'declarationDomain.ts'),plan.moduleSource);const emitted=[];
for(const binding of [...plan.bindings,...plan.interfaces]){const source=sources[binding.qname].source,file=path.join(run,fileFor(binding.qname)+'.ts');fs.mkdirSync(path.dirname(file),{recursive:true});
 const opts={...options};
 if(plan.interfaces.some(i=>i.qname===binding.qname)){for(const k of Object.keys(opts))if(k.startsWith('native'))delete opts[k];}
 opts.nativeVectorTypes={plan,module:'./declarationDomain'};
 const output=emit(parse(binding.qname+'.as',source),source,opts);fs.writeFileSync(file,output);emitted.push({qname:binding.qname,file,sourceSha256:hash(source),outputSha256:hash(output)});
}
const files=[path.join(run,'declarationDomain.ts'),...emitted.map(e=>e.file),...['glsl.d.ts','spine.d.ts'].map(f=>path.join(engine,'src/layaAir/tslibs',f))];
const program=modern.createProgram(files,{target:modern.ScriptTarget.ES2020,module:modern.ModuleKind.CommonJS,strict:true,strictNullChecks:false,experimentalDecorators:true,noEmit:true,skipLibCheck:true,lib:['lib.es2020.d.ts','lib.dom.d.ts']});
const diagnostics=modern.getPreEmitDiagnostics(program).map(d=>({file:d.file&&path.relative(run,d.file.fileName),code:d.code,text:modern.flattenDiagnosticMessageText(d.messageText,'\n')}));fs.writeFileSync(path.join(run,'types.json'),JSON.stringify(diagnostics,null,2));assert.deepEqual(diagnostics.filter(d=>!d.file.startsWith('..')),[]);
assert.deepEqual(diagnostics,[]);
const names=['IOError','AS3CanonicalErrorConstruction','trace','Dictionary','getQualifiedClassName','AS3Vector','AS3MethodBinding','AS3Coercion','AS3String','AS3Type','AS3Property','AS3Class','AS3Invocation','AS3DeclarationType','FlashTypeMetadata','AS3LexicalMembers','AS3ArrayCreation','AS3Addition','QName','AS3DynamicObject','AS3SourceError','AS3ScriptGlobal','AS3GeneratedClass'];
const moduleFor=n=>'src/layaAir/flash/'+(n==='trace'?'debug':['IOError','AS3SourceError','IllegalOperationError'].includes(n)?'errors':'utils')+'/'+n;
const built=esbuild.buildSync({absWorkingDir:engine,stdin:{contents:names.map(n=>'export * from "./'+moduleFor(n)+'";').join('\n'),resolveDir:engine,loader:'ts'},bundle:true,write:false,format:'cjs',platform:'browser',target:'es2020',loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'},metafile:true});
const providerGraph=Object.keys(built.metafile.inputs).filter(f=>f!=='<stdin>').map(f=>({file:f,sha256:hash(fs.readFileSync(path.resolve(engine,f)))}));
const driverFile=path.resolve('tests/native-generated-internal-values/runtime-driver.js'),observer=fs.readFileSync(driverFile,'utf8');
const wanted=captured;assert.equal(wanted.length,30);
for(const mutate of [v=>v.pop(),v=>v.reverse(),v=>v[0].value[0]=false]){const bad=structuredClone(wanted);mutate(bad);assert.throws(()=>assert.deepEqual(bad,wanted));}
(async()=>{const {chromium}=require(require.resolve('playwright',{paths:[path.resolve('../op2-html5/game-client-laya'),engine]}));const browser=await chromium.launch({headless:true});const results=[];
try{for(const target of [ts.ScriptTarget.ES5,ts.ScriptTarget.ES2015]){
 const specs=[];for(const file of files.filter(f=>!f.endsWith('.d.ts'))){const source=fs.readFileSync(file,'utf8'),out=ts.transpileModule(source,{compilerOptions:{target,module:ts.ModuleKind.CommonJS,experimentalDecorators:true},reportDiagnostics:true});assert.deepEqual(out.diagnostics,[]);const relative=path.relative(run,file).replaceAll('\\','/').replace(/\.ts$/,'');specs.push({name:relative,code:out.outputText});}
 for(const name of ['bound','classBound','nativeClass','callableClass'])specs.push({name,code:modern.transpileModule(fs.readFileSync(path.resolve('utils',name+'.ts'),'utf8'),{compilerOptions:{target,module:modern.ModuleKind.CommonJS}}).outputText});
 const makeScript=(runtime=built.outputFiles[0].text,modules=specs)=>'{if(typeof window==="undefined"){globalThis.window=globalThis;globalThis.document={};}const api=(()=>{const module={exports:{}};'+runtime+';return module.exports;})();const shared=new Map(),specs=new Map('+JSON.stringify(modules)+'.map(s=>[s.name,s.code])),providers=new Set('+JSON.stringify(names)+'),localNames=new Set('+JSON.stringify(['declarationDomain',...emitted.map(e=>fileFor(e.qname))])+');function createDomainLoader(){const local=new Map();function load(name){if(providers.has(name))return api;const modules=localNames.has(name)?local:shared;if(modules.has(name))return modules.get(name);if(!specs.has(name))throw Error("unresolved module "+name);const output={};modules.set(name,output);new Function("exports","require",specs.get(name))(output,r=>load(r.split("/").pop()));return output;}load.loaded=local;return load;}const load=createDomainLoader();'+observer+'}';
 const script=makeScript();
 const oldGuard='member.kind === "method" && !member.static';assert.ok(built.outputFiles[0].text.includes(oldGuard));
 const oldRuntime=built.outputFiles[0].text.replace(oldGuard,oldGuard+' && (member.parameterCount === 0 || member.parameterCount === 1)');
 assert.throws(()=>new Function(makeScript(oldRuntime))(),/internal package authority/);
 const mutant=specs.map(s=>({...s,code:s.code.replaceAll('coerceAS3PropertyValue(input, "Object")','coerceAS3PropertyValue(input, "*")')}));
 assert.notDeepEqual(mutant,specs);
 const mutated=new Function(makeScript(undefined,mutant)+';return globalThis.result;')();
 assert.throws(()=>assert.deepEqual(mutated,wanted));
 const intMutant=specs.map(s=>({...s,code:s.code.replaceAll('coerceAS3PropertyValue(input, "int")','coerceAS3PropertyValue(input, "*")')}));
 assert.notDeepEqual(intMutant,specs);
 assert.throws(()=>assert.deepEqual(new Function(makeScript(undefined,intMutant)+';return globalThis.result;')(),wanted));
 fs.writeFileSync(path.join(run,'bundle-'+target+'.js'),script);const node=JSON.parse(JSON.stringify(new Function(script+';return globalThis.result;')()));
 const page=await browser.newPage();await page.addScriptTag({content:script});const web=await page.evaluate(()=>JSON.parse(JSON.stringify(globalThis.result)));await page.close();
 for(const actual of [node,web]){assert.deepEqual(actual,wanted);}
 results.push({target,node,web,appliedMutations:3});
}}finally{await browser.close();}
const compilerInputs=[];function compilerWalk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())compilerWalk(f);else if(f.endsWith('.ts'))compilerInputs.push({file:path.relative(path.resolve('.'),f).replaceAll('\\','/'),sha256:hash(fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n'))});}}compilerWalk(path.resolve('src'));
fs.writeFileSync(path.join(run,'report.json'),JSON.stringify({runnerSha256:hash(fs.readFileSync(__filename)),compilerInputs,outputs:files.filter(f=>!f.endsWith('.d.ts')).map(file=>({file:path.basename(file),source:fs.readFileSync(file,'utf8'),sha256:hash(fs.readFileSync(file))})),combined,emitted,results,providerGraph,observer:{files:[driverFile],sha256:hash(observer)},typecheck:{files:program.getSourceFiles().length,diagnostics,inputs:program.getSourceFiles().map(f=>({file:f.fileName,sha256:hash(fs.readFileSync(f.fileName))}))},rejectionGuards,comparisonNegativeControls:3,held:['Internal static/super methods, optional/rest, new non-void returns or other parameter types','Complete OP2 manager and startup integration']},null,2));console.log(JSON.stringify({run,sourceClasses:plan.bindings.length,airRows:30,comparisons:wanted.length,rejectionGuards,targets:['ES5','ES2015'],runtimes:['Node','Chromium'],generatedTypeErrors:0,dependencyTypeErrors:diagnostics.length}));
})().catch(e=>{console.error(e);process.exitCode=1;});
