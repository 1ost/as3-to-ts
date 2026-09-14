const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process'),crypto=require('node:crypto');
const here=__dirname,compiler=path.resolve(here,'../..'),engine=path.resolve(process.env.LAYAAIR_CHECKOUT||path.join(compiler,'../LayaAir-op2'));
const ts=require(path.join(compiler,'node_modules/typescript')),modern=require(path.join(engine,'node_modules/typescript')),{build}=require(path.join(engine,'node_modules/esbuild'));
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||require.resolve('playwright',{paths:[compiler,engine]}));
const parse=require(path.join(compiler,'lib/parse')),emit=require(path.join(compiler,'lib/emit')),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const evidence=path.join(here,'original-evidence-26-valid'),receiptPath=path.join(evidence,'provenance.json');
assert.equal(sha(receiptPath),'f37e64905681459e16c011e10dd8fa7b403749e38b91109ba3718361ebe254d2');
for(const item of JSON.parse(fs.readFileSync(receiptPath)).files){const rel=item.path.replace(/\\/g,'/'),p=fs.existsSync(path.join(evidence,rel))?path.join(evidence,rel):path.join(evidence,'sources',rel);assert.equal(sha(p),item.sha256,rel);}
const sourcePath=path.join(evidence,'sources/original/Subject.as'),source=fs.readFileSync(sourcePath,'utf8'),expected=JSON.parse(fs.readFileSync(path.join(evidence,'flash.json'))).rows;
assert.equal(expected.length,26);

const syntaxRoot=path.join(here,'original-syntax'),syntaxReceipt=path.join(syntaxRoot,'provenance.json');
assert.equal(sha(syntaxReceipt),'cec73e28892ce5249f62063375472974077d2f73f4ca3149e2bcda45f7990e4a');
for(const item of JSON.parse(fs.readFileSync(syntaxReceipt)).files)assert.equal(sha(path.join(syntaxRoot,item.path)),item.sha256,item.path);
const syntax=JSON.parse(fs.readFileSync(path.join(syntaxRoot,'report.json'))).rows.map(row=>{
 const input=fs.readFileSync(path.join(syntaxRoot,row.id,'Probe.as'),'utf8');let error;
 try{parse('Probe.as',input);}catch(e){error=String(e);}
 assert.equal(!error,row.exitCode===0,row.id+': '+error);
 if(row.id.startsWith('vector-')&&row.exitCode!==0)assert.match(error,/AS3_VECTOR_LITERAL: missing element before comma/);
 return {id:row.id,accepted:!error,error};
});


const accessorRoot=path.join(here,'original-post-call-syntax'),accessorReceipt=path.join(accessorRoot,'provenance.json');
assert.equal(sha(accessorReceipt),'0e5bb260ef50772ca067ae9398d7da3272f70e06ee60199d0136acfd35004635');
for(const item of JSON.parse(fs.readFileSync(accessorReceipt)).files)assert.equal(sha(path.join(accessorRoot,item.path)),item.sha256,item.path);
const accessorSyntax=JSON.parse(fs.readFileSync(path.join(accessorRoot,'report.json'))).rows.map(row=>{
 const input=fs.readFileSync(path.join(accessorRoot,row.id,'Probe.as'),'utf8');let error;
 try{parse('Probe.as',input);}catch(e){error=String(e);}
 assert.equal(!error,row.exitCode===0,row.id+': '+error);
 if(error)assert.match(error,/AS3_ARRAY_ACCESSOR: index expression required/);
 return {id:row.id,accepted:!error,error};
});

function exercise(Subject){function shape(value){if(Array.isArray(value)){const slots=[];for(let i=0;i<value.length;i++)slots.push({own:Object.prototype.hasOwnProperty.call(value,String(i)),value:shape(value[i])});return {kind:'Array',length:value.length,slots};}return {kind:typeof value,value:value===undefined?'undefined':value};}return Array.from({length:26},(_,index)=>({index,value:shape(new Subject(index).value)}));}
(async()=>{
 const outputRoot=path.join(compiler,'.cache/native-array-literals');fs.mkdirSync(outputRoot,{recursive:true});const output=fs.mkdtempSync(path.join(outputRoot,'run-'));
 const provider=path.join(output,'engine');fs.mkdirSync(provider);const pin='42dd05e7d17faa3d74eabdea0af796978a4a7214';
 const archive=cp.execFileSync('git',['-c','core.autocrlf=false','archive','--format=tar',pin,'src/layaAir/flash/utils'],{cwd:engine,maxBuffer:32*1024*1024});cp.execFileSync('tar',['-xf','-','-C',provider],{input:archive});
 const reports=[];let browser;
 try{browser=await chromium.launch({headless:true});for(const target of [ts.ScriptTarget.ES5,ts.ScriptTarget.ES2015]){
  const dir=path.join(output,'target-'+target);fs.mkdirSync(dir);
  const generated=emit(parse('Subject.as',source),source,{customVisitors:[],definitionsByNamespace:{},nativeClassInitialization:{classes:{Subject:'lazy'}},nativeCallableMethodBindingModule:'./AS3MethodBinding',nativeCallableCoercionModule:'./AS3MethodBinding',nativeCallableClasses:{Subject:source}});
  fs.writeFileSync(path.join(dir,'Subject.ts'),generated);
  for(const name of ['bound','classBound','nativeClass','callableClass'])fs.copyFileSync(path.join(compiler,'utils',name+'.ts'),path.join(dir,name+'.ts'));
  fs.writeFileSync(path.join(dir,'AS3MethodBinding.ts'),'export * from "../engine/src/layaAir/flash/utils/AS3MethodBinding";export * from "../engine/src/layaAir/flash/utils/AS3Coercion";');
  fs.writeFileSync(path.join(dir,'Consumer.ts'),'import {Subject} from "./Subject";import {readNativeClass} from "./nativeClass";const subject:Subject=new (readNativeClass(Subject))(0);const value:any[]=subject.value;');
  fs.writeFileSync(path.join(dir,'entry.js'),'const {Subject}=require("./Subject");const {readNativeClass}=require("./nativeClass");exports.rows=('+exercise.toString()+')(readNativeClass(Subject));');
  const program=modern.createProgram(fs.readdirSync(dir).filter(n=>n.endsWith('.ts')).map(n=>path.join(dir,n)),{target:modern.ScriptTarget.ES2021,module:modern.ModuleKind.CommonJS,strict:true,strictNullChecks:false,skipLibCheck:true,downlevelIteration:true,experimentalDecorators:true,noEmit:true,lib:['lib.es2021.d.ts','lib.dom.d.ts']});
  const diagnostics=modern.getPreEmitDiagnostics(program).map(d=>({file:d.file?.fileName,code:d.code,message:modern.flattenDiagnosticMessageText(d.messageText,'\n')}));fs.writeFileSync(path.join(dir,'diagnostics.json'),JSON.stringify(diagnostics,null,2));assert.deepStrictEqual(diagnostics,[]);
  // Exercise the actual requested TS target before bundling, including ES5 class lowering.
  for(const name of fs.readdirSync(dir).filter(n=>n.endsWith('.ts'))){const result=ts.transpileModule(fs.readFileSync(path.join(dir,name),'utf8'),{compilerOptions:{target,module:ts.ModuleKind.CommonJS,experimentalDecorators:true},reportDiagnostics:true});assert.deepStrictEqual(result.diagnostics,[]);fs.writeFileSync(path.join(dir,name.replace(/\.ts$/,'.js')),result.outputText);}
  const bundles=await Promise.all(['node','browser'].map(platform=>build({entryPoints:[path.join(dir,'entry.js')],bundle:true,platform,format:platform==='node'?'cjs':'iife',globalName:'LiteralProbe',outfile:path.join(dir,platform+'.bundle.js'),metafile:true})));
  const node=require(path.join(dir,'node.bundle.js')).rows;assert.deepStrictEqual(node,expected);
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.addScriptTag({path:path.join(dir,'browser.bundle.js')});const chrome=await page.evaluate(()=>LiteralProbe.rows);await page.close();assert.deepStrictEqual(chrome,expected);assert.deepStrictEqual(errors,[]);
  reports.push({target,rows:node.length,nodeMatched:true,chromeMatched:true,strictDiagnostics:diagnostics,inputs:[...new Set(bundles.flatMap(b=>Object.keys(b.metafile.inputs)))].map(p=>({path:path.relative(output,path.resolve(p)).replace(/\\/g,'/'),sha256:sha(p)}))});
 }
 const negative=JSON.parse(JSON.stringify(expected));negative[4].value.slots[0].own=false;assert.throws(()=>assert.deepStrictEqual(negative,expected));
 const report={scope:'Array literal parsing/emission and own undefined entries; no Array storage or splice admission',engineCommit:pin,originalRows:26,syntaxChecks:syntax,accessorSyntaxChecks:accessorSyntax,accessorSyntaxReceiptSHA256:sha(accessorReceipt),syntaxReceiptSHA256:sha(syntaxReceipt),providerGraphTypeCheckTarget:"ES2021",sourceEmitTargets:["ES5","ES2015"],receiptSHA256:sha(receiptPath),compilerTypeScript:ts.version,strictTypeScript:modern.version,negativeControls:1,reports,compilerInputs:['src/emit/emitter.ts','src/parse/parse-literals.ts','src/parse/parse-expressions.ts'].map(p=>({path:p,sha256:sha(path.join(compiler,p))}))};
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({ok:true,originalRows:26,targets:2,output}));
 }finally{if(browser)await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
