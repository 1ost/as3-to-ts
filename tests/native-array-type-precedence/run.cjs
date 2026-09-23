const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),cp=require('child_process'),crypto=require('crypto'),vm=require('vm');
const compiler=process.env.COMPILER_UNDER_TEST||path.resolve(__dirname,'../..');
const engine=process.env.LAYA_ENGINE_REPOSITORY;
assert.ok(engine,'LAYA_ENGINE_REPOSITORY must identify the common engine repository');
const pin='643ee1d1c702a51dbbd04aa313236af9ce5152a0';
const ts=require(path.join(compiler,'node_modules/typescript')),modern=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||require.resolve('playwright',{paths:[compiler,engine]}));
const parse=require(path.join(compiler,'lib/parse')),emit=require(path.join(compiler,'lib/emit'));
const read=p=>fs.readFileSync(p,'utf8'),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),json=p=>JSON.parse(read(p));
const receipts=json(path.join(__dirname,'receipts.json'));
for(const name of ['evidence','evidence-repeat']){
 const folder=path.join(__dirname,name),receipt=path.join(folder,'provenance.json');assert.equal(sha(receipt),receipts[name]);
 for(const item of json(receipt).files){let p=path.join(folder,item.path);if(!fs.existsSync(p))p=path.join(folder,'sources',item.path);assert.equal(sha(p),item.sha256,item.path);}
}
const evidence=path.join(__dirname,'evidence'),expected=json(path.join(evidence,'flash.json')).rows;
assert.equal(expected.length,7);assert.deepEqual(json(path.join(__dirname,'evidence-repeat/flash.json')).rows,expected);
const cache=path.join(compiler,'.cache/native-array-type-precedence');fs.mkdirSync(cache,{recursive:true});const run=fs.mkdtempSync(path.join(cache,'run-'));console.log('Evidence: '+run);
function diagnostics(program){return modern.getPreEmitDiagnostics(program).map(d=>({code:d.code,file:d.file?.fileName,message:modern.flattenDiagnosticMessageText(d.messageText,'\n')}));}
(async()=>{
 const providerSource=path.join(run,'engine');fs.mkdirSync(providerSource);
 const archive=cp.execFileSync('git',['archive',pin,'src/layaAir/flash/utils'],{cwd:engine,maxBuffer:32*1024*1024});cp.execFileSync('tar',['-xf','-','-C',providerSource],{input:archive});
 const exports=['AS3MethodBinding','AS3Coercion','AS3String','AS3Type','AS3Property','AS3Class','AS3Invocation','AS3DeclarationType','FlashTypeMetadata','AS3ArrayCreation','AS3Vector'];
 const providerEntry=exports.map(n=>'export * from "./src/layaAir/flash/utils/'+n+'";').join('\n');
 const providerBuild=esbuild.buildSync({stdin:{contents:providerEntry,resolveDir:providerSource,loader:'ts'},bundle:true,write:false,format:'cjs',platform:'node',target:'es2020',metafile:true});
 const commonSource='(function(){var module={exports:{}};\n'+providerBuild.outputFiles[0].text+'\nObject.assign(exports,module.exports);})();';
 const utils=path.join(providerSource,'src/layaAir/flash/utils'),declarations=path.join(run,'provider');
 const provider=modern.createProgram(exports.map(n=>path.join(utils,n+'.ts')),{target:modern.ScriptTarget.ES2021,module:modern.ModuleKind.CommonJS,declaration:true,emitDeclarationOnly:true,rootDir:utils,outDir:declarations,strict:true,strictNullChecks:false,lib:['lib.es2021.d.ts','lib.dom.d.ts']});
 const providerErrors=diagnostics(provider);assert.deepEqual(providerErrors,[]);assert.equal(provider.emit().emitSkipped,false);
 const qname='probe.Array',source=read(path.join(evidence,'sources/original/probe/Array.as'));
 const metadataDocument=JSON.parse(cp.execFileSync(process.env.PYTHON||'python',[path.join(__dirname,'extract-metadata.py'),evidence],{encoding:'utf8'}));
 const metadata={module:'./AS3MethodBinding',classes:metadataDocument.classes};
 const options={customVisitors:[],definitionsByNamespace:{probe:['Array']},nativeClassInitialization:{classes:{[qname]:'lazy'}},nativeCallableClasses:{[qname]:source},nativeCallableMethodBindingModule:'./AS3MethodBinding',nativeCallableCoercionModule:'./AS3MethodBinding',nativeCallableStringModule:'./AS3MethodBinding',nativeCallableMetadata:metadata};
 const generated=emit(parse('Array.as',source),source,options);
 const holderSource=read(path.join(evidence,'sources/original/probe/Holder.as'));
 const holderOptions={...options,nativeClassInitialization:{classes:{'probe.Array':'lazy','probe.Holder':'lazy'}},nativeCallableClasses:{'probe.Array':source,'probe.Holder':holderSource}};
 const holderGenerated=emit(parse('Holder.as',holderSource),holderSource,holderOptions);
 fs.writeFileSync(path.join(run,'holder-generated.ts'),holderGenerated);fs.writeFileSync(path.join(run,'generated.ts'),generated);
 const guards=[];
 for(const [id,mutate] of [['wrong-instance-type',r=>r.instanceTraits[0].type='Object'],['wrong-static-type',r=>r.staticTraits[0].type='Object'],['wrong-source-sha',r=>r.sourceSha256='0'.repeat(64)]]){
  const wrong=structuredClone(metadata);mutate(wrong.classes[qname]);assert.throws(()=>emit(parse('Array.as',source),source,{...options,nativeCallableMetadata:wrong}),/AS3_CLASS_METADATA_UNSUPPORTED/);guards.push(id);
 }
 for(const file of json(path.join(__dirname,'rejected-own-receipts.json')))assert.equal(sha(path.join(__dirname,file.path)),file.sha256);
 const rejected=read(path.join(__dirname,'rejected-own/rejected-original/probe/Array.as'));
 const ambiguousMetadata=structuredClone(metadata);ambiguousMetadata.classes[qname].sourceSha256=crypto.createHash('sha256').update(rejected).digest('hex');
 assert.throws(()=>emit(parse('Array.as',rejected),rejected,{...options,nativeCallableClasses:{[qname]:rejected},nativeCallableMetadata:ambiguousMetadata}),/ambiguous unqualified own\/builtin type Array/);guards.push('original-unqualified-own-array-ambiguous');
 const wrongHolder=structuredClone(metadata);wrongHolder.classes['probe.Holder'].instanceTraits[0].type='probe.Array';
 assert.throws(()=>emit(parse('Holder.as',holderSource),holderSource,{...holderOptions,nativeCallableMetadata:wrongHolder}),/AS3_CLASS_METADATA_UNSUPPORTED/);guards.push('imported-foreign-metadata-conflict');
 const reports=[],browser=await chromium.launch({headless:true});try{for(const target of [ts.ScriptTarget.ES5,ts.ScriptTarget.ES2015]){
  const dir=path.join(run,'target-'+target);fs.mkdirSync(dir);const specs=[];
  function add(name,source,isTS=true){let code=source;if(isTS){const result=ts.transpileModule(source,{compilerOptions:{target,module:ts.ModuleKind.CommonJS,experimentalDecorators:true},reportDiagnostics:true});assert.deepEqual(result.diagnostics,[]);code=result.outputText;}fs.writeFileSync(path.join(dir,name+(isTS?'.ts':'.js')),source);specs.push({name,code});}
  add('AS3MethodBinding',commonSource,false);
  for(const helper of ['bound','classBound','nativeClass','callableClass'])add(helper,read(path.join(compiler,'utils',helper+'.ts')));
  add('Array',generated);add('Holder',holderGenerated);
  fs.writeFileSync(path.join(dir,'AS3MethodBinding.d.ts'),exports.map(n=>'export * from "../provider/'+n+'";').join('\n'));
  const program=modern.createProgram(fs.readdirSync(dir).filter(n=>n.endsWith('.ts')).map(n=>path.join(dir,n)),{target:modern.ScriptTarget.ES2021,module:modern.ModuleKind.CommonJS,strict:true,strictNullChecks:false,lib:['lib.es2021.d.ts','lib.dom.d.ts'],experimentalDecorators:true,noEmit:true});
  const errors=diagnostics(program);fs.writeFileSync(path.join(dir,'diagnostics.json'),JSON.stringify(errors,null,2));assert.deepEqual(errors,[]);
  const script='{const modules=new Map();const specs='+JSON.stringify(specs)+';for(const spec of specs)modules.set(spec.name,{});for(const spec of specs)new Function("exports","require",spec.code)(modules.get(spec.name),request=>modules.get(request.split("/").pop()));'+read(path.join(__dirname,'driver.js'))+'}';
  fs.writeFileSync(path.join(dir,'bundle.js'),script);const context=vm.createContext({});vm.runInContext(script,context);
  const node=JSON.parse(JSON.stringify(context.result));assert.deepEqual(node,expected);assert.deepEqual(JSON.parse(JSON.stringify(context.boundaries)),[true,true]);
  const page=await browser.newPage(),pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));await page.addScriptTag({content:script});const web=await page.evaluate(()=>globalThis.result);assert.deepEqual(web,expected);assert.deepEqual(await page.evaluate(()=>globalThis.boundaries),[true,true]);assert.deepEqual(pageErrors,[]);await page.close();
  fs.writeFileSync(path.join(dir,'node.json'),JSON.stringify(node,null,2));fs.writeFileSync(path.join(dir,'browser.json'),JSON.stringify(web,null,2));
  reports.push({target,originalRows:7,node:true,chromium:true,actualTypeFiles:program.getSourceFiles().length,actualDeclarationDiagnostics:0,bundleSHA256:sha(path.join(dir,'bundle.js'))});
 }}finally{await browser.close();}
 const report={ok:true,scope:'Authenticated builtin Array annotation precedence over an imported namesake; qualified self type preserved',engineCommit:pin,generatedSHA256:sha(path.join(run,'generated.ts')),receipts,guards,reports,compilerInputs:['src/emit/native-source-type.ts','lib/emit/native-source-type.js','src/emit/native-callable-classes.ts','lib/emit/native-callable-classes.js','utils/callableClass.ts'].map(p=>({path:p,sha256:sha(path.join(compiler,p))})),providerInputs:Object.keys(providerBuild.metafile.inputs).filter(p=>p!=='<stdin>').map(p=>({path:path.relative(providerSource,path.resolve(p)),sha256:sha(path.resolve(p))}))};
 fs.writeFileSync(path.join(run,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:true,originalRows:7,guards:guards.length,run}));
})().catch(e=>{console.error(e);process.exitCode=1;});
