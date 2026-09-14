'use strict';
const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),ts=require(path.join(root,'node_modules/typescript-4-9'));
// In-memory CommonJS loader: cache partial exports before loading cyclic runtime imports.
const cache=new Map();
function load(file){
 file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;
 const mod={exports:{}};cache.set(file,mod);
 const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 Function('require','module','exports',js)(id=>id.startsWith('.')?load(path.resolve(path.dirname(file),id+'.ts')):require(id),mod,mod.exports);
 return mod.exports;
}

const {as3RegExpTest:matches,as3RegExpReplaceReceiver:replaceReceiver}=load(path.join(root,'src/hardened-runtime/AS3RegExp.ts'));
const {lowerAS3RegExpLiteral:lower}=load(path.join(root,'src/hardened-runtime/internal/AS3RegExpPattern.ts'));
const metadata={schema:'as3-runtime-type-authority@1',qnames:[],entries:[]};
load(path.join(root,'src/hardened-runtime/internal/AS3TypeRegistry.ts')).installAS3TypeAuthority({schema:metadata.schema,sha256:crypto.createHash('sha256').update(JSON.stringify(metadata)).digest('hex'),qnames:[],entries:[]});
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const replace=(value,pattern,replacement)=>replaceReceiver(value)(pattern,replacement);
const digest='/^[0-9a-f]{64}$/',assets='/assets_(?:en|cn)(?=\\/|$)/';
for(const [folder,name,count] of [['regexp-config-patterns','RegExpConfigPatternsProbe',41],['regexp-anchor-newlines','RegExpAnchorNewlinesProbe',50]]) {
 test(`native source-bound ${folder} ${count} observations`,()=>{
  const fixture=path.join(process.env.HARDENED_FIXTURE_LAYA||path.resolve(root,'../LayaAir'),'tests/nativeFlashOracle',folder);
  const evidence=JSON.parse(fs.readFileSync(path.join(fixture,'native-air.json'))),scenario=JSON.parse(fs.readFileSync(path.join(fixture,'scenario.json')));
  assert.equal(hash(fs.readFileSync(path.join(fixture,name+'.as'))),evidence.sourceFiles[name+'.as']);
  assert.equal(hash(fs.readFileSync(path.join(fixture,'scenario.json'))),evidence.scenarioSha256);
  const observations=new Map(evidence.capture.state.observations.map(row=>[row.id,row.result]));assert.equal(observations.size,count);
  for(const step of scenario.steps){
   const call=step.calls[0],value=call.args[0];let actual;
   if(call.method==='exercise') actual=[matches('/^a$/',value),matches('/a$/',value),matches('/^$/',value),replace(value,'/$/','#'),replace(value,'/^a$/','X'),replace(value,'/a$/','X')];
   else if(call.method==='digest'){const local=value?value.toLowerCase():'';actual=[matches(digest,value),local,matches(digest,local)?local:''];}
   else if(call.method==='assets') actual=[replace(value||'',assets,'assets')];
   else if(call.method==='replacement') actual=[replace('before/assets_en/after/assets_cn/end',assets,value)];
   else {const events=[];const input=value===0?null:value===1?undefined:value===2?7:{toString(){events.push('toString');return 'assets';}};actual=[replace('assets_en/path',assets,input),matches(digest,input),events];}
   assert.deepEqual(actual,observations.get(step.id),step.id);
  }
 });
}
test('unsupported native grammar stays explicit',()=>{
 for(const pattern of ['/a/g','/a/i','/a/m','/a./','/[^a]/','/(a)/','/a*/','/a+/','/a?/','/a{1,2}/','/\\d/','/\\n/','/[\\n]/','/a{9999}/','/(?:a{999}){999}/','/(?<=a)b/','/a/extra']) assert.throws(()=>lower(pattern),/unsupported/,pattern);
 assert.throws(()=>replace('a','/a/',()=> 'b'),/unavailable/);
 for(const pattern of ['/hello/','/[A-Z]{2}/','/^(?:yes|no)$/','/ab(?=c|$)/']) assert.equal(typeof lower(pattern),'string');
});
