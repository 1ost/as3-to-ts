const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm');
const {compile,engine,root,sources,hash}=require('./compile.cjs');
const ts=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const out=fs.mkdtempSync(path.join(root,'.cache/timer-callbacks-'));
main().catch(e=>{console.error(e);process.exitCode=1;});
async function main(){
 const expected=require('./oracle/verify.cjs');
 const {chromium}=require(require.resolve('playwright',{paths:[path.join(engine,'../op2-html5/game-client-laya'),engine]})),browser=await chromium.launch({headless:true}),runs=[];
 try{for(const target of ['ES5','ES2015']){
 const selected=sources;
 const dir=path.join(out,target),{artifact,files}=compile(dir,target,selected);
 const flash=path.relative(dir,path.join(engine,'src/layaAir/flash')).replaceAll('\\','/');
 const host=path.join(dir,'entry.ts');fs.writeFileSync(host,`import {ApplicationDomain} from '${flash}/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '${flash}/utils/NativeSourceClassLoadingSession';
import {nativeSourceClassModule} from './factory.js';
(globalThis as any).completion=(async()=>{const session=createNativeSourceClassLoadingSession({resolve:()=>nativeSourceClassModule,maxModules:1});
const loaded=await session.load('commented',new ApplicationDomain(ApplicationDomain.currentDomain));
const Subject:any=loaded.getDefinition('cases.TimerOwner'),rows:any[]=[],subject=new Subject();
const record=(id:string)=>rows.push({id,value:subject.state()});const wait=()=>new Promise<void>(resolve=>setTimeout(resolve,50));
record('initial');subject.schedule('cancelled');record('queued');subject.cancel();record('cancelled');subject.schedule('replaced');subject.schedule('kept');record('rescheduled');
await wait();record('first-callback');subject.cancel();record('cancel-completed');subject.schedule('second');record('second-queued');await wait();record('second-callback');
session.retire();(globalThis as any).rows=rows;})().catch(e=>(globalThis as any).failure=String(e.stack));`);files.push(host);
 const program=ts.createProgram(files,{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,strict:true,strictNullChecks:false,useUnknownInCatchVariables:false,experimentalDecorators:true,noEmit:true,skipLibCheck:true,lib:['lib.es2020.d.ts','lib.dom.d.ts']});
 const diagnostics=ts.getPreEmitDiagnostics(program).map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n'));assert.deepEqual(diagnostics,[]);
 const built=await esbuild.build({entryPoints:[host],bundle:true,write:false,format:'iife',platform:'browser',target:'es2020',metafile:true,loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'}}),code=built.outputFiles[0].text;
 const context=vm.createContext({console,setTimeout,clearTimeout,AbortController,AbortSignal,DOMException,TextEncoder,TextDecoder});context.window=context;context.document={};vm.runInContext(code,context);await context.completion;assert.equal(context.failure,undefined);const node=JSON.parse(JSON.stringify(context.rows));assert.deepEqual(node,expected);
 const page=await browser.newPage();let web;try{await page.route('http://class-comments.test/**',route=>route.request().url().endsWith('/bundle.js')?route.fulfill({contentType:'text/javascript',body:code}):route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"default-src 'none'; script-src 'self'"},body:'<script src="/bundle.js"></script>'}));await page.goto('http://class-comments.test/');web=await page.evaluate(async()=>{await globalThis.completion;if(globalThis.failure)throw Error(globalThis.failure);return JSON.parse(JSON.stringify(globalThis.rows));});}finally{await page.close();}assert.deepEqual(web,node);
 const inputs=[...new Set([...Object.keys(built.metafile.inputs).map(f=>path.resolve(f)),...program.getSourceFiles().map(f=>f.fileName)])].map(file=>({file,sha256:hash(fs.readFileSync(file))}));runs.push({target,node,web,diagnostics,sources:selected,inputs});
 }
 const compilerInputs=['src','utils'].flatMap(folder=>fs.readdirSync(path.join(root,folder),{recursive:true}).filter(f=>f.endsWith('.ts')).map(f=>{const file=path.join(root,folder,f);return {file,sha256:hash(fs.readFileSync(file))};}));
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({runs,compilerInputs,runner:{file:__filename,sha256:hash(fs.readFileSync(__filename))}},null,2));console.log(JSON.stringify({out,rows:8,targets:2,realms:2,typeErrors:0}));
 }finally{await browser.close();}
}
