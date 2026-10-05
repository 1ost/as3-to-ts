const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const api=require('../../lib'),engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2-rectangle-return-review');
const ts=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const evidence=path.join(engine,'tests/nativeFlashOracle/private-instance-int-constants');
let baselineLexical;
if(process.argv.includes('--baseline')){
 const previous=require('../native-generated-interface-getter-construction/verify.cjs'),Module=require('node:module'),filename=path.resolve('lib/emit/native-generated-lexical.js');
 const bytes=previous.read(filename),old=new Module(filename,module);old.filename=filename;old.paths=module.paths;old._compile(bytes.toString('utf8'),filename);
 require(filename).NativeGeneratedLexical=old.exports.NativeGeneratedLexical;baselineLexical={file:filename,sha256:hash(bytes),base64:bytes.toString('base64')};
}
const original=require(path.join(evidence,'verify.cjs'));
const expected=original.map(row=>row.id.startsWith('metadata-')?{...row,value:row.value.replace(/>\s+</g,'><')}:row);
const receipt=JSON.parse(fs.readFileSync(path.join(evidence,'evidence-final/receipt.json')));
const frozen=file=>fs.readFileSync(path.join(evidence,file));
const compilerInputs=['src','lib','utils'].flatMap(dir=>fs.readdirSync(path.resolve(dir),{recursive:true}).map(f=>path.resolve(dir,f)).filter(f=>fs.statSync(f).isFile()).map(file=>({file,sha256:hash(fs.readFileSync(file))})));
const cache=path.resolve('.cache/native-generated-private-instance-int-constants');fs.mkdirSync(cache,{recursive:true});
const out=fs.mkdtempSync(path.join(cache,'run-'));
const read=(folder,names)=>Object.fromEntries(names.map(q=>{const file=folder+'/'+q.replaceAll('.','/')+'.as',bytes=frozen(file);assert.equal(hash(bytes),receipt.artifacts[file.replace(/^evidence-final\//,'')]);const source=bytes.toString('utf8');return [q,{source,sourceSha256:hash(source)}];}));
const cohorts={parent:read('evidence-final/source',['intconstants.Trace','intconstants.Base','intconstants.Derived','intconstants.Values'])};
async function main(){
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||require.resolve('playwright',{paths:[path.resolve('../op2-html5/game-client-laya'),engine]}));
 const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}),results=[];
 try{for(const target of ['ES5','ES2015']){
  const dir=path.join(out,target);fs.mkdirSync(dir);
  const modulePath=file=>{const r=path.relative(dir,file).replaceAll('\\','/').replace(/\.ts$/,'');return r.startsWith('.')?r:'./'+r;};
  const artifacts={},typechecks=[];let rejectionGuards=0;
  for(const [cohort,sources]of Object.entries(cohorts)){
  const dir=path.join(out,target,cohort);fs.mkdirSync(dir);
  const modulePath=file=>{const r=path.relative(dir,file).replaceAll('\\','/').replace(/\.ts$/,'');return r.startsWith('.')?r:'./'+r;};
  const provider=n=>modulePath(path.join(engine,'src/layaAir/flash/utils',n+'.ts'));
  const helpers=Object.fromEntries(['bound','classBound','nativeClass','callableClass'].map(n=>[n,modulePath(path.resolve('utils',n+'.ts'))]));
  const sourceError=modulePath(path.join(engine,'src/layaAir/flash/errors/AS3SourceError.ts'));
  const modules=['AS3CanonicalDisplayReference','AS3CanonicalEventConstruction','AS3CanonicalErrorConstruction','AS3CanonicalXMLReference','AS3XML','AS3ReflectionQuery','describeType','AS3Vector','AS3StringIntrinsics','Dictionary','AS3SourceNamespace','AS3GeneratedClass','AS3ScriptGlobal','AS3Type','AS3Class','AS3Invocation','AS3LexicalMembers','AS3Property','AS3MethodBinding','AS3Coercion','AS3String','AS3Addition','AS3ArrayCreation','NativeSourceClassLoadingSession'];
  const externalModules=[...Object.values(helpers),sourceError,...modules.map(provider)];
   const nativeProviders={};
   const trace=modulePath(path.join(engine,'src/layaAir/flash/debug/trace.ts'));externalModules.push(trace,...Object.values(nativeProviders).map(p=>p.module));
   const input={scope:'class-script-retry-'+cohort,sources,providers:nativeProviders,vectorProviderModule:provider('AS3Vector'),patternProviderModule:provider('AS3StringIntrinsics'),providerModule:provider('AS3GeneratedClass'),interfaceProviderModule:provider('AS3Type'),scriptGlobalProviderModule:provider('AS3ScriptGlobal'),scriptDomainProvider:{module:'./cohortDomain',exportName:'scriptDomain'},inheritScriptClasses:true,classScriptSources:['intconstants.Trace'],lexicalProviderModule:provider('AS3LexicalMembers')};

   const plan=api.createNativeGeneratedDeclarationPlan(input);
   const definitionsByNamespace={};for(const q of Object.keys(sources)){const parts=q.split('.'),n=parts.pop();(definitionsByNamespace[parts.join('.')]??=[]).push(n);}
   const options={customVisitors:[],definitionsByNamespace,nativeGlobalModules:{trace},nativeVectorTypes:{plan,module:'./__native_declarations'},nativeStringIntrinsicsModule:provider('AS3StringIntrinsics'),nativeStringLocalCoercionModule:provider('AS3String'),nativeEnumeration:{dictionaryModule:provider('Dictionary'),coercionModule:provider('AS3Coercion'),stringModule:provider('AS3String')},importModules:{...Object.fromEntries(Object.entries(nativeProviders).map(([q,p])=>[q,p.module])),'flash.utils.describeType':provider('describeType'),'compiler.AS3Class':provider('AS3Class'),'compiler.AS3Invocation':provider('AS3Invocation')},
    decoratorModules:{bound:helpers.bound,classBound:helpers.classBound},nativeClassHelperModules:{nativeClass:helpers.nativeClass,callableClass:helpers.callableClass},
    nativeClassTraitsModule:provider('AS3GeneratedClass'),nativeLexicalMembersModule:provider('AS3LexicalMembers'),nativeGeneratedPropertyModule:provider('AS3Property'),
    nativeCallableMethodBindingModule:provider('AS3MethodBinding'),nativeCallableCoercionModule:provider('AS3Coercion'),nativeCallableStringModule:provider('AS3String'),
    nativeSourceErrorModule:sourceError,nativeDynamicPropertyReadsModule:provider('AS3Property'),nativeDynamicPropertyWritesModule:provider('AS3Property'),
    nativeComputedTypeTestModule:provider('AS3Type'),nativeDictionaryPropertyModule:provider('AS3Property'),nativeObjectCreationModule:provider('AS3Class'),
    nativeTypedLocals:true,nativeTypedLocalReferenceModule:provider('AS3Type'),nativeTypedLocalAdditionModule:provider('AS3Addition'),nativeArrayCreationModule:provider('AS3ArrayCreation'),
    nativeReferenceCoercion:{plan,module:'./unused',coercionModule:provider('AS3Type')},nativeNumericMethodParametersModule:provider('AS3Coercion'),nativeSignaturePropertyModule:provider('AS3Property')};
   const config={plan,target,emitterOptions:options,externalModules:[...new Set(externalModules)],loadingSessionModule:provider('NativeSourceClassLoadingSession'),sourceNamespaceProviderModule:provider('AS3SourceNamespace')};
   const emitPlan=p=>api.emitNativeSourceClassModule({...config,plan:p,emitterOptions:{...options,nativeVectorTypes:{...options.nativeVectorTypes,plan:p},nativeReferenceCoercion:{...options.nativeReferenceCoercion,plan:p}}});
   if(!process.argv.includes('--baseline')){
    for(const declaration of ['private const MIN:int=1+2','private const MIN:int','private const MIN:Class=null','private const MIN:uint=1']){
     const source=sources['intconstants.Values'].source.replace('private const MIN:int=-2147483648',declaration);assert.notEqual(source,sources['intconstants.Values'].source);
     assert.throws(()=>emitPlan(api.createNativeGeneratedDeclarationPlan({...input,sources:{...sources,'intconstants.Values':{source,sourceSha256:hash(source)}}})),/AS3_[A-Z_]+UNSUPPORTED/);rejectionGuards++;
    }
    const source=sources['intconstants.Values'].source.replace('return value.MAX;','this.MAX=19;return value.MAX;');
    assert.throws(()=>emitPlan(api.createNativeGeneratedDeclarationPlan({...input,sources:{...sources,'intconstants.Values':{source,sourceSha256:hash(source)}}})),/AS3_[A-Z_]+UNSUPPORTED/);rejectionGuards++;
   }
   const artifact=api.emitNativeSourceClassModule(config);assert.deepEqual(artifact,api.emitNativeSourceClassModule(config));artifacts[cohort]=artifact;
   assert.equal(plan.bindings.length,4);assert.equal(plan.interfaces.length,0);
   const files=[];
   for(const item of artifact.generatedSources){const file=path.join(dir,item.module+'.ts');fs.writeFileSync(file,item.source);files.push(file);}
   const domain=path.join(dir,'cohortDomain.ts');fs.writeFileSync(domain,'import {AS3ScriptDomain} from '+JSON.stringify(provider('AS3ScriptGlobal'))+';export declare const scriptDomain:AS3ScriptDomain;');files.push(domain);
   fs.writeFileSync(path.join(dir,cohort+'-factory.js'),artifact.moduleSource);
   const declaration=path.join(dir,cohort+'-factory.d.ts');fs.writeFileSync(declaration,artifact.declarationSource);files.push(declaration);
   files.push(...['glsl.d.ts','spine.d.ts'].map(f=>path.join(engine,'src/layaAir/tslibs',f)));
   const program=ts.createProgram(files,{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,strict:true,strictNullChecks:false,useUnknownInCatchVariables:false,experimentalDecorators:true,noEmit:true,skipLibCheck:true,lib:['lib.es2020.d.ts','lib.dom.d.ts','lib.dom.iterable.d.ts']});
   const diagnostics=ts.getPreEmitDiagnostics(program).map(d=>({file:d.file?.fileName,code:d.code,text:ts.flattenDiagnosticMessageText(d.messageText,'\n')}));
   fs.writeFileSync(path.join(dir,cohort+'-types.json'),JSON.stringify(diagnostics,null,2));assert.deepEqual(diagnostics,[]);
   typechecks.push({cohort,diagnostics,inputs:program.getSourceFiles().map(f=>({file:f.fileName,sha256:hash(fs.readFileSync(f.fileName))}))});
  }
  if(process.argv.includes('--baseline'))continue;
  const observer=fs.readFileSync(path.join(__dirname,'observer.ts'),'utf8').replaceAll('@FLASH@',modulePath(path.join(engine,'src/layaAir/flash'))).replaceAll('@ENGINE@',modulePath(engine));
  fs.writeFileSync(path.join(dir,'observer.ts'),observer);
  const entry=path.join(dir,'entry.ts');fs.writeFileSync(entry,"import {run} from './observer';import {nativeSourceClassModule as parent} from './parent/parent-factory.js';globalThis.completion=run(parent).then(value=>{globalThis.result=value;});");
  const build=()=>esbuild.build({entryPoints:[entry],bundle:true,write:false,format:'iife',platform:'browser',target:'es2020',metafile:true,loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'}});
  const built=await build();
  const code=built.outputFiles[0].text;fs.writeFileSync(path.join(dir,'bundle.js'),code);
  const execute=async code=>{
   const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
   await page.route('http://loaded-generated.test/**',route=>route.request().url().endsWith('/bundle.js')?route.fulfill({contentType:'text/javascript',body:code}):route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"script-src 'self'"},body:'<!doctype html><body><script src="/bundle.js"></script></body>'}));
   await page.goto('http://loaded-generated.test/');await page.evaluate(()=>globalThis.completion);const value=await page.evaluate(()=>JSON.parse(JSON.stringify(globalThis.result)));await page.close();assert.deepEqual(errors,[]);return value;
  };
  const vm=require('node:vm');const context=vm.createContext({console,setTimeout,clearTimeout,AbortController,AbortSignal,DOMException,performance});context.window=context;context.document={};new vm.Script(code).runInContext(context);await context.completion;const node=JSON.parse(JSON.stringify(context.result));
  const web=await execute(code);assert.deepEqual(node,web);fs.writeFileSync(path.join(dir,'actual.json'),JSON.stringify(web,null,2));assert.deepEqual(web.rows,expected);assert.equal(web.hostGuards,2);assert.equal(web.hostFailures,0);
  const controls=[];
  for(const mutation of ['wrong-private-constant','erase-early-constant','evaluate-folded-receiver']){
   let applied=0;
   const mutated=await esbuild.build({entryPoints:[entry],bundle:true,write:false,format:'iife',platform:'browser',target:'es2020',loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'},plugins:[{name:mutation,setup(build){build.onLoad({filter:/parent-factory\.js$/},args=>{
    let source=fs.readFileSync(args.path,'utf8');
    if(mutation==='evaluate-folded-receiver'){
     const from='return __as3_callable_generatedProperty.coerceAS3PropertyValue(2147483647, "int");';
     const start=source.indexOf('Values.prototype, "effect"'),end=source.indexOf('Values.prototype, "dynamicRead"');assert(start>=0&&end>start);
     const part=source.slice(start,end);assert.equal(part.split(from).length-1,1);
     source=source.slice(0,start)+part.replace(from,'void this.target;'+from)+source.slice(end);
    }else{
     const from='name: "MAX", visibility: "private", static: false, kind: "constant", type: "int", value: 2147483647';
     const to=mutation==='wrong-private-constant'?from.replace('value: 2147483647','value: 2147483646'):from.replace('kind: "constant"','kind: "variable"');
     assert.equal(source.split(from).length-1,1);source=source.replace(from,to);
    }
    applied++;return {contents:source,loader:'js'};
   });}}]});
   assert.equal(applied,1);const code=mutated.outputFiles[0].text;fs.writeFileSync(path.join(dir,'mutant-'+mutation+'.js'),code);
   const control=await execute(code);assert.notDeepEqual(control.rows.find(r=>r.id===(mutation==='evaluate-folded-receiver'?'receiver-effect':'dynamic-read')),expected.find(r=>r.id===(mutation==='evaluate-folded-receiver'?'receiver-effect':'dynamic-read')));
   const context=vm.createContext({console,setTimeout,clearTimeout,AbortController,AbortSignal,DOMException,performance});context.window=context;context.document={};new vm.Script(code).runInContext(context);await context.completion;const nodeControl=JSON.parse(JSON.stringify(context.result));assert.deepEqual(nodeControl,control);
   controls.push({mutation,applied,control,nodeControl});
  }
  results.push({target,node,web,typechecks,artifacts,rejectionGuards,mutations:3,controls,inputs:Object.keys(built.metafile.inputs).map(file=>({file,sha256:hash(fs.readFileSync(file))}))});
  console.log(JSON.stringify({target,observations:web.rows.length,typeErrors:0,rejectionGuards,mutations:3}));
 }}finally{await browser.close();}
 if(process.argv.includes('--baseline')){console.log(JSON.stringify({out,status:'baseline-held',targets:2,runtimeComparisons:0}));return;}
 for(const item of compilerInputs)assert.equal(hash(fs.readFileSync(item.file)),item.sha256,item.file);
 for(const result of results)for(const item of [...result.inputs,...result.typechecks.flatMap(check=>check.inputs)])assert.equal(hash(fs.readFileSync(item.file)),item.sha256,item.file);
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({receiptSha256:hash(frozen('evidence-final/receipt.json')),results,cohorts,compilerInputs,runnerSha256:hash(fs.readFileSync(__filename)),observerSha256:hash(fs.readFileSync(path.join(__dirname,'observer.ts'))),comparison:{generatedSourceRows:16,commonEngineRows:0},held:['Remaining TLF declarations and full source integration','Full startup and game account flow']},null,2));
 console.log(JSON.stringify({out,status:'passed',observations:expected.length,targets:2,realms:2}));
}
main().catch(error=>{fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({message:String(error),stack:error.stack,compilerInputs,cohorts,baselineLexical},null,2));console.error(error);console.log(JSON.stringify({out,status:'failed'}));process.exitCode=1;});
