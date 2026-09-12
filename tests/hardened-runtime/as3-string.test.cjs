'use strict';
const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),output=fs.mkdtempSync(path.join(os.tmpdir(),'as3-string-'));
fs.writeFileSync(path.join(output,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2022',module:'CommonJS',strict:true,skipLibCheck:true,rootDir:path.join(root,'src'),outDir:output},files:[path.join(root,'src/hardened-runtime/AS3Coerce.ts')]}));
cp.execFileSync(process.execPath,[path.join(root,'node_modules/typescript-4-9/bin/tsc'),'-p',path.join(output,'tsconfig.json')],{stdio:'inherit'});
const {as3String,as3TraceValue,as3StringToLowerCase}=require(path.join(output,'hardened-runtime/AS3Coerce.js'));
const registry=require(path.join(output,'hardened-runtime/internal/AS3TypeRegistry.js'));
class StringConversionProbe {}
const row={kind:'class',qname:'StringConversionProbe',base:null,interfaces:[],sourceSha256:'a'.repeat(64),fields:[],objectTraits:{dynamic:false,members:[]}};
const metadata={schema:'as3-runtime-type-authority@1',qnames:[row.qname],entries:[row]};
registry.installAS3TypeAuthority({schema:metadata.schema,sha256:crypto.createHash('sha256').update(JSON.stringify(metadata)).digest('hex'),qnames:metadata.qnames,entries:[{...row,constructor:StringConversionProbe,predicate:v=>v instanceof StringConversionProbe,constructionTarget:null,constructionProof:null}]});
test.after(()=>fs.rmSync(output,{recursive:true,force:true}));
const laya=process.env.HARDENED_FIXTURE_LAYA;
test('lowercase matches every BMP unit from the retained native scan',{skip:!laya},()=>{
 const fixture=path.join(laya,'tests/nativeFlashOracle/string-case-scan');
 cp.execFileSync('python3',['-B',path.join(root,'tools/create-native-case-table.py'),'--fixture',fixture,'--check'],{stdio:'inherit'});
 const rows=JSON.parse(fs.readFileSync(path.join(fixture,'native-air.json'),'utf8')).capture.state.observations[0].changes;
 const expected=new Map(rows.map(row=>[row.from,String.fromCharCode(...row.to)]));
 for(let unit=0;unit<65536;unit++) assert.equal(as3StringToLowerCase(String.fromCharCode(unit)),expected.get(unit)??String.fromCharCode(unit),unit.toString(16));
});
test('native lowercase sequences preserve locale-independent UTF-16 behavior and null errors',{skip:!laya},()=>{
 const fixture=path.join(laya,'tests/nativeFlashOracle/string-case');
 const golden=JSON.parse(fs.readFileSync(path.join(fixture,'native-air.json'),'utf8'));
 for(const [file,hash] of [['StringCaseProbe.as',golden.sourceSha256],['scenario.json',golden.scenarioSha256]])
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(fixture,file))).digest('hex'),hash,file);
 const scenario=JSON.parse(fs.readFileSync(path.join(fixture,'scenario.json'),'utf8'));
 for(const checkpoint of golden.capture.state.observations){
  const step=scenario.steps.find(step=>step.id===checkpoint.id);
  const actual={result:'',failure:''};
  try{actual.result=as3StringToLowerCase(step.calls[0].args[0]);}catch(error){actual.failure=as3String(error);}
  const {id,...expected}=checkpoint;assert.deepEqual(actual,expected,id);
 }
});
test('native String conversion values and exact errors',{skip:!laya},()=>{
 const capture=JSON.parse(fs.readFileSync(path.join(laya,'tests/nativeFlashOracle/string-conversion/native-air.json'),'utf8')).capture;
 const values={object:{},class:new StringConversionProbe(),function:()=>{},constructor:StringConversionProbe,array:[1,null,undefined,['x','y'],{}],
  custom:{toString:()=> 'custom'},'number-return':{toString:()=>7},'null-return':{toString:()=>null},'undefined-return':{toString:()=>undefined},
  fallback:{toString:()=>({}),valueOf:()=>9},noncallable:{toString:3,valueOf:()=>11},failure:{toString:()=>({}),valueOf:()=>({})},'array-override':Object.assign([1,2],{toString:()=> 'array-custom'})};
 for(const row of capture.state.observations){
  const actual={result:'',errorName:'',errorId:0,message:''};
  try{actual.result=as3String(values[row.id]);}catch(error){Object.assign(actual,{errorName:error.name,errorId:error.errorID,message:error.message});}
  const {id,...expected}=row;assert.deepEqual(actual,expected,id);
 }
});
test('lazy trace values convert once in bridge order and preserve partial output',{skip:!laya},()=>{
 const ts=require(path.join(root,'node_modules/typescript-4-9'));
 const source=fs.readFileSync(path.join(laya,'src/layaAir/flash/debug/trace.ts'),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};Function('module','exports',compiled)(module,module.exports);
 const {trace,installNativeTraceHost}=module.exports;let output='',calls=0;
 const lease=installNativeTraceHost({write(text){output+=text;}});
 const bad=as3TraceValue({toString(){calls++;throw new Error('conversion failed')}});
 assert.equal(calls,0);
 trace('TRACE-ERROR-BEGIN');
 assert.throws(()=>trace('discarded-prefix',bad,bad),{message:'conversion failed'});
 trace('TRACE-ERROR-END','conversion failed',calls);lease.dispose();
 const native=JSON.parse(fs.readFileSync(path.join(laya,'tests/nativeFlashOracle/trace-errors/native-air.json'),'utf8'));
 assert.equal(output,native.output);assert.equal(calls,1);
});
test('unsupported recursive arrays and unauthenticated objects remain explicit',()=>{
 const cyclic=[];cyclic.push(cyclic);
 assert.throws(()=>as3String(cyclic),{name:'AS3ObjectDispatchUnavailable'});
 assert.throws(()=>as3String(new (class Unknown {})()),{name:'AS3ObjectDispatchUnavailable'});
});


test('native Error string formatting preserves empty and null names',{skip:!laya},()=>{
 const rows=JSON.parse(fs.readFileSync(path.join(laya,'tests/nativeFlashOracle/error-string/native-air.json'),'utf8')).capture.state.observations;
 const values={empty:new Error(),message:new Error('message'),null:new Error(null),type:new TypeError('typed'),reference:new ReferenceError('reference'),
  name:Object.assign(new Error('message'),{name:'custom'}),'empty-name':Object.assign(new Error('message'),{name:''}),'null-name':Object.assign(new Error('message'),{name:null})};
 for(const row of rows) assert.equal(as3String(values[row.id]),row.result,row.id);
});
