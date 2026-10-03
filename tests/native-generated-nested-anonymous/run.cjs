'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm');
const {compile,engine,root,frozen,sources,hash}=require('./compile.cjs');
const ts=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const expected=require('./verify-oracle.cjs');
const oracle=path.join(__dirname,'oracle/evidence');
const source=fs.readFileSync(path.join(oracle,'source/cases/NestedClosure.as'),'utf8');
const voidOracle=path.join(__dirname,'void-oracle/evidence'),voidSource=fs.readFileSync(path.join(voidOracle,'source/cases/VoidNestedClosure.as'),'utf8');
const selectedSources={'cases.NestedClosure':{source,sourceSha256:hash(source)},'cases.VoidNestedClosure':{source:voidSource,sourceSha256:hash(voidSource)}};
function observer(flash){return `import {ApplicationDomain} from '${flash}/system/ApplicationDomain';
import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '${flash}/utils/NativeSourceClassLoadingSession';
export async function run(module:NativeSourceClassModule){
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});
 const loaded=await session.load('nested-anonymous',new ApplicationDomain(ApplicationDomain.currentDomain));
 const Subject:any=loaded.getDefinition('cases.NestedClosure');
 const rows:any[]=[],first=new Subject(),second=new Subject(),foreign={_calls:99};
 const outerA=first.prepare(4294967295),outerB=second.prepare(10);
 const a1=outerA.call(foreign,2),a2=outerA.apply(null,[5]),b1=outerB.call(first,3);
 rows.push({id:'initial',value:[first.calls(),second.calls(),foreign._calls]});
 rows.push({id:'outer-overflow-foreign-receiver',value:a1.call(foreign,3)});
 rows.push({id:'sibling-shared-outer',value:a2.apply(second,[1])});
 rows.push({id:'intermediate-storage-fraction',value:a1(-1.5)});
 rows.push({id:'separate-owner-string-addition',value:b1('7')});
 rows.push({id:'undefined-storage',value:a1(undefined)});
 let deep=first.chain(2147483647);
 deep=deep.call(foreign);deep=deep.call(second);deep=deep.apply(null,[]);deep=deep();
 rows.push({id:'five-level-overflow',value:deep.call(foreign)});
 rows.push({id:'five-level-repeat',value:deep.apply(second,[])});
 rows.push({id:'owners-retained',value:[first.calls(),second.calls(),foreign._calls]});
 const VoidSubject:any=loaded.getDefinition('cases.VoidNestedClosure'),subject=new VoidSubject(),voidForeign={_calls:77},target:any={};
 subject.schedule(target);
 for(let i=0;i<5;i++){target.next.call(voidForeign);rows.push({id:'void-step-'+i,value:[subject.calls(),target.next===null]});}
 rows.push({id:'void-final-owner',value:[target.value,voidForeign._calls]});
 const typedOuter=subject.typed(),typedInner=typedOuter.call(voidForeign);
 rows.push({id:'nested-typed-return',value:typedInner.call(voidForeign)});
 session.retire();return rows;
}`;}
async function main(){
 const cache=path.join(root,'.cache/native-generated-nested-anonymous');fs.mkdirSync(cache,{recursive:true});const out=fs.mkdtempSync(path.join(cache,'full-'));
 const {chromium}=require(require.resolve('playwright',{paths:[path.join(engine,'../op2-html5/game-client-laya'),engine]})),browser=await chromium.launch({headless:true});
 const runs=[];
 try{for(const target of ['ES5','ES2015']){
  const dir=path.join(out,target),{artifact,files,config}=compile(dir,target,selectedSources);
  const guards=require('./guards.cjs')(path.join(dir,'guards'),target,config,selectedSources);
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
   await page.route('http://nested-anonymous.test/**',route=>route.request().url().endsWith('/bundle.js')?route.fulfill({contentType:'text/javascript',body:code}):route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"default-src 'none'; script-src 'self'"},body:'<script src="/bundle.js"></script>'}));
   await page.goto('http://nested-anonymous.test/');web=await page.evaluate(async()=>{await globalThis.completion;return globalThis.failure?{error:globalThis.failure}:{rows:JSON.parse(JSON.stringify(globalThis.rows))};});
  }finally{await page.close();}
  return {node,web};};
  const built=await build(),actual=await execute(built);assert.equal(actual.node.error,undefined);assert.deepEqual(actual.node.rows,expected);assert.deepEqual(actual.web,actual.node);
  fs.writeFileSync(path.join(dir,'bundle.js'),built.outputFiles[0].text);
  const controls=[],factory=path.join(dir,'factory.js'),original=artifact.moduleSource;
  try{for(const [name,mutated]of [
   ['dynamic-this-instead-of-parent-owner',original.replace(/\)\(__as3_generated_anonymousOwner_\d+\)/g,')(this)')],
   ['uncoerced-uint-storage',original.replace(/\.as3CoerceUint\(/g,'.as3CoerceNumber(')]
  ]){assert.notEqual(mutated,original);fs.writeFileSync(factory,mutated);
   const result=await execute(await build());for(const runtime of [result.node,result.web])assert.notDeepEqual(runtime.rows,expected);
   controls.push({name,mutationSha256:hash(mutated),...result});
  }}finally{fs.writeFileSync(factory,original);}
  runs.push({target,actual,guards,controls,typecheck:{diagnostics,inputs:program.getSourceFiles().map(s=>({file:s.fileName,sha256:hash(fs.readFileSync(s.fileName))}))},inputs:Object.keys(built.metafile.inputs).map(file=>({file:path.resolve(file),sha256:hash(fs.readFileSync(file))})),artifact});
 }
 const compilerInputs=['src','utils'].flatMap(folder=>fs.readdirSync(path.join(root,folder),{recursive:true}).filter(f=>f.endsWith('.ts')).map(f=>{const file=path.join(folder,f).replaceAll('\\','/');return {file,sha256:hash(fs.readFileSync(path.join(root,file)))};}));
 const runnerInputs=['run.cjs','compile.cjs','guards.cjs','../native-generated-anonymous-members/compile.cjs'].map(file=>({file,sha256:hash(fs.readFileSync(path.join(__dirname,file)))}));
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({scope:'Complete generated original Classes with retained host observations',engineCommit:require('child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:engine,encoding:'utf8'}).trim(),engineRoot:engine,compilerRoot:root,compilerInputs,runnerInputs,receiptSha256:hash(fs.readFileSync(path.join(oracle,'receipt.json'))),voidReceiptSha256:hash(fs.readFileSync(path.join(voidOracle,'receipt.json'))),sources:selectedSources,runs},null,2)+'\n');console.log(JSON.stringify({status:'passed',out,rows:16,targets:2,realms:2,guards:11,appliedControls:2,typeErrors:0}));
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
