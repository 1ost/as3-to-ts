const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const api=require('../../lib'),ts=require('typescript');
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2');
const modern=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const packet=path.join(engine,'tests/nativeFlashOracle/source-interface-declarations'),observations=require(path.join(packet,'verify.cjs'));
const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
const cache=path.resolve('.cache/native-generated-interfaces');fs.mkdirSync(cache,{recursive:true});const run=fs.mkdtempSync(path.join(cache,'run-'));
const modulePath=file=>{const name=path.relative(run,file).replaceAll('\\','/').replace(/\.ts$/,'');return name.startsWith('.')?name:'./'+name;};
const provider=name=>modulePath(path.join(engine,'src/layaAir/flash/utils',name+'.ts'));
const source=text=>({source:text,sourceSha256:hash(text)}),sources={};
for(const file of fs.readdirSync(path.join(packet,'source/contracts')))sources['contracts.'+file.slice(0,-3)]=source(fs.readFileSync(path.join(packet,'source/contracts',file),'utf8'));
const input={scope:'source-interface-oracle',providerModule:provider('AS3GeneratedClass'),interfaceProviderModule:provider('AS3Type'),sources};
const plan=api.createNativeGeneratedDeclarationPlan(input);
assert.equal(plan.bindings.length,5);assert.equal(plan.interfaces.length,4);
assert.deepEqual(plan.interfaces.find(b=>b.qname==='contracts.ILeaf').bases,['contracts.ILeft','contracts.IRight']);
assert.deepEqual(plan.bindings.find(b=>b.qname==='contracts.Implementation').interfaces,['contracts.ILeaf']);
assert.deepEqual(plan.bindings.find(b=>b.qname==='contracts.Child').interfaces,[]);
assert.equal(plan.references.find(r=>r.owner==='contracts.Holder'&&r.sourceName==='IRoot').kind,'interface');
assert(!plan.references.some(r=>r.sourceName==='function'));
assert(Object.isFrozen(plan.interfaces)&&plan.interfaces.every(b=>Object.isFrozen(b)&&Object.isFrozen(b.bases)));
assert(plan.bindings.every(b=>Object.isFrozen(b.interfaces)));
const reordered={...input,sources:Object.fromEntries(Object.entries(sources).reverse())};assert.deepEqual(api.createNativeGeneratedDeclarationPlan(reordered),plan);
let guards=0;
function rejects(mutate){const candidate=structuredClone(input);mutate(candidate);assert.throws(()=>api.createNativeGeneratedDeclarationPlan(candidate),/AS3_GENERATED_DECLARATIONS_UNSUPPORTED/);guards++;}
rejects(x=>delete x.interfaceProviderModule);
rejects(x=>x.interfaceProviderModule='bad\nmodule');
rejects(x=>x.sources['contracts.IRoot'].source+=' ');
rejects(x=>x.sources['contracts.IRoot'].referenceOnly=true);
rejects(x=>x.sources['contracts.ILeaf']=source('package contracts {public interface ILeaf extends ILeft, ILeft {}}'));
rejects(x=>x.sources['contracts.IRoot']=source('package contracts {public interface IRoot extends ILeaf {}}'));
rejects(x=>x.sources['contracts.ILeaf']=source('package contracts {public interface ILeaf extends Missing {}}'));
rejects(x=>x.sources['contracts.ILeaf']=source('package contracts {public interface ILeaf extends Implementation {}}'));
rejects(x=>x.sources['contracts.Child']=source('package contracts {public class Child extends IRoot {}}'));
rejects(x=>x.sources['contracts.Child']=source('package contracts {public class Child implements Implementation {}}'));
rejects(x=>x.sources['contracts.Child']=source('package contracts {public class Child implements IRoot,IRoot {}}'));
rejects(x=>x.sources['contracts.Child']=source('package contracts {public class Child implements Missing {}}'));
rejects(x=>x.sources['contracts.IRoot']=source('package contracts {public interface IRoot {} } interface Hidden {}'));
rejects(x=>{x.sources['a.IRoot']=source('package a {public interface IRoot {}}');x.sources['b.IRoot']=source('package b {public interface IRoot {}}');x.sources['contracts.ILeaf']=source('package contracts {import a.*;import b.*;public interface ILeaf extends IRoot {}}');delete x.sources['contracts.IRoot'];});
const {nativeGeneratedDeclarationSource}=require('../../lib/emit/native-generated-declarations');
assert.throws(()=>nativeGeneratedDeclarationSource({...plan},plan.scope,'contracts.IRoot',sources['contracts.IRoot'].source),/exact planned/);guards++;
// Planning records implements names; it must not silently bypass the separate
// callable-class contract and publication hold.
const {NativeCallableClasses}=require('../../lib/emit/native-callable-classes');
assert.equal(typeof NativeCallableClasses,'function');
const only={'contracts.Implementation':sources['contracts.Implementation'].source};
assert.throws(()=>new NativeCallableClasses(only['contracts.Implementation'],only,{'contracts.Implementation':'lazy'},provider('AS3MethodBinding')),/interface construction identity requires separate authority/);guards++;
const {NativeReferenceCoercion}=require('../../lib/emit/native-reference-coercion');
assert.throws(()=>new NativeReferenceCoercion(sources['contracts.Holder'].source,{plan,module:'./domain',coercionModule:provider('AS3Type')},false),/source interface coercion lowering requires separate emission qualification/);guards++;
fs.writeFileSync(path.join(run,'domain.ts'),plan.moduleSource);fs.writeFileSync(path.join(run,'other.ts'),plan.moduleSource);
const names=Object.fromEntries(plan.interfaces.map(b=>[b.qname,b.tokenExport])),bindings=Object.fromEntries(plan.bindings.map(b=>[b.qname,b]));
const driver=fs.readFileSync(path.join(__dirname,'driver.txt'),'utf8').replace('@NAMES@',JSON.stringify(names)).replace('@BINDINGS@',JSON.stringify(bindings)).replace('@METADATA@',provider('FlashTypeMetadata')).replace('@TYPE@',provider('AS3Type'));
fs.writeFileSync(path.join(run,'driver.ts'),driver);
const files=['domain.ts','other.ts','driver.ts'].map(name=>path.join(run,name));
const program=modern.createProgram(files,{target:modern.ScriptTarget.ES2020,module:modern.ModuleKind.CommonJS,strict:true,strictNullChecks:false,noEmit:true,skipLibCheck:true,lib:['lib.es2020.d.ts','lib.dom.d.ts']});
const diagnostics=modern.getPreEmitDiagnostics(program).map(d=>({file:d.file&&d.file.fileName,code:d.code,text:modern.flattenDiagnosticMessageText(d.messageText,'\n')}));
fs.writeFileSync(path.join(run,'types.json'),JSON.stringify(diagnostics,null,2));assert.deepEqual(diagnostics,[]);
const ids=['lookalike','exact','inherited','null-is-as','undefined-is-as','plain-object','class-object'];
const expected=observations.filter(row=>ids.includes(row.id));assert.equal(expected.length,7);
for(const mutate of [rows=>rows.pop(),rows=>rows.reverse(),rows=>rows.find(r=>r.id==='inherited').value[3]=false]){const bad=structuredClone(expected);mutate(bad);assert.throws(()=>assert.deepEqual(bad,expected));}
async function main(){
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||require.resolve('playwright',{paths:[path.resolve('../op2-html5/game-client-laya')]}));const browser=await chromium.launch({headless:true}),results=[];
 try{for(const target of [ts.ScriptTarget.ES5,ts.ScriptTarget.ES2015]){
  const dir=path.join(run,'target-'+target);fs.mkdirSync(dir);
  for(const file of files){const emitted=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});assert.deepEqual(emitted.diagnostics,[]);
   fs.writeFileSync(path.join(dir,path.basename(file,'.ts')+'.js'),emitted.outputText.replace(/require\("(\.\.\/[^"\n]+)"\)/g,(_,name)=>'require('+JSON.stringify('../'+name)+')'));}
  const built=esbuild.buildSync({entryPoints:[path.join(dir,'driver.js')],bundle:true,write:false,format:'iife',globalName:'DeclarationProbe',platform:'browser',target:'es2020',metafile:true});
  const script=built.outputFiles[0].text;fs.writeFileSync(path.join(dir,'bundle.js'),script);
  const node=new Function(script+';return DeclarationProbe.run();')();assert.deepEqual(node.rows,expected);assert.equal(node.guards.length,3);
  const page=await browser.newPage();await page.addScriptTag({content:script});const chromium=await page.evaluate(()=>DeclarationProbe.run());await page.close();assert.deepEqual(chromium,node);
  results.push({target,node,chromium,inputs:Object.keys(built.metafile.inputs).map(file=>({file,sha256:hash(fs.readFileSync(file))}))});
 }}finally{await browser.close();}
 fs.writeFileSync(path.join(run,'report.json'),JSON.stringify({guards,sourceHashes:plan.sourceHashes,results,comparisonNegativeControls:3,held:'Implementing-class emission, interface Class values/reflection, method contract validation, initialization timing and rest/optional signatures.'},null,2));
 console.log('Source interface planning: '+guards+' guards; 7 AIR nominal rows, 3 runtime guards, ES5/ES2015 Node/Chromium. '+run);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
