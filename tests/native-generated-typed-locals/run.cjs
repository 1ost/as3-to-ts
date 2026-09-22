const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const api=require('../../lib'),parse=require('../../lib/parse'),emit=require('../../lib/emit'),ts=require('typescript');
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2');
const modern=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const evidence=path.resolve('tests/native-typed-locals');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
assert.equal(hash(fs.readFileSync(path.join(evidence,'files.json'))),'2ff554b0024db49922f6a33c9924a501e091d9001f8fadffd2a1190985d33303');
for(const file of JSON.parse(fs.readFileSync(path.join(evidence,'files.json'),'utf8')))assert.equal(hash(fs.readFileSync(path.join(evidence,file.path))),file.sha256,file.path);
const expected=JSON.parse(fs.readFileSync(path.join(evidence,'evidence/flash.json'),'utf8')).rows;
assert.equal(expected.length,47);assert.deepEqual(expected,JSON.parse(fs.readFileSync(path.join(evidence,'repeat-evidence/flash.json'),'utf8')).rows);
const root=path.resolve('.cache/native-generated-typed-locals');fs.mkdirSync(root,{recursive:true});const run=fs.mkdtempSync(path.join(root,'run-'));
const modulePath=file=>{let relative=path.relative(run,file).replaceAll('\\','/').replace(/\.ts$/,'');return relative.startsWith('.')?relative:'./'+relative;};
const provider=name=>modulePath(path.join(engine,'src/layaAir/flash/utils',name+'.ts'));
const source=fs.readFileSync(path.join(evidence,'evidence/sources/original/probe/TypedLocals.as'),'utf8');
const sources={'probe.TypedLocals':{source,sourceSha256:hash(source)}};
const plan=api.createNativeGeneratedDeclarationPlan({scope:'generated-typed-locals',providerModule:provider('AS3GeneratedClass'),sources});
const helpers=Object.fromEntries(['bound','classBound','nativeClass','callableClass'].map(name=>[name,modulePath(path.resolve('utils',name+'.ts'))]));
const options={customVisitors:[],definitionsByNamespace:{probe:['TypedLocals']},decoratorModules:{bound:helpers.bound,classBound:helpers.classBound},nativeClassHelperModules:{nativeClass:helpers.nativeClass,callableClass:helpers.callableClass},
 nativeGeneratedDeclarations:{plan,module:'./domain'},nativeClassTraitsModule:provider('AS3GeneratedClass'),
 nativeLexicalMembersModule:provider('AS3LexicalMembers'),nativeGeneratedPropertyModule:provider('AS3Property'),
 nativeCallableMethodBindingModule:provider('AS3MethodBinding'),nativeCallableCoercionModule:provider('AS3Coercion'),nativeCallableStringModule:provider('AS3String'),
 nativeArrayCreationModule:provider('AS3ArrayCreation'),nativeTypedLocals:true,nativeTypedLocalAdditionModule:provider('AS3Addition'),nativeTypedLocalReferenceModule:provider('AS3Type')};
const combined=process.argv.includes('--combined');
if(combined)Object.assign(options,{nativeReferenceCoercion:{plan,module:'./domain',coercionModule:provider('AS3Type')},nativeSignaturePropertyModule:provider('AS3Property'),nativeStringLocalCoercionModule:provider('AS3String'),nativeNumericMethodParametersModule:provider('AS3Coercion')});
let guards=0;
for(const key of ['nativeTypedLocalReferenceModule','nativeTypedLocalAdditionModule','nativeCallableCoercionModule','nativeCallableStringModule']){
 assert.throws(()=>emit(parse('TypedLocals.as',source),source,{...options,[key]:undefined}),/AS3_[A-Z_]+UNSUPPORTED/);guards++;
}
assert.throws(()=>emit(parse('TypedLocals.as',source),source,{...options,nativeTypedLocals:false}),/typed local initialization/);guards++;
for(const member of [
 'public function get value():* {var x:int;return x;}',
 'public function f():* {var x:Guard;return x;}',
 'public function f():* {var x:Vector.<int>;return x;}',
 'public function f():* {const x:int=1;return x;}',
 'public function f():* {for each(var x:int in []){}return x;}',
 'private var x:*;public function f():* {var x:int;return x;}',
 'public function f(x:*):* {var x:int;return x;}',
 'public function f():* {var x:int;var x:String;return x;}',
 'public function f():* {var x:int;try{}catch(x:*){x=1;}return x;}'
]){
 const text='package probe {public class Guard {'+member+'}}';
 assert.throws(()=>{const p=api.createNativeGeneratedDeclarationPlan({scope:'guard',providerModule:provider('AS3GeneratedClass'),sources:{'probe.Guard':{source:text,sourceSha256:hash(text)}}});
 emit(parse('Guard.as',text),text,{...options,nativeGeneratedDeclarations:{plan:p,module:'./guard'},...(combined?{nativeReferenceCoercion:{plan:p,module:'./guard',coercionModule:provider('AS3Type')}}:{})});},/AS3_[A-Z_]+UNSUPPORTED/);guards++;
}
for(const mutate of [x=>x.pop(),x=>x.reverse(),x=>{x.find(r=>r.id==='uint-prefix-overflow').value[0]=0;},x=>{x.find(r=>r.id==='compound-rhs-write').value[0]=22.8;}]){
 const bad=structuredClone(expected);mutate(bad);assert.throws(()=>assert.deepEqual(bad,expected));
}
fs.writeFileSync(path.join(run,'domain.ts'),plan.moduleSource);
const emitted=[];
for(const binding of plan.bindings) {
  const source=sources[binding.qname].source;
  const output=emit(parse(binding.qname+'.as',source),source,options);
  const file=path.join(run,binding.qname.split('.').pop()+'.ts');fs.writeFileSync(file,output);emitted.push({file,sourceSha256:hash(source),generatedSha256:hash(output)});
}
const observer=fs.readFileSync(path.join(evidence,'driver.js'),'utf8').replace('x=P.as3ConstructValue(C,()=>[])','x=new C()');
// Preserve all observer cases; construct the generated native class directly.
const driver=['AS3Invocation','AS3Property','AS3DynamicObject'].map((name,i)=>'import * as Extra'+i+' from '+JSON.stringify(provider(name))+';').join('\n')+'\nimport * as Binding from '+JSON.stringify(provider('AS3MethodBinding'))+';\nimport * as N from '+JSON.stringify(helpers.nativeClass)+';\nimport * as T from "./TypedLocals";\nexport function run():any { const modules=new Map<string,any>([["AS3MethodBinding",Object.assign({},Binding,Extra0,Extra1,Extra2)],["nativeClass",N],["TypedLocals",T]]);return new Function("modules",'+JSON.stringify(observer+';return globalThis.result;')+')(modules);}';
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
   const actual=JSON.parse(JSON.stringify(new Function(script+';return generatedOracle.run();')()));
   const page=await browser.newPage();await page.addScriptTag({content:script});const browserRows=await page.evaluate(()=>JSON.parse(JSON.stringify(generatedOracle.run())));await page.close();
   const wanted=expected;
   assert.deepEqual(actual,wanted);assert.deepEqual(browserRows,wanted);
   results.push({target,node:actual,browser:browserRows,inputs:Object.keys(bundle.metafile.inputs).map(file=>({file,sha256:hash(fs.readFileSync(file))}))});
 }}finally{await browser.close();}
 fs.writeFileSync(path.join(run,'report.json'),JSON.stringify({combined,guards,comparisonNegativeControls:4,observerSha256:hash(observer),emitted,results,typecheck:{files:program.getSourceFiles().length,diagnostics},held:['typed accessors, foreign reference locals, enumeration, nested callable locals']},null,2));
 console.log('Generated typed locals: '+guards+' guards; 47 AIR rows in Node/Chromium, ES5/ES2015; exact original source class. '+run);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
