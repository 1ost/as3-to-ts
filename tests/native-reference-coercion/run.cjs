const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const api=require('../../lib'),parse=require('../../lib/parse'),emit=require('../../lib/emit'),ts=require('typescript');
const classes=require('../../lib/emit/classlist').default;
const engine=path.resolve('../LayaAir-op2'),evidence=path.join(engine,'tests/nativeFlashOracle/reference-enumeration-restored');
const expected=require(path.join(evidence,'verify.cjs')),hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const modern=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const base=path.resolve('.cache/native-reference-coercion');fs.mkdirSync(base,{recursive:true});const run=fs.mkdtempSync(path.join(base,'run-'));
const modulePath=file=>{const relative=path.relative(run,file).replaceAll('\\','/').replace(/\.ts$/,'');return relative.startsWith('.')?relative:'./'+relative;};
const provider=name=>modulePath(path.join(engine,'src/layaAir/flash/utils',name+'.ts'));
const helpers=Object.fromEntries(['bound','classBound','nativeClass','callableClass'].map(name=>[name,modulePath(path.resolve('utils',name+'.ts'))]));
const sources=Object.fromEntries(fs.readdirSync(path.join(evidence,'source')).map(file=>{
 const source=fs.readFileSync(path.join(evidence,'source',file),'utf8');return [file.slice(0,-3),{source,sourceSha256:hash(source),referenceOnly:file.startsWith('Reference')}];
}));
const plan=api.createNativeGeneratedDeclarationPlan({scope:'reference-enumeration',providerModule:provider('AS3GeneratedClass'),sources});
const common={customVisitors:[],definitionsByNamespace:{'':Object.keys(sources)},
 importModules:{...Object.fromEntries(Object.keys(sources).map(name=>[name,'./'+name])),'flash.utils.Dictionary':provider('Dictionary')},
 decoratorModules:{bound:helpers.bound,classBound:helpers.classBound},nativeClassHelperModules:{nativeClass:helpers.nativeClass,callableClass:helpers.callableClass},
 nativeDictionaryPropertyModule:provider('AS3Property'),nativeEnumeration:{dictionaryModule:provider('Dictionary'),coercionModule:provider('AS3Coercion'),stringModule:provider('AS3String')}};
const generated={...common,nativeGeneratedDeclarations:{plan,module:'./domain'},nativeClassTraitsModule:provider('AS3GeneratedClass'),
 nativeLexicalMembersModule:provider('AS3LexicalMembers'),nativeGeneratedPropertyModule:provider('AS3Property'),
 nativeCallableMethodBindingModule:provider('AS3MethodBinding'),nativeCallableCoercionModule:provider('AS3Coercion'),nativeCallableStringModule:provider('AS3String')};
const consumer={...common,nativeSourceErrorModule:modulePath(path.join(engine,'src/layaAir/flash/errors/AS3SourceError.ts')),nativeReferenceCoercion:{plan,module:'./domain',coercionModule:provider('AS3Type')}};
fs.writeFileSync(path.join(run,'domain.ts'),plan.moduleSource);
let guards=0;
const reject=(source,options=consumer)=>{assert.throws(()=>emit(parse('Guard.as',source),source,options),/AS3_[A-Z_]+(?:UNSUPPORTED|MODULES)/);guards++;};
const sample=sources.ReferenceEnumerationProbe.source;
for(const replacement of [null,JSON.parse(JSON.stringify(plan))])reject(sample,{...consumer,nativeReferenceCoercion:{...consumer.nativeReferenceCoercion,plan:replacement}});
reject(sample+' ');
reject(sample,{...consumer,nativeReferenceCoercion:{...consumer.nativeReferenceCoercion,module:''}});
reject(sample,{...consumer,nativeReferenceCoercion:{...consumer.nativeReferenceCoercion,coercionModule:''}});
reject(sample,{...consumer,nativeClassHelperModules:undefined});
reject(sample,{...consumer,nativeSourceErrorModule:undefined});
reject(sample,{...consumer,customVisitors:[{visit(){throw Error('must not run');}}]});
reject(sample,{...consumer,useNamespaces:true});
for(const body of [
 'public var item:EnumValue;',
 'public function f(item:EnumValue):void {}',
 'public function f():EnumValue {return null;}',
 'public function f():void {var item:EnumValue; item++;}',
 'public function f():void {var item:EnumValue; (item)++;}',
 'public function f():void {var item:EnumValue; item+=1;}',
 'public function f():void {var item:EnumValue; delete item;}',
 'public function f():void {var item:EnumValue; var item:EnumValue;}',
 'public function f():void {const item:EnumValue=null;}',
 'public function f():void {var item:* = EnumValue;}',
 'public function f():void {var item:* = null as EnumValue;}',
 'public function f():void {var item:* = null is EnumValue;}',
 'public function f():void {var callback:Function=function():void {var item:EnumValue;};}',
 'public function f():void {try{}catch(e:TypeError){}}',
 'public function f():void {try{}catch(e:Error){}catch(other:*){}}',
])reject('package {public class Guard {'+body+'}}');
const externalPlan=api.createNativeGeneratedDeclarationPlan({scope:plan.scope,providerModule:provider('AS3GeneratedClass'),sources:Object.fromEntries(Object.entries(sources).filter(([,record])=>!record.referenceOnly))});
assert.equal(externalPlan.moduleSource,plan.moduleSource);guards++;
assert.equal(emit(parse('Probe.as',sample),sample,{...consumer,nativeReferenceCoercion:{...consumer.nativeReferenceCoercion,plan:externalPlan}}),emit(parse('Probe.as',sample),sample,consumer));guards++;
assert.equal(emit(parse('Wrong.as','package {public class Wrong{}}'),sample,consumer),emit(parse('Probe.as',sample),sample,consumer));guards++;
const emitted=[];
for(const [name,record] of Object.entries(sources)){
 classes.classList=[];classes.currentClassRecord=undefined;classes.isScanning=true;
 const output=emit(parse(name+'.as',record.source),record.source,record.referenceOnly?consumer:generated);
 fs.writeFileSync(path.join(run,name+'.ts'),output);emitted.push({name,sourceSha256:record.sourceSha256,generatedSha256:hash(output)});
}
const driver=`import {ReferenceEnumerationProbe} from './ReferenceEnumerationProbe';
import {ReferenceHeaderProbe} from './ReferenceHeaderProbe';
export function run(){const p=new ReferenceEnumerationProbe();return {enumeration:${JSON.stringify(expected.enumeration.map(row=>row.id))}.map((id,mode)=>{p.exercise(mode);return {id,result:p.result};}),header:new ReferenceHeaderProbe().snapshot().observations};}`;
fs.writeFileSync(path.join(run,'driver.ts'),driver);
const files=fs.readdirSync(run).filter(name=>name.endsWith('.ts')).map(name=>path.join(run,name));
const program=modern.createProgram(files,{module:modern.ModuleKind.CommonJS,target:modern.ScriptTarget.ES2020,strict:true,strictNullChecks:false,
 experimentalDecorators:true,skipLibCheck:true,noEmit:true,lib:['lib.es2020.d.ts','lib.dom.d.ts']});
const diagnostics=modern.getPreEmitDiagnostics(program).map(d=>({file:d.file&&path.relative(run,d.file.fileName),code:d.code,text:modern.flattenDiagnosticMessageText(d.messageText,'\n')}));
fs.writeFileSync(path.join(run,'types.json'),JSON.stringify(diagnostics,null,2));assert.deepEqual(diagnostics,[]);
async function main(){
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||require.resolve('playwright',{paths:[path.resolve('../op2-html5/game-client-laya'),engine]}));
 const browser=await chromium.launch({headless:true}),results=[];
 try{for(const target of [ts.ScriptTarget.ES5,ts.ScriptTarget.ES2015]){
  const directory=path.join(run,'target-'+target);fs.mkdirSync(directory);
  for(const file of files){
   const built=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target,module:ts.ModuleKind.CommonJS,experimentalDecorators:true,downlevelIteration:true},reportDiagnostics:true});
   assert.deepEqual(built.diagnostics,[]);
   const output=built.outputText.replace(/require\("(\.\.\/[^"\n]+)"\)/g,(_,name)=>'require('+JSON.stringify('../'+name)+')');
   fs.writeFileSync(path.join(directory,path.basename(file,'.ts')+'.js'),output);
  }
  const bundled=esbuild.buildSync({entryPoints:[path.join(directory,'driver.js')],bundle:true,write:false,metafile:true,format:'iife',globalName:'referenceOracle',platform:'browser',target:'es2020'});
  const script=bundled.outputFiles[0].text;fs.writeFileSync(path.join(directory,'bundle.js'),script);
  const node=new Function(script+';return referenceOracle.run();')();
  fs.writeFileSync(path.join(directory,'node.json'),JSON.stringify(node,null,2));assert.deepEqual(node,expected);
  const page=await browser.newPage();await page.addScriptTag({content:script});const browserRows=await page.evaluate(()=>referenceOracle.run());await page.close();
  assert.deepEqual(browserRows,expected);results.push({target,node,browser:browserRows,inputs:Object.keys(bundled.metafile.inputs).map(file=>({file,sha256:hash(fs.readFileSync(file))}))});
 }}finally{await browser.close();}
 fs.writeFileSync(path.join(run,'report.json'),JSON.stringify({guards,emitted,typecheck:{files:program.getSourceFiles().length,diagnostics},results},null,2));
 console.log('Reference coercion: '+guards+' guards, 24 AIR observations from 4 unchanged sources, Node/Chromium ES5/ES2015. '+run);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
