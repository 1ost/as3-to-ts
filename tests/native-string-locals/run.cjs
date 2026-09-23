const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const api=require('../../lib'),parse=require('../../lib/parse'),emit=require('../../lib/emit'),ts=require('typescript');
const engine=path.resolve('../LayaAir-op2'),evidence=path.join(engine,'tests/nativeFlashOracle/string-local-coercion');
const extra=path.join(engine,'tests/nativeFlashOracle/string-local-expressions');
const expected=require(path.join(evidence,'verify.cjs')).concat(require(path.join(extra,'verify.cjs'))),hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const modern=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const base=path.resolve('.cache/native-string-locals');fs.mkdirSync(base,{recursive:true});const run=fs.mkdtempSync(path.join(base,'run-'));
const modulePath=file=>{const relative=path.relative(run,file).replaceAll('\\','/').replace(/\.ts$/,'');return relative.startsWith('.')?relative:'./'+relative;};
const provider=name=>modulePath(path.join(engine,'src/layaAir/flash/utils',name+'.ts'));
const helpers=Object.fromEntries(['bound','classBound','nativeClass','callableClass'].map(name=>[name,modulePath(path.resolve('utils',name+'.ts'))]));
const source=fs.readFileSync(path.join(evidence,'source/StringLocalCoercionProbe.as'),'utf8');
const sources={StringLocalCoercionProbe:{source,sourceSha256:hash(source),referenceOnly:true}};
const extraSource=fs.readFileSync(path.join(extra,'source/StringLocalExpressionsProbe.as'),'utf8');
sources.StringLocalExpressionsProbe={source:extraSource,sourceSha256:hash(extraSource),referenceOnly:true};
const plan=api.createNativeGeneratedDeclarationPlan({scope:'reference-signatures',providerModule:provider('AS3GeneratedClass'),sources,providers:{Date:{module:provider('AS3Date'),exportName:'AS3Date'}}});
const options={nativeStringLocalCoercionModule:provider('AS3String'),customVisitors:[],definitionsByNamespace:{'':['StringLocalCoercionProbe']},decoratorModules:{bound:helpers.bound,classBound:helpers.classBound},nativeClassHelperModules:{nativeClass:helpers.nativeClass,callableClass:helpers.callableClass},nativeGlobalModules:{Date:provider('AS3Date')},nativeComputedTypeTestModule:provider('AS3Type'),nativeNumericMethodParametersModule:provider('AS3Coercion'),nativeSourceErrorModule:modulePath(path.join(engine,'src/layaAir/flash/errors/AS3SourceError.ts')),nativeReferenceCoercion:{plan,module:'./domain',coercionModule:provider('AS3Type')}};
fs.writeFileSync(path.join(run,'domain.ts'),plan.moduleSource);
const output=emit(parse('StringLocalCoercionProbe.as',source),source,options);
fs.writeFileSync(path.join(run,'StringLocalCoercionProbe.ts'),output);
const emitted=[{name:'StringLocalCoercionProbe',sourceSha256:hash(source),generatedSha256:hash(output)}];
const extraOutput=emit(parse('StringLocalExpressionsProbe.as',extraSource),extraSource,options);
fs.writeFileSync(path.join(run,'StringLocalExpressionsProbe.ts'),extraOutput);
emitted.push({name:'StringLocalExpressionsProbe',sourceSha256:hash(extraSource),generatedSha256:hash(extraOutput)});
let guards=0;
const reject=(body,config=options)=>{const text='package {public class Guard {'+body+'}}';assert.throws(()=>emit(parse('Guard.as',text),text,config),/AS3_(?:REFERENCE_COERCION|GENERATED_EMISSION)_UNSUPPORTED/,body);guards++;};
for(const body of [
 'public function f():void {var s:String; s+=1;}',
 'public function f():void {var s:String; s++;}',
 'public function f():void {var s:String; delete s;}',
 'public function f():void {const s:String="x";}',
 'public function f():void {var s:String; var s:*;}',
 'public function f(s:*):void {var s:String;}',
 'public function f():void {try{}catch(s:*){var s:String;}}',
 'public function f():void {var s:String; function g():void {s=null;}}',
])reject(body);
reject('public function f():void {var s:String;}',{...options,nativeReferenceCoercion:undefined});
fs.writeFileSync(path.join(run,'driver.ts'),"import {StringLocalCoercionProbe} from './StringLocalCoercionProbe';\nimport {StringLocalExpressionsProbe} from './StringLocalExpressionsProbe';\nexport function run(){return JSON.parse(JSON.stringify(new StringLocalCoercionProbe().snapshot().observations.concat(new StringLocalExpressionsProbe().snapshot().observations)));}\n");
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
  const bundled=esbuild.buildSync({entryPoints:[path.join(directory,'driver.js')],bundle:true,write:false,metafile:true,format:'iife',globalName:'signatureOracle',platform:'browser',target:'es2020'});
  const script=bundled.outputFiles[0].text;fs.writeFileSync(path.join(directory,'bundle.js'),script);
  const node=new Function(script+';return signatureOracle.run();')();
  fs.writeFileSync(path.join(directory,'node.json'),JSON.stringify(node,null,2));assert.deepEqual(node,expected);
  const page=await browser.newPage();await page.addScriptTag({content:script});const browserRows=await page.evaluate(()=>signatureOracle.run());await page.close();
  assert.deepEqual(browserRows,expected);results.push({target,node,browser:browserRows,inputs:Object.keys(bundled.metafile.inputs).map(file=>({file,sha256:hash(fs.readFileSync(file))}))});
 }}finally{await browser.close();}
 fs.writeFileSync(path.join(run,'report.json'),JSON.stringify({guards,emitted,typecheck:{files:program.getSourceFiles().length,diagnostics},results},null,2));
 console.log('String locals: '+guards+' guards, 21 AIR observations from two unchanged sources, Node/Chromium ES5/ES2015. '+run);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
