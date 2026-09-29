const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{fork}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const {loadCompileDefinitions}=require('../../lib/compile-definitions.js');
const config=(enabled=true,nested=true)=>({schema:'as3-boolean-compile-definitions@1',definitions:{'CONFIG::enabled':enabled,'CONFIG::nested':nested,'CONFIG::disabled':false}});
const source=fs.readFileSync(path.join(__dirname,'fixtures/compile-definitions/CompileDefinitionsProbe.as'),'utf8');
function request(worker,content,definitions,extra={}){return new Promise((resolve,reject)=>{const file=path.join(root,'lib',worker+'.js'),child=fork(file,[],{stdio:['ignore','ignore','pipe','ipc']});let stderr='';const timeout=setTimeout(()=>{child.kill();reject(Error('worker timeout'));},10000);child.stderr.on('data',b=>stderr+=b);child.on('error',reject);child.once('message',r=>{clearTimeout(timeout);assert.equal(stderr,'');resolve(r);});child.send({sourcePath:'CompileDefinitionsProbe.as',content,workerSha256:sha(fs.readFileSync(file)),...(worker==='parser-worker'?{format:'normalized',maxAstBytes:1e6}:{maxResultBytes:1e6}),...(definitions?{compileDefinitions:definitions}:{}),...extra});});}
test('Boolean CONFIG statement projection removes disabled type references and retains exact source identity',async()=>{
 for(const enabled of [true,false])for(const nested of [true,false]){
  const r=await request('parser-worker',source,config(enabled,nested));assert.equal(r.ok,true,r.error);const ast=JSON.parse(r.json);
  assert.equal(ast.sourceSha256,sha(source));assert.equal(ast.fingerprintSha256,sha(JSON.stringify(ast.nodes)));assert.match(ast.compileDefinitionsSha256,/^[a-f0-9]{64}$/);
  assert(!ast.nodes.some(n=>n.text==='MissingInstrumentation'));assert.equal(ast.nodes.some(n=>n.text==='":enabled"'),enabled);assert.equal(ast.nodes.some(n=>n.text==='":nested"'),enabled&&nested);
  assert.equal(ast.nodes.some(n=>n.text==='":tail"'),true);
  const d=await request('declaration-worker',source,config(enabled,nested));assert.equal(d.ok,true,d.error);assert.equal(JSON.parse(d.json).sourceSha256,sha(source));
 }
 const plain=await request('parser-worker',source);assert.equal(plain.ok,true,plain.error);assert(JSON.parse(plain.json).nodes.some(n=>n.text==='MissingInstrumentation'));
 const enabledMissing=config();enabledMissing.definitions['CONFIG::disabled']=true;
 const included=await request('parser-worker',source,enabledMissing);assert.equal(included.ok,true,included.error);assert(JSON.parse(included.json).nodes.some(n=>n.text==='MissingInstrumentation'));
});
test('unknown, expression and semicolon guards cannot silently remove code',async()=>{
 const missing=config();delete missing.definitions['CONFIG::enabled'];
 assert.match((await request('parser-worker',source,missing)).error,/COMPILE_DEFINITION_MISSING/);
 const nestedMissing=config(false);delete nestedMissing.definitions['CONFIG::nested'];
 assert.match((await request('parser-worker',source,nestedMissing)).error,/COMPILE_DEFINITION_MISSING/);
 for(const body of ['CONFIG::enabled; { value="wrong"; }','value = CONFIG::enabled;','if(CONFIG::enabled) {value="wrong";}']){
  const r=await request('parser-worker','package {public class CompileDefinitionsProbe {public var value:String="";public function run():void{'+body+'}}}',config());
  assert.equal(r.ok,false);assert.match(r.error,/COMPILE_GUARD/);
 }
 for(const value of [null,{}, {schema:'as3-boolean-compile-definitions@1',definitions:{'CONFIG::enabled':'false'}},{schema:'as3-boolean-compile-definitions@1',definitions:{'other::x':false}}])assert.throws(()=>loadCompileDefinitions(JSON.stringify(value)),/COMPILE_DEFINITIONS/);
});
test('include projection retains root and fragment provenance with original UTF16 spans',async()=>{
 const original='package {public class CompileDefinitionsProbe {public var value:String="";public function run():void {include "Part.as";}}}';
 const part='CONFIG::disabled {var absent:MissingInstrumentation;} CONFIG::enabled {value="included";}';
 const {inspectSourceIncludes,loadSourceIncludes}=require('../../lib/source-includes.js');const os=require('node:os');
 const dir=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'config-includes-'));
 try{fs.writeFileSync(path.join(dir,'CompileDefinitionsProbe.as'),original);fs.writeFileSync(path.join(dir,'Part.as'),part);
 const includes=loadSourceIncludes(JSON.stringify(inspectSourceIncludes(dir,['CompileDefinitionsProbe.as'])));
 const r=await request('parser-worker',original,config(),{includeRootPath:'CompileDefinitionsProbe.as',includeFragments:includes.fragments,includeEdges:includes.inventory.edges});
 assert.equal(r.ok,true,r.error);const ast=JSON.parse(r.json);assert.equal(ast.sourceSha256,sha(original));assert.equal(ast.includeExpansion.fragments[0].sha256,sha(part));assert(!ast.nodes.some(n=>n.text==='MissingInstrumentation'));assert(ast.nodes.some(n=>n.text==='"included"'));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
