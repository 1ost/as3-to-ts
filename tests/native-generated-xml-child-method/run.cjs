'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm'),Module=require('module');
const {compile,engine,root,frozen,sources,hash}=require('./compile.cjs');
const api=require('../../lib'),ts=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const receipt=JSON.parse(frozen('evidence/receipt.json'));
const captures=[1,2].map(n=>{const file='run-'+n+'/capture.json',b=frozen('evidence/'+file);assert.equal(hash(b),receipt.artifacts[file]);return JSON.parse(b);});
assert.deepEqual(captures[0],captures[1]);const extraReceipt=JSON.parse(frozen('evidence/receipt.json','xml-list-return')),extra=[1,2].map(i=>{const file='run-'+i+'/capture.json',b=frozen('evidence/'+file,'xml-list-return');assert.equal(hash(b),extraReceipt.artifacts[file]);return JSON.parse(b);});assert.deepEqual(extra[0],extra[1]);const expected=[...captures[0].state.observations,...extra[0].state.observations];assert.equal(expected.length,27);
const compilerInputs=fs.readdirSync(path.join(root,'src'),{recursive:true}).filter(f=>f.endsWith('.ts')).map(f=>({file:path.join(root,'src',f),sha256:hash(fs.readFileSync(path.join(root,'src',f)))}));
async function main(){
 const cache=path.join(root,'.cache/native-generated-xml-child-method');fs.mkdirSync(cache,{recursive:true});const out=fs.mkdtempSync(path.join(cache,'run-'));
 const {chromium}=require(require.resolve('playwright',{paths:[path.join(engine,'../op2-html5/game-client-laya'),engine]}));const browser=await chromium.launch({headless:true}),runs=[];
 try{for(const target of ['ES5','ES2015']){
  const dir=path.join(out,target),{artifact,files,config}=compile(dir,target),guards=[];
  const reject=(name,action,pattern)=>{let error;try{action();}catch(e){error=String(e.message);}assert.match(error||'',pattern,name);guards.push({name,error});};
  const variant=(q,from,to)=>{assert(sources[q].source.includes(from));const source=sources[q].source.replace(from,to);return {...sources,[q]:{source,sourceSha256:hash(source)}};};
  for(const [name,change] of Object.entries({missingXML:{nativeXMLModule:undefined},missingReference:{nativeReferenceCoercion:undefined},wrongGlobal:{nativeGlobalModules:{...config.emitterOptions.nativeGlobalModules,XML:'./wrong'}}}))
   reject(name,()=>api.emitNativeSourceClassModule({...config,emitterOptions:{...config.emitterOptions,...change}}),/AS3_[A-Z_]+UNSUPPORTED/);
  reject('copied-plan',()=>api.emitNativeSourceClassModule({...config,plan:{...config.plan}}),/AS3_[A-Z_]+UNSUPPORTED/);
  for(const [name,from,to] of [
   ['dynamic-name','conf.child("id")','conf.child(url)'],['wildcard','conf.child("id")','conf.child("*")'],
   ['qualified-name','conf.child("id")','conf.child("ns:id")'],['numeric-index','conf.child("id")','conf.child(0)'],
   ['extra-argument','conf.child("id")','conf.child("id",1)'],['missing-argument','conf.child("id")','conf.child()'],
   ['wrong-loop-variable','var uiNode:XML','var uiNode:Object']
  ])reject(name,()=>compile(path.join(dir,name),target,variant('model.ChildReader',from,to)),/AS3_[A-Z_]+UNSUPPORTED/);
  const controls=[];
  for(const control of [
   {module:'native-xml',name:'emitNativeXML',from:'const selectedChild = childSelection(n);',to:'const selectedChild = null;',pattern:/XML method-name child selection/},
   {module:'native-callable-classes',name:'NativeCallableClasses',from:"this.xmlReferences && ['XML', 'XMLList'].indexOf(reference.identity) >= 0",to:"this.xmlReferences && reference.identity === 'XML'",pattern:/generated native return type requires separate qualification/}
  ]){
   const location=require.resolve('../../lib/emit/'+control.module),loaded=require(location),saved=loaded[control.name],original=fs.readFileSync(location,'utf8'),mutated=original.replace(control.from,control.to);assert.notEqual(mutated,original);
   const mutant=new Module(location,module);mutant.filename=location;mutant.paths=module.paths;mutant._compile(mutated,location);let error;
   try{loaded[control.name]=mutant.exports[control.name];try{api.emitNativeSourceClassModule(config);}catch(e){error=String(e.message);}}finally{loaded[control.name]=saved;}
   assert.match(error||'',control.pattern);controls.push({name:control.module,error});
  }
  const observer=path.join(dir,'observer.ts');fs.writeFileSync(observer,fs.readFileSync(path.join(__dirname,'observer.ts'),'utf8').replaceAll('@FLASH@',path.relative(dir,path.join(engine,'src/layaAir/flash')).replaceAll('\\','/')).replace('@SAMPLES@',frozen('evidence/source/ChildMethodProbe.as').toString().match(/var samples:Array=(\[[\s\S]*?\]);/)[1]));files.push(observer,...['glsl.d.ts','spine.d.ts'].map(f=>path.join(engine,'src/layaAir/tslibs',f)));
  const program=ts.createProgram(files,{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,strict:true,strictNullChecks:false,useUnknownInCatchVariables:false,experimentalDecorators:true,noEmit:true,skipLibCheck:true,lib:['lib.es2020.d.ts','lib.dom.d.ts']});
  const diagnostics=ts.getPreEmitDiagnostics(program).map(d=>({file:d.file?.fileName,code:d.code,text:ts.flattenDiagnosticMessageText(d.messageText,'\n')}));fs.writeFileSync(path.join(dir,'types.json'),JSON.stringify(diagnostics,null,2));assert.deepEqual(diagnostics,[]);
  const entry=path.join(dir,'entry.ts');fs.writeFileSync(entry,"import {run} from './observer';import {nativeSourceClassModule} from './factory.js';globalThis.completion=run(nativeSourceClassModule).then(rows=>{globalThis.rows=rows;});");
  const built=await esbuild.build({entryPoints:[entry],bundle:true,write:false,format:'iife',platform:'browser',target:'es2020',metafile:true,loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'}}),code=built.outputFiles[0].text;fs.writeFileSync(path.join(dir,'bundle.js'),code);
  const context=vm.createContext({console,performance,setTimeout,clearTimeout,AbortController,AbortSignal,DOMException,TextEncoder,TextDecoder});context.window=context;context.document={};vm.runInContext(code,context);await context.completion;const node=JSON.parse(JSON.stringify(context.rows));assert.deepEqual(node,expected);
  const page=await browser.newPage();let web;try{await page.route('http://negative-default.test/**',route=>route.request().url().endsWith('/bundle.js')?route.fulfill({contentType:'text/javascript',body:code}):route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"default-src 'none'; script-src 'self'"},body:'<script src="/bundle.js"></script>'}));await page.goto('http://negative-default.test/');web=await page.evaluate(async()=>{await globalThis.completion;return globalThis.rows;});}finally{await page.close();}assert.deepEqual(web,expected);
  runs.push({target,artifact,node,web,guards,controls,typecheck:{diagnostics,inputs:program.getSourceFiles().map(f=>({file:f.fileName,sha256:hash(fs.readFileSync(f.fileName))}))},inputs:Object.keys(built.metafile.inputs).map(file=>({file:path.resolve(file),sha256:hash(fs.readFileSync(file))}))});
  console.log(JSON.stringify({target,rows:27,guards:guards.length,compilerControls:2,typeErrors:0}));
 }}finally{await browser.close();}
 for(const i of compilerInputs)assert.equal(hash(fs.readFileSync(i.file)),i.sha256);
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({engineCommit:'84e111889ef029e31f1f7a83ecc903d74989114b',receiptSha256:hash(frozen('evidence/receipt.json')),sources,compilerInputs,runs,runnerInputs:['run.cjs','compile.cjs','observer.ts'].map(file=>({file,sha256:hash(fs.readFileSync(path.join(__dirname,file)))})),startupQualified:false},null,2));console.log(JSON.stringify({out,status:'passed'}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
