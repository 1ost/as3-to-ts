'use strict';
const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),output=fs.mkdtempSync(path.join(os.tmpdir(),'as3-add-'));
fs.writeFileSync(path.join(output,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2022',module:'CommonJS',strict:true,skipLibCheck:true,rootDir:path.join(root,'src'),outDir:output},files:[path.join(root,'src/hardened-runtime/AS3Function.ts')]}));
cp.execFileSync(process.execPath,[path.join(root,'node_modules/typescript-4-9/bin/tsc'),'-p',path.join(output,'tsconfig.json')],{stdio:'inherit'});
const {as3Add,as3String}=require(path.join(output,'hardened-runtime/AS3Coerce.js'));
const {as3FunctionArgument}=require(path.join(output,'hardened-runtime/AS3Function.js'));
const registry=require(path.join(output,'hardened-runtime/internal/AS3TypeRegistry.js'));
class AddValuesProbe {}
const row={kind:'class',qname:'AddValuesProbe',base:null,interfaces:[],sourceSha256:'a'.repeat(64),fields:[],objectTraits:{dynamic:false,members:[]}};
const metadata={schema:'as3-runtime-type-authority@1',qnames:[row.qname],entries:[row]};
registry.installAS3TypeAuthority({schema:metadata.schema,sha256:crypto.createHash('sha256').update(JSON.stringify(metadata)).digest('hex'),qnames:metadata.qnames,entries:[{...row,constructor:AddValuesProbe,predicate:v=>v instanceof AddValuesProbe,constructionTarget:null,constructionProof:null}]});
test.after(()=>fs.rmSync(output,{recursive:true,force:true}));
const laya=process.env.HARDENED_FIXTURE_LAYA;
test('native addition retains values, asymmetric conversion, typed slots and exact errors',{skip:!laya},()=>{
 const dir=path.join(laya,'tests/nativeFlashOracle/add-values'),golden=JSON.parse(fs.readFileSync(path.join(dir,'native-air.json'),'utf8'));
 for(const [file,key] of [['AddValuesProbe.as','sourceSha256'],['scenario.json','scenarioSha256']])assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,file))).digest('hex'),golden[key]);
 const scenario=JSON.parse(fs.readFileSync(path.join(dir,'scenario.json'),'utf8'));
 for(const checkpoint of golden.capture.state.observations){
  const step=scenario.steps.find(step=>step.id===checkpoint.id).calls[0],events=[];
  const actual={result:'',stringResult:false,failure:'',order:''};
  function record(name,value){return function(){events.push(name);return value;};}
  let result;
  try{
   if(step.method!=='special'){
    const type=step.method==='appendText'?'String':step.method==='appendNumber'?'Number':'*';
    result=as3FunctionArgument(as3Add(as3FunctionArgument(step.args[0],type),step.args[1]),type);
   }else{
    let mode=step.args[0],left='prefix:',right;
    if(mode.startsWith('numeric-')){left=7;mode=mode.slice(8);}
    const values={undefined:undefined,class:AddValuesProbe,function:()=>{},valueOf:{valueOf:record('valueOf',7),toString:record('toString','text')},fallback:{valueOf:record('valueOf',{}),toString:record('toString','text')},'null-return':{valueOf:record('valueOf',null),toString:record('toString','text')},'undefined-return':{valueOf:record('valueOf',undefined),toString:record('toString','text')},noncallable:{valueOf:7,toString:record('toString','text')},failure:{valueOf:record('valueOf',{}),toString:record('toString',{})},throw:{valueOf(){events.push('valueOf');throw new Error('conversion failed');}}};
    right=values[mode];
    if(mode==='reverse'){left={valueOf:record('valueOf',7),toString:record('toString','text')};right=':suffix';}
    if(mode==='pair-string'){left={valueOf:record('left-valueOf','left'),toString:record('left-toString','L')};right={valueOf:record('right-valueOf',7),toString:record('right-toString','R')};}
    if(mode==='pair'){events.push('left-eval','right-eval');left={valueOf:record('left-convert',12)};right={valueOf:record('right-convert',5)};}
    if(mode==='slot'){events.push('get','right-eval');left='old:';right={valueOf:record('right-convert',5)};}
    result=as3Add(left,right);if(mode==='slot')events.push('set');
   }
   actual.result=as3String(result);actual.stringResult=typeof result==='string';
  }catch(error){actual.failure=as3String(error);}
  actual.order=events.join(',');const {id,...expected}=checkpoint;assert.deepEqual(actual,expected,id);
 }
});
test('addition rejects host-only primitives and unresolved objects',()=>{
 for(const value of [1n,Symbol(),new (class Unknown {})()]) for(const other of ['',1])assert.throws(()=>as3Add(other,value),{name:'AS3ObjectDispatchUnavailable'});
});
