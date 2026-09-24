const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
module.exports=async function testFactory({api,ts,modern,esbuild,engine,run,plans,options,combined,names,moduleFor,modulePath,provider,helpers,wanted,rejectionGuards}) {
 const externalModules=[...new Set([...names.map(n=>modulePath(path.join(engine,moduleFor(n)+'.ts'))),...Object.values(helpers)])];
 const loadingSessionModule=provider('NativeSourceClassLoadingSession');
 const observerFile=path.resolve('tests/native-generated-inherited-classes/runtime-driver-factory.js'),observer=fs.readFileSync(observerFile,'utf8');
 const config=(plan,target)=>({plan,target,externalModules,loadingSessionModule,emitterOptions:{...options,
  nativeReferenceCoercion:{plan,module:'./unused',coercionModule:provider('AS3Type')},
  ...(combined?{nativeNumericMethodParametersModule:provider('AS3Coercion'),nativeSignaturePropertyModule:provider('AS3Property')}:{})}});
 let factoryGuards=0;
 const rejected=fn=>{assert.throws(fn,/AS3_[A-Z_]+UNSUPPORTED/);factoryGuards++;};
 const c=config(plans.child,'ES2015');
 rejected(()=>api.emitNativeSourceClassModule({...c,plan:{...c.plan}}));
 rejected(()=>api.emitNativeSourceClassModule({...c,target:'ESNext'}));
 rejected(()=>api.emitNativeSourceClassModule({...c,externalModules:[...externalModules,externalModules[0]]}));
 rejected(()=>api.emitNativeSourceClassModule({...c,externalModules:[...externalModules,'./__native_class_0']}));
 rejected(()=>api.emitNativeSourceClassModule({...c,externalModules:externalModules.filter(m=>m!==loadingSessionModule)}));
 rejected(()=>api.emitNativeSourceClassModule({...c,externalModules:externalModules.filter(m=>m!==provider('AS3Class'))}));
 rejected(()=>api.emitNativeSourceClassModule({...c,emitterOptions:{...c.emitterOptions,customVisitors:[{}]}}));
 rejected(()=>api.emitNativeSourceClassModule({...c,emitterOptions:{...c.emitterOptions,nativeReferenceCoercion:{...c.emitterOptions.nativeReferenceCoercion,plan:plans.parent}}}));
 const {chromium}=require(require.resolve('playwright',{paths:[path.resolve('../op2-html5/game-client-laya'),engine]}));
 const browser=await chromium.launch({headless:true}),results=[];
 const execute=async(code)=>{const context=vm.createContext({console,setTimeout,clearTimeout,AbortController,AbortSignal,DOMException});context.window=context;context.document={};new vm.Script(code).runInContext(context);await context.completion;return JSON.parse(JSON.stringify(context.result));};
 try {for(const target of ['ES5','ES2015']) {
  const artifacts={},typechecks=[];
  for(const [cohort,plan] of Object.entries(plans)) {
   const artifact=api.emitNativeSourceClassModule(config(plan,target));artifacts[cohort]=artifact;
   assert.deepEqual(artifact,api.emitNativeSourceClassModule(config(plan,target))); // deterministic complete emission
   assert(!/new Function\(|\beval\(/.test(artifact.moduleSource));
   const files=[];
   for(const item of artifact.generatedSources){const file=path.join(run,item.module+'.ts');fs.writeFileSync(file,item.source);files.push(file);}
   files.push(path.join(run,'cohortDomain.ts'),...['glsl.d.ts','spine.d.ts'].map(f=>path.join(engine,'src/layaAir/tslibs',f)));
   fs.writeFileSync(path.join(run,cohort+'-factory.js'),artifact.moduleSource);
   fs.writeFileSync(path.join(run,cohort+'-factory.d.ts'),artifact.declarationSource);files.push(path.join(run,cohort+'-factory.d.ts'));
   const program=modern.createProgram(files,{target:modern.ScriptTarget.ES2020,module:modern.ModuleKind.CommonJS,strict:true,strictNullChecks:false,useUnknownInCatchVariables:false,experimentalDecorators:true,noEmit:true,skipLibCheck:false,lib:['lib.es2020.d.ts','lib.dom.d.ts']});
   const diagnostics=modern.getPreEmitDiagnostics(program).map(d=>({file:d.file&&d.file.fileName,code:d.code,text:modern.flattenDiagnosticMessageText(d.messageText,'\n')}));
   fs.writeFileSync(path.join(run,cohort+'-factory-types.json'),JSON.stringify(diagnostics,null,2));assert.deepEqual(diagnostics,[]);
   typechecks.push({cohort,files:program.getSourceFiles().length,diagnostics});
  }
  const entry=names.map((n,i)=>'import * as p'+i+' from '+JSON.stringify(modulePath(path.join(engine,moduleFor(n)+'.ts')))+';').join('\n')
   +'\nimport {nativeSourceClassModule as parentModule} from "./parent-factory.js";\nimport {nativeSourceClassModule as childModule,bindNativeSourceClasses as bindChild} from "./child-factory.js";\n'
   +'const api=Object.assign({},'+names.map((n,i)=>'p'+i).join(',')+');const plans='+JSON.stringify(Object.fromEntries(Object.entries(plans).map(([k,p])=>[k,p.bindings])))+';const instantiations=globalThis.instantiations=[];globalThis.completion=(async()=>{'+observer+'})();';
  const build=async(mutation)=>esbuild.build({stdin:{contents:entry,resolveDir:run,loader:'js'},bundle:true,write:false,format:'iife',platform:'browser',target:'es2020',metafile:true,loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'},plugins:[{name:'observer-and-negative-controls',setup(build){build.onLoad({filter:/AS3ScriptGlobal\.ts$|AS3Class\.ts$|factory\.js$/},args=>{
   let contents=fs.readFileSync(args.path,'utf8');
   if(args.path.endsWith('AS3ScriptGlobal.ts')) {
    const marker='return instantiateUnit(domain, input, factory, false);';assert.equal(contents.split(marker).length,2);
    contents=contents.replace(marker,'globalThis.instantiations.push(input.sourceId);'+marker);
    if(mutation==='missing-inheritance')contents=contents.replace('const selected = requireScope().selectSourceClass(name);','const selected = undefined;');
   }
   if(args.path.endsWith('AS3Class.ts')&&mutation==='uncoerced-Class-return')contents=contents.replace('export function as3CoerceClass(value: unknown): AS3ClassValue | null {','export function as3CoerceClass(value: unknown): AS3ClassValue | null { return value as any;');
   if(args.path.endsWith('factory.js')&&mutation==='shared-cohort-cache') {
    contents=contents.replace('export function bindNativeSourceClasses(domain) {','let __cache;\nexport function bindNativeSourceClasses(domain) {');
    const match=contents.match(/const cache = (new Map\([^\n]+\));/);assert(match);contents=contents.replace(match[0],'const cache = __cache || (__cache = '+match[1]+');');
   }
   return {contents,loader:args.path.endsWith('.ts')?'ts':'js'};
  });}}]});
  const built=await build(),script=built.outputFiles[0].text;fs.writeFileSync(path.join(run,'factory-bundle-'+target+'.js'),script);
  const node=await execute(script);assert.deepEqual(node.rows,wanted);assert.equal(node.guards,15);
  const page=await browser.newPage();
  // Executable native script is allowed; dynamic compilation is forbidden by CSP.
  await page.route('http://native-factory.test/**',route=>route.request().url().endsWith('/bundle.js')?route.fulfill({contentType:'text/javascript',body:script}):route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"script-src 'self'"},body:'<!doctype html><script src="/bundle.js"></script>'}));
  await page.goto('http://native-factory.test/');await page.evaluate(()=>globalThis.completion);const web=await page.evaluate(()=>globalThis.result);await page.close();assert.deepEqual(web,node);
  for(const mutation of ['missing-inheritance','shared-cohort-cache'])await assert.rejects(()=>build(mutation).then(b=>execute(b.outputFiles[0].text)));
  const bad=await execute((await build('uncoerced-Class-return')).outputFiles[0].text);assert.equal(bad.rows.find(row=>row.id==='mode-0-class-wrong').value,'returned');assert.throws(()=>assert.deepEqual(bad.rows,wanted));
  results.push({target,node,web,typechecks,artifacts,implementationNegatives:['missing-inheritance','shared-cohort-cache','uncoerced-Class-return'],inputs:Object.keys(built.metafile.inputs).filter(f=>f!=='<stdin>').map(file=>({file,sha256:hash(fs.readFileSync(file))}))});
 }}finally{await browser.close();}
 fs.writeFileSync(path.join(run,'factory-report.json'),JSON.stringify({results,observer:{file:observerFile,sha256:hash(observer)},factoryGuards,rejectionGuards,comparisonNegativeControls:3,held:['Source static initialization','Document root construction','Full game and account validation']},null,2));
 console.log(JSON.stringify({run,productionFactory:true,targets:['ES5','ES2015'],airRows:47,runtimeGuards:15,factoryGuards,implementationNegatives:3,typeErrors:0,browserCSP:'no unsafe-eval'}));
};
