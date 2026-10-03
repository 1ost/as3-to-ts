const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const api=require(process.env.AS3_TEST_COMPILER_API||'../../lib'),parse=require(process.env.AS3_TEST_COMPILER_API?path.join(process.env.AS3_TEST_COMPILER_API,'parse'):'../../lib/parse'),emit=require(process.env.AS3_TEST_COMPILER_API?path.join(process.env.AS3_TEST_COMPILER_API,'emit'):'../../lib/emit'),ts=require('typescript');
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2');
const modern=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const evidence=path.join(__dirname,'oracle');const captured=require(path.join(evidence,'verify.cjs'));
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const root=path.resolve('.cache/native-generated-ancestor-static-booleans');fs.mkdirSync(root,{recursive:true});const run=fs.mkdtempSync(path.join(root,'run-'));
const modulePath=file=>{let r=path.relative(run,file).replaceAll('\\','/').replace(/\.ts$/,'');return r.startsWith('.')?r:'./'+r;};
const provider=name=>modulePath(path.join(engine,'src/layaAir/flash/utils',name+'.ts'));
const sources={};
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,item.name);
 if(item.isDirectory())walk(file);else if(item.name.endsWith('.as')&&item.name!=='StaticBooleansProbe.as'){
 const qname=path.relative(path.join(evidence,'source'),file).replaceAll('\\','/').slice(0,-3).replaceAll('/','.');
 const source=fs.readFileSync(file,'utf8');sources[qname]={source,sourceSha256:hash(source)};}}}
walk(path.join(evidence,'source'));assert.equal(Object.keys(sources).length,5);
const nativeProviders={};
const plan=api.createNativeGeneratedDeclarationPlan({scope:'generated-protected-static-booleans',providers:nativeProviders,providerModule:provider('AS3GeneratedClass'),interfaceProviderModule:provider('AS3Type'),vectorProviderModule:provider('AS3Vector'),scriptGlobalProviderModule:provider('AS3ScriptGlobal'),scriptGlobalSources:[],sources});
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
if(process.argv.includes('--baseline')){
 const subject=sources['deep.Grand'].source;
 assert.throws(()=>emit(parse('Grand.as',subject),subject,options),
  error=>error.message==='AS3_GENERATED_LEXICAL_UNSUPPORTED: inherited static lexical ownership');
 console.log(JSON.stringify({status:'baseline-rejected',message:'AS3_GENERATED_LEXICAL_UNSUPPORTED: inherited static lexical ownership',
  sources:Object.fromEntries(Object.entries(sources).map(([name,value])=>[name,value.sourceSha256]))}));
 process.exit(0);
}
let rejectionGuards=0;
for(const body of [
 'private static var value:Number=1+2;',
 'private static var value:Number=Number(2);',
 'private static var value:Number=NaN;',
 'private static var value:Number=Infinity;',
 'private static var value:Number=1e999;',
 'private static var value:Number=01;',
 'private static var value:Number=(1);',
 'private static var value:uint=1;',
 'protected static var value:Boolean=1;',
 'private static var value:String=String(1);',
 'private static var value:String="a"+"b";',
 'protected static var value:Number=1;'
]){
 const source='package privatecases {public class Guard {'+body+'}}';
 assert.throws(()=>{const p=api.createNativeGeneratedDeclarationPlan({scope:'private-guard',providerModule:provider('AS3GeneratedClass'),sources:{...sources,'privatecases.Guard':{source,sourceSha256:hash(source)}}});emit(parse('Guard.as',source),source,{...options,nativeGeneratedDeclarations:{plan:p,module:'./guard-domain'},nativeReferenceCoercion:{plan:p,module:'./guard-domain',coercionModule:provider('AS3Type')}});},/AS3_[A-Z_]+UNSUPPORTED/,body);rejectionGuards++;
}
// The new authority is confined to authenticated protected Boolean ancestors.
for(const [owner,addition,reason] of [
 ['staticflags.Flags','protected static var label:String="held";','inherited static lexical ownership'],
 ['staticflags.Flags','protected static const LABEL:String="held";','inherited static lexical ownership'],
 ['staticflags.Flags','protected static var count:int=1;','inherited static lexical ownership'],
 ['deep.Grand','protected static var first:Boolean=true;','ambiguous lexical declaration: first']
]){
 const changed=sources[owner].source;
 const offset=changed.indexOf('{',changed.indexOf('public class'))+1;
 const source=changed.slice(0,offset)+addition+changed.slice(offset);
 const altered={...sources,[owner]:{source,sourceSha256:hash(source)}};
 const guarded=api.createNativeGeneratedDeclarationPlan({scope:'ancestor-guard',providers:nativeProviders,
  providerModule:provider('AS3GeneratedClass'),interfaceProviderModule:provider('AS3Type'),
  vectorProviderModule:provider('AS3Vector'),sources:altered});
 const child=altered['deep.Grand'].source;
 assert.throws(()=>emit(parse('Grand.as',child),child,{...options,
  nativeGeneratedDeclarations:{plan:guarded,module:'./guard-domain'},
  nativeReferenceCoercion:{plan:guarded,module:'./guard-domain',coercionModule:provider('AS3Type')}}),
  error=>error.message==='AS3_GENERATED_LEXICAL_UNSUPPORTED: '+reason);
 rejectionGuards++;
}
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
const names=['getQualifiedClassName','AS3Vector','AS3MethodBinding','AS3Coercion','AS3String','AS3Type','AS3Property','AS3Class','AS3Invocation','AS3DeclarationType','FlashTypeMetadata','AS3LexicalMembers','AS3ArrayCreation','AS3Addition','QName','AS3DynamicObject','AS3SourceError','AS3ScriptGlobal','AS3GeneratedClass'];
const moduleFor=n=>'src/layaAir/flash/'+(['AS3SourceError','IllegalOperationError'].includes(n)?'errors':'utils')+'/'+n;
const built=esbuild.buildSync({absWorkingDir:engine,stdin:{contents:names.map(n=>'export * from "./'+moduleFor(n)+'";').join('\n'),resolveDir:engine,loader:'ts'},bundle:true,write:false,format:'cjs',platform:'browser',target:'es2020',loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'},metafile:true});
const providerGraph=Object.keys(built.metafile.inputs).filter(f=>f!=='<stdin>').map(f=>({file:f,sha256:hash(fs.readFileSync(path.resolve(engine,f)))}));
const driverFile=path.resolve('tests/native-generated-ancestor-static-booleans/runtime-driver.js'),observer=fs.readFileSync(driverFile,'utf8');
const wanted=captured;assert.equal(wanted.length,26);
for(const mutate of [v=>v.pop(),v=>v.reverse(),v=>v[0].value=false]){const bad=structuredClone(wanted);mutate(bad);assert.throws(()=>assert.deepEqual(bad,wanted));}
(async()=>{const {chromium}=require(require.resolve('playwright',{paths:[path.resolve('../op2-html5/game-client-laya'),engine]}));const browser=await chromium.launch({headless:true});const results=[];
try{for(const target of [ts.ScriptTarget.ES5,ts.ScriptTarget.ES2015]){
 const specs=[];for(const file of files.filter(f=>!f.endsWith('.d.ts'))){const source=fs.readFileSync(file,'utf8'),out=ts.transpileModule(source,{compilerOptions:{target,module:ts.ModuleKind.CommonJS,experimentalDecorators:true},reportDiagnostics:true});assert.deepEqual(out.diagnostics,[]);const relative=path.relative(run,file).replaceAll('\\','/').replace(/\.ts$/,'');specs.push({name:relative,code:out.outputText});}
 for(const name of ['bound','classBound','nativeClass','callableClass'])specs.push({name,code:modern.transpileModule(fs.readFileSync(path.resolve('utils',name+'.ts'),'utf8'),{compilerOptions:{target,module:modern.ModuleKind.CommonJS}}).outputText});
 const makeScript=entries=>'{if(typeof window==="undefined"){globalThis.window=globalThis;globalThis.document={};}const api=(()=>{const module={exports:{}};'+built.outputFiles[0].text+';return module.exports;})();const shared=new Map(),specs=new Map('+JSON.stringify(entries)+'.map(s=>[s.name,s.code])),providers=new Set('+JSON.stringify(names)+'),localNames=new Set('+JSON.stringify(['declarationDomain',...emitted.map(e=>fileFor(e.qname))])+');function createDomainLoader(){const local=new Map();function load(name){if(providers.has(name))return api;const modules=localNames.has(name)?local:shared;if(modules.has(name))return modules.get(name);if(!specs.has(name))throw Error("unresolved module "+name);const output={};modules.set(name,output);new Function("exports","require",specs.get(name))(output,r=>load(r.split("/").pop()));return output;}load.loaded=local;return load;}const load=createDomainLoader();'+observer+'}';
 const script=makeScript(specs);
 fs.writeFileSync(path.join(run,'bundle-'+target+'.js'),script);const node=JSON.parse(JSON.stringify(new Function(script+';return globalThis.result;')()));
 const page=await browser.newPage();await page.addScriptTag({content:script});const web=await page.evaluate(()=>JSON.parse(JSON.stringify(globalThis.result)));await page.close();
 for(const actual of [node,web]){assert.deepEqual(actual,wanted);}
 const controls=[];
 for(const subject of ['Grand','Leaf']){
  const changed=specs.map(spec=>{
   if(spec.name!==subject)return spec;
   // Applied negative control: use the direct parent for ancestor storage.
   const code=spec.code.replace(/((?:var|const) __as3_generated_key_\d+ = )([\w$.]+)\.getPrototypeOf\(([^;]+)\);/g,
    (all,prefix,intrinsic,inner)=>prefix+'__as3_callable_base;');
   assert.notEqual(code,spec.code,'control changed generated '+subject);
   return {...spec,code};
  });
  const broken=makeScript(changed);
  assert.throws(()=>new Function(broken)(),/1069|1056/);
  const controlPage=await browser.newPage();
  await controlPage.addScriptTag({content:'globalThis.controlScript='+JSON.stringify(broken)});
  const failure=await controlPage.evaluate(()=>{try{new Function(globalThis.controlScript)();return null;}catch(error){return String(error);}});
  await controlPage.close();assert.match(failure,/1069|1056/);controls.push(subject);
 }
 results.push({target,node,web,appliedReceiverControls:controls,domainIsolationChecks:3});
}}finally{await browser.close();}
fs.writeFileSync(path.join(run,'report.json'),JSON.stringify({combined,emitted,results,providerGraph,observer:{files:[driverFile],sha256:hash(observer)},typecheck:{files:program.getSourceFiles().length,diagnostics},rejectionGuards,comparisonNegativeControls:3,held:['Other primitive initializer forms and deeper non-Boolean inherited static ownership','ByteArray reflection, compression and complete archive integration']},null,2));console.log(JSON.stringify({run,sourceClasses:plan.bindings.length,airRows:wanted.length,rejectionGuards,targets:['ES5','ES2015'],runtimes:['Node','Chromium'],generatedTypeErrors:0,dependencyTypeErrors:diagnostics.length}));
})().catch(e=>{console.error(e);process.exitCode=1;});
