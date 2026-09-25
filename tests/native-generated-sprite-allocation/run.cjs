const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const api=require('../../lib'),parse=require('../../lib/parse'),emit=require('../../lib/emit'),ts=require('typescript');
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2');
const modern=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const evidence=path.join(engine,'tests/nativeFlashOracle','perspective-projection-loaded');const captured=require(path.join(evidence,'verify.cjs'));
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const root=path.resolve('.cache/native-generated-sprite-allocation');fs.mkdirSync(root,{recursive:true});const run=fs.mkdtempSync(path.join(root,'run-'));
const modulePath=file=>{let r=path.relative(run,file).replaceAll('\\','/').replace(/\.ts$/,'');return r.startsWith('.')?r:'./'+r;};
const provider=name=>modulePath(path.join(engine,'src/layaAir/flash/utils',name+'.ts'));
const text=fs.readFileSync(path.join(__dirname,'Allocator.as'),'utf8');const sources={'host.ParentCallbacks':{source:text,sourceSha256:hash(text)}};
const source=sources['host.ParentCallbacks'].source;
const applicationDomain=modulePath(path.join(engine,'src/layaAir/flash/display/Sprite.ts'));
const nativeProviders={'flash.display.Sprite':{module:applicationDomain,exportName:'Sprite'}};
const input={scope:'generated-sprite-allocation',inheritScriptClasses:true,providers:nativeProviders,providerModule:provider('AS3GeneratedClass'),scriptGlobalProviderModule:provider('AS3ScriptGlobal'),scriptDomainProvider:{module:'./cohortDomain',exportName:'scriptDomain'},sources};
const plan=api.createNativeGeneratedDeclarationPlan(input);
fs.writeFileSync(path.join(run,'cohortDomain.ts'),'import {AS3ScriptDomain} from '+JSON.stringify(provider('AS3ScriptGlobal'))+';export declare const scriptDomain: AS3ScriptDomain;');
const helpers=Object.fromEntries(['bound','classBound','nativeClass','callableClass'].map(name=>[name,modulePath(path.resolve('utils',name+'.ts'))]));
const fileFor=q=>q.split('.').pop(),definitionsByNamespace={};
for(const q of Object.keys(sources)){const i=q.lastIndexOf('.');(definitionsByNamespace[q.slice(0,i)]??=[]).push(q.slice(i+1));}
const options={customVisitors:[],nativeDynamicPropertyReadsModule:provider("AS3Property"),importModules:{"compiler.AS3Invocation":provider("AS3Invocation"),"compiler.AS3Class":provider("AS3Class"),...Object.fromEntries(Object.keys(sources).map(q=>[q,'./'+fileFor(q)])),...Object.fromEntries(Object.entries(nativeProviders).map(([q,b])=>[q,b.module]))},definitionsByNamespace,
 decoratorModules:{bound:helpers.bound,classBound:helpers.classBound},nativeClassHelperModules:{nativeClass:helpers.nativeClass,callableClass:helpers.callableClass},
 nativeGeneratedDeclarations:{plan,module:'./declarationDomain'},nativeClassTraitsModule:provider('AS3GeneratedClass'),nativeLexicalMembersModule:provider('AS3LexicalMembers'),nativeGeneratedPropertyModule:provider('AS3Property'),
 nativeCallableMethodBindingModule:provider('AS3MethodBinding'),nativeCallableCoercionModule:provider('AS3Coercion'),nativeCallableStringModule:provider('AS3String'),
 nativeSourceErrorModule:modulePath(path.join(engine,'src/layaAir/flash/errors/AS3SourceError.ts')),nativeDynamicPropertyWritesModule:provider('AS3Property'),nativeComputedTypeTestModule:provider('AS3Type'),nativeDictionaryPropertyModule:provider('AS3Property'),nativeObjectCreationModule:provider("AS3Class"),nativeTypedLocals:true,nativeTypedLocalReferenceModule:provider('AS3Type'),nativeTypedLocalAdditionModule:provider('AS3Addition'),nativeArrayCreationModule:provider('AS3ArrayCreation')};


Object.assign(options,{nativeReferenceCoercion:{plan,module:"./declarationDomain",coercionModule:provider("AS3Type")},nativeSignaturePropertyModule:provider("AS3Property"),nativeDynamicConstructionModule:provider('AS3Invocation')});

const session=provider('NativeSourceClassLoadingSession');
const externalModules=[...new Set([...Object.values(helpers),...['AS3GeneratedClass','AS3ScriptGlobal','AS3LexicalMembers','AS3Property','AS3MethodBinding','AS3Coercion','AS3String','AS3Type','AS3Class','AS3Invocation','AS3Addition','AS3ArrayCreation','NativeSourceClassLoadingSession'].map(provider),applicationDomain,options.nativeSourceErrorModule])];
const movie=(width,height,file)=>({width,height,sourceSha256:hash(fs.readFileSync(path.join(evidence,file)))});
const mainMovie=movie(500,375,'evidence/oracle.swf'),childMovie=movie(900,300,'child-build/child.swf');
const base={plan,emitterOptions:options,externalModules,loadingSessionModule:session};
const expected=[false,true,true,false,true,false,true,false,true,false,true,true,true,false].map(child=>captured.find(r=>r.id===(child?'main-read-child-created':'main-read-local')).value);
let guards=0;
const altered=(source,patch={})=>{
 const changed=api.createNativeGeneratedDeclarationPlan({...input,sources:{'host.ParentCallbacks':{source,sourceSha256:hash(source)}}});
 return emit(parse('Allocator.as',source),source,{...options,nativeGeneratedDeclarations:{plan:changed,module:'./declarationDomain'},nativeReferenceCoercion:{...options.nativeReferenceCoercion,plan:changed},...patch});
};
assert.throws(()=>altered(text.replace('new Sprite()','new Sprite(1)')),/AS3_SPRITE_ALLOCATION_UNSUPPORTED/);guards++;
assert.throws(()=>altered(text,{importModules:{...options.importModules,'flash.display.Sprite':'./wrong'}}),/AS3_SPRITE_ALLOCATION_UNSUPPORTED/);guards++;
const shadow='package host { public class ParentCallbacks { public function make(Sprite:Class):* { return new Sprite(); } } }';
assert.ok(!altered(shadow).includes('withAS3ScriptAllocationContext'));guards++;
for(const bad of [{...childMovie,width:0},{...childMovie,height:Infinity},{...childMovie,sourceSha256:'bad'},Object.defineProperty({...childMovie},'width',{get(){throw new Error('getter invoked');}})]){
 assert.throws(()=>api.emitNativeSourceClassModule({...base,target:'ES2015',sourceMovie:bad}),/AS3_SOURCE_CLASS_MODULE_UNSUPPORTED/);guards++;
}
for(const scriptDomainProvider of [undefined]){
 assert.throws(()=>{const changed=api.createNativeGeneratedDeclarationPlan({...input,inheritScriptClasses:false,scriptDomainProvider});return emit(parse('Allocator.as',text),text,{...options,nativeGeneratedDeclarations:{plan:changed,module:'./declarationDomain'},nativeReferenceCoercion:{...options.nativeReferenceCoercion,plan:changed}});},/AS3_[A-Z_]+UNSUPPORTED/);guards++;
}
(async()=>{
 const {chromium}=require(require.resolve('playwright',{paths:[path.resolve('../op2-html5/game-client-laya'),engine]}));const browser=await chromium.launch({headless:true});const results=[];
 try{for(const target of ['ES5','ES2015']){
  const primary=api.emitNativeSourceClassModule({...base,target,sourceMovie:mainMovie});
  const child=api.emitNativeSourceClassModule({...base,target,sourceMovie:childMovie});
  assert.ok(child.generatedSources.some(s=>s.source.includes('withAS3ScriptAllocationContext')));
  fs.writeFileSync(path.join(run,'main.js'),primary.moduleSource);fs.writeFileSync(path.join(run,'child.js'),child.moduleSource);
  const generated=[];for(const item of child.generatedSources){const file=path.join(run,item.module+'.ts');fs.writeFileSync(file,item.source);generated.push(file);}
  const defs=['glsl.d.ts','spine.d.ts'].map(f=>path.join(engine,'src/layaAir/tslibs',f));
  const typeOptions={target:modern.ScriptTarget.ES2020,module:modern.ModuleKind.CommonJS,strict:true,strictNullChecks:false,useUnknownInCatchVariables:false,experimentalDecorators:true,noEmit:true,skipLibCheck:true,lib:['lib.es2020.d.ts','lib.dom.d.ts']};
  const diagnostics=modern.getPreEmitDiagnostics(modern.createProgram([...generated,path.join(run,'cohortDomain.ts'),...defs],typeOptions));
  const baseline=modern.getPreEmitDiagnostics(modern.createProgram([path.join(engine,'src/layaAir/flash/display/Sprite.ts'),...defs],typeOptions));
  const key=d=>JSON.stringify([d.file?.fileName,d.code,d.file?.text.slice(d.start,d.start+d.length)]),remaining=baseline.map(key),added=[];
  for(const d of diagnostics){const i=remaining.indexOf(key(d));if(i<0)added.push({file:d.file?.fileName,code:d.code,message:modern.flattenDiagnosticMessageText(d.messageText,'\n')});else remaining.splice(i,1);}
  fs.writeFileSync(path.join(run,'types-'+target+'.json'),JSON.stringify({baseline:baseline.length,current:diagnostics.length,added},null,2));assert.deepEqual(added,[]);
  const driver=fs.readFileSync(path.join(__dirname,'driver.ts'),'utf8').replaceAll('ENGINE',modulePath(engine));fs.writeFileSync(path.join(run,'driver.ts'),driver);
  const built=await esbuild.build({entryPoints:[path.join(run,'driver.ts')],bundle:true,write:false,platform:'browser',format:'iife',target:'es2020',metafile:true,loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'},logLevel:'warning'});
  const code=built.outputFiles[0].text;fs.writeFileSync(path.join(run,'bundle-'+target+'.js'),code);
  const context=require('node:vm').createContext({console,performance,setTimeout,clearTimeout,AbortController});new (require('node:vm').Script)(code).runInContext(context);await context.done;const node=JSON.parse(JSON.stringify(context.allocationResult));
  const page=await browser.newPage();await page.route('http://allocation.test/**',route=>route.request().url().endsWith('/bundle.js')?route.fulfill({contentType:'text/javascript',body:code}):route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"script-src 'self'"},body:'<script src="/bundle.js"></script>'}));await page.goto('http://allocation.test/');const web=await page.evaluate(async()=>{await globalThis.done;return globalThis.allocationResult;});await page.close();
  assert.deepEqual(node,expected);assert.deepEqual(web,expected);
  results.push({target,node,web,types:{baseline:baseline.length,current:diagnostics.length,added},inputs:Object.keys(built.metafile.inputs).map(file=>({file,sha256:hash(fs.readFileSync(file))}))});
 }}finally{await browser.close();}
 fs.writeFileSync(path.join(run,'report.json'),JSON.stringify({scope:'synthetic generated allocation controls against retained AIR projection states; not complete captured child-source admission',sourceSha256:hash(text),expected,results,guards},null,2));console.log(JSON.stringify({run,targets:results.map(r=>r.target),projectedStatesPerRuntime:expected.length,guards,addedTypes:0}));
})().catch(e=>{console.error(e);process.exitCode=1;});
