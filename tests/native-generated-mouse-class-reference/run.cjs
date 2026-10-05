const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),engine=path.resolve(root,'../engine'),api=require('../../lib'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const candidate=process.argv.includes('--candidate');
const mouseProvider=path.join(engine,candidate?'tests/nativeMouseClassReference/candidate.ts':'src/layaAir/flash/utils/AS3CanonicalMouseReference.ts');
const evidence=path.join(engine,'tests/nativeFlashOracle/mouse-class-reference'),expected=require(path.join(evidence,'verify.cjs'));
const sourceFile=path.join(evidence,'source/mouseprobe/Reader.as'),source=fs.readFileSync(sourceFile,'utf8'),sources={'mouseprobe.Reader':{source,sourceSha256:hash(source)}};
const receipt=JSON.parse(fs.readFileSync(path.join(evidence,'evidence/receipt.json')));assert.equal(hash(source),receipt.artifacts['source/mouseprobe/Reader.as']);
const ts=require(path.join(engine,'node_modules/typescript')),{build}=require(path.join(engine,'node_modules/esbuild'));
const {chromium}=require(require.resolve('playwright',{paths:['C:/Users/admin/Desktop/GITHUB REPO/op2-html5/game-client-laya']}));
const cache=path.join(root,'.cache/native-generated-mouse-class-reference');fs.mkdirSync(cache,{recursive:true});const run=fs.mkdtempSync(path.join(cache,candidate?'qualification-candidate-':'qualified-'));
const record=file=>({file,sha256:hash(fs.readFileSync(file))});
async function main(){
 const browser=await chromium.launch({headless:true}),results=[];
 try {for(const target of ['ES5','ES2015']){
 const out=path.join(run,target);fs.mkdirSync(out);
const modulePath=file=>{let r=path.relative(out,file).replaceAll('\\','/').replace(/\.ts$/,'');return r.startsWith('.')?r:'./'+r;};
const provider=n=>modulePath(path.join(engine,'src/layaAir/flash/utils',n+'.ts'));
const helpers=Object.fromEntries(['bound','classBound','nativeClass','callableClass'].map(n=>[n,modulePath(path.join(root,'utils',n+'.ts'))]));
const providers={'flash.ui.Mouse':{module:modulePath(mouseProvider),exportName:'Mouse'}};
const input={scope:'mouse-class-reference',sources,providers,providerModule:provider('AS3GeneratedClass'),interfaceProviderModule:provider('AS3Type'),scriptGlobalProviderModule:provider('AS3ScriptGlobal'),scriptDomainProvider:{module:'./cohortDomain',exportName:'scriptDomain'},inheritScriptClasses:true,classScriptSources:['mouseprobe.Reader'],lexicalProviderModule:provider('AS3LexicalMembers')};
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

 const config={plan,emitterOptions:options,externalModules,loadingSessionModule:provider('NativeSourceClassLoadingSession'),sourceNamespaceProviderModule:provider('AS3SourceNamespace'),target};
 const artifact=api.emitNativeSourceClassModule(config);assert.deepEqual(artifact,api.emitNativeSourceClassModule(config));
 const file=path.join(out,'factory.js');fs.writeFileSync(file,artifact.moduleSource);
 const typed=[];for(const s of artifact.generatedSources){const f=path.join(out,s.module+'.ts');fs.writeFileSync(f,s.source);typed.push(f);}
 const domain=path.join(out,'cohortDomain.ts');fs.writeFileSync(domain,'import {AS3ScriptDomain} from '+JSON.stringify(provider('AS3ScriptGlobal'))+';export declare const scriptDomain:AS3ScriptDomain;');typed.push(domain);
 const declaration=path.join(out,'factory.d.ts');fs.writeFileSync(declaration,artifact.declarationSource);typed.push(declaration);
 const observer=path.join(out,'observer.ts');fs.writeFileSync(observer,fs.readFileSync(path.join(__dirname,'observer.ts'),'utf8').replaceAll('@ENGINE@',modulePath(engine)).replaceAll('@MOUSE@',modulePath(mouseProvider)));typed.push(observer);
 typed.push(...['glsl.d.ts','spine.d.ts'].map(f=>path.join(engine,'src/layaAir/tslibs',f)));
 const program=ts.createProgram(typed,{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,strict:true,strictNullChecks:false,useUnknownInCatchVariables:false,experimentalDecorators:true,noEmit:true,skipLibCheck:true,lib:['lib.es2020.d.ts','lib.dom.d.ts','lib.dom.iterable.d.ts'],baseUrl:engine,paths:{'@laya/engine/*':['src/layaAir/*'],'@laya/flash/*':['src/layaAir/flash/*']}});
 const diagnostics=ts.getPreEmitDiagnostics(program).map(d=>({file:d.file?.fileName,code:d.code,text:ts.flattenDiagnosticMessageText(d.messageText,'\n')}));fs.writeFileSync(path.join(out,'types.json'),JSON.stringify(diagnostics,null,2));assert.deepEqual(diagnostics,[]);
 const bundle=()=>build({alias:{'@laya/engine':path.join(engine,'src/layaAir'),'@laya/flash':path.join(engine,'src/layaAir/flash')},loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'},entryPoints:[observer],bundle:true,write:false,metafile:true,platform:'browser',target:'es2020',format:'iife',globalName:'MouseQualification'});
 const built=await bundle(),code=built.outputFiles[0].text;
 fs.writeFileSync(path.join(out,'bundle.js'),code);
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 try{
 await page.route('http://mouse-qualified.test/**',route=>route.request().url().endsWith('/probe.js')?route.fulfill({contentType:'text/javascript',body:code}):route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"script-src 'self'"},body:'<!doctype html><body><script src="/probe.js"></script>'}));
 await page.goto('http://mouse-qualified.test/');const actual=await page.evaluate(()=>globalThis.MouseQualification.run());
 const reflected=await page.evaluate(({actual,expected})=>{
  const tree=xml=>{const document=new DOMParser().parseFromString(xml,'text/xml');if(document.querySelector('parsererror'))throw new Error('Invalid reflection XML');const visit=e=>({tag:e.tagName,attributes:Object.fromEntries([...e.attributes].map(a=>[a.name,a.value]).sort(([a],[b])=>a.localeCompare(b))),children:[...e.children].map(visit)});return visit(document.documentElement);};return {actual:tree(actual),expected:tree(expected)};
 },{actual:actual.reflection,expected:expected.find(r=>r.id==='reflection').value});
 assert.deepEqual(actual.rows,expected.slice(0,10));assert.deepEqual(reflected.actual,reflected.expected);assert.ok(actual.checks.every(c=>c.passed));assert.equal(actual.checks.length,8);assert.deepEqual(errors,[]);
 const wantedTransitions=['none','auto','text','none','pointer','auto'];assert.deepEqual(actual.transitions,wantedTransitions);
 const controls=[];
 try{for(const method of ['hide','show']){
  const expression=new RegExp('\\b[A-Za-z_$][\\w$]*\\.Mouse\\.'+method+'\\(\\);','g');assert.ok(expression.test(artifact.moduleSource));
  const mutated=artifact.moduleSource.replace(expression,'void 0;');assert.notEqual(mutated,artifact.moduleSource);fs.writeFileSync(file,mutated);
  fs.writeFileSync(path.join(out,'without-'+method+'-factory.js'),mutated);
  const changed=(await bundle()).outputFiles[0].text;fs.writeFileSync(path.join(out,'without-'+method+'-bundle.js'),changed);
  const negative=await browser.newPage();try{
   await negative.route('http://mouse-negative.test/**',route=>route.request().url().endsWith('/probe.js')?route.fulfill({contentType:'text/javascript',body:changed}):route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"script-src 'self'"},body:'<!doctype html><body><script src="/probe.js"></script>'}));
   await negative.goto('http://mouse-negative.test/');const actual=await negative.evaluate(()=>globalThis.MouseQualification.run());assert.notDeepEqual(actual.transitions,wantedTransitions);controls.push({mutation:'without-'+method,actual,bundleSha256:hash(changed),factorySha256:hash(mutated)});
  }finally{await negative.close();}
 }}finally{fs.writeFileSync(file,artifact.moduleSource);}
 results.push({target,rows:actual.rows,reflection:reflected,checks:actual.checks,transitions:actual.transitions,controls,errors,diagnostics,factory:record(file),generatedSources:artifact.generatedSources,typeInputs:program.getSourceFiles().map(s=>record(s.fileName)),bundleInputs:Object.keys(built.metafile.inputs).map(f=>record(path.resolve(f)))});
 }finally{await page.close();}
 }}finally{await browser.close();}
 const compilerFiles=['src','lib','utils'].flatMap(d=>fs.readdirSync(path.join(root,d),{recursive:true}).map(f=>path.join(root,d,f)).filter(f=>fs.statSync(f).isFile()));
 const inputs=[...compilerFiles,__filename,path.join(__dirname,'observer.ts'),sourceFile,path.join(evidence,'evidence/receipt.json'),mouseProvider].map(record);
 const report={status:'passed',candidate,source:sources,mouseProvider,inputs,results};fs.writeFileSync(path.join(run,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({run,candidate,targets:2,rows:10,reflection:'complete',hostChecks:8,mutationsPerTarget:2,typeErrors:0}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
