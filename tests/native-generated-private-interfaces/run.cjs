const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const api=require('../../lib'),accessor=require('../../lib/emit/native-generated-declarations');
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2');
const ts=require('typescript'),modern=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const evidence=path.join(engine,'tests/nativeFlashOracle/file-local-interfaces'),expected=require(path.join(evidence,'verify.cjs'));
const root=path.resolve('.cache/native-generated-private-interfaces');fs.mkdirSync(root,{recursive:true});const out=fs.mkdtempSync(path.join(root,'run-'));
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const sources=Object.fromEntries(['FileLocalInterfacesProbe','localinterfaces.First','localinterfaces.Second','contracts.IBase'].map(q=>{
 const source=fs.readFileSync(path.join(evidence,'source',q.replaceAll('.','/')+'.as'),'utf8');return [q,{source,sourceSha256:hash(source)}];
}));
const provider=n=>path.join(engine,'src/layaAir/flash/utils',n).replaceAll('\\','/');
const applicationDomain=path.join(engine,'src/layaAir/flash/system/ApplicationDomain').replaceAll('\\','/');
const input={scope:'private-interface-header',sources,providerModule:provider('AS3DeclarationType'),interfaceProviderModule:provider('AS3Type'),scriptGlobalProviderModule:provider('AS3ScriptGlobal'),scriptDomainProvider:{module:'./domain',exportName:'scriptDomain'},inheritScriptClasses:true};
const plan=api.createNativeGeneratedDeclarationPlan(input);
assert.equal(plan.bindings.length,3);assert.equal(plan.privateBindings.length,3);assert.equal(plan.interfaces.length,1);assert.equal(plan.privateInterfaces.length,3);
const [base,a,b]=plan.privateInterfaces;
assert.equal(base.declaration.name,'ILocalBase');assert.equal(a.declaration.name,'IValue');assert.equal(b.declaration.name,'IValue');
assert.deepEqual(a.bases,['contracts.IBase',base.identity]);assert.deepEqual(b.bases,['contracts.IBase']);
assert.equal(plan.bindings.find(b=>b.qname==='localinterfaces.First').interfaces[0],a.identity);
assert.equal(plan.privateBindings.find(b=>b.declaration.sourceOwner==='localinterfaces.First'&&b.declaration.name==='Helper').interfaces[0],a.identity);
// First/Helper/Child each satisfy three IValue, two ILocalBase and one IBase
// members; Second's Helper satisfies three IValue and one IBase members.
assert.equal(plan.interfaceContracts.members.length,5);assert.equal(plan.interfaceContracts.implementations.length,22);
for(const binding of plan.privateInterfaces){
 assert.equal(binding.declaration.packageQName,null);assert.equal(binding.declaration.kind,'interface');
 assert(!('qname' in binding));assert(!('publishExport' in binding));assert(!('lexicalExport' in binding));
 assert(!plan.interfaces.some(i=>i.qname===binding.identity));assert(!plan.bindings.some(i=>i.qname===binding.identity));
 assert(Object.isFrozen(binding)&&Object.isFrozen(binding.bases));
 const unit=accessor.nativeGeneratedSourceUnit(plan,binding.identity);
 assert.equal(unit.source,sources[binding.declaration.sourceOwner].source);
 assert.equal(accessor.nativeGeneratedDeclarationNode(plan,binding.identity).findChild(require('../../lib/syntax/nodeKind').default.NAME).text,binding.declaration.name);
 assert.equal(accessor.nativeGeneratedDeclarationResolver(plan,binding.identity,unit.source).resolve('IValue'),binding===b?b.identity:a.identity);
}
assert(plan.references.some(r=>r.kind==='interface'&&r.owner===a.identity&&r.identity===base.identity));
assert(!plan.references.some(r=>r.kind==='private-declaration'&&plan.privateInterfaces.some(b=>b.identity===r.identity)));
let guards=0;const reject=(fn,re)=>{assert.throws(fn,re);guards++;};
reject(()=>api.createNativeGeneratedDeclarationPlan({...input,interfaceProviderModule:undefined}),/explicit source interface provider/);
reject(()=>api.emitNativeSourceClassModule({plan,target:'ES2015',emitterOptions:{},externalModules:[],loadingSessionModule:'./session'}),/native Class and reference providers/);
reject(()=>accessor.nativeGeneratedClassDeclaration(plan,a.identity),/cannot publish a class/);
assert.equal(accessor.nativeGeneratedClassDeclaration(plan,'localinterfaces.First').interfaces[0],a.identity);
reject(()=>accessor.nativeGeneratedSourceUnit({...plan},a.identity),/exact planned/);
reject(()=>accessor.nativeGeneratedDeclarationSource(plan,plan.scope,a.identity,sources['localinterfaces.Second'].source),/exact planned/);
const change=(from,to)=>{const source=sources['localinterfaces.First'].source.replace(from,to);assert.notEqual(source,sources['localinterfaces.First'].source);return {...input,sources:{...sources,'localinterfaces.First':{source,sourceSha256:hash(source)}}};};
reject(()=>api.createNativeGeneratedDeclarationPlan(change('extends IBase, ILocalBase','extends IBase, IBase')),/duplicate file-private interface base/);
reject(()=>api.createNativeGeneratedDeclarationPlan(change('extends IBase, ILocalBase','extends IValue')),/cyclic source interface inheritance/);
reject(()=>api.createNativeGeneratedDeclarationPlan(change('extends IBase, ILocalBase','extends Helper')),/must identify an interface/);
reject(()=>api.createNativeGeneratedDeclarationPlan(change('extends IBase, ILocalBase','extends Missing')),/base requires exact source interface/);
reject(()=>api.createNativeGeneratedDeclarationPlan(change('function set value(n:int):void;','function set value(n:Number):void;')),/interface|accessor/);
reject(()=>api.createNativeGeneratedDeclarationPlan(change('public function add(n:int):int','public function add(n:Number):int')),/interface|implementation/);
reject(()=>api.createNativeGeneratedDeclarationPlan(change('class Helper implements IValue','class Helper implements IValue, IValue')),/duplicate file-private implements/);
reject(()=>api.createNativeGeneratedDeclarationPlan({...input,sources:{...sources,'localinterfaces.First':{...sources['localinterfaces.First'],referenceOnly:true}}}),/reference-only/);
fs.writeFileSync(path.join(out,'headers.ts'),plan.moduleSource);
fs.writeFileSync(path.join(out,'domain.ts'),'import {createAS3ScriptDomain} from '+JSON.stringify(provider('AS3ScriptGlobal'))+';import {ApplicationDomain} from '+JSON.stringify(applicationDomain)+';export const scriptDomain=createAS3ScriptDomain(ApplicationDomain.createIsolatedScope());');
const program=modern.createProgram([path.join(out,'headers.ts'),path.join(out,'domain.ts'),...['glsl.d.ts','spine.d.ts'].map(n=>path.join(engine,'src/layaAir/tslibs',n))],{target:modern.ScriptTarget.ES2020,module:modern.ModuleKind.CommonJS,resolveJsonModule:true,esModuleInterop:true,strict:true,strictNullChecks:false,useUnknownInCatchVariables:false,experimentalDecorators:true,noEmit:true,skipLibCheck:true,lib:['lib.es2020.d.ts','lib.dom.d.ts','lib.dom.iterable.d.ts']});
const diagnostics=modern.getPreEmitDiagnostics(program).map(d=>modern.flattenDiagnosticMessageText(d.messageText,'\n'));assert.deepEqual(diagnostics,[]);
async function main(){
 const {chromium}=require(require.resolve('playwright',{paths:[path.resolve('../op2-html5/game-client-laya'),engine]}));
 const browser=await chromium.launch({headless:true}),results=[];
 try{for(const target of ['ES5','ES2015']){
  const compiled=ts.transpileModule(plan.moduleSource,{compilerOptions:{target:ts.ScriptTarget[target],module:ts.ModuleKind.CommonJS},reportDiagnostics:true});assert.deepEqual(compiled.diagnostics,[]);
  const harness='import {ApplicationDomain} from '+JSON.stringify(applicationDomain)+';import * as declarations from '+JSON.stringify(provider('AS3DeclarationType'))+';import * as types from '+JSON.stringify(provider('AS3Type'))+';import * as script from '+JSON.stringify(provider('AS3ScriptGlobal'))+';\n'+
   'function load(){const domain=script.createAS3ScriptDomain(ApplicationDomain.createIsolatedScope());const exports:any={};const external:any={'+JSON.stringify(input.providerModule)+':declarations,'+JSON.stringify(input.interfaceProviderModule)+':types,'+JSON.stringify(input.scriptGlobalProviderModule)+':script,"./domain":{scriptDomain:domain}};const require=(name:string)=>external[name];'+compiled.outputText+';return {headers:exports,domain};}\n'+
   'export function run(){const one=load(),two=load(),a=one.headers.'+a.tokenExport+',b=one.headers.'+b.tokenExport+',base=one.headers.'+base.tokenExport+',pub=one.headers.'+plan.interfaces[0].tokenExport+';const rows=[types.isAS3Interface(a),types.isAS3Interface(b),!declarations.isAS3DeclarationType(a),a!==b,a.name==="::IValue"&&b.name==="::IValue",base.name==="::ILocalBase",types.as3ReferenceTypeExtends(a,base),types.as3ReferenceTypeExtends(a,pub),types.as3ReferenceTypeExtends(b,pub),!types.as3ReferenceTypeExtends(b,base),!types.as3ReferenceTypeExtends(a,b),a!==two.headers.'+a.tokenExport+',!types.as3ReferenceTypeExtends(a,two.headers.'+base.tokenExport+'),types.as3CoerceReference(undefined,a)===null,types.as3CoerceReference(null,a)===null,types.as3As({},a)===null,["IValue","::IValue","localinterfaces.IValue"].every(n=>!script.selectAS3ScriptDomainType(one.domain,n)),!("IValue" in one.headers)];let rejected=false;try{types.as3CoerceReference({},a);}catch(e){rejected=true;}rows.push(rejected);if(rows.some(x=>x!==true))throw Error(JSON.stringify(rows));return rows.length;}';
  const entry=path.join(out,target+'.ts');fs.writeFileSync(entry,harness);const nodeFile=path.join(out,target+'.cjs');esbuild.buildSync({entryPoints:[entry],outfile:nodeFile,bundle:true,platform:'node',format:'cjs',target:'es2020'});const checks=require(nodeFile).run();
  const bundled=esbuild.buildSync({stdin:{contents:harness+';globalThis["privateInterfaceResult"]=run();',resolveDir:out,loader:'ts'},write:false,bundle:true,platform:'browser',format:'iife',target:'es2020'}).outputFiles[0].text;
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.route('http://private-interface.test/**',route=>route.fulfill({status:200,contentType:route.request().url().endsWith('.js')?'application/javascript':'text/html',headers:{'Content-Security-Policy':"default-src 'none'; script-src 'self'"},body:route.request().url().endsWith('.js')?bundled:'<script src="/case.js"></script>'}));await page.goto('http://private-interface.test/');await page.waitForFunction(()=>globalThis.privateInterfaceResult!==undefined);assert.equal(await page.evaluate(()=>globalThis.privateInterfaceResult),checks);assert.deepEqual(errors,[]);await page.close();results.push({target,checks,typeErrors:diagnostics.length});
 }}finally{await browser.close();}
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({qualification:'File-private interface headers and contracts only; complete source replay is in full.cjs',flashEvidenceRows:expected.length,guards,results,sourceHashes:plan.sourceHashes},null,2)+'\n');console.log(JSON.stringify({out,guards,results}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
