const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const api=require('../../lib'),parse=require('../../lib/parse'),emit=require('../../lib/emit'),ts=require('typescript');
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2');
const modern=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const evidence=path.join(engine,'tests/nativeFlashOracle/consumer-constant-emission');
const expected=require(path.join(evidence,'verify.cjs'));
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const root=path.resolve('.cache/native-consumer-constants');fs.mkdirSync(root,{recursive:true});const run=fs.mkdtempSync(path.join(root,'run-'));
const modulePath=file=>{let relative=path.relative(run,file).replaceAll('\\','/').replace(/\.ts$/,'');return relative.startsWith('.')?relative:'./'+relative;};
const provider=name=>modulePath(path.join(engine,'src/layaAir/flash/utils',name+'.ts'));
const generatedConsumer=process.argv.includes('--generated-consumer');
const sources={};for(const file of fs.readdirSync(path.join(evidence,'source/consumerconstants'))){const source=fs.readFileSync(path.join(evidence,'source/consumerconstants',file),'utf8');sources['consumerconstants.'+file.slice(0,-3)]={source,sourceSha256:hash(source)};}
const consumerSource=fs.readFileSync(path.join(evidence,'source/ConstantReads.as'),'utf8');sources.ConstantReads={source:consumerSource,sourceSha256:hash(consumerSource),referenceOnly:!generatedConsumer};
const eventModule=provider('AS3CanonicalEventConstruction');
const plan=api.createNativeGeneratedDeclarationPlan({scope:'consumer-constants',providerModule:provider('AS3GeneratedClass'),sources});
const helpers=Object.fromEntries(['bound','classBound','nativeClass','callableClass'].map(name=>[name,modulePath(path.resolve('utils',name+'.ts'))]));
const common={customVisitors:[],importModules:Object.fromEntries(Object.keys(sources).map(name=>[name,'./'+name.split('.').pop()])),definitionsByNamespace:{consumerconstants:['Trace','Parent','Child'],'':['ConstantReads']},
 decoratorModules:{bound:helpers.bound,classBound:helpers.classBound},nativeClassHelperModules:{nativeClass:helpers.nativeClass,callableClass:helpers.callableClass}};
const options={...common,nativeGeneratedDeclarations:{plan,module:'./domain'},nativeClassTraitsModule:provider('AS3GeneratedClass'),
 nativeLexicalMembersModule:provider('AS3LexicalMembers'),nativeGeneratedPropertyModule:provider('AS3Property'),
 nativeCallableMethodBindingModule:provider('AS3MethodBinding'),nativeCallableCoercionModule:provider('AS3Coercion'),nativeCallableStringModule:provider('AS3String')};
const consumer={...common,nativeReferenceCoercion:{plan,module:'./domain',coercionModule:provider('AS3Type')},nativeSignaturePropertyModule:provider('AS3Property')};
let guards=0;
for(const body of ['Child.CHANGE="bad";','Child.CHANGE++;','++Child.CHANGE;','Child.CHANGE += "x";','delete Child.CHANGE;','return Child.initialized;','return Child.BASE;','return Child["CHANGE"];','return Child;']){
 const source='package {import consumerconstants.Child;public class Guard {public function probe():*{'+body+'}}}';
 assert.throws(()=>emit(parse('Guard.as',source),source,consumer),/AS3_[A-Z_]+UNSUPPORTED/);guards++;
}
for(const declaration of ['public static const CHANGE:String=make();public static function make():*{return "x";}','private static const CHANGE:String="x";','public static const CHANGE:Array=[];']){
 const source='package consumerconstants {public class Child {'+declaration+'}}';
 const changed={...sources,'consumerconstants.Child':{source,sourceSha256:hash(source)}};
 const p=api.createNativeGeneratedDeclarationPlan({scope:'guard',providerModule:provider('AS3GeneratedClass'),sources:changed});
 assert.throws(()=>emit(parse('ConstantReads.as',consumerSource),consumerSource,{...consumer,nativeReferenceCoercion:{...consumer.nativeReferenceCoercion,plan:p}}),/AS3_[A-Z_]+UNSUPPORTED/);guards++;
}
if(generatedConsumer)for(const body of ['Child.CHANGE="bad";','Child.CHANGE++;','++Child.CHANGE;','Child.CHANGE += "x";','delete Child.CHANGE;']){
 const source='package {import consumerconstants.Child;public class Guard {public function probe():*{'+body+'}}}';
 const p=api.createNativeGeneratedDeclarationPlan({scope:'generated-mutation',providerModule:provider('AS3GeneratedClass'),sources:{...sources,Guard:{source,sourceSha256:hash(source)}}});
 assert.throws(()=>emit(parse('Guard.as',source),source,{...options,...consumer,nativeGeneratedDeclarations:{plan:p,module:'./guard'},nativeReferenceCoercion:{...consumer.nativeReferenceCoercion,plan:p,module:'./guard'}}),/consumer constant mutation/);guards++;
}
fs.writeFileSync(path.join(run,'domain.ts'),plan.moduleSource);
const emitted=[];
for(const binding of [...plan.bindings,...(generatedConsumer?[]:[{qname:'ConstantReads',referenceOnly:true}])]) {
  const source=sources[binding.qname].source;
  const output=emit(parse(binding.qname+'.as',source),source,binding.qname==='ConstantReads'?{...(generatedConsumer?options:{}),...consumer}:options);
  const file=path.join(run,binding.qname.split('.').pop()+'.ts');fs.writeFileSync(file,output);emitted.push({file,sourceSha256:hash(source),generatedSha256:hash(output)});
}
let driver=fs.readFileSync(path.join(__dirname,'driver.txt'),'utf8').replaceAll('@NATIVE_CLASS@',helpers.nativeClass).replaceAll('@EVENT@',eventModule).replaceAll('@PROPERTY@',provider('AS3Property')).replaceAll('@METADATA@',provider('FlashTypeMetadata')).replaceAll('@TYPE@',provider('AS3Type'));
if(generatedConsumer)driver=driver.replace('new ConstantReads()','new (readNativeClass(ConstantReads))()');
fs.writeFileSync(path.join(run,'driver.ts'),driver);
const files=fs.readdirSync(run).filter(f=>f.endsWith('.ts')).map(f=>path.join(run,f));
const program=modern.createProgram(files,{target:modern.ScriptTarget.ES2020,module:modern.ModuleKind.CommonJS,strict:true,strictNullChecks:false,experimentalDecorators:true,noEmit:true,skipLibCheck:true,lib:['lib.es2020.d.ts','lib.dom.d.ts']});
const diagnostics=modern.getPreEmitDiagnostics(program).map(d=>({file:d.file&&path.relative(run,d.file.fileName),line:d.file&&d.file.getLineAndCharacterOfPosition(d.start).line+1,code:d.code,text:modern.flattenDiagnosticMessageText(d.messageText,'\n')}));
fs.writeFileSync(path.join(run,'types.json'),JSON.stringify(diagnostics,null,2));assert.deepEqual(diagnostics,[]);
async function main(){
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||require.resolve('playwright',{paths:[process.env.LAYA_BROWSER_TOOLS||path.resolve('../op2-html5/game-client-laya'),engine,process.cwd()]}));
 const browser=await chromium.launch({headless:true});const results=[];
 try{for(const target of [ts.ScriptTarget.ES5,ts.ScriptTarget.ES2015]){
   const targetDir=path.join(run,'target-'+target);fs.mkdirSync(targetDir);
   for(const file of files){const result=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target,module:ts.ModuleKind.CommonJS,experimentalDecorators:true},reportDiagnostics:true});assert.deepEqual(result.diagnostics,[]);
     // Moving only this test's modules one directory deeper preserves exact
     // explicit helper/provider module paths; no class bodies are rewritten.
     const code=result.outputText.replace(/require\("(\.\.\/[^"\n]+)"\)/g,(_,name)=>'require('+JSON.stringify('../'+name)+')');
     fs.writeFileSync(path.join(targetDir,path.basename(file,'.ts')+'.js'),code);
   }
   const bundle=esbuild.buildSync({entryPoints:[path.join(targetDir,'driver.js')],bundle:true,write:false,format:'iife',globalName:'generatedOracle',platform:'browser',target:'es2020',metafile:true});
   const script=bundle.outputFiles[0].text;fs.writeFileSync(path.join(targetDir,'bundle.js'),script);
   const actual=new Function(script+';return generatedOracle.run();')();
   const page=await browser.newPage();await page.addScriptTag({content:script});const browserRows=await page.evaluate(()=>generatedOracle.run());await page.close();
   const wanted=expected;
   assert.deepEqual(actual,wanted);assert.deepEqual(browserRows,wanted);
   results.push({target,node:actual,browser:browserRows,inputs:Object.keys(bundle.metafile.inputs).map(file=>({file,sha256:hash(fs.readFileSync(file))}))});
 }}finally{await browser.close();}
 fs.writeFileSync(path.join(run,'report.json'),JSON.stringify({generatedConsumer,guards,emitted,results,typecheck:{files:program.getSourceFiles().length,diagnostics},held:['computed constants, mutable statics, indexed access, Class value escape']},null,2));
 console.log('Consumer constants (generated='+generatedConsumer+'): '+guards+' guards; 6 AIR rows in Node/Chromium, ES5/ES2015; exact 4 source classes. '+run);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
