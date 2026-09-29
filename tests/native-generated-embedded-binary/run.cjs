const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const api=require('../../lib'),engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2');
const ts=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const compilerGraph=require('node:child_process').execFileSync('git',['ls-files','src','utils','package.json','package-lock.json','tsconfig.json'],{encoding:'utf8'}).trim().split(/\r?\n/).map(file=>({file,sha256:hash(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'))}));
const evidence=path.join(engine,'tests/nativeFlashOracle/embedded-bytearray'),expected=require(path.join(evidence,'verify.cjs'));
const sources={};const source=fs.readFileSync(path.join(evidence,'source/embeddedbytes/Assets.as'),'utf8');
const originalClass=fs.readFileSync(path.join(evidence,'decompiled/scripts/embeddedbytes/Assets.as'),'utf8');
const embeddedBinary={};for(const [field,file]of [['Data','payload.bin'],['Other','payload.bin'],['Copy','payload-copy.bin'],['Config','collection.xml']]){
 const className=new RegExp('const '+field+':Class = ([^;]+);').exec(originalClass)[1].replace(/\u00a7/g,'');
 const bytes=fs.readFileSync(path.join(evidence,'source',file));embeddedBinary[field]={source:'../'+file,symbol:'embedded-bytearray/'+file,className,sourceSha256:hash(bytes),definitionSha256:hash(fs.readFileSync(path.join(evidence,'evidence/oracle.swf'))),payload:[...bytes]};
}
sources['embeddedbytes.Assets']={source,sourceSha256:hash(source),embeddedBinary};
const initEvidence=path.join(engine,'tests/nativeFlashOracle/embedded-class-initialization'),initExpected=require(path.join(initEvidence,'verify.cjs'));
const initSource=fs.readFileSync(path.join(initEvidence,'source/embeddedinit/Assets.as'),'utf8'),initDecomp=fs.readFileSync(path.join(initEvidence,'decompiled/scripts/embeddedinit/Assets.as'),'utf8');
const initPayload=fs.readFileSync(path.join(initEvidence,'source/payload.bin'));
sources['embeddedinit.Assets']={source:initSource,sourceSha256:hash(initSource),embeddedBinary:{Data:{source:'../payload.bin',symbol:'embedded-class-initialization/payload.bin',className:/const Data:Class = ([^;]+);/.exec(initDecomp)[1],sourceSha256:hash(initPayload),definitionSha256:hash(fs.readFileSync(path.join(initEvidence,'evidence/oracle.swf'))),payload:[...initPayload]}}};
const cache=path.resolve('.cache/native-generated-embedded-binary');fs.mkdirSync(cache,{recursive:true});const out=fs.mkdtempSync(path.join(cache,'run-'));
async function main(){
 const {createLayaSourceAliasPlugin}=await import(require('node:url').pathToFileURL(path.join(engine,'tests/nativeCanonicalSpriteClass/laya-source-alias.mjs')).href);
 const {chromium}=require(require.resolve('playwright',{paths:[path.resolve('../op2-html5/game-client-laya'),engine]}));
 const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']}),results=[];
 try{for(const target of ['ES5','ES2015']){
  const dir=path.join(out,target);fs.mkdirSync(dir);
  const modulePath=file=>{const r=path.relative(dir,file).replaceAll('\\','/').replace(/\.ts$/,'');return r.startsWith('.')?r:'./'+r;};
  const provider=n=>modulePath(path.join(engine,'src/layaAir/flash/utils',n+'.ts'));
  const helpers=Object.fromEntries(['bound','classBound','nativeClass','callableClass'].map(n=>[n,modulePath(path.resolve('utils',n+'.ts'))]));
  const sourceError=modulePath(path.join(engine,'src/layaAir/flash/errors/AS3SourceError.ts'));
  const modules=['AS3GeneratedClass','AS3ScriptGlobal','AS3Type','AS3Class','AS3Invocation','AS3LexicalMembers','AS3Property','AS3MethodBinding','AS3Coercion','AS3String','AS3Addition','AS3ArrayCreation','AS3Vector','Dictionary','AS3CanonicalEventDispatcherConstruction','AS3GeneratedSpriteConstruction','AS3CanonicalEventConstruction','NativeSourceClassLoadingSession','AS3XML'];
  const nativeProviders={Error:{module:provider('AS3CanonicalErrorConstruction'),exportName:'Error',nativeBase:'Error'},'flash.utils.ByteArray':{module:provider('AS3CanonicalByteArrayReference'),exportName:'ByteArray'},...Object.fromEntries(['XML','XMLList'].map(name=>[name,{module:provider('AS3CanonicalXMLReference'),exportName:name}]))};
  modules.push('AS3CanonicalByteArrayReference','AS3CanonicalXMLReference','AS3EmbeddedByteArrayDomain');
  const input={lexicalProviderModule:provider('AS3LexicalMembers'),providers:nativeProviders,vectorProviderModule:provider('AS3Vector'),embeddedBinaryProviderModule:provider('AS3EmbeddedByteArrayDomain'),scope:'embedded-binary',sources,providerModule:provider('AS3GeneratedClass'),interfaceProviderModule:provider('AS3Type'),scriptGlobalProviderModule:provider('AS3ScriptGlobal'),scriptDomainProvider:{module:'./cohortDomain',exportName:'scriptDomain'},inheritScriptClasses:true,classScriptSources:['embeddedinit.Assets']};
  const plan=api.createNativeGeneratedDeclarationPlan(input);
  const options={nativeObjectPropertyModule:provider('AS3Property'),nativeClassTypeOperationsModule:provider('AS3Class'),customVisitors:[],nativeByteArrayReferenceModule:provider('AS3CanonicalByteArrayReference'),nativeXMLModule:provider('AS3XML'),nativeGlobalModules:{XML:provider('AS3CanonicalXMLReference'),XMLList:provider('AS3CanonicalXMLReference')},definitionsByNamespace:{embeddedbytes:['Assets'],embeddedinit:['Assets']},nativeVectorTypes:{plan,module:'./__native_declarations'},nativeEnumeration:{dictionaryModule:provider('Dictionary'),coercionModule:provider('AS3Coercion'),stringModule:provider('AS3String')},importModules:{'compiler.AS3Property':provider('AS3Property'),'compiler.AS3Class':provider('AS3Class'),'compiler.AS3Invocation':provider('AS3Invocation')},
   decoratorModules:{bound:helpers.bound,classBound:helpers.classBound},nativeClassHelperModules:{nativeClass:helpers.nativeClass,callableClass:helpers.callableClass},
   nativeClassTraitsModule:provider('AS3GeneratedClass'),nativeLexicalMembersModule:provider('AS3LexicalMembers'),nativeGeneratedPropertyModule:provider('AS3Property'),
   nativeCallableMethodBindingModule:provider('AS3MethodBinding'),nativeCallableCoercionModule:provider('AS3Coercion'),nativeCallableStringModule:provider('AS3String'),
   nativeSourceErrorModule:sourceError,nativeDynamicPropertyReadsModule:provider('AS3Property'),nativeDynamicPropertyWritesModule:provider('AS3Property'),
   nativeComputedTypeTestModule:provider('AS3Type'),nativeDictionaryPropertyModule:provider('AS3Property'),nativeObjectCreationModule:provider('AS3Class'),
   nativeTypedLocals:true,nativeTypedLocalReferenceModule:provider('AS3Type'),nativeTypedLocalAdditionModule:provider('AS3Addition'),nativeArrayCreationModule:provider('AS3ArrayCreation'),
   nativeReferenceCoercion:{plan,module:'./unused',coercionModule:provider('AS3Type')},nativeNumericMethodParametersModule:provider('AS3Coercion'),nativeSignaturePropertyModule:provider('AS3Property')};
  Object.assign(options.importModules,Object.fromEntries(Object.entries(nativeProviders).map(([q,b])=>[q,b.module])));
  const config={plan,target,emitterOptions:options,externalModules:[...new Set([...Object.values(helpers),sourceError,...modules.map(provider),...Object.values(nativeProviders).map(p=>p.module)])],loadingSessionModule:provider('NativeSourceClassLoadingSession')};
  assert.deepEqual(plan.references.filter(r=>r.kind==='unresolved'),[]);
  let guards=0;
  assert.throws(()=>api.emitNativeSourceClassModule({...config,plan:{...plan}}),/AS3_.*UNSUPPORTED/);guards++;
  const reject=changedInput=>{
   assert.throws(()=>{const changedPlan=api.createNativeGeneratedDeclarationPlan(changedInput);
    api.emitNativeSourceClassModule({...config,plan:changedPlan,emitterOptions:{...options,nativeVectorTypes:{...options.nativeVectorTypes,plan:changedPlan},nativeReferenceCoercion:{...options.nativeReferenceCoercion,plan:changedPlan}}});
   },/AS3_.*UNSUPPORTED/);guards++;
  };
  for(const key of ['embeddedBinaryProviderModule','scriptDomainProvider'])reject({...input,[key]:undefined});
  const changedBinding=patch=>({...input,sources:{...sources,'embeddedbytes.Assets':{...sources['embeddedbytes.Assets'],embeddedBinary:{...embeddedBinary,Data:{...embeddedBinary.Data,...patch}}}}});
  for(const patch of [{source:'wrong.bin'},{sourceSha256:'0'.repeat(64)},{payload:[...embeddedBinary.Data.payload,0]},{payload:[-1]},{payload:new Array(2)},{definitionSha256:'not-a-hash'},{className:''},{symbol:''},{extra:true}])reject(changedBinding(patch));
  reject({...input,sources:{...sources,'embeddedbytes.Assets':{...sources['embeddedbytes.Assets'],embeddedBinary:undefined}}});
  reject({...input,sources:{...sources,'embeddedbytes.Assets':{...sources['embeddedbytes.Assets'],embeddedBinary:{...embeddedBinary,Missing:embeddedBinary.Data}}}});
  reject({...input,sources:{...sources,'embeddedbytes.Assets':{...sources['embeddedbytes.Assets'],embeddedBinary:{...embeddedBinary,Other:{...embeddedBinary.Other,className:'Wrong'}}}}});
  reject({...input,sources:{...sources,'embeddedbytes.Assets':{...sources['embeddedbytes.Assets'],embeddedBinary:{...embeddedBinary,Copy:{...embeddedBinary.Copy,className:embeddedBinary.Data.className}}}}});
  for(const transform of [s=>s.replace('private static const Data:Class','public static const Data:Class'),s=>s.replace('private static const Data:Class','private static const Data:Object'),s=>s.replace('const Data:Class;','const Data:Class=null;'),s=>s.replace('application/octet-stream','text/plain'),s=>s.replace('bytes:ByteArray','bytes:Object'),s=>s.replace('bytes.readUTFBytes(bytes.length)','bytes.readByte()')]){
   const changed=transform(source);assert.notEqual(changed,source);reject({...input,sources:{...sources,'embeddedbytes.Assets':{...sources['embeddedbytes.Assets'],source:changed,sourceSha256:hash(changed)}}});
  }
  assert.equal(plan.embeddedBinary.length,5);assert.equal(new Set(plan.embeddedBinary.map(b=>b.getterExport)).size,4);
  const artifact=api.emitNativeSourceClassModule(config);assert.equal(artifact.generatedSources.length,3);
  const files=[];for(const item of artifact.generatedSources){const file=path.join(dir,item.module+'.ts');fs.writeFileSync(file,item.source);files.push(file);}
  const domain=path.join(dir,'cohortDomain.ts');fs.writeFileSync(domain,'import {AS3ScriptDomain} from '+JSON.stringify(provider('AS3ScriptGlobal'))+';export declare const scriptDomain:AS3ScriptDomain;');files.push(domain);
  fs.writeFileSync(path.join(dir,'subject-factory.js'),artifact.moduleSource);fs.writeFileSync(path.join(dir,'subject-factory.d.ts'),artifact.declarationSource);files.push(path.join(dir,'subject-factory.d.ts'));
  const observer=fs.readFileSync(path.join(__dirname,'observer.ts'),'utf8').replaceAll('@FLASH@',modulePath(path.join(engine,'src/layaAir/flash'))).replaceAll('@ENGINE@',modulePath(engine));
  fs.writeFileSync(path.join(dir,'observer.ts'),observer);files.push(path.join(dir,'observer.ts'));
  files.push(...['glsl.d.ts','spine.d.ts'].map(f=>path.join(engine,'src/layaAir/tslibs',f)));
  const program=ts.createProgram(files,{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,strict:true,strictNullChecks:false,baseUrl:engine,paths:{"@laya/engine/*":["src/layaAir/*"],"@laya/flash/*":["src/layaAir/flash/*"]},useUnknownInCatchVariables:false,experimentalDecorators:true,noEmit:true,skipLibCheck:true,lib:['lib.es2020.d.ts','lib.dom.d.ts','lib.dom.iterable.d.ts']});
  const diagnostics=ts.getPreEmitDiagnostics(program).map(d=>({file:d.file?.fileName,code:d.code,text:ts.flattenDiagnosticMessageText(d.messageText,'\n')}));
  fs.writeFileSync(path.join(dir,'types.json'),JSON.stringify(diagnostics,null,2));assert.deepEqual(diagnostics,[]);
  const entry=path.join(dir,'entry.ts');fs.writeFileSync(entry,"import {run} from './observer';import {nativeSourceClassModule} from './subject-factory.js';globalThis.completion=run(nativeSourceClassModule).then(value=>{globalThis.result=value;});");
  const built=await esbuild.build({entryPoints:[entry],bundle:true,write:false,format:'iife',platform:'browser',target:'es2020',metafile:true,plugins:[createLayaSourceAliasPlugin(engine)],loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'},tsconfigRaw:{compilerOptions:{useDefineForClassFields:false}}});
  const code=built.outputFiles[0].text;fs.writeFileSync(path.join(dir,'bundle.js'),code);
  const execute=async script=>{
   const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
   try{await page.route('http://embedded-binary.test/**',route=>route.request().url().endsWith('/bundle.js')?route.fulfill({contentType:'text/javascript',body:script}):route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"script-src 'self'"},body:'<!doctype html><body><script src="/bundle.js"></script></body>'}));
    await page.goto('http://embedded-binary.test/');await page.evaluate(()=>globalThis.completion);const result=await page.evaluate(()=>globalThis.result);assert.deepEqual(errors,[]);return result;
   }finally{await page.close();}
  };
  const vm=require('node:vm');const executeNode=async script=>{const context=vm.createContext({console,setTimeout,clearTimeout,AbortController,AbortSignal,DOMException,performance,TextDecoder,TextEncoder});context.window=context;context.document={};new vm.Script(script).runInContext(context);await context.completion;return JSON.parse(JSON.stringify(context.result));};
  const node=await executeNode(code),web=await execute(code),errors=[];assert.deepEqual(web,node);assert.deepEqual(web.rows,expected);assert.deepEqual(web.initialization,initExpected);
  const initLine=code.match(/[^\n]*getAS3LexicalClassConstantInitializer[^\n]*embeddedBinary4\(\)\);/g);assert.equal(initLine.length,1);
  const initAt=code.indexOf(initLine[0]),beforeAt=code.lastIndexOf('__as3_generated_lexicalProvider_0.as3SetLexicalMember',initAt);assert.ok(beforeAt>0&&beforeAt<initAt);
  const early=code.slice(0,beforeAt)+initLine[0]+'\n'+code.slice(beforeAt,initAt)+code.slice(initAt+initLine[0].length);
  const resolver=code.indexOf('function resolveAS3EmbeddedByteArrayClass('),reuse=code.indexOf('return existing.type;',resolver);assert.ok(resolver>0&&reuse>resolver&&reuse-resolver<3000);
  const separate=code.slice(0,reuse)+'return createAS3EmbeddedByteArrayClass(existing.name,existing.bytes);'+code.slice(reuse+'return existing.type;'.length);
  for(const [script,key,expectedRows]of [[early,'initialization',initExpected],[separate,'rows',expected]]){
   await esbuild.transform(script,{loader:'js'});const mutated=await executeNode(script);assert.throws(()=>assert.deepEqual(mutated[key],expectedRows),/AssertionError/);
  }
  assert.equal(guards,22);
  results.push({target,node,web,artifact,diagnostics,errors,guards,mutations:2,providerGraph:Object.keys(built.metafile.inputs).map(file=>({file,sha256:hash(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'))}))});
  console.log(JSON.stringify({target,rows:web.rows.length,errors:errors.length}));
 }}finally{await browser.close();}
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({results,sources,compilerGraph,runnerSha256:hash(fs.readFileSync(__filename,'utf8').replace(/\r\n/g,'\n')),observerSha256:hash(fs.readFileSync(path.join(__dirname,'observer.ts'),'utf8').replace(/\r\n/g,'\n'))},null,2));
 console.log(JSON.stringify({out,status:'passed'}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
