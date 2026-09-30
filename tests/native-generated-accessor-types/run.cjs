'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm');
const {compile,engine,root,frozen,sources,hash}=require('./compile.cjs');
const ts=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const receipt=JSON.parse(frozen('evidence/receipt.json'));
const captures=[1,2].map(n=>{const file='run-'+n+'/capture.json',bytes=frozen('evidence/'+file);assert.equal(hash(bytes),receipt.artifacts[file]);return JSON.parse(bytes);});
const expected=captures[0].state.observations.filter(r=>r.id!=='static-reflection-prototype');
assert.deepEqual(captures[0],captures[1]);assert.equal(expected.length,31);
const writesCaptures=[1,2].map(n=>JSON.parse(fs.readFileSync(path.join(__dirname,'writes-evidence/run-'+n+'/capture.json'))));assert.deepEqual(writesCaptures[0],writesCaptures[1]);assert.equal(writesCaptures[0].state.failure,'');assert.equal(writesCaptures[0].state.observations.length,10);expected.push(...writesCaptures[0].state.observations);
function observer(flash){
 const protocol=frozen('native.ts').toString('utf8');
 const run=protocol.slice(protocol.indexOf('export function run(){'),protocol.indexOf('export function guards(){'));
 const original='const {Base,Numeric,Child,Grand}=subjects(),subject=new Base(),rows:any[]=[];';assert(run.includes(original));
 const imports=protocol.slice(0,protocol.indexOf('const field=')).replace(/import .*AS3DeclarationType';\r?\n/,'').replace(/import .*AS3GeneratedClass';\r?\n/,'').replaceAll('../../src/layaAir/flash',flash);
 return imports+`import {ApplicationDomain} from '${flash}/system/ApplicationDomain';
import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '${flash}/utils/NativeSourceClassLoadingSession';
export async function run(module:NativeSourceClassModule){
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});
 const loaded=await session.load('accessor-types-full',new ApplicationDomain(ApplicationDomain.currentDomain));
 const subject=(name:string):any=>loaded.getDefinition('cases.'+name);
 const Base=subject('DistinctAccessor'),Numeric=subject('CoercedAccessor'),Child=subject('DistinctChild'),Grand=subject('DistinctGrandchild');
 const result=runRows().concat(writeRows());session.retire();return result;
`+run.replace('export function run()','function runRows()').replace(original,'const subject=new Base(),rows:any[]=[];')+fs.readFileSync(path.join(__dirname,'writes-observer.ts'),'utf8')+'}';
}
async function main(){
 const cache=path.join(root,'.cache/native-generated-accessor-types');fs.mkdirSync(cache,{recursive:true});const out=fs.mkdtempSync(path.join(cache,'full-'));
 const {chromium}=require(require.resolve('playwright',{paths:[path.join(engine,'../op2-html5/game-client-laya'),engine]})),browser=await chromium.launch({headless:true});
 const runs=[];
 try{for(const target of ['ES5','ES2015']){
  const dir=path.join(out,target),{artifact,files,config}=compile(dir,target);
  const guards=require('./guards.cjs')(path.join(dir,'guards'),target,config);
  assert.deepEqual({...artifact.sourceHashes},Object.fromEntries(Object.entries(sources).map(([q,s])=>[q,s.sourceSha256])));
  const flash=path.relative(dir,path.join(engine,'src/layaAir/flash')).replaceAll('\\','/');
  const host=path.join(dir,'observer.ts');fs.writeFileSync(host,observer(flash));files.push(host);
  const typeConsumer=path.join(dir,'typed-consumer.ts');
  const baseFile=artifact.generatedSources.find(item=>/export interface DistinctAccessor \{/.test(item.source));assert(baseFile);
  fs.writeFileSync(typeConsumer,'import {DistinctAccessor} from '+JSON.stringify('./'+baseFile.module)+';\nexport function assignObject(target:DistinctAccessor,value:{marker:number}):any{return target.publicValue=value;}\n');files.push(typeConsumer);
  const program=ts.createProgram(files,{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,strict:true,strictNullChecks:false,useUnknownInCatchVariables:false,experimentalDecorators:true,noEmit:true,skipLibCheck:true,lib:['lib.es2020.d.ts','lib.dom.d.ts']});
  const diagnostics=ts.getPreEmitDiagnostics(program).map(d=>({file:d.file?.fileName,code:d.code,text:ts.flattenDiagnosticMessageText(d.messageText,'\n')}));fs.writeFileSync(path.join(dir,'types.json'),JSON.stringify(diagnostics,null,2));assert.deepEqual(diagnostics,[]);
  const entry=path.join(dir,'entry.ts');fs.writeFileSync(entry,"import {run} from './observer';import {nativeSourceClassModule} from './factory.js';globalThis.completion=run(nativeSourceClassModule).then(rows=>globalThis.rows=rows).catch(error=>globalThis.failure=String(error.stack));");
  const build=()=>esbuild.build({entryPoints:[entry],bundle:true,write:false,format:'iife',platform:'browser',target:'es2020',metafile:true,loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'}});
  const execute=async built=>{
  const code=built.outputFiles[0].text;
  const context=vm.createContext({console,setTimeout,clearTimeout,AbortController,AbortSignal,DOMException,TextEncoder,TextDecoder});context.window=context;context.document={};vm.runInContext(code,context);await context.completion;
  const node=context.failure?{error:context.failure}:{rows:JSON.parse(JSON.stringify(context.rows))};
  const page=await browser.newPage();let web;try{
   await page.route('http://accessor-types-full.test/**',route=>route.request().url().endsWith('/bundle.js')?route.fulfill({contentType:'text/javascript',body:code}):route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"default-src 'none'; script-src 'self'"},body:'<script src="/bundle.js"></script>'}));
   await page.goto('http://accessor-types-full.test/');web=await page.evaluate(async()=>{await globalThis.completion;return globalThis.failure?{error:globalThis.failure}:{rows:globalThis.rows};});
  }finally{await page.close();}
  return {node,web};};
  const built=await build(),actual=await execute(built);assert.deepEqual(actual.node.rows,expected);assert.deepEqual(actual.web,actual.node);
  fs.writeFileSync(path.join(dir,'bundle.js'),built.outputFiles[0].text);
  const controls=[],factory=path.join(dir,'factory.js'),original=artifact.moduleSource;
  const contract=/, "?setterType"?: "\*"/g;assert([...original.matchAll(contract)].length>0);
  const assignment=/("numericWrite", \{ value: function \(target, value\) \{[\s\S]*?return target\[[^\]]+\] = )value;/g;assert.equal([...original.matchAll(assignment)].length,1);
  try{for(const [name,mutated,row]of [['discard-wildcard-setter-contract',original.replace(contract,''),'namespace-4'],['coerce-assignment-result',original.replace(assignment,'$1(value | 0);'),'typed-number']]){
   assert.notEqual(mutated,original);fs.writeFileSync(factory,mutated);const result=await execute(await build());
   assert.equal(result.node.error,undefined);assert.deepEqual(result.node.rows.map(r=>r.id),expected.map(r=>r.id));assert.deepEqual(result.node,result.web);
   assert.notDeepEqual(result.node.rows.find(r=>r.id===row),expected.find(r=>r.id===row));controls.push({name,failedRow:row,mutationSha256:hash(mutated),...result});
  }}finally{fs.writeFileSync(factory,original);}

  runs.push({target,actual,guards,controls,typecheck:{diagnostics,inputs:program.getSourceFiles().map(s=>({file:s.fileName,sha256:hash(fs.readFileSync(s.fileName))}))},inputs:Object.keys(built.metafile.inputs).map(file=>({file:path.resolve(file),sha256:hash(fs.readFileSync(file))})),artifact});
 }
 const compilerInputs=['src','utils'].flatMap(folder=>fs.readdirSync(path.join(root,folder),{recursive:true}).filter(f=>f.endsWith('.ts')).map(f=>{const file=path.join(folder,f).replaceAll('\\','/');return {file,sha256:hash(fs.readFileSync(path.join(root,file)))};}));
 const runnerInputs=['run.cjs','compile.cjs','guards.cjs','writes-observer.ts'].map(file=>({file,sha256:hash(fs.readFileSync(path.join(__dirname,file)))}));
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({scope:'Complete generated original Classes with retained host observations',engineCommit:'ed51fdc0c3a740ccc185800fd64ee6b4f46cd1ed',engineRoot:engine,compilerRoot:root,compilerInputs,runnerInputs,receiptSha256:hash(frozen('evidence/receipt.json')),nativeProtocolSha256:hash(frozen('native.ts')),writesReceiptSha256:hash(fs.readFileSync(path.join(__dirname,'writes-evidence/receipt.json'))),sources,runs},null,2)+'\n');console.log(JSON.stringify({status:'passed',out,rows:41,targets:2,realms:2,guards:12,appliedControls:2,typeErrors:0}));
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
