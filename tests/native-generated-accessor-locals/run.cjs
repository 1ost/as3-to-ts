const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const api=require('../../lib'),parse=require('../../lib/parse'),emit=require('../../lib/emit'),ts=require('typescript');
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2');
const modern=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const evidence=path.join(engine,'tests/nativeFlashOracle/generated-accessor-locals');const captured=require(path.join(evidence,'verify.cjs'));
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const root=path.resolve('.cache/native-generated-accessor-locals');fs.mkdirSync(root,{recursive:true});const run=fs.mkdtempSync(path.join(root,'run-'));
const modulePath=file=>{let r=path.relative(run,file).replaceAll('\\','/').replace(/\.ts$/,'');return r.startsWith('.')?r:'./'+r;};
const provider=name=>modulePath(path.join(engine,'src/layaAir/flash/utils',name+'.ts'));
const sources={};function visit(dir){for(const file of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,file.name);if(file.isDirectory())visit(full);else if(file.name.endsWith('.as')&&file.name!=='GeneratedAccessorLocalsProbe.as'){const qname=path.relative(path.join(evidence,'source'),full).replaceAll('\\','.').replaceAll('/','.').slice(0,-3),source=fs.readFileSync(full,'utf8');sources[qname]={source,sourceSha256:hash(source)};}}}visit(path.join(evidence,'source'));assert.equal(Object.keys(sources).length,4);
const plan=api.createNativeGeneratedDeclarationPlan({scope:'generated-accessor-locals',providerModule:provider('AS3GeneratedClass'),interfaceProviderModule:provider('AS3Type'),sources});
const helpers=Object.fromEntries(['bound','classBound','nativeClass','callableClass'].map(name=>[name,modulePath(path.resolve('utils',name+'.ts'))]));
const fileFor=q=>q.split('.').pop(),definitionsByNamespace={};
for(const q of Object.keys(sources)){const i=q.lastIndexOf('.');(definitionsByNamespace[q.slice(0,i)]??=[]).push(q.slice(i+1));}
const options={customVisitors:[],importModules:Object.fromEntries(Object.keys(sources).map(q=>[q,'./'+fileFor(q)])),definitionsByNamespace,
 decoratorModules:{bound:helpers.bound,classBound:helpers.classBound},nativeClassHelperModules:{nativeClass:helpers.nativeClass,callableClass:helpers.callableClass},
 nativeGeneratedDeclarations:{plan,module:'./declarationDomain'},nativeClassTraitsModule:provider('AS3GeneratedClass'),nativeLexicalMembersModule:provider('AS3LexicalMembers'),nativeGeneratedPropertyModule:provider('AS3Property'),
 nativeCallableMethodBindingModule:provider('AS3MethodBinding'),nativeCallableCoercionModule:provider('AS3Coercion'),nativeCallableStringModule:provider('AS3String'),
 nativeComputedTypeTestModule:provider('AS3Type'),nativeDictionaryPropertyModule:provider('AS3Property'),nativeTypedLocals:true,nativeTypedLocalReferenceModule:provider('AS3Type'),nativeTypedLocalAdditionModule:provider('AS3Addition'),nativeArrayCreationModule:provider('AS3ArrayCreation')};
const combined=process.argv.includes('--combined');if(combined)Object.assign(options,{nativeReferenceCoercion:{plan,module:'./declarationDomain',coercionModule:provider('AS3Type')},nativeNumericMethodParametersModule:provider('AS3Coercion'),nativeSignaturePropertyModule:provider('AS3Property')});
let rejectionGuards=0;
const original=sources['accessors.AccessorLocals'].source;
assert.throws(()=>emit(parse('AccessorLocals.as',original),original,{...options,nativeTypedLocals:false}),/AS3_[A-Z_]+UNSUPPORTED/);rejectionGuards++;
for(const body of [
 'public function get value():uint{var n:uint=0;try{return n;}catch(e:*){}}',
 'public function get value():uint{var n:uint=0;}',
 'public function get value():uint{var n:uint=0;return;}',
 'public function set value(v:uint=0):void{}',
 'public function get value():*{var n:uint=0;function inner():*{return n;}return inner();}',
 'public function set value(v:*):void{var n:uint;try{}catch(n:*){n=1;}}'
]){
 const source='package guard {public class Guard {'+body+'}}';
 assert.throws(()=>{const p=api.createNativeGeneratedDeclarationPlan({scope:'guard',providerModule:provider('AS3GeneratedClass'),sources:{'guard.Guard':{source,sourceSha256:hash(source)}}});emit(parse('Guard.as',source),source,{...options,nativeGeneratedDeclarations:{plan:p,module:'./guard'},...(combined?{nativeReferenceCoercion:{plan:p,module:'./guard',coercionModule:provider('AS3Type')}}:{})});},/AS3_[A-Z_]+UNSUPPORTED/,body);rejectionGuards++;
}
fs.writeFileSync(path.join(run,'declarationDomain.ts'),plan.moduleSource);const emitted=[];
for(const binding of [...plan.bindings,...plan.interfaces]){const source=sources[binding.qname].source,file=path.join(run,fileFor(binding.qname)+'.ts');fs.mkdirSync(path.dirname(file),{recursive:true});
 const opts={...options};
 if(plan.interfaces.some(i=>i.qname===binding.qname)){for(const k of Object.keys(opts))if(k.startsWith('native'))delete opts[k];}
 const output=emit(parse(binding.qname+'.as',source),source,opts);fs.writeFileSync(file,output);emitted.push({qname:binding.qname,file,sourceSha256:hash(source),outputSha256:hash(output)});
}
const files=[path.join(run,'declarationDomain.ts'),...emitted.map(e=>e.file)];
const program=modern.createProgram(files,{target:modern.ScriptTarget.ES2020,module:modern.ModuleKind.CommonJS,strict:true,strictNullChecks:false,experimentalDecorators:true,noEmit:true,skipLibCheck:true,lib:['lib.es2020.d.ts','lib.dom.d.ts']});
const diagnostics=modern.getPreEmitDiagnostics(program).map(d=>({file:d.file&&path.relative(run,d.file.fileName),code:d.code,text:modern.flattenDiagnosticMessageText(d.messageText,'\n')}));fs.writeFileSync(path.join(run,'types.json'),JSON.stringify(diagnostics,null,2));assert.deepEqual(diagnostics,[]);
const names=['AS3MethodBinding','AS3Coercion','AS3String','AS3Type','AS3Property','AS3Class','AS3Invocation','AS3DeclarationType','FlashTypeMetadata','AS3LexicalMembers','AS3ArrayCreation','AS3Addition','QName','AS3DynamicObject','AS3SourceError','AS3ScriptGlobal','AS3GeneratedClass'];
const moduleFor=n=>'src/layaAir/flash/'+(n==='AS3SourceError'?'errors':'utils')+'/'+n;
const built=esbuild.buildSync({absWorkingDir:engine,stdin:{contents:names.map(n=>'export * from "./'+moduleFor(n)+'";').join('\n'),resolveDir:engine,loader:'ts'},bundle:true,write:false,format:'cjs',platform:'browser',target:'es2020',metafile:true});
const providerGraph=Object.keys(built.metafile.inputs).filter(f=>f!=='<stdin>').map(f=>({file:f,sha256:hash(fs.readFileSync(path.resolve(engine,f)))}));
const driverFile=path.resolve('tests/native-generated-accessor-locals/runtime-driver.js'),observer=fs.readFileSync(driverFile,'utf8');
const wanted=captured;
assert.equal(wanted.length,36);
for(const mutate of [v=>v.pop(),v=>v.reverse(),v=>v.find(r=>r.id==='defaults').value[0][1]=1,v=>v.find(r=>r.id==='numeric-hook').value[3].push('number'),v=>v.find(r=>r.id==='raw-assignment').value[0][0]=1]){const bad=structuredClone(wanted);mutate(bad);assert.throws(()=>assert.deepEqual(bad,wanted));}
(async()=>{const {chromium}=require(require.resolve('playwright',{paths:[path.resolve('../op2-html5/game-client-laya'),engine]}));const browser=await chromium.launch({headless:true});const results=[];
try{for(const target of [ts.ScriptTarget.ES5,ts.ScriptTarget.ES2015]){
 const specs=[];for(const file of files){const source=fs.readFileSync(file,'utf8'),out=ts.transpileModule(source,{compilerOptions:{target,module:ts.ModuleKind.CommonJS,experimentalDecorators:true},reportDiagnostics:true});assert.deepEqual(out.diagnostics,[]);const relative=path.relative(run,file).replaceAll('\\','/').replace(/\.ts$/,'');specs.push({name:relative,code:out.outputText});}
 for(const name of ['bound','classBound','nativeClass','callableClass'])specs.push({name,code:modern.transpileModule(fs.readFileSync(path.resolve('utils',name+'.ts'),'utf8'),{compilerOptions:{target,module:modern.ModuleKind.CommonJS}}).outputText});
 const script='{const api=(()=>{const module={exports:{}};'+built.outputFiles[0].text+';return module.exports;})();const shared=new Map(),specs=new Map('+JSON.stringify(specs)+'.map(s=>[s.name,s.code])),providers=new Set('+JSON.stringify(names)+'),localNames=new Set('+JSON.stringify(['declarationDomain',...emitted.map(e=>fileFor(e.qname))])+');function createDomainLoader(){const local=new Map();function load(name){if(providers.has(name))return api;const modules=localNames.has(name)?local:shared;if(modules.has(name))return modules.get(name);if(!specs.has(name))throw Error("unresolved module "+name);const output={};modules.set(name,output);new Function("exports","require",specs.get(name))(output,r=>load(r.split("/").pop()));return output;}load.loaded=local;return load;}const load=createDomainLoader();'+observer+'}';
 fs.writeFileSync(path.join(run,'bundle-'+target+'.js'),script);const node=JSON.parse(JSON.stringify(new Function(script+';return globalThis.result;')()));
 const page=await browser.newPage();await page.addScriptTag({content:script});const web=await page.evaluate(()=>JSON.parse(JSON.stringify(globalThis.result)));await page.close();
 for(const actual of [node,web]){assert.deepEqual(actual,wanted);}
 results.push({target,node,web});
}}finally{await browser.close();}
fs.writeFileSync(path.join(run,'report.json'),JSON.stringify({combined,emitted,results,providerGraph,observer:{file:driverFile,sha256:hash(observer)},typecheck:{files:program.getSourceFiles().length,diagnostics},rejectionGuards,comparisonNegativeControls:5,held:['Full error text and builtin Error catch identity are not compared','Typed exception returns, nested accessor closures and static NIL initialization remain held','SlotList.NIL and full Signal runtime remain prerequisites']},null,2));console.log(JSON.stringify({run,sourceClasses:3,sourceInterfaces:1,airRows:36,rejectionGuards,targets:['ES5','ES2015'],runtimes:['Node','Chromium'],typeErrors:0}));
})().catch(e=>{console.error(e);process.exitCode=1;});
