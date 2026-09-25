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
test('exact bounded character-class test is bound to retained AIR/browser evidence',()=>{
 const laya=fs.realpathSync(process.env.HARDENED_FIXTURE_LAYA||path.resolve(root,'../LayaAir')),
  revision='575b82f69e3037c97be4115eec18f19f0d37fd53',fixture=path.join(laya,'tests/nativeFlashOracle/regexp-bounded-character-class');
 const retained=require('node:child_process').spawnSync('git',['merge-base','--is-ancestor',revision,'HEAD'],{cwd:laya,encoding:'utf8'});
 assert.equal(retained.status,0,retained.stderr||'bounded RegExp evidence revision is not retained');
 const files={
  'RegExpBoundedCharacterClassProbe.as':'a3fe091dcac06cc250acdda1d8ba5e91d9341e063206edef972de6c6fc15628c',
  'scenario.json':'e972c76e15890b70ceb679bdd468251e976e734ca778107145cc1c3de1197248',
  'native-air.json':'d4866b05c4431d314a3705ef67915dd7ec3897d3996362ed28e3170784ab599f',
  'browser-pin.json':'4891a1b2122be1e60d94eafffced4c84009cfe1d8fc6cea3b5eb7777c97da3bc',
  'run-browser.mjs':'115742667d40d5815de887c7effd713d5576f01da150723c71fa0f95fbcf0047',
  'browser-air.json':'794b2e326d3905d5809ce73580e953ab521c00c6b71389fbe1974609c5e896dd',
 };
 for(const [name,digest] of Object.entries(files)) {
  assert.equal(hash(require('node:child_process').execFileSync('git',['show',`${revision}:tests/nativeFlashOracle/regexp-bounded-character-class/${name}`],{cwd:laya})),digest,`Git object ${name}`);
  assert.equal(hash(fs.readFileSync(path.join(fixture,name))),digest,name);
 }
 const native=JSON.parse(fs.readFileSync(path.join(fixture,'native-air.json'))),
  relation=JSON.parse(fs.readFileSync(path.join(fixture,'browser-air.json'))),
  scenario=JSON.parse(fs.readFileSync(path.join(fixture,'scenario.json'))),
  observations=new Map(native.capture.state.observations.map(row=>[row.id,row.result])),
  pattern='/^[A-Za-z0-9._-]{1,64}$/';
 assert.equal(native.capture.runtime.version,'MAC 51,3,3,2');
 assert.equal(relation.inputs.nativeEvidenceSha256,files['native-air.json']);
 assert.equal(relation.relation.boundedCharacterClassWithAirAnchorLowering,'equal');
 assert.equal(relation.relation.argumentEvaluationCount,'equal');
 assert.equal(relation.observations.length,scenario.steps.length);
 assert.equal(lower(pattern),'^[A-Za-z0-9._-]{1,64}(?=\\r\\n$|[\\n\\r\\v\\f\\u0085\\u2028\\u2029]$|$)');
 for(const step of scenario.steps) {
  let argumentEvaluations=0,actual;
  if(step.calls[0].method==='inspect') {
   const value=step.calls[0].args[0],counted=()=>{argumentEvaluations++;return value;};
   actual={length:value.length,matched:matches(pattern,counted()),argumentEvaluations};
  } else {
   const throwing=()=>{argumentEvaluations++;throw new Error('regexp-argument-probe');};
   try {matches(pattern,throwing());actual={kind:'return',argumentEvaluations};}
   catch(error) {actual={kind:'throw',name:error.name,message:error.message,errorID:0,argumentEvaluations};}
  }
  assert.deepEqual(actual,observations.get(step.id),step.id);
 }
});
test('unsupported native grammar stays explicit',()=>{
 for(const pattern of ['/a/g','/a/i','/a/m','/a./','/[^a]/','/(a)/','/a*/','/a+/','/a?/','/a{1,2}/','/\\d/','/\\n/','/[\\n]/','/a{9999}/','/(?:a{999}){999}/','/(?<=a)b/','/a/extra',
  '/^[A-Za-z0-9._-]{1,63}$/','/^[A-Za-z0-9._-]{0,64}$/','/^[A-Za-z0-9._-]{1,65}$/','/^[A-Za-z0-9._-]{1,}$/','/^[A-Za-z0-9._-]{,64}$/',
  '/^[A-Za-z0-9._-]{64,1}$/','/^[A-Za-z0-9._-]{01,64}$/','/^[A-Za-z0-9._]{1,64}$/','/^[A-Za-z0-9._-]{1,64}?$/',
  '/^(?:[A-Za-z0-9._-]){1,64}$/','/^[A-Za-z0-9._-]{1,64}{1}$/','/^[A-Za-z0-9._-]{1,64}$/g','/^[A-Za-z0-9._-]{1,64}/'])
  assert.throws(()=>lower(pattern),/unsupported/,pattern);
 assert.throws(()=>replace('a','/a/',()=> 'b'),/unavailable/);
 for(const pattern of ['/hello/','/[A-Z]{2}/','/^(?:yes|no)$/','/ab(?=c|$)/']) assert.equal(typeof lower(pattern),'string');
});
