const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),cp=require('node:child_process'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2-source-namespace-review'),baselineRoot=path.resolve(process.env.AS3_BASELINE_REPOSITORY||'../as3-to-ts-op2-source-namespace-review');
const hash=v=>crypto.createHash('sha256').update(v).digest('hex'),api=require('../../lib'),ts=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
assert.equal(cp.execFileSync('git',['rev-parse','HEAD'],{cwd:baselineRoot,encoding:'utf8'}).trim(),'161810596b2c9578644ae70225f05a29f31792c5');
assert.equal(cp.execFileSync('git',['diff','--name-only','HEAD','--','src'],{cwd:baselineRoot,encoding:'utf8'}).trim(),'');
fs.mkdirSync(path.join(root,'.cache/native-large-declarations'),{recursive:true});const out=fs.mkdtempSync(path.join(root,'.cache/native-large-declarations/run-'));
cp.execFileSync(process.execPath,[path.join(baselineRoot,'node_modules/typescript/bin/tsc'),'--project',path.join(baselineRoot,'tsconfig.json'),'--outDir',path.join(out,'baseline-lib'),'--pretty','false']);
const baseline=require(path.join(out,'baseline-lib')),provider=n=>{const p=path.relative(out,path.join(engine,'src/layaAir/flash/utils',n)).replaceAll('\\','/');return p.startsWith('.')?p:'./'+p;};
const sources={};for(let i=0;i<1400;i++){const source='package large {public class C'+i+(i>0&&i%3===0?' extends C'+(i-1):'')+' {}}';sources['large.C'+i]={source,sourceSha256:hash(source)};}
const input={scope:'large-declarations',sources,providers:{},providerModule:provider('AS3GeneratedClass'),interfaceProviderModule:provider('AS3Type'),scriptGlobalProviderModule:provider('AS3ScriptGlobal'),scriptDomainProvider:{module:'./cohortDomain',exportName:'scriptDomain'},inheritScriptClasses:true};
const before=baseline.createNativeGeneratedDeclarationPlan(input),after=api.createNativeGeneratedDeclarationPlan(input);
for(const count of [1,32,511]){const small={...input,sources:Object.fromEntries(Object.entries(sources).slice(0,count))};assert.equal(api.createNativeGeneratedDeclarationPlan(small).moduleSource,baseline.createNativeGeneratedDeclarationPlan(small).moduleSource,'Compact cohort must remain byte-stable');}
fs.writeFileSync(path.join(out,'cohortDomain.ts'),'import {AS3ScriptDomain} from '+JSON.stringify(provider('AS3ScriptGlobal'))+';export declare const scriptDomain:AS3ScriptDomain;');
const typechecks=[];
for(const [name,plan]of [['baseline',before],['current',after]]){
 const file=path.join(out,name+'.ts');fs.writeFileSync(file,plan.moduleSource);
 const program=ts.createProgram([file,...['glsl.d.ts','spine.d.ts'].map(f=>path.join(engine,'src/layaAir/tslibs',f))],{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,strict:true,strictNullChecks:false,useUnknownInCatchVariables:false,experimentalDecorators:true,noEmit:true,skipLibCheck:true,lib:['lib.es2020.d.ts','lib.dom.d.ts','lib.dom.iterable.d.ts']});
 const diagnostics=ts.getPreEmitDiagnostics(program).map(d=>({code:d.code,text:ts.flattenDiagnosticMessageText(d.messageText,'\n')}));
 if(name==='baseline'){assert.equal(diagnostics.filter(d=>d.code===2563).length,1);assert.equal(diagnostics.filter(d=>d.code===7006).length,1400);}else assert.deepEqual(diagnostics,[]);
 typechecks.push({name,diagnostics,source:plan.moduleSource,inputs:program.getSourceFiles().map(f=>({file:f.fileName,sha256:hash(fs.readFileSync(f.fileName))}))});
}
async function main(){
 const {chromium}=require(require.resolve('playwright',{paths:[path.resolve('../op2-html5/game-client-laya'),engine]})),browser=await chromium.launch({headless:true}),results=[];
 const modules=[...new Set([...after.moduleSource.matchAll(/from ("[^"]+")/g)].map(m=>JSON.parse(m[1])))].filter(m=>m!=='./cohortDomain');
 try{for(const target of ['ES5','ES2015']){
  const compiled=ts.transpileModule(after.moduleSource,{compilerOptions:{target:ts.ScriptTarget[target],module:ts.ModuleKind.CommonJS}}).outputText;
  const imports=modules.map((m,i)=>'import * as p'+i+' from '+JSON.stringify(m)+';').join('\n');
  const app=path.relative(out,path.join(engine,'src/layaAir/flash/system/ApplicationDomain')).replaceAll('\\','/');
  const checks=`
const parent=new ApplicationDomain(ApplicationDomain.currentDomain), local=evaluate(createAS3ScriptDomain(parent));
const bindings=${JSON.stringify(after.bindings.map(b=>({qname:b.qname,base:b.base,token:b.tokenExport,publish:b.publishExport})))}, values=[],byName=new Map(),checks=[];let resolves=0;
const check=(name,value)=>{if(!value)throw new Error(name);checks.push(name);};
for(const b of bindings){const Parent=byName.get(b.base),value=Parent?class Fixture extends Parent{}:class Fixture{};registerFlashTypeMetadata(value,{name:local[b.token].name,base:b.base?b.base.replace(/\.([^.]*)$/,'::$1'):'Object',isDynamic:false,isFinal:false,instance:{methods:[],accessors:[],variables:[],constants:[]},statics:{methods:[],accessors:[],variables:[],constants:[]}});local[b.publish](value);values.push(value);byName.set(b.qname,value);}
parent.publishOwnedSourceClasses(bindings.map((b,i)=>({name:b.qname,declaration:local[b.token],resolve:()=>{resolves++;return values[i];}})),()=>{});
const child=evaluate(createAS3ScriptDomain(new ApplicationDomain(parent)));
check('selection stays lazy',resolves===0);
check('all inherited headers preserve identity',bindings.every(b=>child[b.token]===local[b.token]));
check('all local headers are distinct',new Set(bindings.map(b=>local[b.token])).size===1400);
let rejected=0;for(const b of bindings){try{child[b.publish](function Wrong(){});}catch(e){if(String(e).includes('Inherited Class cannot publish'))rejected++;else throw e;}}
check('inherited headers reject child publication',rejected===1400);
const sibling=evaluate(createAS3ScriptDomain(new ApplicationDomain(ApplicationDomain.currentDomain)));
check('all sibling headers are independent',bindings.every(b=>sibling[b.token]!==local[b.token]));
check('lookup resolves the selected Class',parent.getDefinition(bindings[1399].qname)===values[1399]&&resolves===1);
globalThis.result={checks,classes:1400};`;
  const prefix=imports+'\nimport {ApplicationDomain} from '+JSON.stringify(app)+';\nimport {createAS3ScriptDomain} from '+JSON.stringify(provider('AS3ScriptGlobal'))+';\nimport {registerFlashTypeMetadata} from '+JSON.stringify(provider('FlashTypeMetadata'))+';\n';
  const make=body=>prefix+'function evaluate(scriptDomain){const exports={};const require=name=>{if(name==="./cohortDomain")return {scriptDomain};'+modules.map((m,i)=>'if(name==='+JSON.stringify(m)+')return p'+i+';').join('')+'throw new Error(name);};\n'+body+'\nreturn exports;}\n'+checks;
  const entry=path.join(out,'entry-'+target+'.ts');fs.writeFileSync(entry,make(compiled));
  const build=()=>esbuild.build({entryPoints:[entry],bundle:true,write:false,format:'iife',platform:'browser',target:'es2020',metafile:true,loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'}});
  const built=await build(),code=built.outputFiles[0].text;
  const execute=text=>{const context=vm.createContext({console,setTimeout,clearTimeout,performance});context.window=context;context.document={};new vm.Script(text).runInContext(context);return JSON.parse(JSON.stringify(context.result));};
  const node=execute(code),page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('http://large-declarations.test/**',route=>route.request().url().endsWith('/bundle.js')?route.fulfill({contentType:'text/javascript',body:code}):route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"script-src 'self'"},body:'<!doctype html><script src="/bundle.js"></script>'}));
  await page.goto('http://large-declarations.test/');const web=await page.evaluate(()=>globalThis.result);await page.close();assert.deepEqual(web,node);assert.deepEqual(errors,[]);
  const inputs=Object.keys(built.metafile.inputs).map(file=>({file:path.resolve(file),sha256:hash(fs.readFileSync(file))}));
  const mutation=compiled.replace('return selection ? inherited() : local();','return local();');assert.notEqual(mutation,compiled);
  fs.writeFileSync(entry,make(mutation));const changed=await build();assert.throws(()=>execute(changed.outputFiles[0].text),/all inherited headers preserve identity/);fs.writeFileSync(entry,make(compiled));
  results.push({target,node,web,errors,mutations:1,inputs});console.log(JSON.stringify({target,classes:1400,checks:node.checks.length,mutations:1,typeErrors:0}));
 }}finally{await browser.close();}
 const compilerInputs=fs.readdirSync(path.join(root,'src'),{recursive:true}).filter(f=>f.endsWith('.ts')).map(f=>({file:path.join(root,'src',f),sha256:hash(fs.readFileSync(path.join(root,'src',f)))}));
 for(const item of [...compilerInputs,...typechecks.flatMap(t=>t.inputs),...results.flatMap(r=>r.inputs)])assert.equal(hash(fs.readFileSync(item.file)),item.sha256,item.file);
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({typechecks,results,compilerInputs,runnerSha256:hash(fs.readFileSync(__filename)),compactByteStable:[1,32,511]},null,2));console.log(JSON.stringify({out,baselineDiagnostics:1401,currentDiagnostics:0}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
