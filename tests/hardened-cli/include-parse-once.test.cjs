'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{fork}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),sha=value=>crypto.createHash('sha256').update(value).digest('hex');
async function instrumentWorker(kind,out){
 await require('esbuild').build({entryPoints:[path.join(root,'src/hardened-cli/'+kind+'-worker.ts')],outfile:out,bundle:true,platform:'node',format:'cjs',logLevel:'silent',plugins:[{name:'count-parser-entry',setup(build){
  build.onResolve({filter:/parse\/index$/},()=>({path:'instrumented-parser',namespace:'parse-count'}));
  build.onResolve({filter:/^raw-parser$/},()=>({path:path.join(root,'src/parse/index.ts')}));
  build.onLoad({filter:/.*/,namespace:'parse-count'},()=>({loader:'ts',resolveDir:root,contents:`import parse from 'raw-parser';import {createHash} from 'node:crypto';export default function counted(sourcePath:string,content:string){process.send?.({parseCount:true,sourcePath,contentSha256:createHash('sha256').update(content).digest('hex')});return parse(sourcePath,content);}`}));
 }}]});
}
function execute(worker,kind,sourcePath,content,extra={}){return new Promise((resolve,reject)=>{
 const child=fork(worker,[],{stdio:['ignore','ignore','pipe','ipc']}),calls=[];let result,stderr='';const timer=setTimeout(()=>{child.kill();reject(new Error('Worker timeout'));},15000);
 child.stderr.on('data',value=>stderr+=value);child.on('error',reject);child.on('message',message=>{if(message.parseCount)calls.push(message);else result=message;});child.on('exit',code=>{clearTimeout(timer);try{assert.equal(code,0,stderr);assert.equal(stderr,'');assert.ok(result);resolve({result,calls});}catch(error){reject(error);}});
 child.send({sourcePath,content,...extra,...(kind==='parser'?{format:'normalized',maxAstBytes:4000000}:{maxResultBytes:4000000}),workerSha256:sha(fs.readFileSync(worker))});
});}
for(const kind of ['parser','declaration'])test(kind+' worker parses each ordinary source once and preserves include/hold results',async()=>{
 const dir=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'include-parse-once-'));try{
  const worker=path.join(dir,kind+'.cjs');await instrumentWorker(kind,worker);
  for(const [sourcePath,content] of [['unit/Plain.as','package unit {public class Plain {public var marker:String="include \\\"Ghost.as\\\"";}}'],['unit/Broken.as','package unit {public class Broken {public var value:int = ;}}']]){
   const plain=await execute(worker,kind,sourcePath,content),withInventory=await execute(worker,kind,sourcePath,content,{includeRootPath:sourcePath,includeFragments:[],includeEdges:[]});
   assert.equal(plain.calls.length,1);assert.equal(withInventory.calls.length,1);assert.deepEqual(withInventory.result,plain.result);
  }
  const sourcePath='unit/WithInclude.as',content='package unit {public class WithInclude { include "Fields.as"; }}',fragment='public var value:int=7;';
  const edge={ownerPath:sourcePath,directiveStart:content.indexOf('include'),directiveEnd:content.indexOf('";')+1,specifier:'Fields.as',targetPath:'unit/Fields.as',targetSha256:sha(fragment)};
  const args={includeRootPath:sourcePath,includeFragments:[{path:'unit/Fields.as',content:fragment,sha256:sha(fragment)}],includeEdges:[edge]};
  const included=await execute(worker,kind,sourcePath,content,args);assert.equal(included.result.ok,true,included.result.error);
  assert.equal(included.calls.filter(call=>call.contentSha256===sha(content)).length,0,'include branch must not parse original only to discard that AST');
  const expanded=content.slice(0,edge.directiveStart)+'\n'+fragment+'\n'+content.slice(edge.directiveEnd);
  assert.equal(included.calls.filter(call=>call.contentSha256===sha(expanded)).length,1);
  const value=JSON.parse(included.result.json);assert.equal(value.sourceSha256,sha(content));
  if(kind==='parser'){assert.equal(value.includeExpansion.expandedSha256,sha(expanded));assert.equal(value.includeExpansion.fragments[0].sha256,sha(fragment));}
  else assert.deepEqual(value.members.map(member=>[member.name,member.fieldType]),[['value','int']]);
  const missing=await execute(worker,kind,sourcePath,content,{...args,includeFragments:[]});assert.equal(missing.result.ok,false);assert.match(missing.result.error,/HARDENED_INCLUDE_MISSING/);
  const noEdges=await execute(worker,kind,sourcePath,content,{...args,includeEdges:[]});assert.equal(noEdges.result.ok,false);assert.match(noEdges.result.error,/parser directives differ/);assert.equal(noEdges.calls.filter(call=>call.contentSha256===sha(content)).length,0);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
