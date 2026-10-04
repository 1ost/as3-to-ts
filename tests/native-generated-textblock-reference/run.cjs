const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const api=require('../../lib'),parse=require('../../lib/parse'),emit=require('../../lib/emit'),ts=require('typescript');
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2');
const modern=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const evidence=path.join(engine,'tests/nativeFlashOracle','generated-textblock-reference');const captured=require(path.join(evidence,'verify.cjs'));
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const compilerInputs=[];function inventory(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())inventory(file);else compilerInputs.push({file,sha256:hash(fs.readFileSync(file))});}}inventory(path.resolve('lib'));inventory(path.resolve('utils'));
const root=path.resolve('.cache/native-generated-textblock-reference');fs.mkdirSync(root,{recursive:true});const run=fs.mkdtempSync(path.join(root,'run-'));
const modulePath=file=>{let r=path.relative(run,file).replaceAll('\\','/').replace(/\.ts$/,'');return r.startsWith('.')?r:'./'+r;};
const provider=name=>modulePath(path.join(engine,'src/layaAir/flash/utils',name+'.ts'));
const sources={};
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,item.name);
 if(item.isDirectory())walk(file);else if(item.name.endsWith('.as')&&item.name==='Reader.as'){
 const qname=path.relative(path.join(evidence,'source'),file).replaceAll('\\','/').slice(0,-3).replaceAll('/','.');
 const source=fs.readFileSync(file,'utf8');sources[qname]={source,sourceSha256:hash(source)};}}}
walk(path.join(evidence,'source'));assert.equal(Object.keys(sources).length,1);
const family=['TextBlock'];
const nativeProviders=Object.fromEntries(family.map(name=>['flash.text.engine.'+name,{module:provider('AS3CanonicalTextBlockReference'),exportName:name}]));
const plan=api.createNativeGeneratedDeclarationPlan({scope:'generated-textblock-reference',providers:nativeProviders,providerModule:provider('AS3GeneratedClass'),interfaceProviderModule:provider('AS3Type'),vectorProviderModule:provider('AS3Vector'),scriptGlobalProviderModule:provider('AS3ScriptGlobal'),scriptGlobalSources:[],sources});
const helpers=Object.fromEntries(['bound','classBound','nativeClass','callableClass'].map(name=>[name,modulePath(path.resolve('utils',name+'.ts'))]));
const fileFor=q=>q.split('.').pop(),definitionsByNamespace={};
for(const q of Object.keys(sources)){const i=q.lastIndexOf('.');(definitionsByNamespace[q.slice(0,i)]??=[]).push(q.slice(i+1));}
const options={customVisitors:[],importModules:{"compiler.AS3Invocation":provider("AS3Invocation"),"compiler.AS3Class":provider("AS3Class"),...Object.fromEntries(Object.keys(sources).map(q=>[q,'./'+fileFor(q)])),...Object.fromEntries(Object.entries(nativeProviders).map(([q,b])=>[q,b.module]))},definitionsByNamespace,
 decoratorModules:{bound:helpers.bound,classBound:helpers.classBound},nativeClassHelperModules:{nativeClass:helpers.nativeClass,callableClass:helpers.callableClass},
 nativeGeneratedDeclarations:{plan,module:'./declarationDomain'},nativeClassTraitsModule:provider('AS3GeneratedClass'),nativeLexicalMembersModule:provider('AS3LexicalMembers'),nativeGeneratedPropertyModule:provider('AS3Property'),
 nativeCallableMethodBindingModule:provider('AS3MethodBinding'),nativeCallableCoercionModule:provider('AS3Coercion'),nativeCallableStringModule:provider('AS3String'),
 nativeSourceErrorModule:modulePath(path.join(engine,'src/layaAir/flash/errors/AS3SourceError.ts')),nativeDynamicPropertyReadsModule:provider('AS3Property'),nativeDynamicPropertyWritesModule:provider('AS3Property'),nativeComputedTypeTestModule:provider('AS3Type'),nativeObjectCreationModule:provider("AS3Class"),nativeTypedLocals:true,nativeTypedLocalReferenceModule:provider('AS3Type'),nativeTypedLocalAdditionModule:provider('AS3Addition'),nativeArrayCreationModule:provider('AS3ArrayCreation')};
const combined=process.argv.includes('--combined');if(combined)Object.assign(options,{nativeReferenceCoercion:{plan,module:'./declarationDomain',coercionModule:provider('AS3Type')},nativeNumericMethodParametersModule:provider('AS3Coercion'),nativeSignaturePropertyModule:provider('AS3Property')});
options.nativeReferenceCoercion={plan,module:'./declarationDomain',coercionModule:provider('AS3Type')};
options.nativeGlobalModules={trace:modulePath(path.join(engine,'src/layaAir/flash/debug/trace.ts'))};
options.nativeTextBlockReferenceModule=provider('AS3CanonicalTextBlockReference');
let rejectionGuards=0;
const source=sources['blockref.Reader'].source;
for(const key of ['nativeTextBlockReferenceModule','nativeReferenceCoercion','nativeComputedTypeTestModule']){
 assert.throws(()=>emit(parse('Reader.as',source),source,{...options,[key]:undefined}),/AS3_[A-Z_]+UNSUPPORTED/);rejectionGuards++;
}
for(const changed of [
 source.replace('cast(value:*)','cast(value:*,TextBlock:*)'),
 source.replace('public var calls:int=0;','public var calls:int=0;public var early:TextBlock=null as TextBlock;'),
 source.replace('value as TextBlock','value as flash.text.engine.TextBlock')
]){
 assert.throws(()=>{
  const guard=api.createNativeGeneratedDeclarationPlan({scope:'content-guard',providers:nativeProviders,providerModule:provider('AS3GeneratedClass'),sources:{'blockref.Reader':{source:changed,sourceSha256:hash(changed)}}});
  emit(parse('Reader.as',changed),changed,{...options,nativeGeneratedDeclarations:{plan:guard,module:'./guard'},nativeReferenceCoercion:{plan:guard,module:'./guard',coercionModule:provider('AS3Type')}});
 },/AS3_[A-Z_]+UNSUPPORTED/);rejectionGuards++;
}
for(const override of [
 {nativeTextBlockReferenceModule:provider('AS3Type')},
 ...family.map(name=>({importModules:{...options.importModules,['flash.text.engine.'+name]:provider('AS3Type')}}))
]){assert.throws(()=>emit(parse('Reader.as',source),source,{...options,...override}),/AS3_TEXT_BLOCK_REFERENCE_UNSUPPORTED/);rejectionGuards++;}
fs.writeFileSync(path.join(run,'declarationDomain.ts'),plan.moduleSource);const emitted=[];
for(const binding of [...plan.bindings,...plan.interfaces]){const source=sources[binding.qname].source,file=path.join(run,fileFor(binding.qname)+'.ts');fs.mkdirSync(path.dirname(file),{recursive:true});
 const opts={...options};
 if(plan.interfaces.some(i=>i.qname===binding.qname)){for(const k of Object.keys(opts))if(k.startsWith('native'))delete opts[k];}
 opts.nativeVectorTypes={plan,module:'./declarationDomain'};
 const output=emit(parse(binding.qname+'.as',source),source,opts);fs.writeFileSync(file,output);emitted.push({qname:binding.qname,file,sourceSha256:hash(source),outputSha256:hash(output)});
}
const files=[path.join(run,'declarationDomain.ts'),...emitted.map(e=>e.file),...['glsl.d.ts','spine.d.ts'].map(f=>path.join(engine,'src/layaAir/tslibs',f))];
const program=modern.createProgram(files,{target:modern.ScriptTarget.ES2020,module:modern.ModuleKind.CommonJS,strict:true,strictNullChecks:false,experimentalDecorators:true,noEmit:true,skipLibCheck:true,lib:['lib.es2020.d.ts','lib.dom.d.ts','lib.dom.iterable.d.ts']});
const diagnostics=modern.getPreEmitDiagnostics(program).map(d=>({file:d.file&&path.relative(run,d.file.fileName),code:d.code,text:modern.flattenDiagnosticMessageText(d.messageText,'\n')}));fs.writeFileSync(path.join(run,'types.json'),JSON.stringify(diagnostics,null,2));assert.deepEqual(diagnostics.filter(d=>!d.file.startsWith('..')),[]);
assert.deepEqual(diagnostics,[]);
const names=['AS3CanonicalTextBlockReference','AS3CanonicalErrorConstruction','trace','getQualifiedClassName','AS3Vector','AS3MethodBinding','AS3Coercion','AS3String','AS3Type','AS3Property','AS3Class','AS3Invocation','AS3DeclarationType','FlashTypeMetadata','AS3LexicalMembers','AS3ArrayCreation','AS3Addition','QName','AS3DynamicObject','AS3SourceError','AS3ScriptGlobal','AS3GeneratedClass'];
const moduleFor=n=>'src/layaAir/flash/'+(n==='trace'?'debug':['AS3SourceError','IllegalOperationError'].includes(n)?'errors':'utils')+'/'+n;
const built=esbuild.buildSync({absWorkingDir:engine,stdin:{contents:names.map(n=>'export * from "./'+moduleFor(n)+'";').join('\n'),resolveDir:engine,loader:'ts'},bundle:true,write:false,format:'cjs',platform:'browser',target:'es2020',loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'},metafile:true});
const providerGraph=Object.keys(built.metafile.inputs).filter(f=>f!=='<stdin>').map(f=>({file:f,sha256:hash(fs.readFileSync(path.resolve(engine,f)))}));
const driverFile=path.resolve('tests/native-generated-textblock-reference/runtime-driver.js'),observer=fs.readFileSync(driverFile,'utf8');
const wanted=captured;assert.equal(wanted.length,19);
for(const mutate of [v=>v.pop(),v=>v.reverse(),v=>v[0].value[0]=!v[0].value[0]]){const bad=structuredClone(wanted);mutate(bad);assert.throws(()=>assert.deepEqual(bad,wanted));}
(async()=>{const {chromium}=require(require.resolve('playwright',{paths:[path.resolve('../op2-html5/game-client-laya'),engine]}));const browser=await chromium.launch({headless:true});const results=[];
try{for(const target of [ts.ScriptTarget.ES5,ts.ScriptTarget.ES2015]){
 const specs=[];for(const file of files.filter(f=>!f.endsWith('.d.ts'))){const source=fs.readFileSync(file,'utf8'),out=ts.transpileModule(source,{compilerOptions:{target,module:ts.ModuleKind.CommonJS,experimentalDecorators:true},reportDiagnostics:true});assert.deepEqual(out.diagnostics,[]);const relative=path.relative(run,file).replaceAll('\\','/').replace(/\.ts$/,'');specs.push({name:relative,code:out.outputText});}
 for(const name of ['bound','classBound','nativeClass','callableClass'])specs.push({name,code:modern.transpileModule(fs.readFileSync(path.resolve('utils',name+'.ts'),'utf8'),{compilerOptions:{target,module:modern.ModuleKind.CommonJS}}).outputText});
 const script='{if(typeof window==="undefined"){globalThis.window=globalThis;globalThis.document={};}const api=(()=>{const module={exports:{}};'+built.outputFiles[0].text+';return module.exports;})();const shared=new Map(),specs=new Map(['+specs.map(s=>'['+JSON.stringify(s.name)+',function(exports,require){\n'+s.code+'\n}]').join(',')+']),providers=new Set('+JSON.stringify(names)+'),localNames=new Set('+JSON.stringify(['declarationDomain',...emitted.map(e=>fileFor(e.qname))])+');function createDomainLoader(){const local=new Map();function load(name){if(providers.has(name))return api;const modules=localNames.has(name)?local:shared;if(modules.has(name))return modules.get(name);if(!specs.has(name))throw Error("unresolved module "+name);const output={};modules.set(name,output);specs.get(name)(output,r=>load(r.split("/").pop()));return output;}load.loaded=local;return load;}const load=createDomainLoader();'+observer+'}';
 fs.writeFileSync(path.join(run,'bundle-'+target+'.js'),script);const vm=require('node:vm'),context=vm.createContext({console,setTimeout,clearTimeout,performance});new vm.Script(script).runInContext(context);const node=JSON.parse(JSON.stringify(context.result));
 const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(String(error)));
 await page.route('http://content.test/**',route=>route.request().url().endsWith('/bundle.js')?route.fulfill({contentType:'text/javascript',body:script}):route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"script-src 'self'"},body:'<!doctype html><script src="/bundle.js"></script>'}));
 await page.goto('http://content.test/');const web=await page.evaluate(()=>JSON.parse(JSON.stringify(globalThis.result)));await page.close();assert.deepEqual(errors,[]);
 for(const actual of [node,web]){assert.deepEqual(actual,wanted);}
 const mutant=script.replace(/\.as3As\(/g,'.as3AsMutation(').replace('const shared=new Map()', 'api.as3AsMutation=()=>null;const shared=new Map()');assert.notEqual(mutant,script);
 const mutatedContext=vm.createContext({console,setTimeout,clearTimeout,performance});new vm.Script(mutant).runInContext(mutatedContext);const changed=JSON.parse(JSON.stringify(mutatedContext.result));assert.notDeepEqual(changed,wanted);
 const mutationMismatches=changed.filter((row,i)=>!require('node:util').isDeepStrictEqual(row,wanted[i])).map(row=>row.id);assert.ok(mutationMismatches.includes('type-0'));fs.writeFileSync(path.join(run,'mutant-'+target+'.js'),mutant);
 const isMutant=script.replace(/\.as3Is\(/g,'.as3IsMutation(').replace('const shared=new Map()', 'api.as3IsMutation=()=>false;const shared=new Map()');assert.notEqual(isMutant,script);
 const isContext=vm.createContext({console,setTimeout,clearTimeout,performance});new vm.Script(isMutant).runInContext(isContext);const isChanged=JSON.parse(JSON.stringify(isContext.result));assert.notDeepEqual(isChanged,wanted);
 const isMismatches=isChanged.filter((row,i)=>!require('node:util').isDeepStrictEqual(row,wanted[i])).map(row=>row.id);assert.ok(isMismatches.includes('type-0'));fs.writeFileSync(path.join(run,'is-mutant-'+target+'.js'),isMutant);
 results.push({target,node,web,mutation:{changed,mismatches:mutationMismatches},isMutation:{changed:isChanged,mismatches:isMismatches}});
}}finally{await browser.close();}
for(const item of compilerInputs)assert.equal(hash(fs.readFileSync(item.file)),item.sha256,item.file);
fs.writeFileSync(path.join(run,'report.json'),JSON.stringify({compilerInputs,typeInputs:program.getSourceFiles().map(f=>({file:f.fileName,sha256:hash(fs.readFileSync(f.fileName))})),runner:{file:__filename,sha256:hash(fs.readFileSync(__filename))},engine,combined,emitted,results,providerGraph,observer:{files:[driverFile],sha256:hash(observer)},typecheck:{files:program.getSourceFiles().length,diagnostics},rejectionGuards,hostGuards:3,comparisonNegativeControls:3,held:['Qualified or shadowed type operands and class initializer casts','TextBlock public dispatch, full layout and application integration']},null,2));console.log(JSON.stringify({run,sourceClasses:plan.bindings.length,airRows:19,comparisons:wanted.length,rejectionGuards,targets:['ES5','ES2015'],runtimes:['Node','Chromium'],generatedTypeErrors:0,dependencyTypeErrors:diagnostics.length}));
})().catch(e=>{console.error(e);process.exitCode=1;});
