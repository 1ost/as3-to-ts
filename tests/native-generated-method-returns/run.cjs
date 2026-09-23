const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const api=require('../../lib'),parse=require('../../lib/parse'),emit=require('../../lib/emit'),ts=require('typescript');
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2');
const modern=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const evidence=path.join(engine,'tests/nativeFlashOracle/generated-method-returns');
const expected=require(path.join(evidence,'verify.cjs'));
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const root=path.resolve('.cache/native-generated-method-returns');fs.mkdirSync(root,{recursive:true});const run=fs.mkdtempSync(path.join(root,'run-'));
const modulePath=file=>{let relative=path.relative(run,file).replaceAll('\\','/').replace(/\.ts$/,'');return relative.startsWith('.')?relative:'./'+relative;};
const provider=name=>modulePath(path.join(engine,'src/layaAir/flash/utils',name+'.ts'));
const sources={};for(const file of fs.readdirSync(path.join(evidence,'source/returns'))){const source=fs.readFileSync(path.join(evidence,'source/returns',file),'utf8');sources['returns.'+file.slice(0,-3)]={source,sourceSha256:hash(source)};}
const plan=api.createNativeGeneratedDeclarationPlan({scope:'generated-method-returns',providerModule:provider('AS3GeneratedClass'),sources});
const helpers=Object.fromEntries(['bound','classBound','nativeClass','callableClass'].map(name=>[name,modulePath(path.resolve('utils',name+'.ts'))]));
const options={customVisitors:[],importModules:Object.fromEntries(Object.keys(sources).map(name=>[name,'./'+name.split('.').pop()])),definitionsByNamespace:{returns:['ReturnValue','ChildValue','ReturnMethods']},
 decoratorModules:{bound:helpers.bound,classBound:helpers.classBound},nativeClassHelperModules:{nativeClass:helpers.nativeClass,callableClass:helpers.callableClass},
 nativeGeneratedDeclarations:{plan,module:'./domain'},nativeClassTraitsModule:provider('AS3GeneratedClass'),
 nativeLexicalMembersModule:provider('AS3LexicalMembers'),nativeGeneratedPropertyModule:provider('AS3Property'),
 nativeCallableMethodBindingModule:provider('AS3MethodBinding'),nativeCallableCoercionModule:provider('AS3Coercion'),nativeCallableStringModule:provider('AS3String'),
 nativeTypedLocals:true,nativeTypedLocalReferenceModule:provider('AS3Type'),nativeTypedLocalAdditionModule:provider('AS3Addition')};
const combined=process.argv.includes('--combined');
if(combined)Object.assign(options,{nativeReferenceCoercion:{plan,module:'./domain',coercionModule:provider('AS3Type')},nativeNumericMethodParametersModule:provider('AS3Coercion'),nativeSignaturePropertyModule:provider('AS3Property')});
let guards=0;
for(const method of [
 'public function probe(flag:*):String {try{if(flag)return "x";}finally{}}',
 'public function probe():String {try{return "x";}catch(e:*){}}',
 'public function probe(flag:*):String {if(flag)return "x";}',
 'public function probe():String {return;}',
 'public function probe():Missing {return null;}',
 'public function probe():Vector.<int> {return null;}',
 'public function probe(value:*=[]):String {return value;}',
 'public function probe(...values):String {trace(arguments);return "x";}'
]){
 const source='package returns {public class Guard {'+method+'}}';
 assert.throws(()=>{const p=api.createNativeGeneratedDeclarationPlan({scope:'guard',providerModule:provider('AS3GeneratedClass'),sources:{...sources,'returns.Guard':{source,sourceSha256:hash(source)}}});
 emit(parse('Guard.as',source),source,{...options,nativeGeneratedDeclarations:{plan:p,module:'./guard'},...(combined?{nativeReferenceCoercion:{plan:p,module:'./guard',coercionModule:provider('AS3Type')}}:{})});},/AS3_[A-Z_]+UNSUPPORTED/);guards++;
}
for(const change of [rows=>rows.pop(),rows=>rows.reverse(),rows=>{rows.find(row=>row.id==='local-raw-result').value=2147483648;},rows=>{rows.find(row=>row.id==='throw-identity').error[2]=false;}]){
 const bad=structuredClone(expected);change(bad);assert.throws(()=>assert.deepEqual(bad,expected));
}
fs.writeFileSync(path.join(run,'domain.ts'),plan.moduleSource);
const emitted=[];
for(const binding of plan.bindings) {
  const source=sources[binding.qname].source;
  const output=emit(parse(binding.qname+'.as',source),source,options);
  const file=path.join(run,binding.qname.split('.').pop()+'.ts');fs.writeFileSync(file,output);emitted.push({file,sourceSha256:hash(source),generatedSha256:hash(output)});
}
const driver=fs.readFileSync(path.join(__dirname,'driver.txt'),'utf8').replaceAll('@NATIVE_CLASS@',helpers.nativeClass).replaceAll('@PROPERTY@',provider('AS3Property')).replaceAll('@DYNAMIC@',provider('AS3DynamicObject')).replaceAll('@TYPE@',provider('AS3Type'));
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
 fs.writeFileSync(path.join(run,'report.json'),JSON.stringify({combined,guards,emitted,results,typecheck:{files:program.getSourceFiles().length,diagnostics},comparisonNegativeControls:4,held:['typed exception-return regions, typed fallthrough, optional/rest method signatures, unresolved return types, vectors']},null,2));
 console.log('Generated method returns: '+guards+' guards; 34 AIR rows in Node/Chromium, ES5/ES2015; exact 3 AIR classes. '+run);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
