// One maintained declaration, with the complete authenticated source cohort.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),z=require('node:zlib'),assert=require('node:assert/strict'),cp=require('node:child_process');
const compiler=path.resolve(__dirname,'../..'),engine=path.resolve(compiler,'../engine'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const inputs=new Map(),read=file=>{const b=fs.readFileSync(file);inputs.set(file,{file,sha256:hash(b)});return b;};
const priorDir=path.join(compiler,'tests/native-generated-urlrequest-type-tests/original-replay'),bytes=read(path.join(priorDir,'report.json.gz'));
assert.equal(hash(bytes),JSON.parse(read(path.join(priorDir,'pin.json'))).sha256);const prior=JSON.parse(z.gunzipSync(bytes));
const baselineBytes=read(prior.baseline.file);assert.equal(hash(baselineBytes),prior.baseline.sha256);
const packet=JSON.parse(z.gunzipSync(baselineBytes)),entry=packet.files.find(i=>i.file===packet.reportFile),entryBytes=Buffer.from(entry.base64,'base64');assert.equal(hash(entryBytes),entry.sha256);
const baseline=JSON.parse(entryBytes);assert.deepEqual(prior.input.sources,baseline.input.sources);assert.deepEqual(prior.input.classScriptSources,baseline.input.classScriptSources);
for(const i of prior.sourceInputs)assert.equal(hash(read(i.file)),i.sha256,i.file);
const identity='cn.kyiax.yare.ui.manager.CursorManager',candidate=process.argv.includes('--candidate');
const cache=path.join(compiler,'.cache/native-generated-mouse-class-reference');fs.mkdirSync(cache,{recursive:true});const out=fs.mkdtempSync(path.join(cache,'cursor-manager-'));
const pins=Object.fromEntries(Object.entries({compiler,engine}).map(([k,cwd])=>[k,cp.execFileSync('git',['rev-parse','HEAD'],{cwd,encoding:'utf8'}).trim()]));
const adapterFile=path.resolve('C:/Users/admin/Desktop/GITHUB REPO/op2-html5/as3-to-layaair-porting-kit/tools/adapt_native_tlf_features.mjs');read(adapterFile);
const providerFile=path.join(engine,candidate?'tests/nativeMouseClassReference/candidate.ts':'src/layaAir/flash/utils/AS3CanonicalMouseReference.ts');read(providerFile);
const api=require('../../lib'),parse=require('../../lib/parse'),declarations=require('../../lib/emit/native-generated-declarations');
async function main(){
 const {adaptNativeTLFFeatures}=await import(require('node:url').pathToFileURL(adapterFile).href);
 const input=structuredClone(prior.input),options=structuredClone(prior.options),configuration='flashx.textLayout.elements.Configuration';
 assert.equal(Object.keys(input.sources).length,1356);assert.equal(input.classScriptSources.length,95);assert.ok(!input.classScriptSources.includes(configuration));input.classScriptSources.push(configuration);
 const adapted=adaptNativeTLFFeatures(configuration,input.sources[configuration]);input.sources[configuration]=adapted.unit;
 const capabilities='../engine/src/layaAir/flash/utils/AS3CanonicalCapabilitiesReference';assert.equal(input.providers['flash.system.Capabilities'],undefined);
 input.providers['flash.system.Capabilities']={module:capabilities,exportName:'Capabilities'};options.importModules['flash.system.Capabilities']=capabilities;options.nativeCapabilitiesReferenceModule=capabilities;
 const emit=addMouse=>{
  const cohort=structuredClone(input),emitterOptions=structuredClone(options);assert.equal(cohort.providers['flash.ui.Mouse'],undefined);
  if(addMouse){const module='../engine/'+path.relative(engine,providerFile).replaceAll('\\','/').replace(/\.ts$/,'');cohort.providers['flash.ui.Mouse']={module,exportName:'Mouse'};emitterOptions.importModules['flash.ui.Mouse']=module;}
  let phase='plan';try{
   const plan=api.createNativeGeneratedDeclarationPlan(cohort),imports={...emitterOptions.importModules};
   [...plan.bindings.map(b=>b.qname),...plan.privateBindings.map(b=>b.identity)].forEach((q,i)=>imports[q]='./__native_class_'+i);declarations.nativeGeneratedInterfaceBindings(plan).forEach((b,i)=>imports[b.qname]='./__native_interface_'+i);
   phase='emission';const source=cohort.sources[identity].source;
   const emitted=api.Emitter.emit(parse(identity+'.as',source),source,{...emitterOptions,customVisitors:[],importModules:imports,nativeTweenSourcePlans:baseline.tweenSourcePlans[identity],nativeGeneratedDeclarations:{plan,module:'./__native_declarations',declarationIdentity:identity},nativeReferenceCoercion:{...emitterOptions.nativeReferenceCoercion,plan,module:'./__native_declarations'},nativeVectorTypes:{...emitterOptions.nativeVectorTypes,plan}});
   const file=path.join(out,addMouse?'CursorManager-mouse.ts':'CursorManager-baseline.ts');fs.writeFileSync(file,emitted);const ts=require('typescript'),diagnostics=ts.createSourceFile(file,emitted,ts.ScriptTarget.Latest,true).parseDiagnostics.map(d=>({code:d.code,start:d.start,text:ts.flattenDiagnosticMessageText(d.messageText,'\n')}));assert.deepEqual(diagnostics,[]);
   return {status:'emitted',file,characters:emitted.length,sha256:hash(emitted),syntaxDiagnostics:diagnostics};
  }catch(error){return {status:'held',phase,message:error.message,stack:String(error.stack)};}
 };
 const before=emit(false),after=emit(true);assert.equal(before.status,'held');assert.match(before.message,/unresolved class-value identity: Mouse/);
 const walk=dir=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,e.name);if(e.isDirectory())walk(file);else read(file);}};
 for(const d of ['src','lib','utils'])walk(path.join(compiler,d));read(__filename);
 for(const [name,cwd]of Object.entries({compiler,engine})){assert.equal(cp.execFileSync('git',['rev-parse','HEAD'],{cwd,encoding:'utf8'}).trim(),pins[name]);assert.equal(cp.execFileSync('git',['diff','--name-only','HEAD','--','src','utils'],{cwd,encoding:'utf8'}).trim(),'');}
 for(const i of inputs.values())assert.equal(hash(fs.readFileSync(i.file)),i.sha256,i.file);
 const report={identity,pins,candidate,sourceSha256:input.sources[identity].sourceSha256,sourceCount:1356,classScriptCount:96,input,options,derivation:adapted.derivation,inputs:[...inputs.values()],before,after,providerFile,typeCheck:'not-run',factory:'not-run',runtime:'not-run',productionProviderPromoted:false};
 const file=path.join(out,'report.json');fs.writeFileSync(file,JSON.stringify(report,null,2));console.log(JSON.stringify({file,before,after}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
