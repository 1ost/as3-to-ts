const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm');
const {compile,engine,root,sources,hash}=require('../native-generated-anonymous-members/compile.cjs');
const parse=require('../../lib/parse'),K=require('../../lib/syntax/nodeKind').default;
const ts=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const comments=['/** Code is linked into Game.swf. Only UI libraries are downloaded. */','/* plain */','/**\n * Documentation\n */','/*\r\n Multi-line\r\n */','/**/'];
const out=fs.mkdtempSync(path.join(root,'.cache/class-comments-'));
const baseline=process.argv.includes('--baseline'),checks=[];
for(const comment of comments){
 const source='package cases {\n'+comment+'\npublic class Commented { public function value():int{return 7;} } }';
 const ast=parse('Commented.as',source),nodes=[];const walk=n=>{if(!n)return;if([K.AS_DOC,K.MULTI_LINE_COMMENT].includes(n.kind))nodes.push(n);n.children.forEach(walk);};walk(ast);
 const expectedStart=source.indexOf(comment),record={comment,expectedStart,actual:nodes.map(n=>({start:n.start,end:n.end,text:n.text}))};checks.push(record);
 if(!baseline){assert.equal(nodes.length,1);assert.equal(nodes[0].start,expectedStart);assert.equal(nodes[0].end,expectedStart+comment.length);assert.equal(source.slice(nodes[0].start,nodes[0].end),comment);}
}
if(baseline){const selected=Object.fromEntries(Object.entries(sources).map(([q,s])=>{const source=s.source.replace('public class',comments[0]+'\npublic class');return [q,{source,sourceSha256:hash(source)}];}));
 const failures=['ES5','ES2015'].map(target=>{let error;try{compile(path.join(out,target),target,selected);}catch(e){error=e.message;}assert.match(error||'',/intermediate native syntax/);return {target,error};});
 const report={checks,failures};fs.writeFileSync(path.join(__dirname,'baseline.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({baseline:true,failures}));
}else main().catch(e=>{console.error(e);process.exitCode=1;});
async function main(){
 const expected=require('../native-generated-anonymous-members/oracle/verify.cjs');
 const {chromium}=require(require.resolve('playwright',{paths:[path.join(engine,'../op2-html5/game-client-laya'),engine]})),browser=await chromium.launch({headless:true}),runs=[];
 try{for(const target of ['ES5','ES2015'])for(let variant=0;variant<comments.length;variant++){
 const selected=Object.fromEntries(Object.entries(sources).map(([q,s])=>{const source=s.source.replace('public class',comments[variant]+'\npublic class');return [q,{source,sourceSha256:hash(source)}];}));
 const dir=path.join(out,target+'-'+variant),{artifact,files}=compile(dir,target,selected);
 const flash=path.relative(dir,path.join(engine,'src/layaAir/flash')).replaceAll('\\','/');
 const host=path.join(dir,'entry.ts');fs.writeFileSync(host,`import {ApplicationDomain} from '${flash}/system/ApplicationDomain';
import {createNativeSourceClassLoadingSession} from '${flash}/utils/NativeSourceClassLoadingSession';
import {nativeSourceClassModule} from './factory.js';
(globalThis as any).completion=(async()=>{const session=createNativeSourceClassLoadingSession({resolve:()=>nativeSourceClassModule,maxModules:1});
const loaded=await session.load('commented',new ApplicationDomain(ApplicationDomain.currentDomain));
const Subject:any=loaded.getDefinition('cases.MemberClosure'),rows:any[]=[],first=new Subject(),second=new Subject();
const a=first.begin('alpha'),b=second.begin('beta');rows.push({id:'pending',value:[first.state(),second.state()]});
const foreign={_pending:77,_loading:'foreign',_calls:88};a.call(foreign);const original=first.value('alpha');
rows.push({id:'foreign-call',value:[first.state(),second.state(),foreign._pending,foreign._loading,foreign._calls,original.name]});
b.apply(null,[]);rows.push({id:'second-owner',value:[first.state(),second.state(),second.value('beta').name]});
a();rows.push({id:'repeat-retains-value',value:[first.value('alpha')===original,first.state()]});
const failure=first.begin('');failure.call(second);rows.push({id:'caught-error',value:[first.state(),second.state()]});
const newer=first.begin('gamma');a.call(second);newer();rows.push({id:'old-and-new-captures',value:[first.state(),first.value('alpha')===original,first.value('gamma').name,second.state()]});
const cleared=second.begin(null);cleared();rows.push({id:'null-name-error',value:second.state()});session.retire();(globalThis as any).rows=rows;})().catch(e=>(globalThis as any).failure=String(e.stack));`);files.push(host);
 const program=ts.createProgram(files,{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,strict:true,strictNullChecks:false,useUnknownInCatchVariables:false,experimentalDecorators:true,noEmit:true,skipLibCheck:true,lib:['lib.es2020.d.ts','lib.dom.d.ts']});
 const diagnostics=ts.getPreEmitDiagnostics(program).map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n'));assert.deepEqual(diagnostics,[]);
 const built=await esbuild.build({entryPoints:[host],bundle:true,write:false,format:'iife',platform:'browser',target:'es2020',metafile:true,loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'}}),code=built.outputFiles[0].text;
 const context=vm.createContext({console,setTimeout,clearTimeout,AbortController,AbortSignal,DOMException,TextEncoder,TextDecoder});context.window=context;context.document={};vm.runInContext(code,context);await context.completion;assert.equal(context.failure,undefined);const node=JSON.parse(JSON.stringify(context.rows));assert.deepEqual(node,expected);
 const page=await browser.newPage();let web;try{await page.route('http://class-comments.test/**',route=>route.request().url().endsWith('/bundle.js')?route.fulfill({contentType:'text/javascript',body:code}):route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"default-src 'none'; script-src 'self'"},body:'<script src="/bundle.js"></script>'}));await page.goto('http://class-comments.test/');web=await page.evaluate(async()=>{await globalThis.completion;if(globalThis.failure)throw Error(globalThis.failure);return JSON.parse(JSON.stringify(globalThis.rows));});}finally{await page.close();}assert.deepEqual(web,node);
 const inputs=[...new Set([...Object.keys(built.metafile.inputs).map(f=>path.resolve(f)),...program.getSourceFiles().map(f=>f.fileName)])].map(file=>({file,sha256:hash(fs.readFileSync(file))}));runs.push({target,variant,comment:comments[variant],node,web,diagnostics,sources:selected,inputs});
 }
 const compilerInputs=['src','utils'].flatMap(folder=>fs.readdirSync(path.join(root,folder),{recursive:true}).filter(f=>f.endsWith('.ts')).map(f=>{const file=path.join(root,folder,f);return {file,sha256:hash(fs.readFileSync(file))};}));
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,runs,compilerInputs,runner:{file:__filename,sha256:hash(fs.readFileSync(__filename))}},null,2));console.log(JSON.stringify({out,variants:5,rows:7,targets:2,realms:2,typeErrors:0}));
 }finally{await browser.close();}
}
