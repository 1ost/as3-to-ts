// Authenticate the original Mouse Reader and test the existing provider mapping.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),engine=path.resolve(root,'../engine'),api=require('../../lib'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const evidence=path.join(engine,'tests/nativeFlashOracle/mouse-class-reference');require(path.join(evidence,'verify.cjs'));
const sourceFile=path.join(evidence,'source/mouseprobe/Reader.as'),source=fs.readFileSync(sourceFile,'utf8'),sources={'mouseprobe.Reader':{source,sourceSha256:hash(source)}};
const receipt=JSON.parse(fs.readFileSync(path.join(evidence,'evidence/receipt.json')));assert.equal(hash(source),receipt.artifacts['source/mouseprobe/Reader.as']);
const cache=path.join(root,'.cache/native-generated-mouse-class-reference');fs.mkdirSync(cache,{recursive:true});const out=fs.mkdtempSync(path.join(cache,'baseline-'));
const modulePath=file=>{let r=path.relative(out,file).replaceAll('\\','/').replace(/\.ts$/,'');return r.startsWith('.')?r:'./'+r;};
const provider=n=>modulePath(path.join(engine,'src/layaAir/flash/utils',n+'.ts'));
const helpers=Object.fromEntries(['bound','classBound','nativeClass','callableClass'].map(n=>[n,modulePath(path.join(root,'utils',n+'.ts'))]));
const providers={'flash.ui.Mouse':{module:modulePath(path.join(engine,'src/layaAir/flash/ui/Mouse.ts')),exportName:'Mouse'}};
const input={scope:'mouse-class-reference-baseline',sources,providers,providerModule:provider('AS3GeneratedClass'),interfaceProviderModule:provider('AS3Type'),scriptGlobalProviderModule:provider('AS3ScriptGlobal'),scriptDomainProvider:{module:'./cohortDomain',exportName:'scriptDomain'},inheritScriptClasses:true,classScriptSources:['mouseprobe.Reader'],lexicalProviderModule:provider('AS3LexicalMembers')};
const plan=api.createNativeGeneratedDeclarationPlan(input),sourceError=modulePath(path.join(engine,'src/layaAir/flash/errors/AS3SourceError.ts'));
const options={customVisitors:[],definitionsByNamespace:{mouseprobe:['Reader']},importModules:{'compiler.AS3Class':provider('AS3Class'),'compiler.AS3Invocation':provider('AS3Invocation'),'flash.ui.Mouse':providers['flash.ui.Mouse'].module,'flash.utils.getQualifiedClassName':provider('getQualifiedClassName'),'flash.utils.getQualifiedSuperclassName':provider('getQualifiedSuperclassName')},
 decoratorModules:{bound:helpers.bound,classBound:helpers.classBound},nativeClassHelperModules:{nativeClass:helpers.nativeClass,callableClass:helpers.callableClass},
 nativeGeneratedDeclarations:{plan,module:'./__native_declarations'},nativeReferenceCoercion:{plan,module:'./__native_declarations',coercionModule:provider('AS3Type')},
 nativeClassTraitsModule:provider('AS3GeneratedClass'),nativeLexicalMembersModule:provider('AS3LexicalMembers'),nativeGeneratedPropertyModule:provider('AS3Property'),
 nativeCallableMethodBindingModule:provider('AS3MethodBinding'),nativeCallableCoercionModule:provider('AS3Coercion'),nativeCallableStringModule:provider('AS3String'),
 nativeSourceErrorModule:sourceError,nativeDynamicPropertyReadsModule:provider('AS3Property'),nativeDynamicPropertyWritesModule:provider('AS3Property'),nativeComputedTypeTestModule:provider('AS3Type'),
 nativeObjectCreationModule:provider('AS3Class'),nativeTypedLocals:true,nativeTypedLocalReferenceModule:provider('AS3Type'),nativeTypedLocalAdditionModule:provider('AS3Addition'),nativeArrayCreationModule:provider('AS3ArrayCreation'),
 nativeClassTypeOperationsModule:provider('AS3Class'),nativeNumericMethodParametersModule:provider('AS3Coercion'),nativeSignaturePropertyModule:provider('AS3Property'),nativeReflectionQueryModule:provider('AS3ReflectionQuery')};
const externalModules=[...new Set([...Object.values(helpers),sourceError,...Object.values(providers).map(p=>p.module),...['AS3Class','AS3Invocation','AS3GeneratedClass','AS3ScriptGlobal','AS3LexicalMembers','AS3Property','AS3MethodBinding','AS3Coercion','AS3String','AS3Type','AS3Addition','AS3ArrayCreation','AS3ReflectionQuery','getQualifiedClassName','getQualifiedSuperclassName','NativeSourceClassLoadingSession','AS3SourceNamespace'].map(provider)])];
async function main(){
const results=[];
for(const target of ['ES5','ES2015']){
 try{const artifact=api.emitNativeSourceClassModule({plan,emitterOptions:options,externalModules,loadingSessionModule:provider('NativeSourceClassLoadingSession'),sourceNamespaceProviderModule:provider('AS3SourceNamespace'),target});const file=path.join(out,target+'.js');fs.writeFileSync(file,artifact.moduleSource);results.push({target,status:'emitted',file,sha256:hash(artifact.moduleSource)});}
 catch(error){results.push({target,status:'held',message:error.message,stack:String(error.stack)});}
}
const files=['src','lib','utils'].flatMap(d=>fs.readdirSync(path.join(root,d),{recursive:true}).map(f=>path.join(root,d,f)).filter(f=>fs.statSync(f).isFile()));
const inputs=[...files,sourceFile,path.join(evidence,'evidence/receipt.json'),__filename].map(file=>({file,sha256:hash(fs.readFileSync(file))}));
const report={source:sources,results,inputs,provider:providers['flash.ui.Mouse'],runtime:'not-run',canonicalProvider:false};fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
const {build}=require(path.join(engine,'node_modules/esbuild')),{chromium}=require(require.resolve('playwright',{paths:['C:/Users/admin/Desktop/GITHUB REPO/op2-html5/game-client-laya']}));
const browser=await chromium.launch({headless:true});
try{for(const r of results){
 assert.equal(r.status,'emitted');
 const entry=path.join(out,r.target+'-entry.ts');
 const imp=(what,file)=>'import '+what+' from '+JSON.stringify(modulePath(file))+';';
 const source='import '+JSON.stringify(modulePath(path.join(engine,'tests/nativeCanonicalSpriteClass/init-imports.ts')))+';'+
 imp('{Laya}',path.join(engine,'src/layaAir/Laya.ts'))+
 imp('{ApplicationDomain}',path.join(engine,'src/layaAir/flash/system/ApplicationDomain.ts'))+
 imp('{createNativeSourceClassLoadingSession}',path.join(engine,'src/layaAir/flash/utils/NativeSourceClassLoadingSession.ts'))+
 imp('{as3GetProperty}',path.join(engine,'src/layaAir/flash/utils/AS3Property.ts'))+
 imp('{as3CallValue}',path.join(engine,'src/layaAir/flash/utils/AS3Invocation.ts'))+
 'import {nativeSourceClassModule as artifact} from '+JSON.stringify('./'+r.target+'.js')+';'+
 'globalThis.completion=(async()=>{try{await Laya.init(160,100);const domain=new ApplicationDomain(ApplicationDomain.currentDomain),session=createNativeSourceClassLoadingSession({resolve:()=>artifact,maxModules:1});await session.load("mouse",domain);const Reader=domain.getDefinition("mouseprobe.Reader");const rows=as3CallValue(as3GetProperty(Reader,"run"),()=>[]);return {status:"executed",rows};}catch(error){return {status:"held",name:error.name,message:error.message,stack:String(error.stack)};}})();';
 fs.writeFileSync(entry,source);
 const built=await build({alias:{'@laya/engine':path.join(engine,'src/layaAir'),'@laya/flash':path.join(engine,'src/layaAir/flash')},loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'},entryPoints:[entry],bundle:true,write:false,metafile:true,platform:'browser',target:'es2020',format:'iife'}),code=built.outputFiles[0].text;
 fs.writeFileSync(path.join(out,r.target+'-bundle.js'),code);
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.route('http://mouse-generated.test/**',route=>route.request().url().endsWith('/probe.js')?route.fulfill({contentType:'text/javascript',body:code}):route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"script-src 'self'"},body:'<!doctype html><body><script src="/probe.js"></script>'}));
 await page.goto('http://mouse-generated.test/');r.runtime=await page.evaluate(()=>globalThis.completion);r.errors=errors;assert.deepEqual(errors,[]);await page.close();
 r.bundleInputs=Object.keys(built.metafile.inputs).map(file=>({file:path.resolve(file),sha256:hash(fs.readFileSync(file))}));
 }}finally{await browser.close();}
report.runtime='browser-diagnostic';fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({out,results:results.map(({bundleInputs,...r})=>r)}));
for(const r of results){assert.equal(r.runtime.status,'held');assert.equal(r.runtime.message,'AS3_CLASS_UNSUPPORTED: native class lacks exact source metadata');}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
