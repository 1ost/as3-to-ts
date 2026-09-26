const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const api=require('../../lib'),engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2');
const ts=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const evidence=path.join(engine,'tests/nativeFlashOracle/movieclip-source-surface');
const expected=require(path.join(evidence,'verify.cjs')).filter(r=>r.id.startsWith('subclass-'));
assert.equal(expected.length,2);
const sources=Object.fromEntries(['SurfaceChild','ConstructionLog'].map(q=>{
 const source=fs.readFileSync(path.join(evidence,'source',q+'.as'),'utf8');return [q,{source,sourceSha256:hash(source)}];
}));
const compilerInputs=fs.readdirSync(path.resolve('src'),{recursive:true}).filter(f=>f.endsWith('.ts')).map(f=>({file:path.resolve('src',f),sha256:hash(fs.readFileSync(path.resolve('src',f)))}));
const cache=path.resolve('.cache/native-generated-movieclip');fs.mkdirSync(cache,{recursive:true});const out=fs.mkdtempSync(path.join(cache,'run-'));
async function main(){
 const {chromium}=require(require.resolve('playwright',{paths:[path.resolve('../op2-html5/game-client-laya'),engine]}));
 const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']}),results=[];
 try{for(const target of ['ES5','ES2015']){
  const dir=path.join(out,target);fs.mkdirSync(dir);
  const modulePath=file=>{const r=path.relative(dir,file).replaceAll('\\','/').replace(/\.ts$/,'');return r.startsWith('.')?r:'./'+r;};
  const provider=n=>modulePath(path.join(engine,'src/layaAir/flash/utils',n+'.ts'));
  const nativeProviders={
   'flash.display.MovieClip':{module:provider('AS3GeneratedMovieClipConstruction'),exportName:'MovieClip',nativeBase:'MovieClip'},
   'flash.display.Sprite':{module:modulePath(path.join(engine,'src/layaAir/flash/display/Sprite.ts')),exportName:'Sprite'},
   'flash.display.Scene':{module:provider('AS3CanonicalSceneProperties'),exportName:'Scene'},
   'flash.display.DisplayObject':{module:provider('AS3CanonicalDisplayReference'),exportName:'DisplayObject'},
   'flash.display.DisplayObjectContainer':{module:modulePath(path.join(engine,'src/layaAir/flash/display/DisplayObjectContainer.ts')),exportName:'DisplayObjectContainer'},
   'flash.display.Graphics':{module:provider('AS3CanonicalGraphicsReference'),exportName:'Graphics'},
   'flash.display.Shader':{module:modulePath(path.join(engine,'src/layaAir/flash/display/Shader.ts')),exportName:'Shader'},
   'flash.accessibility.AccessibilityImplementation':{module:provider('AS3CanonicalAccessibilityReference'),exportName:'AccessibilityImplementation'},
   'flash.geom.Rectangle':{module:provider('AS3CanonicalRectangleReference'),exportName:'Rectangle'}
  };
  for(const [name,owner] of [['ContextMenu','flash.ui'],['LoaderInfo','flash.display'],['Stage','flash.display']])
   nativeProviders[owner+'.'+name]={module:provider('AS3CanonicalSpriteOwnerReferences'),exportName:name};
  for(const [name,owner] of [['Transform','flash.geom'],['SoundTransform','flash.media'],['TextSnapshot','flash.text'],['AccessibilityProperties','flash.accessibility']])
   nativeProviders[owner+'.'+name]={module:provider('AS3CanonicalSpriteValueReferences'),exportName:name};
  const helpers=Object.fromEntries(['bound','classBound','nativeClass','callableClass'].map(n=>[n,modulePath(path.resolve('utils',n+'.ts'))]));
  const sourceError=modulePath(path.join(engine,'src/layaAir/flash/errors/AS3SourceError.ts'));
  const modules=['AS3GeneratedClass','AS3ScriptGlobal','AS3Type','AS3Class','AS3Invocation','AS3LexicalMembers','AS3Property','AS3MethodBinding','AS3Coercion','AS3String','AS3Addition','AS3ArrayCreation','NativeSourceClassLoadingSession'];
  const externalModules=[...Object.values(helpers),sourceError,...modules.map(provider),...Object.values(nativeProviders).map(p=>p.module)];
  const input={scope:'generated-movieclip',sources,providers:nativeProviders,providerModule:provider('AS3GeneratedClass'),scriptGlobalProviderModule:provider('AS3ScriptGlobal'),scriptDomainProvider:{module:'./cohortDomain',exportName:'scriptDomain'},inheritScriptClasses:true,classScriptSources:['ConstructionLog']};
  const plan=api.createNativeGeneratedDeclarationPlan(input);
  const options={customVisitors:[],definitionsByNamespace:{'':['SurfaceChild','ConstructionLog']},importModules:{...Object.fromEntries(Object.entries(nativeProviders).map(([q,p])=>[q,p.module])),'compiler.AS3Class':provider('AS3Class'),'compiler.AS3Invocation':provider('AS3Invocation')},
   decoratorModules:{bound:helpers.bound,classBound:helpers.classBound},nativeClassHelperModules:{nativeClass:helpers.nativeClass,callableClass:helpers.callableClass},
   nativeClassTraitsModule:provider('AS3GeneratedClass'),nativeLexicalMembersModule:provider('AS3LexicalMembers'),nativeGeneratedPropertyModule:provider('AS3Property'),
   nativeCallableMethodBindingModule:provider('AS3MethodBinding'),nativeCallableCoercionModule:provider('AS3Coercion'),nativeCallableStringModule:provider('AS3String'),
   nativeSourceErrorModule:sourceError,nativeDynamicPropertyReadsModule:provider('AS3Property'),nativeDynamicPropertyWritesModule:provider('AS3Property'),
   nativeComputedTypeTestModule:provider('AS3Type'),nativeDictionaryPropertyModule:provider('AS3Property'),nativeObjectCreationModule:provider('AS3Class'),
   nativeTypedLocals:true,nativeTypedLocalReferenceModule:provider('AS3Type'),nativeTypedLocalAdditionModule:provider('AS3Addition'),nativeArrayCreationModule:provider('AS3ArrayCreation'),
   nativeReferenceCoercion:{plan,module:'./unused',coercionModule:provider('AS3Type')},nativeNumericMethodParametersModule:provider('AS3Coercion'),nativeSignaturePropertyModule:provider('AS3Property')};
  const config={plan,target,emitterOptions:options,externalModules:[...new Set(externalModules)],loadingSessionModule:provider('NativeSourceClassLoadingSession')};
  const artifact=api.emitNativeSourceClassModule(config);assert.deepEqual(artifact,api.emitNativeSourceClassModule(config));
  const files=[];
  for(const item of artifact.generatedSources){const file=path.join(dir,item.module+'.ts');fs.writeFileSync(file,item.source);files.push(file);}
  const domain=path.join(dir,'cohortDomain.ts');fs.writeFileSync(domain,'import {AS3ScriptDomain} from '+JSON.stringify(provider('AS3ScriptGlobal'))+';export declare const scriptDomain:AS3ScriptDomain;');files.push(domain);
  fs.writeFileSync(path.join(dir,'factory.js'),artifact.moduleSource);fs.writeFileSync(path.join(dir,'factory.d.ts'),artifact.declarationSource);files.push(path.join(dir,'factory.d.ts'));
  files.push(...['glsl.d.ts','spine.d.ts'].map(f=>path.join(engine,'src/layaAir/tslibs',f)));
  const program=ts.createProgram(files,{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,strict:true,strictNullChecks:false,useUnknownInCatchVariables:false,experimentalDecorators:true,noEmit:true,skipLibCheck:true,lib:['lib.es2020.d.ts','lib.dom.d.ts','lib.dom.iterable.d.ts']});
  const diagnostics=ts.getPreEmitDiagnostics(program).map(d=>({file:d.file?.fileName,code:d.code,text:ts.flattenDiagnosticMessageText(d.messageText,'\n')}));
  fs.writeFileSync(path.join(dir,'types.json'),JSON.stringify(diagnostics,null,2));assert.deepEqual(diagnostics,[]);
  const observer=fs.readFileSync(path.join(__dirname,'observer.ts'),'utf8').replaceAll('@FLASH@',modulePath(path.join(engine,'src/layaAir/flash')));fs.writeFileSync(path.join(dir,'observer.ts'),observer);
  const entry=path.join(dir,'entry.ts');fs.writeFileSync(entry,"import "+JSON.stringify(modulePath(path.join(engine,'tests/nativeCanonicalSpriteClass/init-imports.ts')))+";import {Laya} from "+JSON.stringify(modulePath(path.join(engine,'src/layaAir/Laya.ts')))+";import {Render} from "+JSON.stringify(modulePath(path.join(engine,'src/layaAir/laya/renders/Render.ts')))+";import {run} from './observer';import {nativeSourceClassModule} from './factory.js';globalThis.completion=Laya.init(160,100).then(()=>{Render.paused=true;return run(nativeSourceClassModule);}).then(value=>{globalThis.result=value;});");
  const {createLayaSourceAliasPlugin}=await import(require('node:url').pathToFileURL(path.join(engine,'tests/nativeCanonicalSpriteClass/laya-source-alias.mjs')));
  const build=()=>esbuild.build({entryPoints:[entry],bundle:true,write:false,format:'iife',platform:'browser',target:'es2020',metafile:true,plugins:[createLayaSourceAliasPlugin(engine)],loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'}});
  const built=await build();
  const code=built.outputFiles[0].text;fs.writeFileSync(path.join(dir,'bundle.js'),code);
  const execute=async code=>{
   const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
   try{await page.route('http://movieclip-generated.test/**',r=>r.request().url().endsWith('/bundle.js')?r.fulfill({contentType:'text/javascript',body:code}):r.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"script-src 'self'"},body:'<!doctype html><body><script src="/bundle.js"></script></body>'}));
    await page.goto('http://movieclip-generated.test/');await page.evaluate(()=>globalThis.completion);assert.deepEqual(errors,[]);return await page.evaluate(()=>JSON.parse(JSON.stringify(globalThis.result)));
   }finally{await page.close();}
  };
  const web=await execute(code);
  fs.writeFileSync(path.join(dir,'actual.json'),JSON.stringify(web,null,2));assert.deepEqual(web.rows,expected);assert.equal(web.guards.length,5);
  const factoryFile=path.join(dir,'factory.js'),original=fs.readFileSync(factoryFile,'utf8');
  try{
   const changed=original.replace('this.trackAsMenu = true;','this.trackAsMenu = false;');assert.notEqual(changed,original);
   fs.writeFileSync(factoryFile,changed);const mutant=await build();const altered=await execute(mutant.outputFiles[0].text);assert.notDeepEqual(altered.rows,expected);
   const unprepared=original.replace(/[^\n;]+\.prepareNativeBase\(this,[^;]+;/,'');assert.notEqual(unprepared,original);
   fs.writeFileSync(factoryFile,unprepared);const rejected=await build();await assert.rejects(()=>execute(rejected.outputFiles[0].text),/Generated MovieClip base entry out of order/);
  }finally{fs.writeFileSync(factoryFile,original);}
  results.push({target,mutations:2,web,artifact,diagnostics,inputs:Object.keys(built.metafile.inputs).map(file=>({file,sha256:hash(fs.readFileSync(file))}))});
  console.log(JSON.stringify({target,rows:2,guards:web.guards.length,mutations:2,typeErrors:0}));
 }}finally{await browser.close();}
 for(const item of compilerInputs)assert.equal(hash(fs.readFileSync(item.file)),item.sha256,item.file);
 for(const result of results)for(const item of result.inputs)assert.equal(hash(fs.readFileSync(item.file)),item.sha256,item.file);
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({results,sources,compilerInputs,runnerSha256:hash(fs.readFileSync(__filename)),observerSha256:hash(fs.readFileSync(path.join(__dirname,'observer.ts'))),scope:'Complete unchanged code-created MovieClip subclass source; authored symbols remain separate.'},null,2));
 console.log(JSON.stringify({out,status:'passed',targets:2,realms:1}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
