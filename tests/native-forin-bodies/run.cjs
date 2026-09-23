const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const parse=require('../../lib/parse'),emit=require('../../lib/emit'),K=require('../../lib/syntax/nodeKind').default;
const ts=require('typescript'),engine=path.resolve('../LayaAir-op2');
const esbuild=require(path.join(engine,'node_modules/esbuild'));
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const evidence=path.join(engine,'tests/nativeFlashOracle/reference-enumeration-restored');
require(path.join(evidence,'verify.cjs'));
const headerSource=fs.readFileSync(path.join(evidence,'source/ReferenceHeaderProbe.as'),'utf8');
let sourceLoops=0;
function check(node){
 if(!node)return;
 if(node.kind===K.FORIN){sourceLoops++;assert.equal(node.children.length,3);assert.equal(node.children[2].kind,K.BLOCK);assert.ok(node.end>=node.children[2].end);}
 node.children.forEach(check);
}
check(parse('ReferenceHeaderProbe.as',headerSource));assert.equal(sourceLoops,1);
const cases=[
 ['braced','for(var key:String in obj){count++;}',2],
 ['untyped-header','for(var key in obj){count++;}',2],
 ['existing-binding','var key:String;for(key in obj){count++;}',2],
 ['unbraced-if','if(true) for(var key:String in obj) count++; else count=100;',2],
 ['unbraced-else','if(false) for(var key:String in obj) count++; else count=100;',100],
 ['continue-label','outer: for(var key:String in obj){count++;continue outer;}',2],
 ['break-label','outer: for(var key:String in obj){count++;break outer;}',1],
 ['nested','for(var key:String in obj) for(var sub:String in obj) count++;',4],
 ['dangling-else','if(true) for(var key:String in obj) if(false) count=100; else count++;',2],
 ['empty','for(var key:String in obj);count=7;',7],
];
const source='package probe { import flash.utils.Dictionary; public class Probe {\n'+cases.map(([id,body],index)=>
 'public function case'+index+'():Number {var obj:Object={a:1,b:2};var count:Number=0;'+body+'return count;}').join('\n')+
 '\npublic function keys(values:Dictionary):Array {var result:Array=[];for(var key:* in values){result.push(key);}return result;}\n} }';
const base=path.resolve('.cache/native-forin-bodies');fs.mkdirSync(base,{recursive:true});const run=fs.mkdtempSync(path.join(base,'run-'));
fs.writeFileSync(path.join(run,'Probe.as'),source);
const emitted=emit(parse('Probe.as',source),source,{decoratorModules:{bound:'./bound',classBound:'./classBound'},customVisitors:[],
 importModules:{'flash.utils.Dictionary':'./common'},nativeDictionaryPropertyModule:'./common',
 nativeEnumeration:{dictionaryModule:'./common',coercionModule:'./common',stringModule:'./common'}});
fs.writeFileSync(path.join(run,'Probe.ts'),emitted);
const expected=cases.map(([id,,value])=>({id,value})).concat([{id:'dictionary-key',value:true},{id:'empty-dictionary',value:0},{id:'null-dictionary',value:0}]);
async function main(){
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||require.resolve('playwright',{paths:[path.resolve('../op2-html5/game-client-laya'),engine]}));
 const browser=await chromium.launch({headless:true}),results=[];
 try{for(const target of [ts.ScriptTarget.ES5,ts.ScriptTarget.ES2015]){
  const directory=path.join(run,'target-'+target);fs.mkdirSync(directory);
  for(const [name,input] of [['Probe',emitted],...['bound','classBound'].map(name=>[name,fs.readFileSync(path.resolve('utils',name+'.ts'),'utf8')])]){
   const result=ts.transpileModule(input,{compilerOptions:{module:ts.ModuleKind.CommonJS,target,experimentalDecorators:true,downlevelIteration:true},reportDiagnostics:true});
   assert.deepEqual(result.diagnostics,[]);fs.writeFileSync(path.join(directory,name+'.js'),result.outputText);
  }
  fs.writeFileSync(path.join(directory,'common.ts'),['Dictionary','AS3Property','AS3Coercion','AS3String'].map(name=>
   'export * from '+JSON.stringify(path.relative(directory,path.join(engine,'src/layaAir/flash/utils',name)).replaceAll('\\','/'))+';').join('\n'));
  fs.writeFileSync(path.join(directory,'entry.js'),'export * from "./Probe.js";export {Dictionary,as3SetProperty} from "./common";');
  const bundle=esbuild.buildSync({entryPoints:[path.join(directory,'entry.js')],bundle:true,write:false,format:'iife',globalName:'ForInProbe',target:'es2015',platform:'browser',metafile:true});
  const exercise=`const p=new ForInProbe.Probe();const rows=${JSON.stringify(cases.map(([id],i)=>({id,method:'case'+i})))}.map(row=>({id:row.id,value:p[row.method]()}));
   const d=new ForInProbe.Dictionary(),key={};ForInProbe.as3SetProperty(d,key,1);const keys=p.keys(d);
   rows.push({id:'dictionary-key',value:keys.length===1&&keys[0]===key},{id:'empty-dictionary',value:p.keys(new ForInProbe.Dictionary()).length},{id:'null-dictionary',value:p.keys(null).length});return rows;`;
  const script=bundle.outputFiles[0].text+';globalThis.forInRows=(()=>{'+exercise+'})();';fs.writeFileSync(path.join(directory,'browser.js'),script);
  const node=new Function(script+';return globalThis.forInRows;')();assert.deepEqual(node,expected);
  const page=await browser.newPage();await page.addScriptTag({content:script});const chromiumRows=await page.evaluate(()=>globalThis.forInRows);await page.close();
  assert.deepEqual(chromiumRows,expected);results.push({target,downlevelIteration:true,node,chromium:chromiumRows,
   inputs:Object.keys(bundle.metafile.inputs).map(file=>({file,sha256:hash(fs.readFileSync(file))}))});
 }}finally{await browser.close();}
 fs.writeFileSync(path.join(run,'report.json'),JSON.stringify({scope:'Parser/body/control-flow regressions; reference coercion remains a separate prerequisite.',headerSourceSha256:hash(headerSource),sourceSha256:hash(source),emittedSha256:hash(emitted),results},null,2));
 console.log('For-in bodies: original AIR header AST owns its body; 10 control-flow and 3 common Dictionary cases in Node/Chromium on ES5/ES2015. '+run);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
