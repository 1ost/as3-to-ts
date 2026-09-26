const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const api=require('../../lib'),engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2');
const ts=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const evidence=path.join(engine,'tests/nativeFlashOracle/generated-sprite-drag-calls'),expected=require(path.join(evidence,'verify.cjs'));
const cache=path.resolve('.cache/native-generated-sprite-drag-calls');fs.mkdirSync(cache,{recursive:true});
const out=fs.mkdtempSync(path.join(cache,'run-'));
const read=(folder,names)=>Object.fromEntries(names.map(q=>{const source=fs.readFileSync(path.join(evidence,folder,q.replaceAll('.','/')+'.as'),'utf8');return [q,{source,sourceSha256:hash(source)}];}));
const cohorts={subject:read('source',['dragcalls.Owner'])};
async function main(){
 const {chromium}=require(require.resolve('playwright',{paths:[path.resolve('../op2-html5/game-client-laya'),engine]}));
 const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']}),results=[];
 try{for(const target of ['ES5','ES2015']){
  const dir=path.join(out,target);fs.mkdirSync(dir);
  const modulePath=file=>{const r=path.relative(dir,file).replaceAll('\\','/').replace(/\.ts$/,'');return r.startsWith('.')?r:'./'+r;};
  const artifacts={},typechecks=[];let compilerGuards=0;
  for(const [cohort,sources]of Object.entries(cohorts)){
  const dir=path.join(out,target,cohort);fs.mkdirSync(dir);
  const modulePath=file=>{const r=path.relative(dir,file).replaceAll('\\','/').replace(/\.ts$/,'');return r.startsWith('.')?r:'./'+r;};
  const provider=n=>modulePath(path.join(engine,'src/layaAir/flash/utils',n+'.ts'));
  const helpers=Object.fromEntries(['bound','classBound','nativeClass','callableClass'].map(n=>[n,modulePath(path.resolve('utils',n+'.ts'))]));
  const sourceError=modulePath(path.join(engine,'src/layaAir/flash/errors/AS3SourceError.ts'));
  const modules=['AS3GeneratedClass','AS3ScriptGlobal','AS3Type','AS3Class','AS3Invocation','AS3LexicalMembers','AS3Property','AS3MethodBinding','AS3Coercion','AS3String','AS3Addition','AS3ArrayCreation','NativeSourceClassLoadingSession'];
  const spriteModule=provider('AS3GeneratedSpriteConstruction');
  const rectangleModule=modulePath(path.join(engine,'src/layaAir/flash/geom/Rectangle.ts'));
  const externalModules=[...Object.values(helpers),sourceError,...modules.map(provider),spriteModule,rectangleModule,provider('AS3CanonicalDisplayReference')];
   const extraProviders={};
   for(const [name,owner,mod] of [
    ['ContextMenu','flash.ui','AS3CanonicalSpriteOwnerReferences'],['LoaderInfo','flash.display','AS3CanonicalSpriteOwnerReferences'],['Stage','flash.display','AS3CanonicalSpriteOwnerReferences'],
    ['Transform','flash.geom','AS3CanonicalSpriteValueReferences'],['SoundTransform','flash.media','AS3CanonicalSpriteValueReferences'],['TextSnapshot','flash.text','AS3CanonicalSpriteValueReferences'],['AccessibilityProperties','flash.accessibility','AS3CanonicalSpriteValueReferences'],
    ['Graphics','flash.display','AS3CanonicalGraphicsReference'],['AccessibilityImplementation','flash.accessibility','AS3CanonicalAccessibilityReference']])extraProviders[owner+'.'+name]={module:provider(mod),exportName:name};
   for(const name of ['DisplayObjectContainer','Shader'])extraProviders['flash.display.'+name]={module:modulePath(path.join(engine,'src/layaAir/flash/display',name+'.ts')),exportName:name};
   externalModules.push(...new Set(Object.values(extraProviders).map(p=>p.module)));
   const input={scope:'sprite-drag-calls-'+cohort,sources,providers:{...extraProviders,'flash.geom.Rectangle':{module:rectangleModule,exportName:'Rectangle'},'flash.display.Sprite':{module:spriteModule,exportName:'Sprite',nativeBase:'Sprite'},'flash.display.DisplayObject':{module:provider('AS3CanonicalDisplayReference'),exportName:'DisplayObject'}},providerModule:provider('AS3GeneratedClass'),interfaceProviderModule:provider('AS3Type'),scriptGlobalProviderModule:provider('AS3ScriptGlobal'),scriptDomainProvider:{module:'./cohortDomain',exportName:'scriptDomain'},inheritScriptClasses:true};
   const plan=api.createNativeGeneratedDeclarationPlan(input);
   const definitionsByNamespace={};for(const q of Object.keys(sources)){const parts=q.split('.'),n=parts.pop();(definitionsByNamespace[parts.join('.')]??=[]).push(n);}
   const options={customVisitors:[],definitionsByNamespace,nativeDisplayObjectReferenceModule:provider('AS3CanonicalDisplayReference'),importModules:{'flash.geom.Rectangle':rectangleModule,'flash.display.Sprite':spriteModule,'flash.display.DisplayObject':provider('AS3CanonicalDisplayReference'),'compiler.AS3Class':provider('AS3Class'),'compiler.AS3Invocation':provider('AS3Invocation')},
    decoratorModules:{bound:helpers.bound,classBound:helpers.classBound},nativeClassHelperModules:{nativeClass:helpers.nativeClass,callableClass:helpers.callableClass},
    nativeClassTraitsModule:provider('AS3GeneratedClass'),nativeLexicalMembersModule:provider('AS3LexicalMembers'),nativeGeneratedPropertyModule:provider('AS3Property'),
    nativeCallableMethodBindingModule:provider('AS3MethodBinding'),nativeCallableCoercionModule:provider('AS3Coercion'),nativeCallableStringModule:provider('AS3String'),
    nativeSourceErrorModule:sourceError,nativeDynamicPropertyReadsModule:provider('AS3Property'),nativeDynamicPropertyWritesModule:provider('AS3Property'),
    nativeComputedTypeTestModule:provider('AS3Type'),nativeDictionaryPropertyModule:provider('AS3Property'),nativeObjectCreationModule:provider('AS3Class'),
    nativeTypedLocals:true,nativeTypedLocalReferenceModule:provider('AS3Type'),nativeTypedLocalAdditionModule:provider('AS3Addition'),nativeArrayCreationModule:provider('AS3ArrayCreation'),
    nativeReferenceCoercion:{plan,module:'./unused',coercionModule:provider('AS3Type')},nativeNumericMethodParametersModule:provider('AS3Coercion'),nativeSignaturePropertyModule:provider('AS3Property')};
   const swf=JSON.parse(fs.readFileSync(path.join(evidence,'evidence/swf-inspect.json')));
   assert.equal(hash(fs.readFileSync(path.join(evidence,'evidence/oracle.swf'))),swf.sha256);
   const config={plan,target,emitterOptions:options,externalModules,loadingSessionModule:provider('NativeSourceClassLoadingSession'),sourceMovie:{width:swf.stage.width,height:swf.stage.height,sourceSha256:swf.sha256}};
   compilerGuards=require('./guards.cjs')(api,input,config,hash);assert.equal(compilerGuards,6);
   const artifact=api.emitNativeSourceClassModule(config);assert.deepEqual(artifact,api.emitNativeSourceClassModule(config));artifacts[cohort]=artifact;
   assert.equal(artifact.generatedSources.length,Object.keys(sources).length+1);
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
  const observer=fs.readFileSync(path.join(__dirname,'observer.ts'),'utf8').replaceAll('@FLASH@',modulePath(path.join(engine,'src/layaAir/flash'))).replaceAll('@ENGINE@',modulePath(engine));
  fs.writeFileSync(path.join(dir,'observer.ts'),observer);
  const entry=path.join(dir,'entry.ts');fs.writeFileSync(entry,"import {run} from './observer';import {nativeSourceClassModule as subject} from './subject/subject-factory.js';globalThis.completion=run(subject).then(value=>{globalThis.result=value;});");
  const build=()=>esbuild.build({entryPoints:[entry],bundle:true,write:false,format:'iife',platform:'browser',target:'es2020',metafile:true,loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'}});
  const built=await build();
  const code=built.outputFiles[0].text;fs.writeFileSync(path.join(dir,'bundle.js'),code);
  const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(String(error)));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});await page.route('http://loaded-generated.test/**',route=>route.request().url().endsWith('/bundle.js')?route.fulfill({contentType:'text/javascript',body:code}):route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"script-src 'self'"},body:'<!doctype html><body><script src="/bundle.js"></script></body>'}));
  await page.goto('http://loaded-generated.test/');await page.evaluate(()=>globalThis.completion);const web=await page.evaluate(()=>globalThis.result);assert.deepEqual(web.rows,expected);assert.equal(web.checks.length,4);
  await page.mouse.move(30,30);await page.evaluate(()=>globalThis.dragProbe.begin());await page.mouse.move(70,60);await page.waitForTimeout(80);
  assert.deepEqual(await page.evaluate(()=>globalThis.dragProbe.position()),[70,60]);
  await page.evaluate(()=>globalThis.dragProbe.end());await page.mouse.move(110,90);await page.waitForTimeout(80);
  assert.deepEqual(await page.evaluate(()=>globalThis.dragProbe.position()),[70,60]);
  await page.close();assert.deepEqual(errors,[]);
  results.push({target,web,typechecks,artifacts,pointerChecks:2,compilerGuards,inputs:Object.keys(built.metafile.inputs).map(file=>({file,sha256:hash(fs.readFileSync(file))}))});
  console.log(JSON.stringify({target,observations:web.rows.length,guards:web.checks.length,typeErrors:0}));
 }}finally{await browser.close();}
 for(const result of results)for(const item of [...result.inputs,...result.typechecks.flatMap(check=>check.inputs)])assert.equal(hash(fs.readFileSync(item.file)),item.sha256,item.file);
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({results,cohorts,runnerSha256:hash(fs.readFileSync(__filename)),observerSha256:hash(fs.readFileSync(path.join(__dirname,'observer.ts'))),held:['Other native namesake methods and unqualified Sprite providers','Complete SimpleDragManager and full startup/account flow']},null,2));
 console.log(JSON.stringify({out,status:'passed',observations:12,targets:2,realms:1}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
