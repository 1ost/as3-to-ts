'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const api=require('../../lib'),{NativeGeneratedClassTraits:Projection}=require('../../lib/emit/native-generated-traits');
const root=path.resolve(__dirname,'../..'),engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2-namespace-traits-review');
const engineCommit='0e85a408b7b3cfe7041ec20e938b6a58309d3dca';
const ts=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const frozen=file=>execFileSync('git',['show',engineCommit+':tests/nativeGeneratedNamespaceTraits/'+file],{cwd:engine,maxBuffer:16*1024*1024});
const receipt=JSON.parse(frozen('evidence/receipt.json'));
const captures=[1,2].map(n=>{const file='run-'+n+'/capture.json',bytes=frozen('evidence/'+file);assert.equal(hash(bytes),receipt.artifacts[file]);return JSON.parse(bytes);});
assert.deepEqual(captures[0],captures[1]);const expected=captures[0].state.observations;assert.equal(expected.length,46);
const sourceFiles=Object.keys(receipt.artifacts).filter(file=>/^source\/cases\/[^/]+\.as$/.test(file));assert.equal(sourceFiles.length,9);
const record=source=>({source,sourceSha256:hash(source)});
const sources=Object.fromEntries(sourceFiles.map(file=>{const bytes=frozen('evidence/'+file);assert.equal(hash(bytes),receipt.artifacts[file]);return ['cases.'+path.basename(file,'.as'),record(bytes.toString('utf8'))];}));
const input={scope:'namespace-trait-projection',sources,providerModule:'./provider',inheritScriptClasses:true,
 scriptGlobalProviderModule:'./script',scriptDomainProvider:{module:'./domain',exportName:'scriptDomain'}};
const plan=api.createNativeGeneratedDeclarationPlan(input);
const projections=Object.fromEntries(plan.bindings.map(b=>[b.qname,new Projection(plan,input.scope,b.qname,sources[b.qname].source)]));
let guards=0;
const reject=action=>{assert.throws(action,/AS3_[A-Z_]+UNSUPPORTED/);guards++;};
for(const fake of [JSON.parse(JSON.stringify(plan)),{...plan}])reject(()=>new Projection(fake,input.scope,'cases.RegistryBase',sources['cases.RegistryBase'].source));
reject(()=>new Projection(plan,input.scope,'cases.RegistryBase',sources['cases.RegistryBase'].source+' '));
const mutate=(q,from,to)=>{
 const source=sources[q].source;assert(source.includes(from));const changed={...sources,[q]:record(source.replace(from,to))};
 const p=api.createNativeGeneratedDeclarationPlan({...input,sources:changed});
 return new Projection(p,input.scope,'cases.RegistryGrandchild',changed['cases.RegistryGrandchild'].source);
};
reject(()=>mutate('cases.RegistryBase','alpha function get count()','final alpha function get count()'));
reject(()=>mutate('cases.RegistryBase','alpha function set count(n:int)','alpha function set count(n:String)'));
reject(()=>mutate('cases.RegistryChild','override beta function read():String','override beta function read(n:int):String'));
reject(()=>mutate('cases.RegistryChild','override beta function read()','beta function read()'));
reject(()=>mutate('cases.RegistryGrandchild','override alpha function set count(n:int)','override alpha function set absent(n:int)'));
reject(()=>mutate('cases.alpha','urn:op2:namespace-traits:a','urn:op2:namespace-traits:b'));
reject(()=>projections['cases.RegistryChild'].emitDefinition('domain','Array','getBase()'));
const native=frozen('native.ts').toString('utf8');
function projectedNative(dir,mutation){
 let source=native.replace('registerAS3GeneratedClass,','registerAS3GeneratedClass as engineRegister,');assert.notEqual(source,native);
 const relative=path.relative(dir,path.join(engine,'src')).replaceAll('\\','/');source=source.replaceAll('../../src/',relative+'/');
 source+='\n// Compiler-generated registrar definitions; protocol bodies above are retained engine probes.\n';
 source+='function registerAS3GeneratedClass(ctor:any,definition:any){\n';
 source+='const Base=definition.instanceBase; switch(definition.metadata.name){\n';
 for(const [q,p]of Object.entries(projections)){
  const b=p.binding;
  source+='case '+JSON.stringify(b.reflectedName)+':{const domain={'+JSON.stringify(b.tokenExport)+':definition.declaration.type,'+JSON.stringify(b.publishExport)+':definition.declaration.publishGeneration};\n';
  source+='const projected:Parameters<typeof engineRegister>[1]='+p.emitDefinition('domain','Array',b.base?'Base':undefined)+';\n';
  if(mutation==='method-uri'&&q==='cases.RegistryBase')source+='projected.instanceMethods[1].uri="urn:wrong";\n';
  if(mutation==='constant-uri'&&q==='cases.RegistryBase')source+='projected.instanceConstants[2].uri=projected.instanceConstants[1].uri;\n';
  source+='return engineRegister(ctor,projected);}\n';
 }
 source+='default:throw Error("Unexpected protocol class: "+definition.metadata.name);}}\n';return source;
}
async function main(){
 const cache=path.join(root,'.cache/native-generated-namespace-traits');fs.mkdirSync(cache,{recursive:true});const out=fs.mkdtempSync(path.join(cache,'projection-'));
 const {chromium}=require(require.resolve('playwright',{paths:[path.join(engine,'../op2-html5/game-client-laya'),engine]})),browser=await chromium.launch({headless:true});
 const runs=[];
 try{for(const target of ['ES5','ES2015']){
  const dir=path.join(out,target);fs.mkdirSync(dir);const file=path.join(dir,'protocol.ts');fs.writeFileSync(file,projectedNative(dir));
  const program=ts.createProgram([file],{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,strict:true,strictNullChecks:false,useUnknownInCatchVariables:false,noEmit:true,skipLibCheck:true,experimentalDecorators:true,lib:['lib.es2020.d.ts','lib.dom.d.ts']});
  const diagnostics=ts.getPreEmitDiagnostics(program).map(d=>({file:d.file?.fileName,code:d.code,text:ts.flattenDiagnosticMessageText(d.messageText,'\n')}));
  fs.writeFileSync(path.join(dir,'types.json'),JSON.stringify(diagnostics,null,2));assert.deepEqual(diagnostics,[]);
  const typeInputs=program.getSourceFiles().map(s=>({file:s.fileName,sha256:hash(fs.readFileSync(s.fileName))}));
  const build=async mutation=>{
   const source=mutation?projectedNative(dir,mutation):fs.readFileSync(file,'utf8');
   const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget[target],module:ts.ModuleKind.CommonJS},reportDiagnostics:true});assert.deepEqual(compiled.diagnostics,[]);
   if(!mutation)fs.writeFileSync(path.join(dir,'protocol.js'),compiled.outputText);
   return esbuild.build({stdin:{contents:compiled.outputText,resolveDir:dir,sourcefile:'protocol.js',loader:'js'},bundle:true,write:false,format:'iife',globalName:'NamespaceProjection',platform:'browser',target:'es2020',metafile:true});
  };
  const execute=async built=>{
   const code=built.outputFiles[0].text,context=vm.createContext({console,TextEncoder,TextDecoder});vm.runInContext(code,context);
   let node;try{node={rows:JSON.parse(JSON.stringify(context.NamespaceProjection.run()))};}catch(e){node={error:String(e.message)};}
   const page=await browser.newPage();try{
    await page.route('http://namespace-projection.test/**',route=>route.request().url().endsWith('/bundle.js')?route.fulfill({contentType:'text/javascript',body:code}):route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"default-src 'none'; script-src 'self'"},body:'<script src="/bundle.js"></script>'}));
    await page.goto('http://namespace-projection.test/');const web=await page.evaluate(()=>{try{return {rows:globalThis.NamespaceProjection.run()};}catch(e){return {error:String(e.message)};}});assert.deepEqual(node,web);return {node,web};
   }finally{await page.close();}
  };
  const built=await build(),actual=await execute(built);assert.deepEqual(actual.node.rows,expected);fs.writeFileSync(path.join(dir,'bundle.js'),built.outputFiles[0].text);
  const controls=[];for(const name of ['method-uri','constant-uri']){const result=await execute(await build(name));assert.match(result.node.error,/AS3_GENERATED_CLASS_UNSUPPORTED/);controls.push({name,...result});}
  runs.push({target,actual,controls,typecheck:{diagnostics,inputs:typeInputs},inputs:Object.keys(built.metafile.inputs).map(f=>({file:path.resolve(f),sha256:hash(fs.readFileSync(f))}))});
 }
 const report={scope:'Compiler-generated trait definitions with retained native protocol bodies; full AS3 Class emission remains unqualified',engineCommit,
  engineRoot:engine,compilerRoot:root,runnerSha256:hash(fs.readFileSync(__filename)),
  oracleRows:46,guards,sourceHashes:plan.sourceHashes,receiptSha256:hash(frozen('evidence/receipt.json')),nativeProtocolSha256:hash(frozen('native.ts')),
  compilerInputs:['native-generated-traits','native-generated-namespaces','native-namespaces','native-source-ancestry'].map(name=>({file:'src/emit/'+name+'.ts',sha256:hash(fs.readFileSync(path.join(root,'src/emit',name+'.ts')))})),runs};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:'passed',out,rows:46,targets:2,realms:2,guards,appliedControls:2,typeErrors:0}));
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
