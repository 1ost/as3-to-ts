const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const api=require('../../lib'),parse=require('../../lib/parse'),emit=require('../../lib/emit'),ts=require('typescript');
const engine=path.resolve('../LayaAir-op2'),evidence=path.join(engine,'tests/nativeFlashOracle/date-construction');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const capture=JSON.parse(fs.readFileSync(path.join(evidence,'native-air.json')));
const pins=JSON.parse(fs.readFileSync(path.join(engine,'tests/nativeDate/evidence-pin.json')));
assert.equal(hash(fs.readFileSync(path.join(evidence,'native-air.json'))),pins['date-construction']);
for(const packet of Object.values(capture.captures)){assert.equal(packet.receipt.status,'passed');assert.equal(packet.receipt.capture.identical,true);assert.equal(packet.receipt.capture.runs,2);}
const expected={construction:capture.captures.construction.capture.state.observations,epoch:capture.captures.epoch.capture.state.observations.slice(0,9)};
const modern=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const base=path.resolve('.cache/native-date-binding');fs.mkdirSync(base,{recursive:true});const run=fs.mkdtempSync(path.join(base,'run-'));
const modulePath=file=>{const relative=path.relative(run,file).replaceAll('\\','/').replace(/\.ts$/,'');return relative.startsWith('.')?relative:'./'+relative;};
const provider=name=>modulePath(path.join(engine,'src/layaAir/flash/utils',name+'.ts'));
const helpers=Object.fromEntries(['bound','classBound','nativeClass','callableClass'].map(name=>[name,modulePath(path.resolve('utils',name+'.ts'))]));
const sources=Object.fromEntries(Object.entries(capture.sourceFiles).map(([file,sourceSha256])=>{const source=fs.readFileSync(path.join(evidence,file),'utf8');assert.equal(hash(source),sourceSha256);return [file.slice(0,-3),{source,sourceSha256,referenceOnly:true}];}));
const plan=api.createNativeGeneratedDeclarationPlan({scope:'date',providerModule:provider('AS3GeneratedClass'),sources,providers:{Date:{module:provider('AS3Date'),exportName:'AS3Date'}}});
const options={customVisitors:[],definitionsByNamespace:{'':Object.keys(sources)},decoratorModules:{bound:helpers.bound,classBound:helpers.classBound},nativeClassHelperModules:{nativeClass:helpers.nativeClass,callableClass:helpers.callableClass},nativeGlobalModules:{Date:provider('AS3Date')},nativeComputedTypeTestModule:provider('AS3Type'),nativeReferenceCoercion:{plan,module:'./domain',coercionModule:provider('AS3Type')}};
fs.writeFileSync(path.join(run,'domain.ts'),plan.moduleSource);
let guards=0;const emitted=[];
for(const [name,record] of Object.entries(sources)){const output=emit(parse(name+'.as',record.source),record.source,options);fs.writeFileSync(path.join(run,name+'.ts'),output);emitted.push({name,sourceSha256:record.sourceSha256,generatedSha256:hash(output)});}
const reject=(source,config=options)=>{assert.throws(()=>emit(parse('Guard.as',source),source,config),/AS3_[A-Z_]+UNSUPPORTED/);guards++;};
reject(sources.DateConstructionProbe.source,{...options,nativeGlobalModules:{}});
reject(sources.DateConstructionProbe.source,{...options,nativeComputedTypeTestModule:undefined});
reject('package {public class Guard {public function f():* {return Date();}}}');
reject('package {public class Guard {public function f(value:*):* {return value as Date;}}}');
reject('package {public class Guard {public function f(value:*):* {return value as Date;}}}',{...options,nativeReferenceCoercion:undefined});
for(const source of [
 'package {public class Shadow {public function f(Date:*):* {return new Date();}}}',
 'package {import custom.Date; public class Shadow {public function f():* {return new Date();}}}',
 'package custom {public class Date {public function f():* {return new Date();}}}',
]){const result=emit(parse('Shadow.as',source),source,{...options,nativeReferenceCoercion:undefined});assert.ok(!result.includes('__as3_global_Date'));guards++;}
const typeShadow='package {public class Shadow {public function f(Date:*):* {var d:Date=null;return d;}}}';
assert.match(emit(parse('Shadow.as',typeShadow),typeShadow,options),/AS3Date as __as3_global_Date/);guards++;
const identity='package {public class DateIdentityProbe {public function computed(value:*,target:*):Boolean {return value is target.type;} public function match(value:*):Boolean {return value is Date;} public function coerce(value:*):* {var result:Date=value;return result;} public function empty():Boolean {return result===null;var result:Date;}}}';
fs.writeFileSync(path.join(run,'DateIdentityProbe.ts'),emit(parse('DateIdentityProbe.as',identity),identity,options));
const driver=`import {DateConstructionProbe} from './DateConstructionProbe';
import {DateEpochControlsProbe} from './DateEpochControlsProbe';
import {DateIdentityProbe} from './DateIdentityProbe';
import {as3IsSourceErrorInstance} from ${JSON.stringify(modulePath(path.join(engine,'src/layaAir/flash/errors/AS3SourceError.ts')))};
import {AS3Date} from ${JSON.stringify(provider('AS3Date'))};
export function run(){
const identity=new DateIdentityProbe(),date=new AS3Date(0);
if(!identity.computed(date,{type:AS3Date})||!identity.computed(2,{type:Number}))throw Error('Computed type test failed');
if(!identity.match(AS3Date.prototype)||!identity.match(date)||identity.match(new Date())||identity.match(Object.create(AS3Date.prototype)))throw Error('Generated Date nominal test failed');
if(identity.coerce(undefined)!==null||identity.coerce(date)!==date||!identity.empty())throw Error('Generated Date coercion/default failed');
let rejected=false;try{identity.coerce(new Date());}catch(e){rejected=as3IsSourceErrorInstance(e)&&e.errorID===1034;}if(!rejected)throw Error('Host Date was adopted');
const c=new DateConstructionProbe();c.exercise();const e=new DateEpochControlsProbe();return {construction:[{id:'allocation-and-stable-time-relations',result:c.result}],epoch:Array.from({length:9},(_,i)=>{e.exercise(i);return {id:String(i),result:e.result};})};}`;
fs.writeFileSync(path.join(run,'driver.ts'),driver);
const files=fs.readdirSync(run).filter(name=>name.endsWith('.ts')).map(name=>path.join(run,name));
const program=modern.createProgram(files,{module:modern.ModuleKind.CommonJS,target:modern.ScriptTarget.ES2020,strict:true,strictNullChecks:false,
 experimentalDecorators:true,skipLibCheck:true,noEmit:true,lib:['lib.es2020.d.ts','lib.dom.d.ts']});
const diagnostics=modern.getPreEmitDiagnostics(program).map(d=>({file:d.file&&path.relative(run,d.file.fileName),code:d.code,text:modern.flattenDiagnosticMessageText(d.messageText,'\n')}));
fs.writeFileSync(path.join(run,'types.json'),JSON.stringify(diagnostics,null,2));assert.deepEqual(diagnostics,[{file:'DateEpochControlsProbe.ts',code:2345,text:"Argument of type 'string' is not assignable to parameter of type 'number'."}]);
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
  const bundled=esbuild.buildSync({entryPoints:[path.join(directory,'driver.js')],bundle:true,write:false,metafile:true,format:'iife',globalName:'dateOracle',platform:'browser',target:'es2020'});
  const script=bundled.outputFiles[0].text;fs.writeFileSync(path.join(directory,'bundle.js'),script);
  const node=new Function(script+';return dateOracle.run();')();
  fs.writeFileSync(path.join(directory,'node.json'),JSON.stringify(node,null,2));assert.deepEqual(node,expected);
  const page=await browser.newPage();await page.addScriptTag({content:script});const browserRows=await page.evaluate(()=>dateOracle.run());await page.close();
  assert.deepEqual(browserRows,expected);results.push({target,node,browser:browserRows,inputs:Object.keys(bundled.metafile.inputs).map(file=>({file,sha256:hash(fs.readFileSync(file))}))});
 }}finally{await browser.close();}
 fs.writeFileSync(path.join(run,'report.json'),JSON.stringify({guards,emitted,typecheck:{files:program.getSourceFiles().length,diagnostics},results},null,2));
 console.log('Date binding: '+guards+' guards, 10 AIR observations from 2 unchanged sources, Node/Chromium ES5/ES2015. '+run);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
