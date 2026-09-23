const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const parse=require('../../lib/parse'),emit=require('../../lib/emit'),ts=require('typescript');
const engine=path.resolve('../LayaAir-op2'),modern=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const hash=v=>crypto.createHash('sha256').update(v).digest('hex'),packet=path.join(engine,'tests/nativeAS3ParseInt');
const receipt=JSON.parse(fs.readFileSync(path.join(packet,'provenance.json')));
for(const f of receipt.files)assert.equal(hash(fs.readFileSync(path.join(packet,f.path))),f.sha256);
const cases=JSON.parse(fs.readFileSync(path.join(packet,'cases.json'))),expected=JSON.parse(fs.readFileSync(path.join(packet,'flash-a.json')));
assert.deepEqual(expected,JSON.parse(fs.readFileSync(path.join(packet,'flash-b.json'))));assert.equal(cases.length,receipt.cases);
const selected=cases.map((c,index)=>({c,index})).filter(({c})=>c.args.length<=2);
const base=path.resolve('.cache/native-parse-int-binding');fs.mkdirSync(base,{recursive:true});const run=fs.mkdtempSync(path.join(base,'run-'));
const relative=file=>{const v=path.relative(run,file).replaceAll('\\','/').replace(/\.ts$/,'');return v.startsWith('.')?v:'./'+v;};
const options={customVisitors:[],nativeGlobalModules:{parseInt:relative(path.join(engine,'src/layaAir/flash/utils/AS3ParseInt.ts'))},decoratorModules:{bound:relative(path.resolve('utils/bound.ts')),classBound:relative(path.resolve('utils/classBound.ts'))}};
const source='package {public class Reader {public function zero():Number{return parseInt();} public function one(value:*):Number{return parseInt(value);} public function two(value:*,radix:*):Number{return parseInt(value,radix);}}}';
fs.writeFileSync(path.join(run,'Reader.ts'),emit(parse('Reader.as',source),source,options));
let guards=0;
for(const body of ['public function f():*{return parseInt;}','public function f():*{return parseInt.apply(null,[]);}','public function f():*{return parseInt(1,2,3);}','public function f():*{return new parseInt();}']){
 const s='package {public class Guard {'+body+'}}';assert.throws(()=>emit(parse('Guard.as',s),s,options),/AS3_GLOBAL_MODULE_UNSUPPORTED/);guards++;
}
for(const s of ['package {public class Guard {public function f(parseInt:Function):*{return parseInt("2");}}}',
 'package {import custom.parseInt;public class Guard {public function f():*{return parseInt("2");}}}',
 'package {public class Guard {private function parseInt(value:*):*{return value;}public function f():*{return parseInt("2");}}}']){
 assert.ok(!emit(parse('Guard.as',s),s,options).includes('__as3_global_parseInt'));guards++;
}
let fixture=fs.readFileSync(path.join(packet,'fixture.ts'),'utf8');
fixture=fixture.replace(/^import .*\r?\n/,'import {Reader} from "./Reader";const reader=new Reader();\n').replace('Reflect.apply(host ? parseInt : sourceParseInt, null, args)','host ? Reflect.apply(parseInt,null,args) : args.length===0 ? reader.zero() : args.length===1 ? reader.one(args[0]) : reader.two(args[0],args[1])');
fs.writeFileSync(path.join(run,'driver.ts'),fixture);
const files=['Reader.ts','driver.ts'].map(f=>path.join(run,f));
const program=modern.createProgram(files,{noEmit:true,strict:true,strictNullChecks:false,experimentalDecorators:true,target:modern.ScriptTarget.ES2020,module:modern.ModuleKind.CommonJS,skipLibCheck:true});
const diagnostics=modern.getPreEmitDiagnostics(program).map(d=>modern.flattenDiagnosticMessageText(d.messageText,'\n'));assert.deepEqual(diagnostics,[]);
(async()=>{const {chromium}=require(require.resolve('playwright',{paths:[path.resolve('../op2-html5/game-client-laya')]}));const browser=await chromium.launch({headless:true}),results=[];
try{for(const target of [ts.ScriptTarget.ES5,ts.ScriptTarget.ES2015]){
 const dir=path.join(run,'target-'+target);fs.mkdirSync(dir);
 for(const file of files){const out=(file.endsWith('driver.ts')?modern:ts).transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText.replace(/require\("(\.\.\/[^"\n]+)"\)/g,(_,name)=>'require('+JSON.stringify('../'+name)+')');fs.writeFileSync(path.join(dir,path.basename(file,'.ts')+'.js'),out);}
 const built=esbuild.buildSync({entryPoints:[path.join(dir,'driver.js')],bundle:true,write:false,format:'iife',globalName:'parseIntProbe',platform:'browser',target:'es2020',metafile:true}),script=built.outputFiles[0].text;
 const inputs=selected.map(v=>v.c),wanted=selected.map(v=>expected[v.index]);
 const node=new Function(script+';return parseIntProbe;')().evaluate(inputs);assert.deepEqual(node,wanted);
 const page=await browser.newPage();await page.addScriptTag({content:script});const web=await page.evaluate(c=>parseIntProbe.evaluate(c),inputs);await page.close();assert.deepEqual(web,wanted);
 results.push({target,node,web,inputs:Object.keys(built.metafile.inputs).map(f=>({file:f,sha256:hash(fs.readFileSync(f))}))});
}}finally{await browser.close();}
fs.writeFileSync(path.join(run,'report.json'),JSON.stringify({guards,diagnostics,originalCases:cases.length,directCallCases:selected.length,excludedExtraArgumentCases:cases.length-selected.length,source,results},null,2));console.log(JSON.stringify({run,guards,originalCases:cases.length,directCallCases:selected.length,typeDiagnostics:diagnostics.length,targets:['ES5','ES2015'],runtimes:['Node','Chromium']}));
})().catch(e=>{console.error(e);process.exitCode=1;});
