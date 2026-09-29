import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const compiler=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),engine=path.resolve(compiler,'../LayaAir-op2');
const hash=value=>createHash('sha256').update(value).digest('hex');
export function buildGeneratedParentRemoval(target='ES2015',{sourceMovie}={}){
 const api=require(path.join(compiler,'lib')),modern=require(path.join(engine,'node_modules/typescript'));
 const cache=path.join(compiler,'.cache/native-generated-parent-removal');fs.mkdirSync(cache,{recursive:true});const out=fs.mkdtempSync(path.join(cache,'run-'));
 const modulePathFor=f=>{let p=path.relative(out,f).replaceAll('\\','/').replace(/\.ts$/,'');return p.startsWith('.')?p:'./'+p;};
 const provider=n=>modulePathFor(path.join(engine,'src/layaAir/flash/utils',n+'.ts'));
 const helpers=Object.fromEntries(['bound','classBound','nativeClass','callableClass'].map(n=>[n,modulePathFor(path.join(compiler,'utils',n+'.ts'))]));
 const options={customVisitors:[],decoratorModules:{bound:helpers.bound,classBound:helpers.classBound},nativeClassHelperModules:{nativeClass:helpers.nativeClass,callableClass:helpers.callableClass},nativeClassTraitsModule:provider('AS3GeneratedClass'),nativeLexicalMembersModule:provider('AS3LexicalMembers'),nativeGeneratedPropertyModule:provider('AS3Property'),nativeCallableMethodBindingModule:provider('AS3MethodBinding'),nativeCallableCoercionModule:provider('AS3Coercion'),nativeCallableStringModule:provider('AS3String'),nativeSourceErrorModule:modulePathFor(path.join(engine,'src/layaAir/flash/errors/AS3SourceError.ts')),nativeDynamicPropertyReadsModule:provider('AS3Property'),nativeDynamicPropertyWritesModule:provider('AS3Property'),nativeComputedTypeTestModule:provider('AS3Type'),nativeDictionaryPropertyModule:provider('AS3Property'),nativeObjectCreationModule:provider('AS3Class'),nativeTypedLocals:true,nativeTypedLocalReferenceModule:provider('AS3Type'),nativeTypedLocalAdditionModule:provider('AS3Addition'),nativeArrayCreationModule:provider('AS3ArrayCreation'),nativeNumericMethodParametersModule:provider('AS3Coercion'),nativeSignaturePropertyModule:provider('AS3Property'),nativeReferenceCoercion:{coercionModule:provider('AS3Type')}};
 options.importModules={'compiler.AS3Class':provider('AS3Class'),'compiler.AS3Invocation':provider('AS3Invocation')};
 const compilerInputs=[];function collect(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isDirectory())collect(file);else compilerInputs.push({file,sha256:hash(fs.readFileSync(file))});}}collect(path.join(compiler,'lib'));collect(path.join(compiler,'src'));
 const revisions=Object.fromEntries([['engine',engine],['compiler',compiler]].map(([name,cwd])=>[name,{head:execFileSync('git',['rev-parse','HEAD'],{cwd,encoding:'utf8'}).trim(),sourceDiffSha256:hash(execFileSync('git',['diff','HEAD','--','src'],{cwd,maxBuffer:32*1024*1024}))}]));
 const ctx={api,out,engine,modern,provider,pins:revisions,compilerInputs,options,externalModules:[...['NativeSourceClassLoadingSession','AS3Class','AS3Invocation','AS3Type','AS3Vector','AS3ScriptGlobal'].map(provider),...Object.values(helpers),options.nativeSourceErrorModule,...Object.values(options).filter(v=>typeof v==='string')]};
 const sources={},manifest=[];
 for(const qname of ['removal.Child']){
  const file=path.join(engine,'tests/nativeFlashOracle/generated-parent-removal/source',qname.replaceAll('.','/')+'.as'),source=fs.readFileSync(file,'utf8');
  sources[qname]={source,sourceSha256:hash(source)};manifest.push({qname,file,sha256:hash(source)});
 }

 const modulePath=f=>{let p=path.relative(out,f).replaceAll('\\','/').replace(/\.ts$/,'');return p.startsWith('.')?p:'./'+p;};
 const providers={'flash.display.Sprite':{module:provider('AS3GeneratedSpriteConstruction'),exportName:'Sprite',nativeBase:'Sprite'}};
 const referenceProviders={DisplayObject:'AS3CanonicalDisplayReference',Graphics:'AS3CanonicalGraphicsReference',AccessibilityImplementation:'AS3CanonicalAccessibilityReference',Rectangle:'AS3CanonicalRectangleReference',ContextMenu:'AS3CanonicalSpriteOwnerReferences',LoaderInfo:'AS3CanonicalSpriteOwnerReferences',Stage:'AS3CanonicalSpriteOwnerReferences',Transform:'AS3CanonicalSpriteValueReferences',SoundTransform:'AS3CanonicalSpriteValueReferences',TextSnapshot:'AS3CanonicalSpriteValueReferences',AccessibilityProperties:'AS3CanonicalSpriteValueReferences'};
 for(const trait of require(path.join(compiler,'lib/emit/native-sprite-traits')).nativeSpriteTraits){if(!trait.type?.includes('::'))continue;const q=trait.type.replace('::','.'),name=q.split('.').at(-1);if(providers[q])continue;providers[q]={module:referenceProviders[name]?provider(referenceProviders[name]):modulePath(path.join(engine,'src/layaAir',q.replaceAll('.','/'))),exportName:name};}
 const plan=api.createNativeGeneratedDeclarationPlan({scope:'native-parent-removal',sources,providers,
  lexicalProviderModule:provider('AS3LexicalMembers'),providerModule:provider('AS3GeneratedClass'),interfaceProviderModule:provider('AS3Type'),vectorProviderModule:provider('AS3Vector'),
  scriptGlobalProviderModule:provider('AS3ScriptGlobal'),scriptDomainProvider:{module:'./cohortDomain',exportName:'scriptDomain'},inheritScriptClasses:true});
 const {NativeGeneratedClassTraits:Projection}=require(path.join(compiler,'lib/emit/native-generated-traits'));
 const compilerGuards=[];
 const definitionsByNamespace={};
 for(const q of [...Object.keys(sources),...Object.keys(providers)]){const i=q.lastIndexOf('.');(definitionsByNamespace[q.slice(0,i)]??=[]).push(q.slice(i+1));}
 const emissionOptions={...ctx.options,definitionsByNamespace,nativeObjectPropertyModule:provider('AS3Property'),nativeClassTypeOperationsModule:provider('AS3Class'),
  nativeDisplayObjectReferenceModule:provider('AS3CanonicalDisplayReference'),nativeVectorTypes:{plan,module:'./__native_declarations'},
  importModules:{...ctx.options.importModules,'compiler.AS3Property':provider('AS3Property'),...Object.fromEntries(Object.entries(providers).map(([q,p])=>[q,p.module]))},
  nativeReferenceCoercion:{...ctx.options.nativeReferenceCoercion,plan,module:'./__native_declarations'}};
 const outputs=[],write=(name,source)=>{const f=path.join(out,name);fs.writeFileSync(f,source);outputs.push({file:f,sha256:hash(source)});return f;};
 const report={target,compilerGuards,pins:ctx.pins,sources:manifest,sourceMovie,unresolved:plan.references.filter(r=>r.kind==='unresolved'),compilerInputs:ctx.compilerInputs,
  builderSha256:hash(fs.readFileSync(fileURLToPath(import.meta.url))),outputs,qualification:'Generated parent removal source cohort'};
 try{
  assert.deepEqual(report.unresolved,[]);
  const config={plan,emitterOptions:emissionOptions,externalModules:[...new Set([...ctx.externalModules,...Object.values(providers).map(p=>p.module),provider('AS3Vector')])],loadingSessionModule:provider('NativeSourceClassLoadingSession'),target,sourceMovie};
  for(const [name,reference] of [['missing reference plan',undefined],['unrelated reference plan',{...emissionOptions.nativeReferenceCoercion,plan:{...plan}}]]){
   assert.throws(()=>api.emitNativeSourceClassModule({...config,emitterOptions:{...emissionOptions,nativeReferenceCoercion:reference}}),/AS3_.*UNSUPPORTED/,name);
   compilerGuards.push(name);
  }
  const artifact=api.emitNativeSourceClassModule(config);
  const files=artifact.generatedSources.map(item=>write(item.module.slice(2)+'.ts',item.source));
  write('parent-removal.js',artifact.moduleSource);files.push(write('parent-removal.d.ts',artifact.declarationSource));
  files.push(write('cohortDomain.ts','import {AS3ScriptDomain} from '+JSON.stringify(provider('AS3ScriptGlobal'))+';export declare const scriptDomain:AS3ScriptDomain;'));
  files.push(...['glsl.d.ts','spine.d.ts'].map(f=>path.join(engine,'src/layaAir/tslibs',f)));
  const program=modern.createProgram(files,{baseUrl:engine,paths:{'@laya/engine/*':['src/layaAir/*'],'@laya/flash/*':['src/layaAir/flash/*'],'@laya/authored-content/*':['src/extensions/authoredContent/*']},resolveJsonModule:true,esModuleInterop:true,target:modern.ScriptTarget.ES2020,module:modern.ModuleKind.CommonJS,strict:true,strictNullChecks:false,useUnknownInCatchVariables:false,experimentalDecorators:true,noEmit:true,skipLibCheck:true,lib:['lib.es2020.d.ts','lib.dom.d.ts','lib.dom.iterable.d.ts']});
  report.diagnostics=modern.getPreEmitDiagnostics(program).map(d=>({file:d.file?.fileName,code:d.code,text:modern.flattenDiagnosticMessageText(d.messageText,'\n')}));
  report.typeInputs=program.getSourceFiles().map(f=>({file:f.fileName,sha256:hash(fs.readFileSync(f.fileName))}));
  report.dependencies=artifact.dependencies;
 }catch(error){report.factoryHold=error.message;report.factoryStack=error.stack;}
 for(const item of [...report.sources,...outputs,...(report.typeInputs||[]),...ctx.compilerInputs])assert.equal(hash(fs.readFileSync(item.file)),item.sha256,item.file);
 fs.writeFileSync(path.join(out,'parent-removal-review.json'),JSON.stringify(report,null,2)+'\n');

 return {ctx,out,report};
}
