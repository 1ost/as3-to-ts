const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const {compile,engine,root,evidence,sources,hash}=require('./compile.cjs'),ts=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const receipt=JSON.parse(fs.readFileSync(path.join(evidence,'evidence/receipt.json')));assert.equal(receipt.status,'passed');assert.equal(receipt.capture.identical,true);
for(const [f,h]of Object.entries(receipt.artifacts))assert.equal(hash(fs.readFileSync(path.join(evidence,'evidence',f))),h);
const air=JSON.parse(fs.readFileSync(path.join(evidence,'evidence/run-1/capture.json')));assert.equal(air.state.failure,'');const expected=air.state.observations;
const baseline=process.argv.includes('--baseline'),cache=path.join(root,'.cache/native-generated-explicit-static-namespace-owner');fs.mkdirSync(cache,{recursive:true});const out=fs.mkdtempSync(path.join(cache,baseline?'baseline-':'run-'));
async function main(){const {chromium}=require(process.env.PLAYWRIGHT_MODULE),browser=await chromium.launch({headless:true}),results=[];
 try{for(const target of ['ES5','ES2015'])for(const variant of ['source']){
  const dir=path.join(out,target,variant),selected=sources;
  const c=compile(dir,target,selected),guards=baseline?[]:require('./guards.cjs')(c.config),flash=path.relative(dir,path.join(engine,'src/layaAir/flash')).replaceAll('\\','/');
  const host=path.join(dir,'observer.ts');fs.writeFileSync(host,fs.readFileSync(path.join(__dirname,'observer.ts'),'utf8').replaceAll('@FLASH@',flash));
  c.files.push(host);
  const program=ts.createProgram(c.files.concat(['glsl.d.ts','spine.d.ts'].map(f=>path.join(engine,'src/layaAir/tslibs',f))),{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,strict:true,strictNullChecks:false,useUnknownInCatchVariables:false,experimentalDecorators:true,noEmit:true,skipLibCheck:true});
  const diagnostics=ts.getPreEmitDiagnostics(program).map(d=>({file:d.file?.fileName,code:d.code,text:ts.flattenDiagnosticMessageText(d.messageText,'\n')}));fs.writeFileSync(path.join(dir,'types.json'),JSON.stringify(diagnostics,null,2));if(!baseline)assert.deepEqual(diagnostics,[]);
  const entry=path.join(dir,'entry.ts');fs.writeFileSync(entry,"import {run} from './observer';import {nativeSourceClassModule} from './factory.js';globalThis.completion=run(nativeSourceClassModule).then(rows=>globalThis.rows=rows).catch(e=>globalThis.failure=String(e));");
  const built=await esbuild.build({entryPoints:[entry],bundle:true,write:false,format:'iife',target:'es2020',metafile:true,loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'}}),code=built.outputFiles[0].text;
  async function evaluate(code,label){
   fs.writeFileSync(path.join(dir,label+'.js'),code);const context=vm.createContext({console,setTimeout,clearTimeout,AbortController,AbortSignal,DOMException,performance});context.window=context;context.document={};vm.runInContext(code,context);await context.completion;const node=JSON.parse(JSON.stringify({rows:context.rows,error:context.failure}));
   const page=await browser.newPage();await page.route('http://namespace-owner.test/**',route=>route.request().url().endsWith('/bundle.js')?route.fulfill({contentType:'text/javascript',body:code}):route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"script-src 'self'"},body:'<!doctype html><script src="/bundle.js"></script>'}));await page.goto('http://namespace-owner.test/');await page.evaluate(()=>globalThis.completion);const web=await page.evaluate(()=>JSON.parse(JSON.stringify({rows:globalThis.rows,error:globalThis.failure})));await page.close();assert.deepEqual(web,node);return {node,web};
  }
  const {node,web}=await evaluate(code,'bundle');
  if(baseline)assert.notDeepEqual(node.rows,expected);else assert.deepEqual(node.rows,expected);
  const controls=[];if(!baseline){
   const factory=path.join(dir,'factory.js'),original=fs.readFileSync(factory,'utf8');
   const mutated=original.replace(/\(nativeClass_\d+\.readNativeClass\(__native_class_1_1\.Base, "read"\)\)/g,'Base');assert.notEqual(mutated,original);
   fs.writeFileSync(factory,mutated);try{const b=await esbuild.build({entryPoints:[entry],bundle:true,write:false,format:'iife',target:'es2020',loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'}});const result=await evaluate(b.outputFiles[0].text,'mutation');assert.match(result.node.error,/Base is not defined/);controls.push({name:'bare-declaring-owner-substitution',...result});}finally{fs.writeFileSync(factory,original);}
  }
  const inputs=[...new Set([...program.getSourceFiles().map(f=>f.fileName),...Object.keys(built.metafile.inputs),__filename,path.join(__dirname,'compile.cjs'),path.join(__dirname,'observer.ts'),path.join(__dirname,'guards.cjs')])].map(file=>({file:path.resolve(file),sha256:hash(fs.readFileSync(file))}));
  results.push({target,variant,node,web,diagnostics,inputs,controls,guards,sources:selected});console.log(JSON.stringify({target,diagnostics:diagnostics.length,rows:node.rows,error:node.error}));
 }}finally{await browser.close();}
 const compilerInputs=[];for(const folder of ['src','lib','utils'])for(const f of fs.readdirSync(path.join(root,folder),{recursive:true})){const file=path.join(root,folder,f);if(fs.statSync(file).isFile())compilerInputs.push({file,sha256:hash(fs.readFileSync(file))});}
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({baseline,results,sources,compilerInputs,evidence,receiptSha256:hash(fs.readFileSync(path.join(evidence,'evidence/receipt.json')))},null,2));console.log(JSON.stringify({out,status:baseline?'baseline-reproduced':'passed'}));
}main().catch(e=>{console.error(e);console.error({out});process.exitCode=1;});
