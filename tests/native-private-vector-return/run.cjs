'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm');
const {compile,engine,root,frozen,sources,hash}=require('./compile.cjs');
const ts=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const expected=require('./verify-oracle.cjs');
function observer(flash){return `import {ApplicationDomain} from '${flash}/system/ApplicationDomain';
import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '${flash}/utils/NativeSourceClassLoadingSession';
import {as3VectorCreate,as3VectorPrimitiveSpec} from '${flash}/utils/AS3Vector';
export async function run(module:NativeSourceClassModule){
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});
 const loaded=await session.load('private-vector-return',new ApplicationDomain(ApplicationDomain.currentDomain));
 const Subject:any=loaded.getDefinition('cases.VectorReturn'),subject=new Subject(),other=new Subject(),rows:any[]=[];
 const ints=as3VectorCreate(as3VectorPrimitiveSpec('int'));ints.push(4,7);
 rows.push({id:'identity',value:subject.exchange(ints)===ints});
 rows.push({id:'null',value:subject.exchange(null)===null});
 rows.push({id:'undefined',value:subject.exchange(undefined)===null});
 const fn=subject.closure();
 rows.push({id:'bound-owner',value:fn.call(other,ints)===ints});
 rows.push({id:'closure-identity',value:fn===subject.closure()});
 const bad=[[],as3VectorCreate(as3VectorPrimitiveSpec('uint')),as3VectorCreate(as3VectorPrimitiveSpec('Number')),as3VectorCreate(as3VectorPrimitiveSpec('*')),{}];
 for(let i=0;i<bad.length;i++) {
  try{subject.exchange(bad[i]);rows.push({id:'bad-'+i,value:'accepted'});}
  catch(error){rows.push({id:'bad-'+i,value:[error.name,error.errorID]});}
 }
 rows.push({id:'calls-after-errors',value:[subject.calls(),other.calls()]});
 rows.push({id:'static-identity',value:subject.staticExchange(ints)===ints});
 rows.push({id:'static-undefined',value:subject.staticExchange(undefined)===null});
 try{subject.staticExchange([]);rows.push({id:'static-array',value:'accepted'});}
 catch(error){rows.push({id:'static-array',value:[error.name,error.errorID]});}
 rows.push({id:'digits-204',value:subject.digits(204).join(',')});
 rows.push({id:'digits-0',value:subject.digits(0).join(',')});
 rows.push({id:'digits-overflow',value:subject.digits(4294967297).join(',')});
 session.retire();return rows;
}`;}
async function main(){
 const cache=path.join(root,'.cache/native-private-vector-return');fs.mkdirSync(cache,{recursive:true});const out=fs.mkdtempSync(path.join(cache,'full-'));
 const {chromium}=require(require.resolve('playwright',{paths:[path.join(engine,'../op2-html5/game-client-laya'),engine]})),browser=await chromium.launch({headless:true});
 const runs=[];
 try{for(const target of ['ES5','ES2015']){
  const dir=path.join(out,target),{artifact,files,config}=compile(dir,target,sources);
  const guards=require('./guards.cjs')(path.join(dir,'guards'),target,config,sources);
  assert.deepEqual({...artifact.sourceHashes},Object.fromEntries(Object.entries(sources).map(([q,s])=>[q,s.sourceSha256])));
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
   await page.route('http://private-vector-return.test/**',route=>route.request().url().endsWith('/bundle.js')?route.fulfill({contentType:'text/javascript',body:code}):route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"default-src 'none'; script-src 'self'"},body:'<script src="/bundle.js"></script>'}));
   await page.goto('http://private-vector-return.test/');web=await page.evaluate(async()=>{await globalThis.completion;return globalThis.failure?{error:globalThis.failure}:{rows:JSON.parse(JSON.stringify(globalThis.rows))};});
  }finally{await page.close();}
  return {node,web};};
  const built=await build(),actual=await execute(built);assert.equal(actual.node.error,undefined);assert.deepEqual(actual.node.rows,expected);assert.deepEqual(actual.web,actual.node);
  fs.writeFileSync(path.join(dir,'bundle.js'),built.outputFiles[0].text);
  const controls=[],factory=path.join(dir,'factory.js'),original=artifact.moduleSource;
  try{for(const [name,mutated]of [
   ['unchecked-vector-return',original.replace(/\{\s*name:\s*"__AS3__\.vec::Vector\.<int>",\s*vector:[^}]+\}/g,'"*"')],
   ['reversed-digit-order',original.replace(/\.unshift\(/g,'.push(')]
  ]){assert.notEqual(mutated,original);fs.writeFileSync(factory,mutated);
   const result=await execute(await build());for(const runtime of [result.node,result.web])assert.notDeepEqual(runtime.rows,expected);
   controls.push({name,mutationSha256:hash(mutated),...result});
  }}finally{fs.writeFileSync(factory,original);}
  runs.push({target,actual,guards,controls,typecheck:{diagnostics,inputs:program.getSourceFiles().map(s=>({file:s.fileName,sha256:hash(fs.readFileSync(s.fileName))}))},inputs:Object.keys(built.metafile.inputs).map(file=>({file:path.resolve(file),sha256:hash(fs.readFileSync(file))})),artifact});
 }
 const compilerInputs=['src','utils'].flatMap(folder=>fs.readdirSync(path.join(root,folder),{recursive:true}).filter(f=>f.endsWith('.ts')).map(f=>{const file=path.join(folder,f).replaceAll('\\','/');return {file,sha256:hash(fs.readFileSync(path.join(root,file)))};}));
 const runnerInputs=['run.cjs','compile.cjs','guards.cjs','verify-oracle.cjs'].map(file=>({file,sha256:hash(fs.readFileSync(path.join(__dirname,file)))}));
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({scope:'Complete generated original Classes with retained host observations',engineCommit:require('child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:engine,encoding:'utf8'}).trim(),engineRoot:engine,compilerRoot:root,compilerInputs,runnerInputs,receiptSha256:hash(fs.readFileSync(path.join(__dirname,'oracle/evidence/receipt.json'))),sources:sources,runs},null,2)+'\n');console.log(JSON.stringify({status:'passed',out,rows:17,targets:2,realms:2,guards:6,appliedControls:2,typeErrors:0}));
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
