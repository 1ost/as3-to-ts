'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict'),cp=require('child_process');
const api=require('../../lib'),root=path.resolve(__dirname,'../..');
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../engine');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const evidence=path.join(engine,'tests/nativeFlashOracle/vector-numeric-index-generated');
const sources=Object.fromEntries(['vindex.Probe'].map(q=>{const source=fs.readFileSync(path.join(evidence,'source',q.replaceAll('.','/')+'.as'),'utf8');return [q,{source,sourceSha256:hash(source)}];}));
function compile(dir,target,selectedSources=sources){
 fs.mkdirSync(dir,{recursive:true});
 const relative=file=>{const r=path.relative(dir,file).replaceAll('\\','/').replace(/\.ts$/,'');return r.startsWith('.')?r:'./'+r;};
 const provider=n=>relative(path.join(engine,'src/layaAir/flash/utils',n+'.ts'));
 const helpers=Object.fromEntries(['bound','classBound','nativeClass','callableClass'].map(n=>[n,relative(path.join(root,'utils',n+'.ts'))]));
 const sourceError=relative(path.join(engine,'src/layaAir/flash/errors/AS3SourceError.ts'));
 const modules=['Dictionary','Proxy','AS3CanonicalProxyConstruction','AS3CanonicalErrorConstruction','AS3Vector','AS3GeneratedClass','AS3ScriptGlobal','AS3SourceNamespace','AS3Type','AS3Class','AS3Invocation','AS3LexicalMembers','AS3Property','AS3MethodBinding','AS3Coercion','AS3String','AS3Addition','AS3ArrayCreation','NativeSourceClassLoadingSession'];
 const externalModules=[...Object.values(helpers),sourceError,...modules.map(provider)];
 const providers={'flash.utils.Proxy':{module:provider('AS3CanonicalProxyConstruction'),exportName:'Proxy',nativeBase:'Proxy'},Error:{module:provider('AS3CanonicalErrorConstruction'),exportName:'Error',nativeBase:'Error'}};
 const input={lexicalProviderModule:provider('AS3LexicalMembers'),vectorProviderModule:provider('AS3Vector'),providers,scope:'namespace-full-classes',sources:selectedSources,providerModule:provider('AS3GeneratedClass'),interfaceProviderModule:provider('AS3Type'),scriptGlobalProviderModule:provider('AS3ScriptGlobal'),scriptDomainProvider:{module:'./cohortDomain',exportName:'scriptDomain'},inheritScriptClasses:true};
 const plan=api.createNativeGeneratedDeclarationPlan(input),definitionsByNamespace={vindex:['Probe']};
 const options={nativeEnumeration:{dictionaryModule:provider('Dictionary'),coercionModule:provider('AS3Coercion'),stringModule:provider('AS3String')},nativeObjectPropertyModule:provider('AS3Property'),nativeVectorTypes:{plan,module:'./__native_declarations'},customVisitors:[],definitionsByNamespace,importModules:{'flash.utils.Proxy':provider('AS3CanonicalProxyConstruction'),'flash.utils.flash_proxy':provider('Proxy'),'compiler.AS3Property':provider('AS3Property'),Error:provider('AS3CanonicalErrorConstruction'),'compiler.AS3Class':provider('AS3Class'),'compiler.AS3Invocation':provider('AS3Invocation')},
  decoratorModules:{bound:helpers.bound,classBound:helpers.classBound},nativeClassHelperModules:{nativeClass:helpers.nativeClass,callableClass:helpers.callableClass},
  nativeClassTraitsModule:provider('AS3GeneratedClass'),nativeLexicalMembersModule:provider('AS3LexicalMembers'),nativeGeneratedPropertyModule:provider('AS3Property'),
  nativeCallableMethodBindingModule:provider('AS3MethodBinding'),nativeCallableCoercionModule:provider('AS3Coercion'),nativeCallableStringModule:provider('AS3String'),
  nativeSourceErrorModule:sourceError,nativeDynamicPropertyReadsModule:provider('AS3Property'),nativeDynamicPropertyWritesModule:provider('AS3Property'),
  nativeComputedTypeTestModule:provider('AS3Type'),nativeDictionaryPropertyModule:provider('AS3Property'),nativeObjectCreationModule:provider('AS3Class'),
  nativeTypedLocals:true,nativeTypedLocalReferenceModule:provider('AS3Type'),nativeTypedLocalAdditionModule:provider('AS3Addition'),nativeArrayCreationModule:provider('AS3ArrayCreation'),
  nativeReferenceCoercion:{plan,module:'./unused',coercionModule:provider('AS3Type')},nativeNumericMethodParametersModule:provider('AS3Coercion'),nativeSignaturePropertyModule:provider('AS3Property')};
 const config={plan,target,emitterOptions:options,externalModules,loadingSessionModule:provider('NativeSourceClassLoadingSession'),sourceNamespaceProviderModule:provider('AS3SourceNamespace')};
 const artifact=api.emitNativeSourceClassModule(config),files=[];
 for(const item of artifact.generatedSources){const file=path.join(dir,item.module+'.ts');fs.writeFileSync(file,item.source);files.push(file);}
 const domain=path.join(dir,'cohortDomain.ts');fs.writeFileSync(domain,'import {AS3ScriptDomain} from '+JSON.stringify(provider('AS3ScriptGlobal'))+';export declare const scriptDomain:AS3ScriptDomain;');files.push(domain);
 fs.writeFileSync(path.join(dir,'factory.js'),artifact.moduleSource);const declaration=path.join(dir,'factory.d.ts');fs.writeFileSync(declaration,artifact.declarationSource);files.push(declaration);
 fs.writeFileSync(path.join(dir,'artifact.json'),JSON.stringify(artifact,null,2));
 return {artifact,files,config,plan,input};
}
module.exports={compile,engine,root,evidence,sources,hash};
