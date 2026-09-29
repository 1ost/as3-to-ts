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

const {AS3RangeError:NativeRangeError}=load(path.join(root,'src/hardened-runtime/AS3Error.ts'));
const {as3ErrorToString,as3ErrorID}=load(path.join(root,'src/hardened-runtime/AS3Coerce.ts'));
const metadata={schema:'as3-runtime-type-authority@1',qnames:[],entries:[]};
load(path.join(root,'src/hardened-runtime/internal/AS3TypeRegistry.ts')).installAS3TypeAuthority({schema:metadata.schema,sha256:crypto.createHash('sha256').update(JSON.stringify(metadata)).digest('hex'),qnames:[],entries:[]});
const fixture=path.join(process.env.HARDENED_FIXTURE_LAYA||path.resolve(root,'../LayaAir'),'tests/nativeFlashOracle/range-error-construction');
test('all13 native constructor/catch/message/id/conversion observations match',()=>{
 const retained=JSON.parse(fs.readFileSync(path.join(fixture,'native-air.json'))),hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
 assert.equal(hash(path.join(fixture,'RangeErrorConstructionProbe.as')),retained.sourceFiles['RangeErrorConstructionProbe.as']);assert.equal(hash(path.join(fixture,'scenario.json')),retained.scenarioSha256);
 const rows=retained.capture.state.observations;assert.equal(rows.length,13);
 for(let mode=0;mode<13;mode++){
  const events=[];const args=[[],[''],['The requested frame is out of bounds.'],['custom message'],['identified',73],['overflow',4294967297],['fraction',-1.9],[42],[null],[undefined],['string id','73'],['nan id',NaN],[{toString(){events.push('message-toString');return 'message object';}},{valueOf(){events.push('id-valueOf');return 73;}}]][mode];
  const failure=new NativeRangeError(...args);let caught,rethrown;try{throw failure;}catch(error){assert.ok(error instanceof Error);caught=error;}try{throw caught;}catch(error){rethrown=error;}
  const message=caught.message,kind=typeof message,value=kind==='object'&&message!==null?'[object retained]':message===undefined?'[undefined]':message;
  const result=[caught===failure,rethrown===failure,caught.name,kind,value,message===null,message===undefined,as3ErrorID(caught),as3ErrorToString(caught),events];
  assert.deepEqual(result,rows[mode].result,rows[mode].id);
 }
});
test('identifier conversion observes evaluated arguments without converting the message eagerly',()=>{
 const events=[],message={toString(){events.push('message-convert');return 'text';}},id={valueOf(){events.push('id-convert');return 2;}};
 const value=new NativeRangeError((events.push('message-evaluate'),message),(events.push('id-evaluate'),id));
 assert.equal(value.message,message);assert.deepEqual(events,['message-evaluate','id-evaluate','id-convert']);assert.equal(as3ErrorToString(value),'RangeError: text');assert.deepEqual(events,['message-evaluate','id-evaluate','id-convert','message-convert']);
});
