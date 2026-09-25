const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const api=require('../../lib'),parse=require('../../lib/parse'),emit=require('../../lib/emit'),ts=require('typescript');
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2');
const modern=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const evidence=path.join(engine,'tests/nativeFlashOracle','sprite-owner-references');const expected=require(path.join(evidence,'verify.cjs')).filter(row=>row.id!=='ContextMenu-base');
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const root=path.resolve('.cache/native-sprite-owner-references');fs.mkdirSync(root,{recursive:true});const run=fs.mkdtempSync(path.join(root,'run-'));
const modulePath=file=>{let r=path.relative(run,file).replaceAll('\\','/').replace(/\.ts$/,'');return r.startsWith('.')?r:'./'+r;};
const provider=name=>modulePath(path.join(engine,'src/layaAir/flash/utils',name+'.ts'));
const text=fs.readFileSync(path.join(evidence,'source/SpriteOwnerHolder.as'),'utf8');const sources={'SpriteOwnerHolder':{source:text,sourceSha256:hash(text)}};
const source=sources['SpriteOwnerHolder'].source;
const applicationDomain=provider('AS3CanonicalSpriteOwnerReferences');
const names=['flash.display.LoaderInfo','flash.ui.ContextMenu'];
const nativeProviders=Object.fromEntries(names.map(name=>[name,{module:applicationDomain,exportName:name.split('.').pop()}]));
const input={scope:'generated-sprite-owner-references',inheritScriptClasses:true,providers:nativeProviders,providerModule:provider('AS3GeneratedClass'),scriptGlobalProviderModule:provider('AS3ScriptGlobal'),scriptDomainProvider:{module:'./cohortDomain',exportName:'scriptDomain'},sources};
const plan=api.createNativeGeneratedDeclarationPlan(input);
fs.writeFileSync(path.join(run,'cohortDomain.ts'),'import {AS3ScriptDomain} from '+JSON.stringify(provider('AS3ScriptGlobal'))+';export declare const scriptDomain: AS3ScriptDomain;');
const helpers=Object.fromEntries(['bound','classBound','nativeClass','callableClass'].map(name=>[name,modulePath(path.resolve('utils',name+'.ts'))]));
const fileFor=q=>q.split('.').pop(),definitionsByNamespace={};
for(const q of Object.keys(sources)){const i=q.lastIndexOf('.');(definitionsByNamespace[i<0?'':q.slice(0,i)]??=[]).push(q.slice(i+1));}
const options={customVisitors:[],nativeDynamicPropertyReadsModule:provider("AS3Property"),importModules:{"compiler.AS3Invocation":provider("AS3Invocation"),"compiler.AS3Class":provider("AS3Class"),...Object.fromEntries(Object.keys(sources).map(q=>[q,'./'+fileFor(q)])),...Object.fromEntries(Object.entries(nativeProviders).map(([q,b])=>[q,b.module]))},definitionsByNamespace,
 decoratorModules:{bound:helpers.bound,classBound:helpers.classBound},nativeClassHelperModules:{nativeClass:helpers.nativeClass,callableClass:helpers.callableClass},
 nativeGeneratedDeclarations:{plan,module:'./declarationDomain'},nativeClassTraitsModule:provider('AS3GeneratedClass'),nativeLexicalMembersModule:provider('AS3LexicalMembers'),nativeGeneratedPropertyModule:provider('AS3Property'),
 nativeCallableMethodBindingModule:provider('AS3MethodBinding'),nativeCallableCoercionModule:provider('AS3Coercion'),nativeCallableStringModule:provider('AS3String'),
 nativeSourceErrorModule:modulePath(path.join(engine,'src/layaAir/flash/errors/AS3SourceError.ts')),nativeDynamicPropertyWritesModule:provider('AS3Property'),nativeComputedTypeTestModule:provider('AS3Type'),nativeDictionaryPropertyModule:provider('AS3Property'),nativeObjectCreationModule:provider("AS3Class"),nativeTypedLocals:true,nativeTypedLocalReferenceModule:provider('AS3Type'),nativeTypedLocalAdditionModule:provider('AS3Addition'),nativeArrayCreationModule:provider('AS3ArrayCreation')};


Object.assign(options,{nativeSpriteOwnerReferenceModule:applicationDomain,nativeReferenceCoercion:{plan,module:"./declarationDomain",coercionModule:provider("AS3Type")},nativeSignaturePropertyModule:provider("AS3Property"),nativeDynamicConstructionModule:provider('AS3Invocation')});

const session=provider('NativeSourceClassLoadingSession');
const externalModules=[...new Set([...Object.values(helpers),...['AS3GeneratedClass','AS3ScriptGlobal','AS3LexicalMembers','AS3Property','AS3MethodBinding','AS3Coercion','AS3String','AS3Type','AS3Class','AS3Invocation','AS3Addition','AS3ArrayCreation','NativeSourceClassLoadingSession'].map(provider),applicationDomain,options.nativeSourceErrorModule])];
const base={plan,emitterOptions:options,externalModules,loadingSessionModule:session};
let bindingGuards=0;
for(const patch of [
 {nativeSpriteOwnerReferenceModule:undefined},
 {nativeSpriteOwnerReferenceModule:'./wrong'},
 {nativeReferenceCoercion:undefined},
 {nativeGeneratedDeclarations:undefined},
 {importModules:{...options.importModules,'flash.display.LoaderInfo':'./wrong'}},
 ...names.slice(1).map(name=>({importModules:{...options.importModules,[name]:'./wrong'}})),
]){
 assert.throws(()=>emit(parse('SpriteOwnerHolder.as',text),text,{...options,...patch}),/AS3_[A-Z_]+UNSUPPORTED/,Object.keys(patch).join(','));bindingGuards++;
}
const altered=source=>{
 const changed=api.createNativeGeneratedDeclarationPlan({...input,sources:{SpriteOwnerHolder:{source,sourceSha256:hash(source)}}});
 return api.emitNativeSourceClassModule({...base,plan:changed,emitterOptions:{...options,
  nativeGeneratedDeclarations:{...options.nativeGeneratedDeclarations,plan:changed},
  nativeReferenceCoercion:{...options.nativeReferenceCoercion,plan:changed}},target:'ES2015'});
};
for(const name of names.map(name=>name.split('.').pop())){
 assert.throws(()=>altered(text.replace('inspect'+name+'(input:*)','inspect'+name+'(input:*,'+name+':Class)')),/AS3_[A-Z_]+UNSUPPORTED/);bindingGuards++;
 assert.throws(()=>altered(text.replace('public class SpriteOwnerHolder {','public class SpriteOwnerHolder extends '+name+' {')),/AS3_GENERATED_DECLARATIONS_UNSUPPORTED/);bindingGuards++;
}
(async()=>{
 const {chromium}=require(require.resolve('playwright',{paths:[path.resolve('../op2-html5/game-client-laya'),engine]}));
 const browser=await chromium.launch({headless:true}),results=[];
 try{for(const target of ['ES5','ES2015']){
  const module=api.emitNativeSourceClassModule({...base,target});
  fs.writeFileSync(path.join(run,'module.js'),module.moduleSource);
  const generated=[];for(const item of module.generatedSources){const file=path.join(run,item.module+'.ts');fs.writeFileSync(file,item.source);generated.push(file);}
  const defs=['glsl.d.ts','spine.d.ts'].map(f=>path.join(engine,'src/layaAir/tslibs',f));
  const typeOptions={target:modern.ScriptTarget.ES2020,module:modern.ModuleKind.CommonJS,strict:true,strictNullChecks:false,useUnknownInCatchVariables:false,experimentalDecorators:true,noEmit:true,skipLibCheck:true,lib:['lib.es2020.d.ts','lib.dom.d.ts','lib.dom.iterable.d.ts']};
  const diagnostics=modern.getPreEmitDiagnostics(modern.createProgram([...generated,path.join(run,'cohortDomain.ts'),...defs],typeOptions));
  const types=diagnostics.map(d=>({file:d.file?.fileName,code:d.code,message:modern.flattenDiagnosticMessageText(d.messageText,'\n')}));
  fs.writeFileSync(path.join(run,'types-'+target+'.json'),JSON.stringify(types,null,2));assert.deepEqual(types,[]);
  const driver=fs.readFileSync(path.join(__dirname,'driver.ts'),'utf8').replaceAll('ENGINE',modulePath(engine));fs.writeFileSync(path.join(run,'driver.ts'),driver);
  const built=await esbuild.build({entryPoints:[path.join(run,'driver.ts')],bundle:true,write:false,platform:'browser',format:'iife',target:'es2020',metafile:true,loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'},logLevel:'warning'});
  const code=built.outputFiles[0].text;fs.writeFileSync(path.join(run,'bundle-'+target+'.js'),code);
  const vm=require('node:vm'),context=vm.createContext({console,performance,setTimeout,clearTimeout,AbortController});new vm.Script(code).runInContext(context);await context.done;
  const node=JSON.parse(JSON.stringify(context.result));
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('http://sprite-owner-references.test/**',route=>route.request().url().endsWith('/bundle.js')?route.fulfill({contentType:'text/javascript',body:code}):route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"script-src 'self'"},body:'<script src="/bundle.js"></script>'}));
  await page.goto('http://sprite-owner-references.test/');const web=await page.evaluate(async()=>{await globalThis.done;return globalThis.result;});await page.close();
  assert.deepEqual(errors,[]);assert.deepEqual(node.rows,expected);assert.deepEqual(web.rows,expected);assert.equal(node.guards,30);assert.equal(web.guards,30);
  results.push({target,node,web,types,inputs:Object.keys(built.metafile.inputs).map(file=>({file,sha256:hash(fs.readFileSync(file))}))});
 }}finally{await browser.close();}
 fs.writeFileSync(path.join(run,'report.json'),JSON.stringify({scope:'complete generated SpriteOwnerHolder source, two native reference bindings; ContextMenu NativeMenu ancestry remains unqualified; no generated native subclass or full Sprite admission',sourceSha256:hash(text),expected,results,bindingGuards},null,2));
 console.log(JSON.stringify({run,targets:results.map(r=>r.target),rowsPerRuntime:expected.length,guardsPerRuntime:30,bindingGuards,typeErrors:0}));
})().catch(e=>{console.error(e);process.exitCode=1;});
