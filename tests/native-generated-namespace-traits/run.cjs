'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm');
const {compile,engine,root,frozen,sources,hash}=require('./compile.cjs');
const ts=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const receipt=JSON.parse(frozen('evidence/receipt.json'));
const captures=[1,2].map(n=>{const file='run-'+n+'/capture.json',bytes=frozen('evidence/'+file);assert.equal(hash(bytes),receipt.artifacts[file]);return JSON.parse(bytes);});
const expected=captures[0].state.observations;
assert.deepEqual(captures[0],captures[1]);assert.equal(expected.length,46);
function observer(flash){
 const protocol=frozen('native.ts').toString('utf8');
 const first=protocol.slice(protocol.indexOf(' const a=new Native(),'),protocol.indexOf('\nfunction projectionCases('));
 assert(first.startsWith(' const a='));assert(first.endsWith('}\r\n')||first.endsWith('}\n'));
 const last=protocol.slice(protocol.indexOf('function projectionRows(){'),protocol.indexOf('\nexport function guards()'));
 assert(last.startsWith('function projectionRows(){'));
 const imports=`import {ApplicationDomain} from '${flash}/system/ApplicationDomain';
import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '${flash}/utils/NativeSourceClassLoadingSession';
import {as3GetProperty as get,as3SetProperty as set,as3HasProperty as has,as3HasOwnProperty as own,as3CallProperty as call,as3DeleteProperty as del,as3EnumerableKeys} from '${flash}/utils/AS3Property';
import {QName} from '${flash}/utils/QName';import {describeRegisteredFlashType} from '${flash}/utils/FlashTypeMetadata';
const A='urn:op2:namespace-traits:a',B='urn:op2:namespace-traits:b';
const key=(uri:string,name:string)=>Symbol.for('as3.namespace.member@1:'+JSON.stringify([uri,name]));
const q=(uri:string,name:string)=>new QName(uri,name);
const av=key(A,'value'),bv=key(B,'value'),u=key(A,'unsigned'),label=key(A,'label'),count=key(A,'count');
const ar=key(A,'read'),br=key(B,'read'),total=key(A,'total'),stamp=key(A,'stamp'),marker=key(A,'marker'),amount=key(A,'amount');
export async function run(module:NativeSourceClassModule){
 const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:1});
 const loaded=await session.load('namespace-full',new ApplicationDomain(ApplicationDomain.currentDomain));
 const subject=(name:string):any=>loaded.getDefinition('cases.'+name);
 const Native=subject('NamespaceBase'),Child=subject('NamespaceChild'),Opened=subject('NamespaceOpened');
 const results=runRows();session.retire();return results;
 function runRows(){
`;
 const replacement="const Native=subject('RegistryBase'),Child=subject('RegistryChild'),Grand=subject('RegistryGrandchild'),ac=key(A,'count'),bc=key(B,'count'),ao=key(A,'options'),bo=key(B,'options'),base=new Native(),child=new Child(),grand=new Grand(),rows:any[]=[];";
 const original='const {Native,Child,Grand,ac,bc,ao,bo}=projectionCases(),base=new Native(),child=new Child(),grand=new Grand(),rows:any[]=[];';
 assert(last.includes(original));return imports+first+'\n'+last.replace(original,replacement)+'\n}\n';
}
async function main(){
 const cache=path.join(root,'.cache/native-generated-namespace-traits');fs.mkdirSync(cache,{recursive:true});const out=fs.mkdtempSync(path.join(cache,'full-'));
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
   await page.route('http://namespace-full.test/**',route=>route.request().url().endsWith('/bundle.js')?route.fulfill({contentType:'text/javascript',body:code}):route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"default-src 'none'; script-src 'self'"},body:'<script src="/bundle.js"></script>'}));
   await page.goto('http://namespace-full.test/');web=await page.evaluate(async()=>{await globalThis.completion;return globalThis.failure?{error:globalThis.failure}:{rows:globalThis.rows};});
  }finally{await page.close();}
  return {node,web};};
  const built=await build(),actual=await execute(built);assert.deepEqual(actual.node.rows,expected);assert.deepEqual(actual.web,actual.node);
  fs.writeFileSync(path.join(dir,'bundle.js'),built.outputFiles[0].text);
  const controls=[],factory=path.join(dir,'factory.js');
  const original=artifact.moduleSource;
  const initializer=/(__as3_classValue_\d+)\[__native_declarations_\d+\.namespaceKey\d+\]( = \(callableClass_\d+\.callableClassIntrinsics\.number\(10\) \| 0\);)/g;
  const initMatches=[...original.matchAll(initializer)];assert.equal(initMatches.length,1);
  const bindings=/^.*bindAS3Method\(this, globalThis\.Symbol\.for\("as3\.namespace\.member@1:.*\);\r?$/gm;
  const bindMatches=[...original.matchAll(bindings)];assert(bindMatches.length>0);
  try{for(const [name,mutated]of [['static-string-key',original.replace(initializer,'$1["total"]$2')],['unbound-methods',original.replace(bindings,'/* removed namespace binding control */')]]){
   assert.notEqual(mutated,original);fs.writeFileSync(factory,mutated);const result=await execute(await build());
   if(name==='static-string-key'){assert.equal(result.node.error,undefined);assert.equal(result.node.rows.length,46);assert.notDeepEqual(result.node.rows,expected);assert.deepEqual(result.node,result.web);}
   else {assert.match(result.node.error||'',/TypeError|AS3_/);assert.match(result.web.error||'',/TypeError|AS3_/);}
   controls.push({name,mutationSha256:hash(mutated),...result});
  }}finally{fs.writeFileSync(factory,original);}
  runs.push({target,actual,guards,controls,typecheck:{diagnostics,inputs:program.getSourceFiles().map(s=>({file:s.fileName,sha256:hash(fs.readFileSync(s.fileName))}))},inputs:Object.keys(built.metafile.inputs).map(file=>({file:path.resolve(file),sha256:hash(fs.readFileSync(file))})),artifact});
 }
 const compilerInputs=['src','utils'].flatMap(folder=>fs.readdirSync(path.join(root,folder),{recursive:true}).filter(f=>f.endsWith('.ts')).map(f=>{const file=path.join(folder,f).replaceAll('\\','/');return {file,sha256:hash(fs.readFileSync(path.join(root,file)))};}));
 const runnerInputs=['run.cjs','compile.cjs','guards.cjs'].map(file=>({file,sha256:hash(fs.readFileSync(path.join(__dirname,file)))}));
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({scope:'Complete generated original Classes with retained host observations',engineCommit:'0e85a408b7b3cfe7041ec20e938b6a58309d3dca',engineRoot:engine,compilerRoot:root,compilerInputs,runnerInputs,receiptSha256:hash(frozen('evidence/receipt.json')),nativeProtocolSha256:hash(frozen('native.ts')),sources,runs},null,2)+'\n');console.log(JSON.stringify({status:'passed',out,rows:46,targets:2,realms:2,guards:10,appliedControls:2,typeErrors:0}));
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
