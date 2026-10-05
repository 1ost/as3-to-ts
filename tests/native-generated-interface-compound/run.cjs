'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm');
const {compile,engine,root,evidence,sources,hash}=require('./compile.cjs');
const ts=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const air=require(path.join(evidence,'verify.cjs')),expected=air.filter(r=>r.id!=='native-reflection');
function observer(flash){return fs.readFileSync(path.join(__dirname,'observer.ts'),'utf8').replaceAll('@FLASH@',flash);}
async function main(){
 const cache=path.join(root,'.cache/native-generated-interface-compound');fs.mkdirSync(cache,{recursive:true});const out=fs.mkdtempSync(path.join(cache,'full-'));
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||require.resolve('playwright',{paths:[path.join(engine,'../op2-html5/game-client-laya'),engine]})),browser=await chromium.launch({headless:true});
 const runs=[];
 try{for(const target of ['ES5','ES2015']){
  const dir=path.join(out,target),{artifact,files,config}=compile(dir,target);
  const guards=require('./guards.cjs')(config);
  assert.deepEqual({...artifact.sourceHashes},Object.fromEntries(Object.entries(sources).map(([q,s])=>[q,s.sourceSha256])));
  const flash=path.relative(dir,path.join(engine,'src/layaAir/flash')).replaceAll('\\','/');
  const host=path.join(dir,'observer.ts');fs.writeFileSync(host,observer(flash));files.push(host,...['glsl.d.ts','spine.d.ts'].map(f=>path.join(engine,'src/layaAir/tslibs',f)));
  const program=ts.createProgram(files,{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,strict:true,strictNullChecks:false,useUnknownInCatchVariables:false,experimentalDecorators:true,noEmit:true,skipLibCheck:true,lib:['lib.es2020.d.ts','lib.dom.d.ts','lib.dom.iterable.d.ts']});
  const diagnostics=ts.getPreEmitDiagnostics(program).map(d=>({file:d.file?.fileName,code:d.code,text:ts.flattenDiagnosticMessageText(d.messageText,'\n')}));fs.writeFileSync(path.join(dir,'types.json'),JSON.stringify(diagnostics,null,2));assert.deepEqual(diagnostics,[]);
  const entry=path.join(dir,'entry.ts');fs.writeFileSync(entry,"import {run} from './observer';import {nativeSourceClassModule} from './factory.js';globalThis.completion=run(nativeSourceClassModule).then(rows=>globalThis.rows=rows).catch(error=>{globalThis.failure=String(error.stack);globalThis.errorID=error.errorID;});");
  const build=()=>esbuild.build({entryPoints:[entry],bundle:true,write:false,format:'iife',platform:'browser',target:'es2020',metafile:true,loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'}});
  const execute=async built=>{
  const code=built.outputFiles[0].text;
  const context=vm.createContext({console,setTimeout,clearTimeout,AbortController,AbortSignal,DOMException,performance,TextEncoder,TextDecoder});context.window=context;context.document={};vm.runInContext(code,context);await context.completion;
  const node=context.failure?{error:context.failure,errorID:context.errorID}:{rows:JSON.parse(JSON.stringify(context.rows))};
  const page=await browser.newPage();let web;try{
   await page.route('http://private-namespace.test/**',route=>route.request().url().endsWith('/bundle.js')?route.fulfill({contentType:'text/javascript',body:code}):route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"default-src 'none'; script-src 'self'"},body:'<script src="/bundle.js"></script>'}));
   await page.goto('http://private-namespace.test/');web=await page.evaluate(async()=>{await globalThis.completion;return globalThis.failure?{error:globalThis.failure,errorID:globalThis.errorID}:{rows:globalThis.rows};});
  }finally{await page.close();}
  return {node,web};};
  const built=await build(),actual=await execute(built);fs.writeFileSync(path.join(dir,'actual.json'),JSON.stringify(actual,null,2));assert.deepEqual(actual.node.rows,expected);assert.deepEqual(actual.web,actual.node);
  fs.writeFileSync(path.join(dir,'bundle.js'),built.outputFiles[0].text);
  const controls=[],factory=path.join(dir,'factory.js'),original=artifact.moduleSource;
  const marker=/return (\w+\.as3SetProperty)\(writeTarget\(\),\s*key,\s*value\);/g;
  const mutated=original.replace(marker,'return $1(readTarget,key,value);');assert.notEqual(mutated,original);
  try{fs.writeFileSync(factory,mutated);const change=await build(),result=await execute(change);assert.equal(result.node.error,undefined);assert.notDeepEqual(result.node.rows,expected);assert.deepEqual(result.node,result.web);fs.writeFileSync(path.join(dir,'mutation-factory.js'),mutated);fs.writeFileSync(path.join(dir,'mutation-bundle.js'),change.outputFiles[0].text);controls.push({name:'captured-subtraction-receiver',mutationSha256:hash(mutated),bundleSha256:hash(change.outputFiles[0].text),...result});}finally{fs.writeFileSync(factory,original);}
  runs.push({target,actual,guards,controls,typecheck:{diagnostics,inputs:program.getSourceFiles().map(s=>({file:s.fileName,sha256:hash(fs.readFileSync(s.fileName))}))},inputs:Object.keys(built.metafile.inputs).map(file=>({file:path.resolve(file),sha256:hash(fs.readFileSync(file))})),artifact});
 }
 for(const run of runs)for(const item of [...run.inputs,...run.typecheck.inputs])assert.equal(hash(fs.readFileSync(item.file)),item.sha256,item.file);
 const compilerInputs=['src','utils'].flatMap(folder=>fs.readdirSync(path.join(root,folder),{recursive:true}).filter(f=>f.endsWith('.ts')).map(f=>{const file=path.join(folder,f).replaceAll('\\','/');return {file,sha256:hash(fs.readFileSync(path.join(root,file)))};}));
 const runnerInputs=['run.cjs','compile.cjs','guards.cjs','observer.ts'].map(file=>({file,sha256:hash(fs.readFileSync(path.join(__dirname,file)))}));
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({scope:'Numeric compound assignments through source interfaces',engineRoot:engine,compilerRoot:root,compilerInputs,runnerInputs,receiptSha256:hash(fs.readFileSync(path.join(evidence,'evidence/receipt.json'))),sources,runs},null,2)+'\n');console.log(JSON.stringify({status:'passed',out,rows:expected.length,targets:2,realms:2,guards:runs[0].guards.length,appliedControls:1,typeErrors:0}));
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
