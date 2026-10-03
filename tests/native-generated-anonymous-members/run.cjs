'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm');
const {compile,engine,root,frozen,sources,hash}=require('./compile.cjs');
const ts=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const receipt=JSON.parse(frozen('evidence/receipt.json'));
const captures=[1,2].map(n=>{const file='run-'+n+'/capture.json',bytes=frozen('evidence/'+file);assert.equal(hash(bytes),receipt.artifacts[file]);return JSON.parse(bytes);});
const expected=captures[0].state.observations;
assert.deepEqual(captures[0],captures[1]);assert.equal(expected.length,7);
const numeric=path.join(__dirname,'numeric-oracle/evidence'),numericReceipt=JSON.parse(fs.readFileSync(path.join(numeric,'receipt.json')));
for(const [file,sha]of Object.entries(numericReceipt.artifacts))assert.equal(hash(fs.readFileSync(path.join(numeric,file))),sha,file);
const numericCaptures=[1,2].map(n=>JSON.parse(fs.readFileSync(path.join(numeric,'run-'+n+'/capture.json'))));assert.deepEqual(numericCaptures[0],numericCaptures[1]);expected.push(...numericCaptures[0].state.observations);
const numericSource=fs.readFileSync(path.join(numeric,'source/cases/NumericClosure.as'),'utf8'),selectedSources={...sources,'cases.NumericClosure':{source:numericSource,sourceSha256:hash(numericSource)}};
function observer(flash){return `import {ApplicationDomain} from '${flash}/system/ApplicationDomain';
import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '${flash}/utils/NativeSourceClassLoadingSession';
export async function run(module:NativeSourceClassModule){
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});
 const loaded=await session.load('anonymous-members',new ApplicationDomain(ApplicationDomain.currentDomain));
 const Subject:any=loaded.getDefinition('cases.MemberClosure');
 const rows:any[]=[],first=new Subject(),second=new Subject();
 const a=first.begin('alpha'),b=second.begin('beta');
 rows.push({id:'pending',value:[first.state(),second.state()]});
 const foreign={_pending:77,_loading:'foreign',_calls:88};a.call(foreign);
 const original=first.value('alpha');
 rows.push({id:'foreign-call',value:[first.state(),second.state(),foreign._pending,foreign._loading,foreign._calls,original.name]});
 b.apply(null,[]);rows.push({id:'second-owner',value:[first.state(),second.state(),second.value('beta').name]});
 a();rows.push({id:'repeat-retains-value',value:[first.value('alpha')===original,first.state()]});
 const failure=first.begin('');failure.call(second);rows.push({id:'caught-error',value:[first.state(),second.state()]});
 const newer=first.begin('gamma');a.call(second);newer();rows.push({id:'old-and-new-captures',value:[first.state(),first.value('alpha')===original,first.value('gamma').name,second.state()]});
 const cleared=second.begin(null);cleared();rows.push({id:'null-name-error',value:second.state()});
 const Numeric:any=loaded.getDefinition('cases.NumericClosure'),numeric=new Numeric();
 [4294967297,-1.5,undefined,'7'].forEach((value,index)=>rows.push({id:'numeric-'+index,value:numeric.make(value)()}));
 session.retire();return rows;
}`;}
async function main(){
 const cache=path.join(root,'.cache/native-generated-anonymous-members');fs.mkdirSync(cache,{recursive:true});const out=fs.mkdtempSync(path.join(cache,'full-'));
 const {chromium}=require(require.resolve('playwright',{paths:[path.join(engine,'../op2-html5/game-client-laya'),engine]})),browser=await chromium.launch({headless:true});
 const runs=[];
 try{for(const target of ['ES5','ES2015']){
  const dir=path.join(out,target),{artifact,files,config}=compile(dir,target,selectedSources);
  const guards=require('./guards.cjs')(path.join(dir,'guards'),target,config);
  assert.deepEqual({...artifact.sourceHashes},Object.fromEntries(Object.entries(selectedSources).map(([q,s])=>[q,s.sourceSha256])));
  const flash=path.relative(dir,path.join(engine,'src/layaAir/flash')).replaceAll('\\','/');
  const host=path.join(dir,'observer.ts');fs.writeFileSync(host,observer(flash));files.push(host);
  const program=ts.createProgram(files,{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,strict:true,strictNullChecks:false,useUnknownInCatchVariables:false,experimentalDecorators:true,noEmit:true,skipLibCheck:true,lib:['lib.es2020.d.ts','lib.dom.d.ts']});
  const diagnostics=ts.getPreEmitDiagnostics(program).map(d=>({file:d.file?.fileName,code:d.code,text:ts.flattenDiagnosticMessageText(d.messageText,'\n')}));fs.writeFileSync(path.join(dir,'types.json'),JSON.stringify(diagnostics,null,2));assert.deepEqual(diagnostics,[]);
  const entry=path.join(dir,'entry.ts');fs.writeFileSync(entry,"import {run} from './observer';import {nativeSourceClassModule} from './factory.js';globalThis.completion=run(nativeSourceClassModule).then(rows=>globalThis.rows=rows).catch(error=>globalThis.failure=String(error.stack));");
  const build=()=>esbuild.build({entryPoints:[entry],bundle:true,write:false,format:'iife',platform:'browser',target:'es2020',metafile:true,loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'}});
  const execute=async built=>{
  const code=built.outputFiles[0].text;
  const context=vm.createContext({console,setTimeout,clearTimeout,AbortController,AbortSignal,DOMException,TextEncoder,TextDecoder});context.window=context;context.document={};vm.runInContext(code,context);await context.completion;
  const node=context.failure?{error:context.failure}:{rows:JSON.parse(JSON.stringify(context.rows))};
  const page=await browser.newPage();let web;try{
   await page.route('http://anonymous-members.test/**',route=>route.request().url().endsWith('/bundle.js')?route.fulfill({contentType:'text/javascript',body:code}):route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"default-src 'none'; script-src 'self'"},body:'<script src="/bundle.js"></script>'}));
   await page.goto('http://anonymous-members.test/');web=await page.evaluate(async()=>{await globalThis.completion;return globalThis.failure?{error:globalThis.failure}:{rows:JSON.parse(JSON.stringify(globalThis.rows))};});
  }finally{await page.close();}
  return {node,web};};
  const built=await build(),actual=await execute(built);assert.equal(actual.node.error,undefined);assert.deepEqual(actual.node.rows,expected);assert.deepEqual(actual.web,actual.node);
  fs.writeFileSync(path.join(dir,'bundle.js'),built.outputFiles[0].text);
  const controls=[],factory=path.join(dir,'factory.js'),original=artifact.moduleSource;
  const owners=[...new Set(original.match(/__as3_generated_anonymousOwner_\d+/g))];assert.equal(owners.length,2);
  const owner='(?:'+owners.join('|')+')';
  try{for(const [name,mutated]of [
   ['dynamic-this-instead-of-captured-owner',original.replace(new RegExp(owner+'(?=,)', 'g'),'this')],
   ['converted-assignment-result',original.replace(/return __as3_callable_typedRaw;/g,'return __as3_callable_localCoercion.as3CoerceUint(__as3_callable_typedRaw);')]
  ]){assert.notEqual(mutated,original);fs.writeFileSync(factory,mutated);
   const result=await execute(await build());for(const runtime of [result.node,result.web])assert.notDeepEqual(runtime.rows,expected);
   controls.push({name,mutationSha256:hash(mutated),...result});
  }}finally{fs.writeFileSync(factory,original);}
  runs.push({target,actual,guards,controls,typecheck:{diagnostics,inputs:program.getSourceFiles().map(s=>({file:s.fileName,sha256:hash(fs.readFileSync(s.fileName))}))},inputs:Object.keys(built.metafile.inputs).map(file=>({file:path.resolve(file),sha256:hash(fs.readFileSync(file))})),artifact});
 }
 const compilerInputs=['src','utils'].flatMap(folder=>fs.readdirSync(path.join(root,folder),{recursive:true}).filter(f=>f.endsWith('.ts')).map(f=>{const file=path.join(folder,f).replaceAll('\\','/');return {file,sha256:hash(fs.readFileSync(path.join(root,file)))};}));
 const runnerInputs=['run.cjs','compile.cjs','guards.cjs'].map(file=>({file,sha256:hash(fs.readFileSync(path.join(__dirname,file)))}));
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({scope:'Complete generated original Classes with retained host observations',engineCommit:require('child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:engine,encoding:'utf8'}).trim(),engineRoot:engine,compilerRoot:root,compilerInputs,runnerInputs,receiptSha256:hash(frozen('evidence/receipt.json')),sources:selectedSources,numericReceiptSha256:hash(fs.readFileSync(path.join(numeric,'receipt.json'))),runs},null,2)+'\n');console.log(JSON.stringify({status:'passed',out,rows:11,targets:2,realms:2,guards:12,appliedControls:2,typeErrors:0}));
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
