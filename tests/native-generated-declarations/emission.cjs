const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const api=require('../../lib'),parse=require('../../lib/parse'),emit=require('../../lib/emit'),ts=require('typescript');
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2');
const modern=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const evidence=path.join(engine,'tests/nativeFlashOracle/generated-declaration-storage');
const expected=require(path.join(evidence,'verify.cjs'));
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const root=path.resolve('.cache/native-generated-emission');fs.mkdirSync(root,{recursive:true});const run=fs.mkdtempSync(path.join(root,'run-'));
const modulePath=file=>{let relative=path.relative(run,file).replace(/\\/g,'/').replace(/\.ts$/,'');return relative.startsWith('.')?relative:'./'+relative;};
const provider=name=>modulePath(path.join(engine,'src/layaAir/flash/utils',name+'.ts'));
const sources=Object.fromEntries(fs.readdirSync(path.join(evidence,'source/declcases')).map(file=>{
  const source=fs.readFileSync(path.join(evidence,'source/declcases',file),'utf8');return ['declcases.'+file.slice(0,-3),{source,sourceSha256:hash(source),referenceOnly:['ShadowEvent.as','StorageProbe.as'].includes(file)}];
}));
const plan=api.createNativeGeneratedDeclarationPlan({scope:'air-storage-emission',providerModule:provider('AS3GeneratedClass'),sources});
const importModules=Object.fromEntries(Object.keys(sources).map(name=>[name,'./'+name.split('.').pop()]));
const helpers=Object.fromEntries(['bound','classBound','nativeClass','callableClass'].map(name=>[name,modulePath(path.resolve('utils',name+'.ts'))]));
const options={customVisitors:[],importModules,definitionsByNamespace:{declcases:Object.keys(sources).map(name=>name.split('.').pop())},
  decoratorModules:{bound:helpers.bound,classBound:helpers.classBound},
  nativeGeneratedDeclarations:{plan,module:'./domain'},nativeClassTraitsModule:provider('AS3GeneratedClass'),
  nativeClassHelperModules:{nativeClass:helpers.nativeClass,callableClass:helpers.callableClass},
  nativeLexicalMembersModule:provider('AS3LexicalMembers'),nativeGeneratedPropertyModule:provider('AS3Property'),
  nativeCallableMethodBindingModule:provider('AS3MethodBinding'),nativeCallableCoercionModule:provider('AS3Coercion'),
  nativeCallableStringModule:provider('AS3String')};
let guards=0;
const baseSource=sources['declcases.BaseRecord'].source;
const reject=(source,settings,label)=>{assert.throws(()=>emit(parse('Guard.as',source),source,settings),/AS3_[A-Z_]+(?:UNSUPPORTED|MODULES)/,label);guards++;};
for(const mutate of [
 o=>o.nativeGeneratedDeclarations={...o.nativeGeneratedDeclarations,plan:JSON.parse(JSON.stringify(plan))},
 o=>o.nativeGeneratedDeclarations={...o.nativeGeneratedDeclarations,module:''},
 o=>delete o.nativeClassTraitsModule,
 o=>delete o.nativeClassHelperModules,
 o=>o.nativeClassHelperModules={nativeClass:'./nativeClass',callableClass:''},
 o=>delete o.nativeCallableMethodBindingModule,
 o=>delete o.nativeLexicalMembersModule,
 o=>delete o.nativeGeneratedPropertyModule,
 o=>o.customVisitors=[{visit(){throw Error('must not execute');}}],
 o=>o.useNamespaces=true,
 o=>o.nativeClassInitialization={classes:{}},
 o=>o.nativeCallableMetadata={}
]){const changed={...options};mutate(changed);reject(baseSource,changed);}
reject(baseSource+' ',options,'source-byte mismatch');
reject(sources['declcases.StorageProbe'].source,options,'reference-only publication');
for(const body of [
 'public static const value:int=make();public static function make():*{return 1;}',
 'private static var value:int;',
 'internal var value:int;',
 'private function get value():int { return 0; }',
 'private var value:int; public function run():void { value++; }',
 'private var value:int; public function run():void { value+=1; }',
 'private var value:int; public function run():void { delete value; }',
 'public function run(n:int=NaN):void {}',
 'public function run(...values):void {}',
 'public function run():int { try { return 0; } finally {} }',
 'public function run():Vector.<int> { return null; }',
 'public function Subject(value:Vector.<int>) {}',
 'public function run():void { var value:int; }',
 'public function run():void { var value:Vector.<int>; }',
 'public function run():void { var value:* = function():void {}; }',
 'public function run():void { trace(arguments); }',
 'override protected function run():void {}'
]){
 const source='package guard { public class Subject { '+body+' } }';
 const p=api.createNativeGeneratedDeclarationPlan({scope:'guard',providerModule:provider('AS3GeneratedClass'),sources:{'guard.Subject':{source,sourceSha256:hash(source)}}});
 reject(source,{...options,nativeGeneratedDeclarations:{plan:p,module:'./guard-domain'}},body);
}
for(const override of ['protected function run(v:String):void {}','override protected function run(v:int):void {}']){
 const base='package guard { public class Parent { protected function run(v:String):void {} } }';
 const child='package guard { public class Subject extends Parent { '+override+' } }';
 const p=api.createNativeGeneratedDeclarationPlan({scope:'guard',providerModule:provider('AS3GeneratedClass'),sources:Object.fromEntries([['guard.Parent',base],['guard.Subject',child]].map(([name,source])=>[name,{source,sourceSha256:hash(source)}]))});
 reject(child,{...options,nativeGeneratedDeclarations:{plan:p,module:'./guard-domain'}},override);
}
const mutatedAST=parse('Wrong.as','package wrong { public class Wrong {} }');
assert.equal(emit(mutatedAST,baseSource,options),emit(parse('Right.as',baseSource),baseSource,options));guards++;
{
 const source='package guard { public dynamic class Subject {} }';
 const p=api.createNativeGeneratedDeclarationPlan({scope:'guard',providerModule:provider('AS3GeneratedClass'),sources:{'guard.Subject':{source,sourceSha256:hash(source)}}});
 reject(source,{...options,nativeGeneratedDeclarations:{plan:p,module:'./guard-domain'}},'dynamic storage routing');
}
fs.writeFileSync(path.join(run,'domain.ts'),plan.moduleSource);
const emitted=[];
for(const binding of plan.bindings) {
  const source=sources[binding.qname].source;
  const output=emit(parse(binding.qname+'.as',source),source,options);
  const file=path.join(run,binding.qname.split('.').pop()+'.ts');fs.writeFileSync(file,output);emitted.push({file,sourceSha256:hash(source),generatedSha256:hash(output)});
}
const driver=`
import {BaseRecord as BaseBinding} from './BaseRecord';
import {DerivedRecord as DerivedBinding} from './DerivedRecord';
import {Storage as StorageBinding} from './Storage';
import {TimingDerived as TimingBinding} from './TimingDerived';
import {readNativeClass} from ${JSON.stringify(helpers.nativeClass)};
import {as3Is} from ${JSON.stringify(provider('AS3Type'))};
import * as domain from './domain';
export function run() {
 const BaseRecord=readNativeClass(BaseBinding),DerivedRecord=readNativeClass(DerivedBinding),Storage=readNativeClass(StorageBinding),TimingDerived=readNativeClass(TimingBinding);
 const rows:any[]=[],row=(id:string,value:any)=>rows.push({id,value});
 const s:any=new Storage(),b=new BaseRecord(),d=new DerivedRecord();
 row('defaults',[s.signed,s.unsigned,String(s.numeric),s.flag,s.text,s.object,s.array,s.anything===undefined,s.reference,s.accessor,s.calls]);
 row('static-defaults',[Storage.staticReference,Storage.staticInt,String(Storage.staticNumber)]);
 s.reference=b;row('reference-base',s.reference===b);
 s.reference=d;row('reference-derived',[s.reference===d,as3Is(s.reference,domain.${plan.bindings.find(b=>b.qname==='declcases.BaseRecord').tokenExport})]);
 s.reference=undefined;row('reference-undefined',s.reference===null);
 const error=(fn:()=>any)=>{try{fn();return [];}catch(e){return [(e as any).name,(e as any).errorID];}};
 s.reference=b;row('reference-rejection',[error(()=>s.reference={}),s.reference===b]);
 s.accessor=d;row('accessor-derived',[s.accessor===d,s.calls]);
 row('accessor-rejection',[error(()=>s.accessor={}),s.accessor===d,s.calls]);
 s.accessor=undefined;row('accessor-undefined',[s.accessor===null,s.calls]);
 Storage.staticReference=d;row('static-reference-derived',Storage.staticReference===d);
 row('static-reference-rejection',[error(()=>Storage.staticReference={} as any),Storage.staticReference===d]);
 Storage.staticReference=undefined as any;row('static-reference-undefined',Storage.staticReference===null);
 row('constructor-order',new TimingDerived().observations);
 if('saved' in s||'inspect' in TimingDerived.prototype)throw Error('Lexical source names leaked');
 if(as3Is(Object.create(DerivedRecord.prototype),domain.${plan.bindings.find(b=>b.qname==='declcases.DerivedRecord').tokenExport}))throw Error('Forged instance admitted');
 return rows;
}
`;
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
   const wanted=expected.filter(row=>!['static-shadow','shadow-reflection-constants'].includes(row.id));
   assert.deepEqual(actual,wanted);assert.deepEqual(browserRows,wanted);
   results.push({target,node:actual,browser:browserRows,inputs:Object.keys(bundle.metafile.inputs).map(file=>({file,sha256:hash(fs.readFileSync(file))}))});
 }}finally{await browser.close();}
 fs.writeFileSync(path.join(run,'report.json'),JSON.stringify({guards,emitted,results,typecheck:{files:program.getSourceFiles().length,diagnostics},held:['static-shadow: native Event inheritance/Class metadata','shadow-reflection-constants: complete source reflection']},null,2));
 console.log('Generated class emission: '+guards+' guards; 13 AIR rows in Node/Chromium, ES5/ES2015; exact 5 source classes. '+run);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
