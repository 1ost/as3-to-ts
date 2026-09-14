const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto'),vm=require('vm'),child=require('child_process');
const root=path.resolve(__dirname,'../..'),compiler=path.resolve(__dirname,'../compiler-super-method/candidate'),engine=path.resolve(root,'../LayaAir-op2');
const ts=require(path.join(compiler,'node_modules/typescript')),parse=require(path.join(compiler,'lib/parse')),emit=require(path.join(compiler,'lib/emit'));
const esbuild=require(path.join(engine,'node_modules/esbuild')),{chromium}=require(path.join(root,'game-client-laya/node_modules/playwright'));
const capture=path.join(__dirname,'flash-review'),names=['Journal','Base','Middle','Leaf','Grandchild'],commit='d3db69240e22575d48828ae95b1243bc6e593ed1';
for(const item of JSON.parse(fs.readFileSync(path.join(capture,'provenance.json'))).files)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(item.path)).digest('hex'),item.sha256);
const expected=JSON.parse(fs.readFileSync(path.join(capture,'flash.json'))),sources=Object.fromEntries(names.map(name=>['superprobe.'+name,fs.readFileSync(path.join(capture,'sources/superprobe',name+'.as'),'utf8')]));
const classes=Object.fromEntries(Object.keys(sources).map(name=>[name,'lazy']));
const snapshot=fs.mkdtempSync(path.join(__dirname,'engine-'));child.execFileSync('tar',['-xf','-','-C',snapshot],{input:child.execFileSync('git',['archive','--format=tar',commit,'src/layaAir/flash/utils'],{cwd:engine,maxBuffer:32*1024*1024})});
const common=esbuild.buildSync({stdin:{contents:'export * from "./src/layaAir/flash/utils/AS3MethodBinding";export * from "./src/layaAir/flash/utils/AS3Coercion";',resolveDir:snapshot,loader:'ts'},bundle:true,write:false,format:'cjs',platform:'browser',target:'es2015'}).outputFiles[0].text;
const driver=`const read=modules.nativeClass.readNativeClass,Grandchild=read(modules.Grandchild.Grandchild),Journal=read(modules.Journal.Journal);const one=new Grandchild();one.identity='one';one.run();const two=new Grandchild();two.identity='two';const detached=two.run;detached.call(one);globalThis.result=Journal.rows;`;
(async()=>{const reports=[],browser=await chromium.launch({headless:true});try{
 for(const target of [ts.ScriptTarget.ES5,ts.ScriptTarget.ES2015]){
  const dir=path.join(__dirname,'generated-'+target);fs.mkdirSync(dir,{recursive:true});
  let script='var modules={};function req(name){return modules[name.split("/").pop()];}\nmodules.AS3MethodBinding={};(function(exports){var module={exports:{}};'+common+'\nObject.assign(exports,module.exports);})(modules.AS3MethodBinding);\n';
  for(const name of ['bound','classBound','nativeClass','callableClass',...names]){
   const source=sources['superprobe.'+name],generated=source?emit(parse(name+'.as',source),source,{customVisitors:[],definitionsByNamespace:{},nativeClassInitialization:{classes},nativeCallableMethodBindingModule:'./AS3MethodBinding',nativeCallableCoercionModule:'./AS3MethodBinding',nativeCallableClasses:sources}):fs.readFileSync(path.join(compiler,'utils',name+'.ts'),'utf8');
   fs.writeFileSync(path.join(dir,name+'.ts'),generated);
   const result=ts.transpileModule(generated,{compilerOptions:{target,module:ts.ModuleKind.CommonJS,experimentalDecorators:true},reportDiagnostics:true});assert.deepStrictEqual(result.diagnostics,[]);
   script+='modules.'+name+'={};(function(exports,require){'+result.outputText+'\n})(modules.'+name+',req);\n';
  }
  script+=driver;fs.writeFileSync(path.join(dir,'bundle.js'),script);
  const context=vm.createContext({});vm.runInContext(script,context);const nodeRows=JSON.parse(JSON.stringify(context.result));fs.writeFileSync(path.join(dir,'node.json'),JSON.stringify(nodeRows,null,2));assert.deepStrictEqual(nodeRows,expected);
  const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(String(error)));await page.addScriptTag({content:script});const browserRows=await page.evaluate(()=>globalThis.result);fs.writeFileSync(path.join(dir,'browser.json'),JSON.stringify(browserRows,null,2));assert.deepStrictEqual(errors,[]);assert.deepStrictEqual(browserRows,expected);await page.close();
  reports.push({target,rows:expected.length,nodeMatched:true,browserMatched:true,browser:browser.version(),bundleSHA256:crypto.createHash('sha256').update(script).digest('hex')});
 }
 fs.writeFileSync(path.join(__dirname,'report.json'),JSON.stringify({scope:'bounded direct source super methods',productionReady:false,engineCommit:commit,compilerSourceSHA256:crypto.createHash('sha256').update(fs.readFileSync(path.join(compiler,'src/emit/native-callable-classes.ts'))).digest('hex'),reports},null,2));console.log(JSON.stringify(reports));
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
