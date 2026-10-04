const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../..'),compiler=repo,engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2-illegal-operation-review'),api=require(path.join(compiler,'lib'));
const cp=require('node:child_process');const pins={engine:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:engine,encoding:'utf8'}).trim()};
assert.equal(pins.engine,require('./engine.json').commit);
const ts=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const evidence=__dirname,air=require(path.join(evidence,'verify.cjs'));
const expected=air;
const compilerInputs=['src','lib'].flatMap(folder=>fs.readdirSync(path.join(compiler,folder),{recursive:true}).filter(f=>/\.(ts|js)$/.test(f)).map(f=>{const file=path.join(compiler,folder,f);return {file,sha256:hash(fs.readFileSync(file))};}));
const cache=path.resolve(repo,'.cache/native-generated-movieclip-lexical');fs.mkdirSync(cache,{recursive:true});
const out=fs.mkdtempSync(path.join(cache,'run-'));
const read=(folder,names)=>Object.fromEntries(names.map(q=>{const source=fs.readFileSync(path.join(evidence,folder,q.replaceAll('.','/')+'.as'),'utf8');return [q,{source,sourceSha256:hash(source)}];}));
const cohorts={parent:read('source',['cases.Base','cases.Reader','cases.Probe'])};
async function main(){
 const {chromium}=require(require.resolve('playwright',{paths:[path.resolve('../op2-html5/game-client-laya'),engine]}));
 const browser=await chromium.launch({headless:true}),results=[];
 try{for(const target of ['ES5','ES2015']){
  const dir=path.join(out,target);fs.mkdirSync(dir);
  const modulePath=file=>{const r=path.relative(dir,file).replaceAll('\\','/').replace(/\.ts$/,'');return r.startsWith('.')?r:'./'+r;};
  const artifacts={},typechecks=[];let rejectionGuards=0;
  for(const [cohort,sources]of Object.entries(cohorts)){
  const dir=path.join(out,target,cohort);fs.mkdirSync(dir);
  const modulePath=file=>{const r=path.relative(dir,file).replaceAll('\\','/').replace(/\.ts$/,'');return r.startsWith('.')?r:'./'+r;};
  const provider=n=>modulePath(path.join(engine,'src/layaAir/flash/utils',n+'.ts'));
  const helpers=Object.fromEntries(['bound','classBound','nativeClass','callableClass'].map(n=>[n,modulePath(path.join(compiler,'utils',n+'.ts'))]));
  const sourceError=modulePath(path.join(engine,'src/layaAir/flash/errors/AS3SourceError.ts'));
  const modules=['getQualifiedClassName','AS3CanonicalDisplayReference','AS3CanonicalEventConstruction','AS3CanonicalErrorConstruction','AS3CanonicalXMLReference','AS3XML','AS3ReflectionQuery','describeType','AS3Vector','AS3StringIntrinsics','Dictionary','AS3GeneratedClass','AS3ScriptGlobal','AS3Type','AS3Class','AS3Invocation','AS3LexicalMembers','AS3Property','AS3MethodBinding','AS3Coercion','AS3String','AS3Addition','AS3ArrayCreation','NativeSourceClassLoadingSession'];
  const externalModules=[...Object.values(helpers),sourceError,...modules.map(provider)];
   const nativeProviders={'flash.display.MovieClip':{module:provider('AS3GeneratedMovieClipConstruction'),exportName:'MovieClip',nativeBase:'MovieClip'},Error:{module:provider('AS3CanonicalErrorConstruction'),exportName:'Error',nativeBase:'Error'},'flash.errors.IllegalOperationError':{module:provider('AS3CanonicalIllegalOperationErrorConstruction'),exportName:'IllegalOperationError'}};
   for(const [q,n]of Object.entries({
    'flash.display.DisplayObject':'AS3CanonicalDisplayReference','flash.display.Graphics':'AS3CanonicalGraphicsReference',
    'flash.accessibility.AccessibilityImplementation':'AS3CanonicalAccessibilityReference','flash.geom.Rectangle':'AS3CanonicalRectangleReference',
    'flash.text.TextField':'AS3CanonicalTextFieldReference','flash.display.Scene':'AS3CanonicalSceneConstruction',
    'flash.ui.ContextMenu':'AS3CanonicalSpriteOwnerReferences','flash.display.LoaderInfo':'AS3CanonicalSpriteOwnerReferences','flash.display.Stage':'AS3CanonicalSpriteOwnerReferences',
    'flash.geom.Transform':'AS3CanonicalSpriteValueReferences','flash.media.SoundTransform':'AS3CanonicalSpriteValueReferences',
    'flash.text.TextSnapshot':'AS3CanonicalSpriteValueReferences','flash.accessibility.AccessibilityProperties':'AS3CanonicalSpriteValueReferences'
   }))nativeProviders[q]={module:provider(n),exportName:q.split('.').pop()};
   for(const n of ['DisplayObjectContainer','Shader','Sprite'])nativeProviders['flash.display.'+n]={module:modulePath(path.join(engine,'src/layaAir/flash/display',n+'.ts')),exportName:n};
   const trace=modulePath(path.join(engine,'src/layaAir/flash/debug/trace.ts'));externalModules.push(trace,...Object.values(nativeProviders).map(p=>p.module));
   const input={scope:'movieclip-lexical-'+cohort,sources,providers:nativeProviders,vectorProviderModule:provider('AS3Vector'),patternProviderModule:provider('AS3StringIntrinsics'),providerModule:provider('AS3GeneratedClass'),interfaceProviderModule:provider('AS3Type'),scriptGlobalProviderModule:provider('AS3ScriptGlobal'),scriptDomainProvider:{module:'./cohortDomain',exportName:'scriptDomain'},inheritScriptClasses:true,lexicalProviderModule:provider('AS3LexicalMembers')};

   const plan=api.createNativeGeneratedDeclarationPlan(input);
   const definitionsByNamespace={};for(const q of [...Object.keys(sources),...Object.keys(nativeProviders)]){const parts=q.split('.'),n=parts.pop();(definitionsByNamespace[parts.join('.')]??=[]).push(n);}
   const options={customVisitors:[],definitionsByNamespace,nativeGlobalModules:{trace},nativeVectorTypes:{plan,module:'./__native_declarations'},nativeStringIntrinsicsModule:provider('AS3StringIntrinsics'),nativeStringLocalCoercionModule:provider('AS3String'),nativeEnumeration:{dictionaryModule:provider('Dictionary'),coercionModule:provider('AS3Coercion'),stringModule:provider('AS3String')},importModules:{...Object.fromEntries(Object.entries(nativeProviders).map(([q,p])=>[q,p.module])),'flash.utils.getQualifiedClassName':provider('getQualifiedClassName'),'flash.utils.describeType':provider('describeType'),'compiler.AS3Class':provider('AS3Class'),'compiler.AS3Invocation':provider('AS3Invocation')},
    decoratorModules:{bound:helpers.bound,classBound:helpers.classBound},nativeClassHelperModules:{nativeClass:helpers.nativeClass,callableClass:helpers.callableClass},
    nativeClassTraitsModule:provider('AS3GeneratedClass'),nativeLexicalMembersModule:provider('AS3LexicalMembers'),nativeGeneratedPropertyModule:provider('AS3Property'),
    nativeCallableMethodBindingModule:provider('AS3MethodBinding'),nativeCallableCoercionModule:provider('AS3Coercion'),nativeCallableStringModule:provider('AS3String'),
    nativeSourceErrorModule:sourceError,nativeDynamicPropertyReadsModule:provider('AS3Property'),nativeDynamicPropertyWritesModule:provider('AS3Property'),
    nativeComputedTypeTestModule:provider('AS3Type'),nativeDictionaryPropertyModule:provider('AS3Property'),nativeObjectCreationModule:provider('AS3Class'),
    nativeMovieClipReferenceModule:provider('AS3GeneratedMovieClipConstruction'),nativeClassTypeOperationsModule:provider('AS3Class'),nativeTypedLocals:true,nativeTypedLocalReferenceModule:provider('AS3Type'),nativeTypedLocalAdditionModule:provider('AS3Addition'),nativeArrayCreationModule:provider('AS3ArrayCreation'),
    nativeReferenceCoercion:{plan,module:'./unused',coercionModule:provider('AS3Type')},nativeNumericMethodParametersModule:provider('AS3Coercion'),nativeSignaturePropertyModule:provider('AS3Property')};
   const config={plan,target,emitterOptions:options,externalModules:[...new Set(externalModules)],loadingSessionModule:provider('NativeSourceClassLoadingSession')};
   const emitPlan=p=>api.emitNativeSourceClassModule({...config,plan:p,emitterOptions:{...options,nativeVectorTypes:{...options.nativeVectorTypes,plan:p},nativeReferenceCoercion:{...options.nativeReferenceCoercion,plan:p}}});
   if(process.argv.includes('--baseline')){assert.throws(()=>api.emitNativeSourceClassModule(config),/lexical receiver requires exact source type/);console.log(JSON.stringify({target,baseline:true}));continue;}
   for(const patch of [
    {nativeMovieClipReferenceModule:undefined},
    {nativeMovieClipReferenceModule:'./wrong'},
    {nativeReferenceCoercion:undefined},
    {importModules:{...options.importModules,'flash.display.MovieClip':'./wrong'}}
   ]){assert.throws(()=>api.emitNativeSourceClassModule({...config,emitterOptions:{...options,...patch}}),/AS3_.*UNSUPPORTED/);rejectionGuards++;}
   for(const replacement of ['return display.downArrow=1;','return display.downArrow();']){
    const source=sources['cases.Reader'].source.replace('return display.downArrow;',replacement);
    const changed=api.createNativeGeneratedDeclarationPlan({...input,sources:{...sources,'cases.Reader':{source,sourceSha256:hash(source)}}});
    assert.throws(()=>emitPlan(changed),/chained dynamic receiver currently requires a property read/);rejectionGuards++;
   }
   const artifact=api.emitNativeSourceClassModule(config);assert.deepEqual(artifact,api.emitNativeSourceClassModule(config));artifacts[cohort]=artifact;
   assert.equal(artifact.generatedSources.length,Object.keys(sources).length+1);
   const files=[];
   for(const item of artifact.generatedSources){const file=path.join(dir,item.module+'.ts');fs.writeFileSync(file,item.source);files.push(file);}
   const domain=path.join(dir,'cohortDomain.ts');fs.writeFileSync(domain,'import {AS3ScriptDomain} from '+JSON.stringify(provider('AS3ScriptGlobal'))+';export declare const scriptDomain:AS3ScriptDomain;');files.push(domain);
   fs.writeFileSync(path.join(dir,cohort+'-factory.js'),artifact.moduleSource);
   const declaration=path.join(dir,cohort+'-factory.d.ts');fs.writeFileSync(declaration,artifact.declarationSource);files.push(declaration);
   files.push(...['glsl.d.ts','spine.d.ts'].map(f=>path.join(engine,'src/layaAir/tslibs',f)));
   const program=ts.createProgram(files,{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,resolveJsonModule:true,esModuleInterop:true,strict:true,strictNullChecks:false,useUnknownInCatchVariables:false,experimentalDecorators:true,noEmit:true,skipLibCheck:true,lib:['lib.es2020.d.ts','lib.dom.d.ts','lib.dom.iterable.d.ts']});
   const diagnostics=ts.getPreEmitDiagnostics(program).map(d=>({file:d.file?.fileName,code:d.code,text:ts.flattenDiagnosticMessageText(d.messageText,'\n')}));
   fs.writeFileSync(path.join(dir,cohort+'-types.json'),JSON.stringify(diagnostics,null,2));assert.deepEqual(diagnostics,[]);
   typechecks.push({cohort,diagnostics,inputs:program.getSourceFiles().map(f=>({file:f.fileName,sha256:hash(fs.readFileSync(f.fileName))}))});
  }
  if(process.argv.includes('--baseline'))continue;
  const init=fs.readFileSync(path.join(engine,'tests/nativeCanonicalDisplayAncestry/init-imports.ts'),'utf8').replaceAll('@laya/engine/',modulePath(path.join(engine,'src/layaAir'))+'/');
  const observer=init+'\n'+fs.readFileSync(path.join(__dirname,'observer.ts'),'utf8').replaceAll('@FLASH@',modulePath(path.join(engine,'src/layaAir/flash')));
  fs.writeFileSync(path.join(dir,'observer.ts'),observer);
  const entry=path.join(dir,'entry.ts');fs.writeFileSync(entry,"import {run} from './observer';import {nativeSourceClassModule as parent} from './parent/parent-factory.js';globalThis.completion=run(parent).then(value=>{globalThis.result=value;});");
  const build=()=>esbuild.build({entryPoints:[entry],bundle:true,write:false,format:'iife',platform:'browser',target:'es2020',metafile:true,loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'}});
  const built=await build();
  const code=built.outputFiles[0].text;fs.writeFileSync(path.join(dir,'bundle.js'),code);
  const execute=async body=>{const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('http://movieclip-lexical.test/**',route=>route.request().url().endsWith('/bundle.js')?route.fulfill({contentType:'text/javascript',body}):route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"script-src 'self' 'wasm-unsafe-eval'"},body:'<!doctype html><body><script src="/bundle.js"></script></body>'}));
   await page.goto('http://movieclip-lexical.test/');await page.evaluate(()=>globalThis.completion);const result=await page.evaluate(()=>JSON.parse(JSON.stringify(globalThis.result)));await page.close();assert.deepEqual(errors,[]);return result;};
  const web=await execute(code);assert.deepEqual(web.rows,expected);
  const factory=path.join(dir,'parent/parent-factory.js'),original=fs.readFileSync(factory,'utf8'),controls=[];
  for(const [name,from,to,row]of [
   ['duplicate-getter','as3GetProperty(this.display, "downArrow")','as3GetProperty((this.display, this.display), "downArrow")','implicit'],
   ['wrong-store-value','as3SetProperty(clip, "downArrow", child)','as3SetProperty(clip, "downArrow", {})','implicit']
  ]){
   const changed=original.replaceAll(from,to);assert.notEqual(changed,original,name);
   try{fs.writeFileSync(factory,changed);const actual=await execute((await build()).outputFiles[0].text);assert.notDeepEqual(actual.rows.find(r=>r.id===row),expected.find(r=>r.id===row));controls.push({name,row,web:actual});}
   finally{fs.writeFileSync(factory,original);}
  }
  results.push({target,web,typechecks,artifacts,rejectionGuards,controls,inputs:Object.keys(built.metafile.inputs).map(file=>({file,sha256:hash(fs.readFileSync(file))}))});
  console.log(JSON.stringify({target,observations:web.rows.length,typeErrors:0,rejectionGuards,mutations:controls.length}));
 }}finally{await browser.close();}
 if(process.argv.includes('--baseline'))return;
 for(const item of compilerInputs)assert.equal(hash(fs.readFileSync(item.file)),item.sha256,item.file);
 for(const result of results)for(const item of [...result.inputs,...result.typechecks.flatMap(check=>check.inputs)])assert.equal(hash(fs.readFileSync(item.file)),item.sha256,item.file);
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({pins,results,cohorts,compilerInputs,runnerSha256:hash(fs.readFileSync(__filename)),observerSha256:hash(fs.readFileSync(path.join(__dirname,'observer.ts'))),held:['Maintained ScrollBar integration','Full startup and game account flow']},null,2));
 console.log(JSON.stringify({out,status:'passed',observations:expected.length,targets:2,realms:1}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
