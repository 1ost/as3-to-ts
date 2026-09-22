const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const api=require('../../lib'),parse=require('../../lib/parse'),emit=require('../../lib/emit'),ts=require('typescript');
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2');
const modern=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const evidence=path.join(engine,'tests/nativeFlashOracle/interface-reference-entry');
const expected=require(path.join(evidence,'verify.cjs'));
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const root=path.resolve('.cache/native-interface-reference-entry');fs.mkdirSync(root,{recursive:true});const run=fs.mkdtempSync(path.join(root,'run-'));
const modulePath=file=>{let relative=path.relative(run,file).replaceAll('\\','/').replace(/\.ts$/,'');return relative.startsWith('.')?relative:'./'+relative;};
const provider=name=>modulePath(path.join(engine,'src/layaAir/flash/utils',name+'.ts'));
const sources={};for(const file of fs.readdirSync(path.join(evidence,'source/cases'))){const source=fs.readFileSync(path.join(evidence,'source/cases',file),'utf8');sources['cases.'+file.slice(0,-3)]={source,sourceSha256:hash(source)};}
const plan=api.createNativeGeneratedDeclarationPlan({scope:'interface-reference-entry',providerModule:provider('AS3GeneratedClass'),interfaceProviderModule:provider('AS3Type'),sources});
const helpers=Object.fromEntries(['bound','classBound','nativeClass','callableClass'].map(name=>[name,modulePath(path.resolve('utils',name+'.ts'))]));
const options={customVisitors:[],importModules:Object.fromEntries(Object.keys(sources).map(name=>[name,'./'+name.split('.').pop()])),definitionsByNamespace:{cases:Object.keys(sources).map(n=>n.split('.').pop())},
 decoratorModules:{bound:helpers.bound,classBound:helpers.classBound},nativeClassHelperModules:{nativeClass:helpers.nativeClass,callableClass:helpers.callableClass},
 nativeGeneratedDeclarations:{plan,module:'./domain'},nativeClassTraitsModule:provider('AS3GeneratedClass'),
 nativeLexicalMembersModule:provider('AS3LexicalMembers'),nativeGeneratedPropertyModule:provider('AS3Property'),
 nativeCallableMethodBindingModule:provider('AS3MethodBinding'),nativeCallableCoercionModule:provider('AS3Coercion'),nativeCallableStringModule:provider('AS3String'),
 nativeDictionaryPropertyModule:provider('AS3Property'),nativeEnumeration:{dictionaryModule:provider('Dictionary'),coercionModule:provider('AS3Coercion'),stringModule:provider('AS3String')},
 nativeTypedLocals:true,nativeTypedLocalReferenceModule:provider('AS3Type'),nativeTypedLocalAdditionModule:provider('AS3Addition')};
const combined=process.argv.includes('--combined');
if(combined)Object.assign(options,{nativeReferenceCoercion:{plan,module:'./domain',coercionModule:provider('AS3Type')},nativeNumericMethodParametersModule:provider('AS3Coercion'),nativeSignaturePropertyModule:provider('AS3Property')});
let guards=0;
for(const body of [
 'private static var count:int;',
 'protected static function call():void {}',
 'private static function get value():int {return 0;}',
 'private static function call(...values):void {}',
 'private static function call(v:int=0):void {}'
]){
 const source='package cases {public class Guard {'+body+'}}';
 const p=api.createNativeGeneratedDeclarationPlan({scope:'interface-emission-guard',providerModule:provider('AS3GeneratedClass'),interfaceProviderModule:provider('AS3Type'),sources:{...sources,'cases.Guard':{source,sourceSha256:hash(source)}}});
 assert.throws(()=>emit(parse('Guard.as',source),source,{...options,nativeGeneratedDeclarations:{plan:p,module:'./guard-domain'},...(combined?{nativeReferenceCoercion:{plan:p,module:'./guard-domain',coercionModule:provider('AS3Type')}}:{})}),/AS3_[A-Z_]+UNSUPPORTED/);guards++;
}
const wanted=expected.filter(row=>row.id.startsWith('required-')||row.id.startsWith('forward-'));assert.equal(wanted.length,12);
for(const mutate of [rows=>rows.pop(),rows=>rows.reverse(),rows=>rows.find(r=>r.id==='forward-rejected').value[3][0]=10,rows=>rows.find(r=>r.id==='required-undefined').value[2][1]=false,rows=>rows.find(r=>r.id==='required-lookalike').value[1].push('base-body')]){
 const bad=structuredClone(wanted);mutate(bad);assert.throws(()=>assert.deepEqual(bad,wanted));
}
fs.writeFileSync(path.join(run,'domain.ts'),plan.moduleSource);
const emitted=[];
for(const binding of plan.bindings) {
  const source=sources[binding.qname].source;
  if(binding.qname==='cases.Locals'){assert.throws(()=>emit(parse(binding.qname+'.as',source),source,options),/typed local source reference lowering required/);guards++;continue;}
  const output=emit(parse(binding.qname+'.as',source),source,options);
  const file=path.join(run,binding.qname.split('.').pop()+'.ts');fs.writeFileSync(file,output);emitted.push({file,sourceSha256:hash(source),generatedSha256:hash(output)});
}
for(const binding of plan.interfaces){const source=sources[binding.qname].source;
 const output=emit(parse(binding.qname+'.as',source),source,{customVisitors:[],importModules:options.importModules,definitionsByNamespace:options.definitionsByNamespace,decoratorModules:options.decoratorModules});
 const file=path.join(run,binding.qname.split('.').pop()+'.ts');fs.writeFileSync(file,output);emitted.push({file,sourceSha256:hash(source),generatedSha256:hash(output)});}
const driver=fs.readFileSync(path.join(__dirname,'reference-entry-driver.txt'),'utf8').replaceAll('@NATIVE_CLASS@',helpers.nativeClass).replaceAll('@TYPE@',provider('AS3Type')).replace('@INTERFACES@',JSON.stringify(Object.fromEntries(plan.interfaces.map(b=>[b.qname,b.tokenExport]))));
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
   assert.deepEqual(actual,wanted);assert.deepEqual(browserRows,wanted);
   results.push({target,node:actual,browser:browserRows,inputs:Object.keys(bundle.metafile.inputs).map(file=>({file,sha256:hash(fs.readFileSync(file))}))});
 }}finally{await browser.close();}
 fs.writeFileSync(path.join(run,'report.json'),JSON.stringify({combined,guards,emitted,results,typecheck:{files:program.getSourceFiles().length,diagnostics},comparisonNegativeControls:5,held:['20 AIR local observations: full Locals source requires nested callable lowering','Ordinary consumer interface coercion','Static lexical variables, accessors and protected methods','Optional/rest methods and constructors, typed exception-return regions']},null,2));
 console.log('Generated interface emission: '+guards+' guards, 12 AIR rows in Node/Chromium, ES5/ES2015; exact 6 AIR classes and 1 interface; full Locals source explicitly held. '+run);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
