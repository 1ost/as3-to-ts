const fs=require('fs'),path=require('path'),assert=require('assert'),cp=require('child_process'),vm=require('vm');
const here=__dirname,compiler=path.resolve(here,'../..'),engine=path.resolve(process.env.LAYAAIR_CHECKOUT||path.join(compiler,'../LayaAir-op2'));
const modern=require(path.join(engine,'node_modules/typescript'));const ts=require(path.join(compiler,'node_modules/typescript')),{buildSync}=require(path.join(engine,'node_modules/esbuild'));
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||require.resolve('playwright',{paths:[compiler,engine]}));
const {verify,authenticateMetadata,hash}=require('../native-typeof/evidence.cjs');
const evidence=verify('typeof');assert.equal(evidence.expected.rows.length,32);
const root=path.join(compiler,'.cache/native-array-allocation');fs.mkdirSync(root,{recursive:true});const output=fs.mkdtempSync(path.join(root,'metadata-')),provider=path.join(output,'engine');fs.mkdirSync(provider);
const pin='69789c4fa64dec426cf86a0ecd4cccfedf79be6c',archive=cp.execFileSync('git',['archive','--format=tar',pin,'src'],{cwd:engine,maxBuffer:128*1024*1024});cp.execFileSync('tar',['-xf','-','-C',provider],{input:archive});
const modules=['AS3MethodBinding','AS3Coercion','AS3Property','AS3Invocation','AS3Class','AS3DynamicObject','AS3DeclarationType','AS3Type','FlashTypeMetadata','AS3TypeOf','AS3ArrayCreation','XML'];
const bundle=buildSync({stdin:{contents:modules.map(n=>'export * from "./src/layaAir/flash/utils/'+n+'";').join('\n'),resolveDir:provider,loader:'ts'},bundle:true,write:false,metafile:true,format:'cjs',platform:'node'});
const instrumentation=`
exports.audit={literals:0,transports:0};
const factory=exports.as3CreateArrayLiteral;
exports.as3CreateArrayLiteral=function(values){if(exports.getAS3ArrayCreation(values))throw Error('literal transport incorrectly allocated');for(let i=0;i<values.length;i++)if(!Object.prototype.hasOwnProperty.call(values,i))throw Error('missing literal transport own slot');exports.audit.literals++;return factory(values);};
for(const name of ['as3CallValue','as3CallProperty','as3ConstructValue']){const original=exports[name];exports[name]=function(...args){const index=name==='as3CallProperty'?2:1,thunk=args[index];args[index]=function(){const values=thunk();if(exports.getAS3ArrayCreation(values))throw Error('call transport incorrectly allocated');exports.audit.transports++;return values;};return original(...args);};}
`;
const commonSource='(function(){var module={exports:{}};'+bundle.outputFiles[0].text+';Object.assign(exports,module.exports);})();'+instrumentation;
fs.symlinkSync(path.join(engine,'node_modules'),path.join(provider,'node_modules'),'junction');
const config=modern.readConfigFile(path.join(provider,'src/layaAir/tsconfig.json'),modern.sys.readFile);assert(!config.error);
const flags=modern.convertCompilerOptionsFromJson(config.config.compilerOptions,path.join(provider,'src/layaAir')).options;
const ambient=modern.sys.readDirectory(path.join(provider,'src/layaAir/tslibs'),['.d.ts']).concat(modern.sys.readDirectory(path.join(engine,'node_modules/@webgpu/types'),['.d.ts']));
const diagnostics=program=>modern.getPreEmitDiagnostics(program).map(d=>({code:d.code,file:d.file&&path.relative(output,d.file.fileName),message:modern.flattenDiagnosticMessageText(d.messageText,'\n')}));
const declarationProgram=modern.createProgram(modules.map(n=>path.join(provider,'src/layaAir/flash/utils',n+'.ts')).concat(ambient),{...flags,target:modern.ScriptTarget.ES2021,module:modern.ModuleKind.CommonJS,composite:false,types:['node'],typeRoots:[path.join(engine,'node_modules/@types')],declaration:true,emitDeclarationOnly:true,lib:['lib.es2021.d.ts','lib.dom.d.ts'],rootDir:path.join(provider,'src'),outDir:path.join(output,'provider-types')});
const providerDiagnostics=diagnostics(declarationProgram);fs.writeFileSync(path.join(output,'provider-diagnostics.json'),JSON.stringify(providerDiagnostics,null,2));assert.deepStrictEqual(providerDiagnostics,[]);assert.equal(declarationProgram.emit().emitSkipped,false);

const driver=require('../native-typeof/driver.cjs');
(async()=>{const reports=[],browser=await chromium.launch({headless:true});try{for(const target of [ts.ScriptTarget.ES5,ts.ScriptTarget.ES2015])for(const arrayModule of ['./ArrayFactory','./CommonProvider']){
const metadata=authenticateMetadata(evidence,evidence.metadata);metadata.module='./CommonProvider';const native=require('./metadata-fixture.cjs').fixture(compiler,target,evidence.sources,commonSource,metadata,arrayModule);Object.assign(native.context,{readTestClass:native.get,testCommon:native.common});const expression='('+driver.toString()+')(readTestClass,testCommon)';const rows=JSON.parse(vm.runInContext('JSON.stringify('+expression+')',native.context));assert.deepStrictEqual(rows,evidence.expected.rows);
const audit=JSON.parse(JSON.stringify(native.common.audit));assert(audit.literals>0);assert(audit.transports>0);
const Subject=native.get('Subject'),creation=native.common.getAS3ArrayCreation(Subject.primitives());assert.equal(creation.kind,'values');assert.equal(creation.initialLength,11);
const generated=native.generated.Subject||native.generated['typeprobe.Subject'];const dir=path.join(output,target+'-'+arrayModule.slice(2));fs.mkdirSync(dir);for(const [name,source]of Object.entries(native.generated))fs.writeFileSync(path.join(dir,name+'.ts'),source);
for(const name of ['bound','classBound','nativeClass','callableClass'])fs.copyFileSync(path.join(compiler,'utils',name+'.ts'),path.join(dir,name+'.ts'));
fs.writeFileSync(path.join(dir,'AS3MethodBinding.d.ts'),modules.map(n=>'export * from "../provider-types/layaAir/flash/utils/'+n+'";').join('\n'));
for(const name of ['CommonProvider','ArrayFactory'])fs.writeFileSync(path.join(dir,name+'.d.ts'),'export * from "./AS3MethodBinding";');
fs.writeFileSync(path.join(dir,'Consumer.ts'),'import {Subject} from "./Subject";import {readNativeClass} from "./nativeClass";import {as3CreateArrayLiteral} from "./ArrayFactory";const value:any[]=readNativeClass(Subject).primitives();const array:unknown[]=as3CreateArrayLiteral(value);');
const errors=diagnostics(modern.createProgram(fs.readdirSync(dir).filter(n=>n.endsWith('.ts')).map(n=>path.join(dir,n)),{target:modern.ScriptTarget.ES2021,module:modern.ModuleKind.CommonJS,strict:true,strictNullChecks:false,skipLibCheck:true,allowUnreachableCode:true,lib:['lib.es2021.d.ts','lib.dom.d.ts'],experimentalDecorators:true,noEmit:true}));fs.writeFileSync(path.join(dir,'diagnostics.json'),JSON.stringify(errors,null,2));assert.deepStrictEqual(errors,[]);

// Browser uses the same actual transpiled modules in an isolated page.
let browserScript='var modules={};function load(name,source){var exports=modules[name]||(modules[name]={});new Function("exports","require",source)(exports,function(request){return modules[request.split("/").pop()];});}';
browserScript+='load("AS3MethodBinding",'+JSON.stringify(commonSource)+');modules.CommonProvider=modules.AS3MethodBinding;modules.ArrayFactory=modules.AS3MethodBinding;';
for(const name of ['bound','classBound','nativeClass','callableClass'])browserScript+='load('+JSON.stringify(name)+','+JSON.stringify(ts.transpileModule(fs.readFileSync(path.join(compiler,'utils',name+'.ts'),'utf8'),{compilerOptions:{target,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText)+');';
for(const [name,source]of Object.entries(native.generated))browserScript+='load('+JSON.stringify(name)+','+JSON.stringify(ts.transpileModule(source,{compilerOptions:{target,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText)+');';
browserScript+='var readTestClass=function(name){return modules.nativeClass.readNativeClass(modules[name][name]);},testCommon=modules.AS3MethodBinding;var result='+expression+';';
const page=await browser.newPage(),pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));await page.addScriptTag({content:browserScript});const chrome=await page.evaluate(()=>({rows:result,audit:testCommon.audit}));await page.close();assert.deepStrictEqual(chrome.rows,rows);assert.deepStrictEqual(chrome.audit,audit);assert.deepStrictEqual(pageErrors,[]);reports.push({target,arrayModule,rows:rows.length,audit,diagnostics:errors,nodeMatched:true,chromeMatched:true});}
const report={engineCommit:pin,providerDiagnostics,originalRows:32,receiptSHA256:evidence.receiptSHA256,sourceSHA256:Object.values(evidence.metadata.classes).map(c=>c.sourceSha256),reports,providerInputs:Object.keys(bundle.metafile.inputs).filter(p=>p!=="<stdin>").map(p=>({path:path.relative(output,path.resolve(p)),sha256:hash(fs.readFileSync(p))}))};fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({ok:true,output,reports}));}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
