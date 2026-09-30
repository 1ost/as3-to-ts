'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm');
const {compile,engine,root,frozen,sources,hash}=require('./compile.cjs');
const ts=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const receipt=JSON.parse(frozen('evidence/receipt.json'));
const captures=[1,2].map(n=>{const file='run-'+n+'/capture.json',bytes=frozen('evidence/'+file);assert.equal(hash(bytes),receipt.artifacts[file]);return JSON.parse(bytes);});
const expected=captures[0].state.observations;
assert.deepEqual(captures[0],captures[1]);assert.equal(expected.length,22);
function observer(flash){
 const protocol=frozen('native.ts').toString('utf8');
 const run=protocol.slice(protocol.indexOf('const error='),protocol.indexOf('export function guards(){'));
 const original='const {Base,Child,Grand}=subjects();let b=new Base()';assert(run.includes(original));
 const imports=protocol.slice(0,protocol.indexOf('const half=')).replace(/import .*AS3DeclarationType';\r?\n/,'').replace(/import .*AS3GeneratedClass';\r?\n/,'').replaceAll('../../src/layaAir/flash',flash);
 return imports+`import {ApplicationDomain} from '${flash}/system/ApplicationDomain';
import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '${flash}/utils/NativeSourceClassLoadingSession';
export async function run(module:NativeSourceClassModule){
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});
 const loaded=await session.load('array-accessors-full',new ApplicationDomain(ApplicationDomain.currentDomain));
 const subject=(name:string):any=>loaded.getDefinition('cases.'+name);
 const Base=subject('ArrayBase'),Child=subject('ArrayChild'),Grand=subject('ArrayGrand');

`+run.replace('export function run()','function runRows()').replace(original,'let b=new Base()')+'const result=runRows();session.retire();return result;}';
}
async function main(){
 const cache=path.join(root,'.cache/native-generated-array-accessors');fs.mkdirSync(cache,{recursive:true});const out=fs.mkdtempSync(path.join(cache,'full-'));
 const {chromium}=require(require.resolve('playwright',{paths:[path.join(engine,'../op2-html5/game-client-laya'),engine]})),browser=await chromium.launch({headless:true});
 const runs=[];
 try{for(const target of ['ES5','ES2015']){
  const dir=path.join(out,target),{artifact,files,config}=compile(dir,target);
  const guards=require('./guards.cjs')(path.join(dir,'guards'),target,config);
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
   await page.route('http://array-accessors-full.test/**',route=>route.request().url().endsWith('/bundle.js')?route.fulfill({contentType:'text/javascript',body:code}):route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"default-src 'none'; script-src 'self'"},body:'<script src="/bundle.js"></script>'}));
   await page.goto('http://array-accessors-full.test/');web=await page.evaluate(async()=>{await globalThis.completion;return globalThis.failure?{error:globalThis.failure}:{rows:globalThis.rows};});
  }finally{await page.close();}
  return {node,web};};
  const built=await build(),actual=await execute(built);assert.equal(actual.node.error,undefined);assert.deepEqual(actual.node.rows,expected);assert.deepEqual(actual.web,actual.node);
  fs.writeFileSync(path.join(dir,'bundle.js'),built.outputFiles[0].text);
  const controls=[],factory=path.join(dir,'factory.js'),original=artifact.moduleSource;
  const setter=/name: "values", type: (\{ name: "Array", reference: [^}]+\}), "set": \{ "override": true, "final": false \}/g;
  const getter=/name: "values", type: (\{ name: "Array", reference: [^}]+\}), "get": \{ "override": true, "final": false \}/g;
  assert.equal([...original.matchAll(setter)].length,1);assert.equal([...original.matchAll(getter)].length,1);
  try{for(const [name,mutated]of [
   ['setter-loses-override',original.replace(setter,m=>m.replace('"override": true','"override": false'))],
   ['getter-loses-override',original.replace(getter,m=>m.replace('"override": true','"override": false'))]
  ]){assert.notEqual(mutated,original);fs.writeFileSync(factory,mutated);const result=await execute(await build());
   for(const runtime of [result.node,result.web])assert.match(runtime.error||'',/selected parent accessor requires matching nonfinal half authority/);
   controls.push({name,mutationSha256:hash(mutated),...result});}
  }finally{fs.writeFileSync(factory,original);}

  runs.push({target,actual,guards,controls,typecheck:{diagnostics,inputs:program.getSourceFiles().map(s=>({file:s.fileName,sha256:hash(fs.readFileSync(s.fileName))}))},inputs:Object.keys(built.metafile.inputs).map(file=>({file:path.resolve(file),sha256:hash(fs.readFileSync(file))})),artifact});
 }
 const compilerInputs=['src','utils'].flatMap(folder=>fs.readdirSync(path.join(root,folder),{recursive:true}).filter(f=>f.endsWith('.ts')).map(f=>{const file=path.join(folder,f).replaceAll('\\','/');return {file,sha256:hash(fs.readFileSync(path.join(root,file)))};}));
 const runnerInputs=['run.cjs','compile.cjs','guards.cjs'].map(file=>({file,sha256:hash(fs.readFileSync(path.join(__dirname,file)))}));
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({scope:'Complete generated original Classes with retained host observations',engineCommit:'beb8d3e6d4d4aa053ada60acd76f877dc7d65916',engineRoot:engine,compilerRoot:root,compilerInputs,runnerInputs,receiptSha256:hash(frozen('evidence/receipt.json')),nativeProtocolSha256:hash(frozen('native.ts')),sources,runs},null,2)+'\n');console.log(JSON.stringify({status:'passed',out,rows:22,targets:2,realms:2,guards:12,appliedControls:2,typeErrors:0}));
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
