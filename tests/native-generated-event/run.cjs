const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const api=require('../../lib'),parse=require('../../lib/parse'),emit=require('../../lib/emit'),ts=require('typescript');
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2');
const modern=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const evidence=path.join(engine,'tests/nativeFlashOracle/event-construction');
const storageEvidence=path.join(engine,'tests/nativeFlashOracle/generated-declaration-storage');
const storageOracle=require(path.join(storageEvidence,'verify.cjs'));
const canonical=require(path.join(engine,'tests/nativeFlashOracle/canonical-event/verify.cjs'));
const chainEvidence=path.join(engine,'tests/nativeFlashOracle/event-inheritance');
const expected=require(path.join(evidence,'verify.cjs')).filter(r=>!r.id.startsWith('direct-')).concat(storageOracle.filter(r=>['static-shadow','shadow-reflection-constants'].includes(r.id)),require(path.join(chainEvidence,'verify.cjs')));
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const root=path.resolve('.cache/native-generated-event');fs.mkdirSync(root,{recursive:true});const run=fs.mkdtempSync(path.join(root,'run-'));
const modulePath=file=>{let relative=path.relative(run,file).replace(/\\/g,'/').replace(/\.ts$/,'');return relative.startsWith('.')?relative:'./'+relative;};
const provider=name=>modulePath(path.join(engine,'src/layaAir/flash/utils',name+'.ts'));
const withReferences=process.argv.includes('--reference-coercion');
const sources={};
for(const [qname,file] of [['eventcases.EntryEvent',path.join(evidence,'source/eventcases/EntryEvent.as')],['declcases.ShadowEvent',path.join(storageEvidence,'source/declcases/ShadowEvent.as')]]){
 const source=fs.readFileSync(file,'utf8');sources[qname]={source,sourceSha256:hash(source)};
}
const eventModule=provider('AS3CanonicalEventConstruction');
for(const name of ['BaseEvent','LeafEvent']){
 const source=fs.readFileSync(path.join(chainEvidence,'source/eventchain',name+'.as'),'utf8');
 sources['eventchain.'+name]={source,sourceSha256:hash(source)};
}
const providers={'flash.events.Event':{module:eventModule,exportName:'Event',nativeBase:'Event'}};
const plan=api.createNativeGeneratedDeclarationPlan({scope:'air-generated-event',providerModule:provider('AS3GeneratedClass'),sources,providers});
const importModules={...Object.fromEntries(Object.keys(sources).map(name=>[name,'./'+name.split('.').pop()])), 'flash.events.Event':eventModule};
const helpers=Object.fromEntries(['bound','classBound','nativeClass','callableClass'].map(name=>[name,modulePath(path.resolve('utils',name+'.ts'))]));
const options={customVisitors:[],importModules,definitionsByNamespace:{eventchain:['BaseEvent','LeafEvent'],eventcases:['EntryEvent'],declcases:['ShadowEvent'],'flash.events':['Event']},
  nativeComputedTypeTestModule:provider('AS3Type'),
  decoratorModules:{bound:helpers.bound,classBound:helpers.classBound},
  nativeGeneratedDeclarations:{plan,module:'./domain'},nativeClassTraitsModule:provider('AS3GeneratedClass'),
  nativeClassHelperModules:{nativeClass:helpers.nativeClass,callableClass:helpers.callableClass},
  nativeLexicalMembersModule:provider('AS3LexicalMembers'),nativeGeneratedPropertyModule:provider('AS3Property'),
  nativeCallableMethodBindingModule:provider('AS3MethodBinding'),nativeCallableCoercionModule:provider('AS3Coercion'),
  nativeCallableStringModule:provider('AS3String')};
let guards=0;
if(withReferences)options.nativeReferenceCoercion={plan,module:'./domain',coercionModule:provider('AS3Type')};
const reject=(source,bindings=providers)=>{
 assert.throws(()=>{
  const p=api.createNativeGeneratedDeclarationPlan({scope:'guard',providerModule:provider('AS3GeneratedClass'),providers:bindings,
   sources:{'Guard':{source,sourceSha256:hash(source)}}});
  emit(parse('Guard.as',source),source,{...options,nativeGeneratedDeclarations:{plan:p,module:'./guard'},...(withReferences?{nativeReferenceCoercion:{plan:p,module:'./guard',coercionModule:provider('AS3Type')}}:{})});
 },/AS3_[A-Z_]+UNSUPPORTED/,source);guards++;
};
const guardSource='package {import flash.events.Event;public class Guard extends Event {public function Guard(){super("g");}}}';
reject(guardSource,{'flash.events.Event':{module:eventModule,exportName:'Event'}});
reject(guardSource,{'flash.events.Event':{module:eventModule,exportName:'Event',nativeBase:'Date'}});
reject('package {import flash.display.Sprite;public class Guard extends Sprite {public function Guard(){super();}}}',{'flash.display.Sprite':{module:provider('AS3GeneratedSpriteConstruction'),exportName:'Sprite',nativeBase:'Sprite'}});
reject(guardSource,{'flash.events.Event':{module:eventModule,exportName:'Fake',nativeBase:'Event'}});
reject(guardSource,{'other.Event':{module:eventModule,exportName:'Event',nativeBase:'Event'}});
for(const body of [
 'public function Guard(){}',
 'public function Guard(){super("g");super("g");}',
 'public function Guard(){if(true)super("g");}',
 'public function Guard(){super("g");} public var type:String;',
 'public function Guard(){super("g");} override public function stopPropagation():void{}',
 'public function Guard(){super("g");} public function inspect():*{return super.toString();}'
])reject('package {import flash.events.Event;public class Guard extends Event {'+body+'}}');
if(withReferences){
 reject('package {import flash.events.Event;public class Guard extends Event {public function Guard(){super("g");} public function cast():*{return this as Event;}}}');
 reject('package {import flash.events.Event;public class Guard {public function test(value:*):*{return value is Event;}}}');
}
// Verify every admitted inherited trait against the independently pinned AIR tree.
const projection=new (require('../../lib/emit/native-generated-traits').NativeGeneratedClassTraits)(plan,plan.scope,'declcases.ShadowEvent',sources['declcases.ShadowEvent'].source);
const nativeTraits=canonical.find(r=>r.id==='instance-reflection').value.children.filter(n=>['method','accessor'].includes(n.tag));
assert.equal(projection.instanceTraits.length,nativeTraits.length);
for(const node of nativeTraits){
 const trait=projection.instanceTraits.find(t=>t.name===node.attributes.name);
 assert.equal(trait.kind,node.tag);if(node.tag==='accessor')assert.equal(trait.type,node.attributes.type);
 else assert.equal(projection.metadata.instance.methods.find(m=>m.name===trait.name).parameterCount,node.children.filter(c=>c.tag==='parameter').length);
}
fs.writeFileSync(path.join(run,'domain.ts'),plan.moduleSource);
const emitted=[];
for(const binding of plan.bindings) {
  const source=sources[binding.qname].source;
  const output=emit(parse(binding.qname+'.as',source),source,options);
  assert.match(output,/\.invokeNativeConstructor\(this,/,'native source constructors use the allocation shell');
  const file=path.join(run,binding.qname.split('.').pop()+'.ts');fs.writeFileSync(file,output);emitted.push({file,sourceSha256:hash(source),generatedSha256:hash(output)});
}
const driver=fs.readFileSync(path.join(__dirname,'driver.txt'),'utf8').replaceAll('@NATIVE_CLASS@',helpers.nativeClass).replaceAll('@EVENT@',eventModule).replaceAll('@PROPERTY@',provider('AS3Property')).replaceAll('@METADATA@',provider('FlashTypeMetadata')).replaceAll('@TYPE@',provider('AS3Type'));
fs.writeFileSync(path.join(run,'driver.ts'),driver);
const files=fs.readdirSync(run).filter(f=>f.endsWith('.ts')).map(f=>path.join(run,f));
const program=modern.createProgram(files,{target:modern.ScriptTarget.ES2020,module:modern.ModuleKind.CommonJS,strict:true,strictNullChecks:false,experimentalDecorators:true,noEmit:true,skipLibCheck:true,types:[],lib:['lib.es2020.d.ts','lib.dom.d.ts']});
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
 fs.writeFileSync(path.join(run,'report.json'),JSON.stringify({withReferences,guards,emitted,results,typecheck:{files:program.getSourceFiles().length,diagnostics},held:['other native generated returns, native super methods, broad native base admission']},null,2));
 console.log('Generated Event subclasses (references='+withReferences+'): '+guards+' guards; 12 AIR rows in Node/Chromium, ES5/ES2015; exact 4 source classes. '+run);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
