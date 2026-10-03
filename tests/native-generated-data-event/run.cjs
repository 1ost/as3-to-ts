'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm'),Module=require('module');
const {compile,engine,root,frozen,sources,hash}=require('./compile.cjs');
const api=require('../../lib'),ts=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const receipt=JSON.parse(frozen('evidence/receipt.json'));
const captures=[1,2].map(n=>{const file='run-'+n+'/capture.json',b=frozen('evidence/'+file);assert.equal(hash(b),receipt.artifacts[file]);return JSON.parse(b);});
assert.deepEqual(captures[0],captures[1]);const expected=captures[0].state.observations;assert.equal(expected.length,36);
const compilerInputs=fs.readdirSync(path.join(root,'src'),{recursive:true}).filter(f=>f.endsWith('.ts')).map(f=>({file:path.join(root,'src',f),sha256:hash(fs.readFileSync(path.join(root,'src',f)))}));
async function main(){
 const cache=path.join(root,'.cache/native-generated-data-event');fs.mkdirSync(cache,{recursive:true});const out=fs.mkdtempSync(path.join(cache,'run-'));
 const {chromium}=require(require.resolve('playwright',{paths:[path.join(engine,'../op2-html5/game-client-laya'),engine]}));const browser=await chromium.launch({headless:true}),runs=[];
 try{for(const target of ['ES5','ES2015']){
  const dir=path.join(out,target),{artifact,files,config}=compile(dir,target),guards=[];
  const reject=(name,action,pattern)=>{let error;try{action();}catch(e){error=String(e.message);}assert.match(error||'',pattern,name);guards.push({name,error});};
  const variant=(q,from,to)=>{assert(sources[q].source.includes(from));const source=sources[q].source.replace(from,to);return {...sources,[q]:{source,sourceSha256:hash(source)}};};
  for(const [name,change] of Object.entries({missingConstruction:{nativeDataEventConstructionModule:undefined},missingReference:{nativeDataEventReferenceModule:undefined},wrongConstruction:{nativeDataEventConstructionModule:'./wrong'},wrongImport:{importModules:{...config.emitterOptions.importModules,'flash.events.DataEvent':'./wrong'}}}))
   reject(name,()=>api.emitNativeSourceClassModule({...config,emitterOptions:{...config.emitterOptions,...change}}),/AS3_[A-Z_]+UNSUPPORTED/);
  reject('copied-plan',()=>api.emitNativeSourceClassModule({...config,plan:{...config.plan}}),/AS3_[A-Z_]+UNSUPPORTED/);
  for(const [name,from,to]of [
   ['zero-arguments','new DataEvent("empty")','new DataEvent()'],
   ['extra-arguments','new DataEvent("empty")','new DataEvent("empty",false,false,"",1)'],
   ['shadowed-target','cast(value:*)','cast(value:*,DataEvent:Object)'],
   ['class-initializer','public class DataEventUse {','public class DataEventUse { public static var event:* = new DataEvent("x");'],
   ['payload-write','return event.data;','event.data="x";return event.data;'],
   ['computed-payload','return event.data;','return event["data"];'],
   ['wrong-provider','return event.data;','return event.text;']
  ])reject(name,()=>compile(path.join(dir,name),target,variant('model.DataEventUse',from,to)),/AS3_[A-Z_]+UNSUPPORTED/);
  const emitter=require('../../lib/emit/emitter'),saved=emitter.emit,controls=[];
  for(const option of ['nativeDataEventConstructionModule','nativeDataEventReferenceModule']){
   let controlError;try{emitter.emit=(ast,source,options)=>saved(ast,source,{...options,[option]:undefined});try{api.emitNativeSourceClassModule(config);}catch(e){controlError=String(e.message);}}finally{emitter.emit=saved;}
   assert.match(controlError||'',/AS3_[A-Z_]+UNSUPPORTED/);controls.push({option,error:controlError});
  }
  const observer=path.join(dir,'observer.ts');fs.writeFileSync(observer,fs.readFileSync(path.join(__dirname,'observer.ts'),'utf8').replaceAll('@FLASH@',path.relative(dir,path.join(engine,'src/layaAir/flash')).replaceAll('\\','/')).replace('@OBSERVE@',path.relative(dir,path.join(engine,'tests/nativeDataEventSource/observe')).replaceAll('\\','/')));files.push(observer);
  const program=ts.createProgram([...files,...['glsl.d.ts','spine.d.ts'].map(f=>path.join(engine,'src/layaAir/tslibs',f))],{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,strict:true,strictNullChecks:false,useUnknownInCatchVariables:false,experimentalDecorators:true,noEmit:true,skipLibCheck:true,lib:['lib.es2020.d.ts','lib.dom.d.ts','lib.dom.iterable.d.ts']});
  const diagnostics=ts.getPreEmitDiagnostics(program).map(d=>({file:d.file?.fileName,code:d.code,text:ts.flattenDiagnosticMessageText(d.messageText,'\n')}));fs.writeFileSync(path.join(dir,'types.json'),JSON.stringify(diagnostics,null,2));assert.deepEqual(diagnostics,[]);
  const entry=path.join(dir,'entry.ts');fs.writeFileSync(entry,"import {run} from './observer';import {nativeSourceClassModule} from './factory.js';globalThis.completion=run(nativeSourceClassModule).then(rows=>{globalThis.rows=rows;});");
  const built=await esbuild.build({entryPoints:[entry],bundle:true,write:false,format:'iife',platform:'browser',target:'es2020',metafile:true,loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'}}),code=built.outputFiles[0].text;fs.writeFileSync(path.join(dir,'bundle.js'),code);
  const context=vm.createContext({console,setTimeout,clearTimeout,AbortController,AbortSignal,DOMException,TextEncoder,TextDecoder,performance});context.window=context;context.document={};vm.runInContext(code,context);await context.completion;const node=JSON.parse(JSON.stringify(context.rows));assert.deepEqual(node,expected);
  const page=await browser.newPage();let web;try{await page.route('http://negative-default.test/**',route=>route.request().url().endsWith('/bundle.js')?route.fulfill({contentType:'text/javascript',body:code}):route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"default-src 'none'; script-src 'self'"},body:'<script src="/bundle.js"></script>'}));await page.goto('http://negative-default.test/');web=await page.evaluate(async()=>{await globalThis.completion;return globalThis.rows;});}finally{await page.close();}assert.deepEqual(web,expected);
  runs.push({target,artifact,node,web,guards,controls,typecheck:{diagnostics,inputs:program.getSourceFiles().map(f=>({file:f.fileName,sha256:hash(fs.readFileSync(f.fileName))}))},inputs:Object.keys(built.metafile.inputs).map(file=>({file:path.resolve(file),sha256:hash(fs.readFileSync(file))}))});
  console.log(JSON.stringify({target,rows:36,guards:guards.length,compilerControls:controls.length,typeErrors:0}));
 }}finally{await browser.close();}
 for(const i of compilerInputs)assert.equal(hash(fs.readFileSync(i.file)),i.sha256);
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({engineCommit:require('child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:engine,encoding:'utf8'}).trim(),receiptSha256:hash(frozen('evidence/receipt.json')),sources,compilerInputs,runs,runnerInputs:['run.cjs','compile.cjs','observer.ts'].map(file=>({file,sha256:hash(fs.readFileSync(path.join(__dirname,file)))})),startupQualified:false},null,2));console.log(JSON.stringify({out,status:'passed'}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
