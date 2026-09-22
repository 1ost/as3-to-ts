const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const api=require('../../lib'),parse=require('../../lib/parse'),emit=require('../../lib/emit'),ts=require('typescript');
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2');
const modern=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const evidence=path.resolve('tests/native-foreign-typed-locals');require(path.join(evidence,'verify-evidence.cjs'));
const captured=require('./verify.cjs');
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const root=path.resolve('.cache/native-generated-class-locals');fs.mkdirSync(root,{recursive:true});const run=fs.mkdtempSync(path.join(root,'run-'));
const modulePath=file=>{let r=path.relative(run,file).replaceAll('\\','/').replace(/\.ts$/,'');return r.startsWith('.')?r:'./'+r;};
const provider=name=>modulePath(path.join(engine,'src/layaAir/flash/utils',name+'.ts'));
const sources={};function visit(dir){for(const file of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,file.name);if(file.isDirectory())visit(full);else if(file.name.endsWith('.as')&&file.name!=='ConstructorOracle.as'){const qname=path.relative(path.join(evidence,'capture-c/sources/original'),full).replaceAll('\\','.').replaceAll('/','.').slice(0,-3),source=fs.readFileSync(full,'utf8');sources[qname]={source,sourceSha256:hash(source)};}}}visit(path.join(evidence,'capture-c/sources/original'));assert.equal(Object.keys(sources).length,12);
const plan=api.createNativeGeneratedDeclarationPlan({scope:'generated-foreign-locals',providerModule:provider('AS3GeneratedClass'),sources});
const helpers=Object.fromEntries(['bound','classBound','nativeClass','callableClass'].map(name=>[name,modulePath(path.resolve('utils',name+'.ts'))]));
const fileFor=q=>q==='elsewhere.Peer'?'elsewhere/Peer':q.split('.').pop(),definitionsByNamespace={};
for(const q of Object.keys(sources)){const i=q.lastIndexOf('.');(definitionsByNamespace[q.slice(0,i)]??=[]).push(q.slice(i+1));}
const options={customVisitors:[],importModules:Object.fromEntries(Object.keys(sources).map(q=>[q,'./'+fileFor(q)])),definitionsByNamespace,
 decoratorModules:{bound:helpers.bound,classBound:helpers.classBound},nativeClassHelperModules:{nativeClass:helpers.nativeClass,callableClass:helpers.callableClass},
 nativeGeneratedDeclarations:{plan,module:'./declarationDomain'},nativeClassTraitsModule:provider('AS3GeneratedClass'),nativeLexicalMembersModule:provider('AS3LexicalMembers'),nativeGeneratedPropertyModule:provider('AS3Property'),
 nativeCallableMethodBindingModule:provider('AS3MethodBinding'),nativeCallableCoercionModule:provider('AS3Coercion'),nativeCallableStringModule:provider('AS3String'),
 nativeTypedLocals:true,nativeTypedLocalReferenceModule:provider('AS3Type'),nativeTypedLocalAdditionModule:provider('AS3Addition'),nativeArrayCreationModule:provider('AS3ArrayCreation')};
const combined=process.argv.includes('--combined');if(combined)Object.assign(options,{nativeReferenceCoercion:{plan,module:'./declarationDomain',coercionModule:provider('AS3Type')},nativeNumericMethodParametersModule:provider('AS3Coercion'),nativeSignaturePropertyModule:provider('AS3Property')});
let rejectionGuards=0;
const entry=sources['refs.Entry'].source;
for(const key of ['nativeTypedLocalReferenceModule','nativeTypedLocalAdditionModule','nativeCallableCoercionModule','nativeCallableStringModule']){
 assert.throws(()=>emit(parse('Entry.as',entry),entry,{...options,[key]:undefined}),/AS3_[A-Z_]+UNSUPPORTED/);rejectionGuards++;
}
assert.throws(()=>emit(parse('Entry.as',entry),entry,{...options,nativeTypedLocals:false}),/typed local initialization/);rejectionGuards++;
for(const body of [
 'public function f():* {const x:Guard=null;return x;}',
 'public function f():* {var x:Guard;var x:Array;return x;}',
 'public function f(x:*):* {var x:Guard;return x;}',
 'public function f():* {var x:Guard;try{}catch(x:*){x=null;}return x;}',
 'public function f():* {var x:Guard;x+=null;return x;}',
 'public function f():* {var x:Guard;return ++x;}',
 'public function f():* {for each(var x:Guard in []){}return x;}',
 'public function f():* {var x:Guard;function nested(v:Guard):void{x=v;}nested(null);return x;}'
]){
 const source='package guard {public class Guard {'+body+'}}';
 assert.throws(()=>{const p=api.createNativeGeneratedDeclarationPlan({scope:'guard',providerModule:provider('AS3GeneratedClass'),sources:{'guard.Guard':{source,sourceSha256:hash(source)}}});
 emit(parse('Guard.as',source),source,{...options,nativeGeneratedDeclarations:{plan:p,module:'./guard'},...(combined?{nativeReferenceCoercion:{plan:p,module:'./guard',coercionModule:provider('AS3Type')}}:{})});},/AS3_[A-Z_]+UNSUPPORTED/,body);rejectionGuards++;
}
fs.writeFileSync(path.join(run,'declarationDomain.ts'),plan.moduleSource);const emitted=[];
for(const binding of plan.bindings){const source=sources[binding.qname].source,file=path.join(run,fileFor(binding.qname)+'.ts');fs.mkdirSync(path.dirname(file),{recursive:true});
 // Only this declaration lives a directory deeper; adjust explicit compiler module bindings, never source bodies.
 const opts=Object.fromEntries(Object.entries(options).map(([k,v])=>[k,v]));
 if(binding.qname==='elsewhere.Peer'){
  for(const k of Object.keys(opts))if(typeof opts[k]==='string'&&opts[k].startsWith('../'))opts[k]='../'+opts[k];
  for(const k of ['decoratorModules','nativeClassHelperModules'])opts[k]=Object.fromEntries(Object.entries(opts[k]).map(([n,v])=>[n,'../'+v]));
  opts.nativeGeneratedDeclarations={plan,module:'../declarationDomain'};
  if(combined)opts.nativeReferenceCoercion={plan,module:'../declarationDomain',coercionModule:'../'+provider('AS3Type')};
 }
 const output=emit(parse(binding.qname+'.as',source),source,opts);fs.writeFileSync(file,output);emitted.push({qname:binding.qname,file,sourceSha256:hash(source),outputSha256:hash(output)});
}
const files=[path.join(run,'declarationDomain.ts'),...emitted.map(e=>e.file)];
const program=modern.createProgram(files,{target:modern.ScriptTarget.ES2020,module:modern.ModuleKind.CommonJS,strict:true,strictNullChecks:false,experimentalDecorators:true,noEmit:true,skipLibCheck:true,lib:['lib.es2020.d.ts','lib.dom.d.ts']});
const diagnostics=modern.getPreEmitDiagnostics(program).map(d=>({file:d.file&&path.relative(run,d.file.fileName),code:d.code,text:modern.flattenDiagnosticMessageText(d.messageText,'\n')}));fs.writeFileSync(path.join(run,'types.json'),JSON.stringify(diagnostics,null,2));assert.deepEqual(diagnostics,[]);
const names=['AS3MethodBinding','AS3Coercion','AS3String','AS3Type','AS3Property','AS3Class','AS3Invocation','AS3DeclarationType','FlashTypeMetadata','AS3LexicalMembers','AS3ArrayCreation','AS3Addition','QName','AS3DynamicObject','AS3SourceError','AS3ScriptGlobal','AS3GeneratedClass'];
const moduleFor=n=>'src/layaAir/flash/'+(n==='AS3SourceError'?'errors':'utils')+'/'+n;
const built=esbuild.buildSync({absWorkingDir:engine,stdin:{contents:names.map(n=>'export * from "./'+moduleFor(n)+'";').join('\n'),resolveDir:engine,loader:'ts'},bundle:true,write:false,format:'cjs',platform:'browser',target:'es2020',metafile:true});
const providerGraph=Object.keys(built.metafile.inputs).filter(f=>f!=='<stdin>').map(f=>({file:f,sha256:hash(fs.readFileSync(path.resolve(engine,f)))}));
const driverFile=path.resolve('tests/native-generated-class-locals/runtime-driver.js'),observer=fs.readFileSync(driverFile,'utf8');
const wanted={rows:captured.rows,initializationRows:captured.initializationRows,errorRows:captured.errorRows};
assert.equal(wanted.rows.length+wanted.initializationRows.length+wanted.errorRows.length,57);
for(const mutate of [v=>v.rows.pop(),v=>v.rows.reverse(),v=>v.rows.find(r=>r.id==='chain-undefined').value=false,v=>v.initializationRows[0].events.push('early'),v=>v.errorRows.pop()]){const bad=structuredClone(wanted);mutate(bad);assert.throws(()=>assert.deepEqual(bad,wanted));}
(async()=>{const {chromium}=require(require.resolve('playwright',{paths:[path.resolve('../op2-html5/game-client-laya'),engine]}));const browser=await chromium.launch({headless:true});const results=[];
try{for(const target of [ts.ScriptTarget.ES5,ts.ScriptTarget.ES2015]){
 const specs=[];for(const file of files){const source=fs.readFileSync(file,'utf8'),out=ts.transpileModule(source,{compilerOptions:{target,module:ts.ModuleKind.CommonJS,experimentalDecorators:true},reportDiagnostics:true});assert.deepEqual(out.diagnostics,[]);const relative=path.relative(run,file).replaceAll('\\','/').replace(/\.ts$/,'');specs.push({name:relative==='elsewhere/Peer'?'OtherPeer':relative,code:out.outputText});}
 for(const name of ['bound','classBound','nativeClass','callableClass'])specs.push({name,code:modern.transpileModule(fs.readFileSync(path.resolve('utils',name+'.ts'),'utf8'),{compilerOptions:{target,module:modern.ModuleKind.CommonJS}}).outputText});
 const script='{const api=(()=>{const module={exports:{}};'+built.outputFiles[0].text+';return module.exports;})();const shared=new Map(),specs=new Map('+JSON.stringify(specs)+'.map(s=>[s.name,s.code])),providers=new Set('+JSON.stringify(names)+'),localNames=new Set('+JSON.stringify(['declarationDomain',...emitted.map(e=>e.qname==='elsewhere.Peer'?'OtherPeer':fileFor(e.qname))])+');function createDomainLoader(){const local=new Map();function load(name){if(providers.has(name))return api;const modules=localNames.has(name)?local:shared;if(modules.has(name))return modules.get(name);if(!specs.has(name))throw Error("unresolved module "+name);const output={};modules.set(name,output);new Function("exports","require",specs.get(name))(output,r=>load(r.endsWith("/elsewhere/Peer")?"OtherPeer":r.split("/").pop()));return output;}load.loaded=local;return load;}const load=createDomainLoader();const declarationBindings='+JSON.stringify(plan.bindings)+';'+observer+'}';
 fs.writeFileSync(path.join(run,'bundle-'+target+'.js'),script);const node=JSON.parse(JSON.stringify(new Function(script+';return globalThis.result;')()));
 const page=await browser.newPage();await page.addScriptTag({content:script});const web=await page.evaluate(()=>JSON.parse(JSON.stringify(globalThis.result)));await page.close();
 for(const actual of [node,web]){assert.deepEqual({rows:actual.rows,initializationRows:actual.initializationRows,errorRows:actual.errorRows},wanted);assert.equal(actual.guards.length,10);}
 results.push({target,node,web});
}}finally{await browser.close();}
fs.writeFileSync(path.join(run,'report.json'),JSON.stringify({combined,emitted,results,providerGraph,observer:{file:driverFile,sha256:hash(observer)},typecheck:{files:program.getSourceFiles().length,diagnostics},rejectionGuards,comparisonNegativeControls:5,held:['Error message text differs across Pepper and debug AIR and is not qualified','Original oracle host functions/reflection not emitted','Rest/optional signatures and SlotList.NIL remain prerequisites']},null,2));console.log(JSON.stringify({run,sourceClasses:12,airRows:57,rejectionGuards,domainGuards:10,targets:['ES5','ES2015'],runtimes:['Node','Chromium'],typeErrors:0}));
})().catch(e=>{console.error(e);process.exitCode=1;});
