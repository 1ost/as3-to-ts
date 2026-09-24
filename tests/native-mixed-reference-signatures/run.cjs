const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const api=require('../../lib'),parse=require('../../lib/parse'),emit=require('../../lib/emit'),ts=require('typescript');
const engine=path.resolve('../LayaAir-op2'),evidence=path.join(engine,'tests/nativeFlashOracle/mixed-reference-signatures');
const expected={objects:require(path.join(engine,'tests/nativeFlashOracle/object-reference-signatures/verify.cjs')),mixed:require(path.join(evidence,'verify.cjs')),zip:require(path.join(engine,'tests/nativeFlashOracle/date-zip-prerequisite/verify.cjs')),throws:require(path.join(engine,'tests/nativeFlashOracle/reference-signature-throws/verify.cjs'))},hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const modern=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const base=path.resolve('.cache/native-mixed-reference-signatures');fs.mkdirSync(base,{recursive:true});const run=fs.mkdtempSync(path.join(base,'run-'));
const modulePath=file=>{const relative=path.relative(run,file).replaceAll('\\','/').replace(/\.ts$/,'');return relative.startsWith('.')?relative:'./'+relative;};
const provider=name=>modulePath(path.join(engine,'src/layaAir/flash/utils',name+'.ts'));
const helpers=Object.fromEntries(['bound','classBound','nativeClass','callableClass'].map(name=>[name,modulePath(path.resolve('utils',name+'.ts'))]));
const source=fs.readFileSync(path.join(evidence,'source/MixedReferenceSignaturesProbe.as'),'utf8');
const zipSource=fs.readFileSync(path.join(engine,'tests/nativeFlashOracle/date-zip-prerequisite/source/DateZipProbe.as'),'utf8');
const sources={MixedReferenceSignaturesProbe:{source,sourceSha256:hash(source),referenceOnly:true},DateZipProbe:{source:zipSource,sourceSha256:hash(zipSource),referenceOnly:true}};
const throwSource=fs.readFileSync(path.join(engine,'tests/nativeFlashOracle/reference-signature-throws/source/ReferenceSignatureThrowsProbe.as'),'utf8');
sources.ReferenceSignatureThrowsProbe={source:throwSource,sourceSha256:hash(throwSource),referenceOnly:true};
const objectSource=fs.readFileSync(path.join(engine,'tests/nativeFlashOracle/object-reference-signatures/source/ObjectReferenceSignaturesProbe.as'),'utf8');
sources.ObjectReferenceSignaturesProbe={source:objectSource,sourceSha256:hash(objectSource),referenceOnly:true};
const plan=api.createNativeGeneratedDeclarationPlan({scope:'reference-signatures',providerModule:provider('AS3GeneratedClass'),sources,providers:{Date:{module:provider('AS3Date'),exportName:'AS3Date'}}});
const options={nativeSignaturePropertyModule:provider('AS3Property'),customVisitors:[],definitionsByNamespace:{'':['MixedReferenceSignaturesProbe']},decoratorModules:{bound:helpers.bound,classBound:helpers.classBound},nativeClassHelperModules:{nativeClass:helpers.nativeClass,callableClass:helpers.callableClass},nativeGlobalModules:{Date:provider('AS3Date')},nativeComputedTypeTestModule:provider('AS3Type'),nativeNumericMethodParametersModule:provider('AS3Coercion'),nativeSourceErrorModule:modulePath(path.join(engine,'src/layaAir/flash/errors/AS3SourceError.ts')),nativeReferenceCoercion:{plan,module:'./domain',coercionModule:provider('AS3Type')}};
fs.writeFileSync(path.join(run,'domain.ts'),plan.moduleSource);
const output=emit(parse('MixedReferenceSignaturesProbe.as',source),source,options);
fs.writeFileSync(path.join(run,'MixedReferenceSignaturesProbe.ts'),output);
const zipOutput=emit(parse('DateZipProbe.as',zipSource),zipSource,options);fs.writeFileSync(path.join(run,'DateZipProbe.ts'),zipOutput);
const emitted=[{name:'MixedReferenceSignaturesProbe',sourceSha256:hash(source),generatedSha256:hash(output)},{name:'DateZipProbe',sourceSha256:hash(zipSource),generatedSha256:hash(zipOutput)}];
const throwOutput=emit(parse('ReferenceSignatureThrowsProbe.as',throwSource),throwSource,options);fs.writeFileSync(path.join(run,'ReferenceSignatureThrowsProbe.ts'),throwOutput);emitted.push({name:'ReferenceSignatureThrowsProbe',sourceSha256:hash(throwSource),generatedSha256:hash(throwOutput)});
const objectOutput=emit(parse('ObjectReferenceSignaturesProbe.as',objectSource),objectSource,options);fs.writeFileSync(path.join(run,'ObjectReferenceSignaturesProbe.ts'),objectOutput);emitted.push({name:'ObjectReferenceSignaturesProbe',sourceSha256:hash(objectSource),generatedSha256:hash(objectOutput)});
let guards=0;
const reject=(body,config=options)=>{
 const s='package {public class Guard {'+body+'}}';
 assert.throws(()=>emit(parse('Guard.as',s),s,config),/AS3_REFERENCE_COERCION_UNSUPPORTED/);guards++;
};
for(const body of [
 'public function Guard(value:Date) {}',
 'public function get value():Date {return null;}',
 'public function f(value:Date,...rest):Date {return value;}',
 'public function f(value:Date,other:Function):Date {return value;}',
 'public function f(value:Date=undefined):Date {return value;}',
 'public function f(value:Date):Date {return;}',
 'public function f(value:Date):Date {var a:*=arguments;return value;}',
 'public function f(value:Date):Date {arguments.length=0;return value;}',
 'public function f(value:Date):Date {arguments.push(1);return value;}',
 'public function f(arguments:Date):Date {return arguments;}',
 'public function f(value:Date):Date {arguments[1]=null;return value;}',
 'public function f(value:Date=null):Date {arguments[0]=null;return value;}',
 'public function f(value:Date):Date {arguments[0]++;return value;}',
 'public function f(value:Date):Date {delete arguments[0];return value;}',
 'public function f(value:Date):Date {arguments["push"](1);return value;}',
 'public function f(value:Date):Date {(arguments.length)=0;return value;}',
 'public function f(value:Date):Date {(arguments[1])=null;return value;}',
 'public function f(value:Date):Date {delete (arguments[0]);return value;}',
 'public function f(value:Date):Date {try{}catch(arguments:Error){}return value;}',
 'public function f(value:Date,text:String=undefined):String {return text;}',
])reject(body);
reject('public function f(value:Date,n:Number):Date {return value;}',{...options,nativeNumericMethodParametersModule:undefined});
reject('public function f(value:*):Date {return value;}',{...options,nativeGlobalModules:{}});
reject('public function f(value:Date):String {return null;}',{...options,nativeSignaturePropertyModule:undefined});
reject('public function f(value:Date,other:Object):Date {return value;}',{...options,nativeSignaturePropertyModule:undefined});
reject('public function f(value:Date,other:Object=7):Date {return value;}');
reject('public function f(value:Date,other:Object=undefined):Date {return value;}');
reject('public function f(value:Date,other:Object):Date {other++;return value;}');
reject('public function f(value:Date,other:Object):Date {other+=1;return value;}');
for(const module of ['',"bad\nmodule"]){reject('public function f(value:Date):String {return null;}',{...options,nativeSignaturePropertyModule:module});}
const auxiliary='package {public class SignatureShadow {public function array(value:Date,Array:*):Array {return Array;} public function string(value:Date,s:String="'+String.fromCharCode(0x2028)+'"):String {return s;}}}';
const auxiliaryOutput=emit(parse('SignatureShadow.as',auxiliary),auxiliary,options);assert.ok(!auxiliaryOutput.includes(String.fromCharCode(0x2028)));guards++;
fs.writeFileSync(path.join(run,'SignatureShadow.ts'),auxiliaryOutput);
fs.writeFileSync(path.join(run,'driver.ts'),"import {ObjectReferenceSignaturesProbe} from './ObjectReferenceSignaturesProbe';\nimport {ReferenceSignatureThrowsProbe} from './ReferenceSignatureThrowsProbe';\nimport {SignatureShadow} from './SignatureShadow';\nimport {MixedReferenceSignaturesProbe} from './MixedReferenceSignaturesProbe';\nimport {DateZipProbe} from './DateZipProbe';\nexport function run(){const shadow=new SignatureShadow(),array=[1];if(shadow.array(null,array)!==array||shadow.string(null)!==String.fromCharCode(0x2028)||shadow.string(null,undefined)!==null)throw Error('Signature shadow/default regression');return JSON.parse(JSON.stringify({objects:new ObjectReferenceSignaturesProbe().snapshot().observations,mixed:new MixedReferenceSignaturesProbe().snapshot().observations,zip:new DateZipProbe().snapshot().observations,throws:new ReferenceSignatureThrowsProbe().snapshot().observations}));}\n");
const files=fs.readdirSync(run).filter(name=>name.endsWith('.ts')).map(name=>path.join(run,name));
const program=modern.createProgram(files,{module:modern.ModuleKind.CommonJS,target:modern.ScriptTarget.ES2020,strict:true,strictNullChecks:false,
 experimentalDecorators:true,skipLibCheck:true,noEmit:true,lib:['lib.es2020.d.ts','lib.dom.d.ts']});
const diagnostics=modern.getPreEmitDiagnostics(program).map(d=>({file:d.file&&path.relative(run,d.file.fileName),code:d.code,text:modern.flattenDiagnosticMessageText(d.messageText,'\n')}));
fs.writeFileSync(path.join(run,'types.json'),JSON.stringify(diagnostics,null,2));assert.deepEqual(diagnostics,[{file:'ReferenceSignatureThrowsProbe.ts',code:2739,text:"Type '{}' is missing the following properties from type 'Error': name, message"}]);
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
 console.log('Mixed reference signatures: '+guards+' guards, 69 AIR observations from four unchanged sources, Node/Chromium ES5/ES2015. '+run);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
