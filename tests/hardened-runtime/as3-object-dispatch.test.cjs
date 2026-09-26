"use strict";
const assert=require("node:assert/strict"),test=require("node:test"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),cp=require("node:child_process"),crypto=require("node:crypto");
const root=path.resolve(__dirname,"../.."), out=fs.mkdtempSync(path.join(os.tmpdir(),"as3-dispatch-"));
fs.writeFileSync(path.join(out,"tsconfig.json"),JSON.stringify({compilerOptions:{target:"ES2022",module:"CommonJS",strict:true,skipLibCheck:true,rootDir:path.join(root,"src"),outDir:out},files:[path.join(root,"src/hardened-runtime/AS3ObjectDispatch.ts"),path.join(root,"src/hardened-runtime/AS3Object.ts")]}));
cp.execFileSync(process.execPath,[path.join(root,"node_modules/typescript-4-9/bin/tsc"),"-p",path.join(out,"tsconfig.json")],{stdio:"inherit"});
const r=require(path.join(out,"hardened-runtime/AS3ObjectDispatch.js")), i=require(path.join(out,"hardened-runtime/internal/AS3TypeRegistry.js")), {as3ObjectLiteral}=require(path.join(out,"hardened-runtime/AS3Object.js"));
const brands=new WeakSet(),externalBrands=new WeakSet();
class DynamicClassProbe {constructor(){brands.add(this);this.field=7;this.hidden="private";this.fixed=3;} method(){return "method";}}
class ExternalDynamicClassProbe {constructor(){externalBrands.add(this)}}
const members=[{name:"field",kind:"field",type:"int",visibility:"public",namespaceName:null},{name:"hidden",kind:"field",type:"String",visibility:"private",namespaceName:null},{name:"fixed",kind:"const",type:"int",visibility:"public",namespaceName:null},{name:"method",kind:"method",type:"Function",visibility:"public",namespaceName:null}];
class ObjectErrorProbe extends DynamicClassProbe {}
const rows=[{kind:"class",qname:"DynamicClassProbe",base:null,interfaces:[],sourceSha256:"a".repeat(64),fields:[],objectTraits:{dynamic:false,members}}, {kind:"class",qname:"ExternalDynamicClassProbe",base:null,interfaces:[],sourceSha256:"b".repeat(64),fields:[],objectTraits:{dynamic:false,members:[]}}];
rows.push({...rows[0],qname:"oracle.probe.ObjectErrorProbe",sourceSha256:"c".repeat(64)});
const nativeBrands=new WeakSet(),childBrands=new WeakSet(),unknownBrands=new WeakSet();
class NativeBase {constructor(){nativeBrands.add(this)} nativeOnly(){throw new Error("must not call native host properties")}}
class LocalChild extends NativeBase {constructor(){super();childBrands.add(this);this.calls=0} dispose(){this.calls++}}
class UnknownNative extends NativeBase {constructor(){super();unknownBrands.add(this)}}
rows.push({kind:"class",qname:"NativeBase",base:null,interfaces:[],sourceSha256:"d".repeat(64),fields:[],
 nativeObjectTraits:{dynamic:false,names:["nativeOnly"],sourceArtifactSha256:"e".repeat(64)}});
rows.push({kind:"class",qname:"LocalChild",base:"NativeBase",interfaces:[],sourceSha256:"f".repeat(64),fields:[],
 objectTraits:{dynamic:false,members:[{name:"dispose",kind:"method",type:"Function",visibility:"public",namespaceName:null}]}});
rows.push({kind:"class",qname:"UnknownNative",base:"NativeBase",interfaces:[],sourceSha256:"1".repeat(64),fields:[],
 nativeObjectTraits:{dynamic:null,names:[],sourceArtifactSha256:"e".repeat(64)}});
const dynamicNativeBrands=new WeakSet(),dynamicSourceBrands=new WeakSet();
class DynamicNative {constructor(){dynamicNativeBrands.add(this)}}
class DynamicSource {constructor(){dynamicSourceBrands.add(this);this.hidden="private"}}
rows.push({kind:"class",qname:"flash.display.MovieClip",base:null,interfaces:[],sourceSha256:"2".repeat(64),fields:[],
 nativeObjectTraits:{dynamic:true,names:[],sourceArtifactSha256:"e".repeat(64)}});
rows.push({kind:"class",qname:"DynamicSource",base:null,interfaces:[],sourceSha256:"3".repeat(64),fields:[],
 objectTraits:{dynamic:true,members:[{name:"hidden",kind:"field",type:"String",visibility:"private",namespaceName:null}]}});
const constructors=[DynamicClassProbe,ExternalDynamicClassProbe,ObjectErrorProbe,NativeBase,LocalChild,UnknownNative,DynamicNative,DynamicSource];
const predicates=[v=>brands.has(v)&&!(v instanceof ObjectErrorProbe),v=>externalBrands.has(v),v=>v instanceof ObjectErrorProbe,
 v=>nativeBrands.has(v),v=>childBrands.has(v),v=>unknownBrands.has(v),v=>dynamicNativeBrands.has(v),v=>dynamicSourceBrands.has(v)];
const metadata={schema:"as3-runtime-type-authority@1",qnames:rows.map(row=>row.qname),entries:rows};
i.installAS3TypeAuthority({schema:metadata.schema,sha256:crypto.createHash("sha256").update(JSON.stringify(metadata)).digest("hex"),qnames:metadata.qnames,entries:rows.map((row,n)=>({...row,constructor:constructors[n],predicate:predicates[n],constructionTarget:null,constructionProof:null}))});
test.after(()=>fs.rmSync(out,{recursive:true,force:true}));
const string=value=>r.as3ObjectFunctionLabel(value)??String(value);

test("dynamic push retains native receiver capture, argument order and primitive failures",()=>{
 const folder=path.join(process.env.HARDENED_FIXTURE_LAYA,"tests/nativeFlashOracle/dynamic-array-push");
 const retained=JSON.parse(fs.readFileSync(path.join(folder,"native-air.json")));
 for(const [name,hash] of Object.entries(retained.sourceFiles))
  assert.equal(crypto.createHash("sha256").update(fs.readFileSync(path.join(folder,name))).digest("hex"),hash);
 for(const row of retained.capture.state.observations){
  if(["class-method","wrong-method-arity"].includes(row.id))continue; // Actual generated methods are exercised by the paired fixture.
  const original=["original"],log=[];let stored=original;
  const values={null:null,undefined:undefined,"noncallable-property":{push:7},"missing-property":{},string:"text",number:7,boolean:true};
  if(Object.hasOwn(values,row.id))stored=values[row.id];
  const current=()=>{log.push("receiver");return stored;};
  const argument=n=>{log.push("arg"+n);if(row.id==="receiver-replaced"&&n===1)stored=["replacement"];return n;};
  let result;
  try {
   const answer=row.id==="no-arguments"?r.as3ObjectCall(current(),"push",[]):row.id==="one-argument"?
    r.as3ObjectCall(current(),"push",[argument(1)]):r.as3ObjectCall(current(),"push",[argument(1),argument(2)]);
   result=["return",answer];
  }catch(error){result=[error.name,error.errorID,error.message];}
  result.push(log,original.join("|"),0,0,stored===original);assert.deepEqual(result,row.result,row.id);
 }
 const overridden=[];overridden.push=()=>99;
 assert.throws(()=>r.as3ObjectCall(overridden,"push",[1]),{name:"AS3ArrayOperationUnavailable"});
 assert.throws(()=>r.as3ObjectCall(new(class extends Array{})(),"push",[1]),{name:"AS3ArrayOperationUnavailable"});
});

test("native same-class and external namespace operations",()=>{
 const goldenRoot=process.env.HARDENED_FIXTURE_LAYA;
 assert.ok(goldenRoot,"HARDENED_FIXTURE_LAYA identifies retained native captures");
 for(const [folder,caller] of [["dynamic-class","DynamicClassProbe"],["dynamic-class-external","ExternalDynamicClassProbe"]]){
  const native=JSON.parse(fs.readFileSync(path.join(goldenRoot,"tests/nativeFlashOracle",folder,"native-air.json"),"utf8")).capture.state.observations;
  const target=new DynamicClassProbe();
  for(const row of native){
   const split=row.id.indexOf("-"),operation=row.id.slice(0,split),key=row.id.slice(split+1);
   let errorId=0,errorName="",value="";
   if(operation==="read"){
    assert.equal(r.as3ObjectHas(target,key),row.present,row.id);assert.equal(r.as3ObjectHasOwn(target,key),row.own,row.id);
    try{value=string(r.as3ObjectRead(target,key,caller));}catch(error){errorId=error.errorID;errorName=error.name;}
    assert.deepEqual({value,errorId,errorName},{value:row.value,errorId:row.errorId,errorName:row.errorName},folder+"/"+row.id);
   }else if(operation==="write"){
    const next={field:3.7,hidden:"changed",absent:1,fixed:2,method:"changed"}[key];
    try{r.as3ObjectWrite(target,key,next,caller);}catch(error){errorId=error.errorID;errorName=error.name;}
    assert.deepEqual({errorId,errorName},{errorId:row.errorId,errorName:row.errorName},folder+"/"+row.id);
   }else assert.equal(r.as3ObjectDelete(target,key,caller),row.removed,row.id);
  }
 }
});
test("plain objects do not expose JS prototype magic and preserve data keys",()=>{
 const value=as3ObjectLiteral([]);
 assert.equal(r.as3ObjectRead(value,"absent"),undefined);
 assert.equal(r.as3ObjectHas(value,"toString"),true);
 assert.equal(r.as3ObjectHasOwn(value,"toString"),false);
 assert.equal(r.as3ObjectRead(value,"__defineGetter__"),undefined);
 r.as3ObjectWrite(value,"__proto__","data");
 assert.equal(r.as3ObjectRead(value,"__proto__"),"data");
 assert.equal(Object.getPrototypeOf(value),Object.prototype);
 assert.equal(r.as3ObjectDelete(value,"toString"),true);
 assert.equal(r.as3ObjectHas(value,"toString"),true);
 assert.equal(r.as3ObjectCall(value,"toString",[]),"[object Object]");
});

function golden(folder,file="native-air.json") {
 return JSON.parse(fs.readFileSync(path.join(process.env.HARDENED_FIXTURE_LAYA,"tests/nativeFlashOracle",folder,file),"utf8")).capture.state.observations;
}
test("retained native Object prototype surface",()=>{
 const target=as3ObjectLiteral([]);
 for(const row of golden("dynamic-object","prototype-native-air.json")) {
  const key=row.id;
  assert.equal(string(r.as3ObjectRead(target,key)),row.value,key);
  assert.equal(r.as3ObjectHas(target,key),row.present,key);
  assert.equal(r.as3ObjectHasOwn(target,key),row.own,key);
 }
});
test("retained native errors include exact names, IDs and messages",()=>{
 const target=new ObjectErrorProbe();
 for(const row of golden("object-errors")) {
  const [operation,key]=row.id.split("-");
  assert.throws(()=>operation==="write"?r.as3ObjectWrite(target,key,5,"oracle.probe.ObjectErrorProbe"):
   r.as3ObjectRead(operation==="null"?null:operation==="undefined"?undefined:target,key,"oracle.probe.ObjectErrorProbe"),
   error=>error.name===row.name&&error.errorID===row.errorId&&error.message===row.message,row.id);
 }
});
test("native enumerability and locale string protocol",()=>{
 const target=as3ObjectLiteral([["x",1]]);
 for(const row of golden("object-protocol")) {
  if(row.id==="hidden") r.as3ObjectCall(target,"setPropertyIsEnumerable",["x",false]);
  if(row.id==="shown") r.as3ObjectCall(target,"setPropertyIsEnumerable",["x",true]);
  if(row.id==="missing") r.as3ObjectCall(target,"setPropertyIsEnumerable",["absent",true]);
  if(row.id==="inherited") r.as3ObjectCall(target,"setPropertyIsEnumerable",["toString",true]);
  if(row.id==="override") r.as3ObjectWrite(target,"toString",()=>"custom");
  const key=row.id==="missing"?"absent":["inherited","override"].includes(row.id)?"toString":"x";
  assert.equal(r.as3ObjectHasOwn(target,key),row.own,row.id);
  assert.equal(r.as3ObjectCall(target,"propertyIsEnumerable",[key]),row.enumerable,row.id);
  assert.equal(r.as3ObjectCall(target,"toLocaleString",[]),row.value,row.id);
  assert.equal(r.as3ObjectCall(target,"valueOf",[])===target,row.same,row.id);
  assert.equal(r.as3ObjectCall(target,"isPrototypeOf",[{}]),row.prototype,row.id);
 }
});

test("native dynamic keys convert once, preserve fallback errors and check null receivers first",()=>{
 const folder=path.join(process.env.HARDENED_FIXTURE_LAYA,"tests/nativeFlashOracle/object-keys");
 const native=JSON.parse(fs.readFileSync(path.join(folder,"native-air.json"),"utf8"));
 for(const [file,field] of [["ObjectKeysProbe.as","sourceSha256"],["scenario.json","scenarioSha256"]])
  assert.equal(crypto.createHash("sha256").update(fs.readFileSync(path.join(folder,file))).digest("hex"),native[field]);
 for(const row of native.capture.state.observations.filter(row=>!row.id.startsWith("scalar-")&&row.id!=="enumerate")) {
  const [operation,kind]=row.id.split("-");let calls="",value="";
  let key=as3ObjectLiteral([["toString",()=>{
   calls+="s";
   if(kind==="throws")throw new Error("key failed");
   if(kind==="fallback")return null;
   if(kind==="invalid")return {};
   if(kind==="missing")return "missing";
   if(kind==="builtin")return "toString";
   return "chosen";
  }],["valueOf",()=>{calls+="v";return kind==="invalid"?{}:"chosen"; }]]);
  if(kind==="undefined")key=undefined;
  if(kind==="array")key=["chosen"];
  if(kind==="plain")key={};
  if(kind==="function")key=()=>{};
  if(kind==="noncallable")key={toString:3};
  const target=kind==="null"?null:as3ObjectLiteral([["chosen","stored"]]);
  try {
   if(operation==="read")value=r.as3NativeString(r.as3ObjectRead(target,key));
   if(operation==="write"){r.as3ObjectWrite(target,key,"changed");value=r.as3NativeString(r.as3ObjectRead(target,"chosen"));}
   if(operation==="in")value=String(r.as3ObjectIn(key,target));
   if(operation==="own")value=String(r.as3ObjectCall(target,"hasOwnProperty",[key]));
   if(operation==="delete")value=String(r.as3ObjectDelete(target,key));
  }catch(error){value=error.name+":"+error.message;}
  assert.deepEqual({calls,value},{calls:row.calls,value:row.value},row.id);
 }
 for(const key of [1n,Symbol()])assert.throws(()=>r.as3ObjectRead({},key),{name:"AS3ObjectDispatchUnavailable"});
});

test("authenticated mapped-native dynamic reads consult one own descriptor before missing fallback",()=>{
 const target=new DynamicNative(),lock=new DynamicNative();
 Object.defineProperty(target,"lock",{value:lock,writable:true,enumerable:true,configurable:true});
 assert.equal(r.as3ObjectRead(target,"lock"),lock);
 assert.equal(r.as3ObjectRead(target,"missing"),undefined);
 let reads=0;
 Object.defineProperty(target,"authored",{enumerable:true,configurable:true,get(){reads++;return lock;}});
 assert.equal(r.as3ObjectRead(target,"authored"),lock);assert.equal(reads,1);
 assert.equal(typeof r.as3ObjectRead(target,"toString"),"function","builtin fallback remains available without an own slot");
 const forged=Object.create(DynamicNative.prototype);let forgedReads=0;
 Object.defineProperty(forged,"lock",{get(){forgedReads++;return lock;}});
 assert.throws(()=>r.as3ObjectRead(forged,"lock"),{name:"AS3ObjectDispatchUnavailable"});assert.equal(forgedReads,0);
 const hidden=new DynamicSource();
 assert.throws(()=>r.as3ObjectRead(hidden,"hidden","ExternalDynamicClassProbe"),
  {name:"AS3ObjectDispatchUnavailable"},"an inaccessible generated trait must not become a public dynamic slot");
 assert.equal(r.as3ObjectRead(hidden,"hidden","DynamicSource"),"private");
 assert.throws(()=>r.as3ObjectWrite(hidden,"hidden","overwrite","ExternalDynamicClassProbe"),
  {name:"AS3ObjectDispatchUnavailable"},"public dynamic writes must not overwrite private source storage");
 assert.throws(()=>r.as3ObjectDelete(hidden,"hidden","ExternalDynamicClassProbe"),
  {name:"AS3ObjectDispatchUnavailable"},"public dynamic deletion must not remove private source storage");
 assert.equal(r.as3ObjectRead(hidden,"hidden","DynamicSource"),"private");
 for(const value of [null,undefined])assert.throws(()=>r.as3ObjectRead(value,"lock"),
  error=>error.name==="TypeError"&&error.errorID===(value===null?1009:1010));
});

test("SDK member absence permits local methods without exposing unresolved native methods",()=>{
 const child=new LocalChild();
 assert.throws(()=>r.as3ObjectCall({dispose:function(value){}},"dispose",[],"LocalChild"),{name:"AS3ObjectDispatchUnavailable"});
 r.as3ObjectCall(child,"dispose",[],"LocalChild");assert.equal(child.calls,1);
 assert.equal(r.as3ObjectRead(child,"dispose","LocalChild"),r.as3ObjectRead(child,"dispose","LocalChild"));
 for(const receiver of [child,new NativeBase()]) {
  assert.throws(()=>r.as3ObjectCall(receiver,"nativeOnly",[],"LocalChild"),{name:"AS3ObjectDispatchUnavailable"});
  assert.throws(()=>r.as3ObjectCall(receiver,"missing",[],"LocalChild"),{name:"ReferenceError",errorID:1069});
 }
 assert.throws(()=>r.as3ObjectCall(new UnknownNative(),"missing",[],"LocalChild"),{name:"AS3ObjectDispatchUnavailable"});
 for(const value of [{dispose:7},{}]) assert.throws(()=>r.as3ObjectCall(value,"dispose",[],"LocalChild"),{name:"TypeError",errorID:1006});
});

test("dynamic calls admit source lambdas without admitting unknown host functions",()=>{
 const {as3SourceLambda,isAS3SourceLambda}=require(path.join(out,"hardened-runtime/AS3Function.js"));
 const fn=function(value){return value;};
 assert.equal(isAS3SourceLambda(fn),false);
 assert.throws(()=>r.as3ObjectCall({run:fn},"run",[7]),{name:"AS3ObjectDispatchUnavailable"});
 assert.equal(as3SourceLambda(fn),fn);assert.equal(isAS3SourceLambda(fn),true);
 assert.equal(r.as3ObjectCall({run:fn},"run",[7]),7);
 assert.equal(r.as3ObjectRead({run:fn},"run"),fn);
 assert.throws(()=>r.as3ObjectCall({run:function(){}},"run",[7]),{name:"AS3ObjectDispatchUnavailable"});
});

test("computed String-key calls snapshot the selected source function before argument effects",()=>{
 const {as3SourceLambda}=require(path.join(out,"hardened-runtime/AS3Function.js"));
 const rows=golden("dynamic-call-arguments").filter(row=>row.id.startsWith("computed-"));
 for(const row of rows) {
  const mode=Number(row.id.slice("computed-".length)),events=[],result=[];
  let target;
  const source=(body)=>as3SourceLambda(function(value){const text=r.as3NativeString(value);return body(text);});
  const object=(value)=>as3ObjectLiteral(value===undefined?[]:[["run",value]]);
  target=object(source(value=>{events.push("body");return value;}));
  if(mode===2)target=null;
  if(mode===3)target=object(7);
  if(mode===4)target=object();
  if(mode===6)target=object(source(()=>{events.push("throw");throw new Error("body");}));
  const receiver=()=>{events.push("receiver");return target;};
  const propertyName=()=>{events.push("name");if(mode===8)throw new Error("name");return mode===7?"missing":"run";};
  const argument=()=>{
   events.push("argument");
   if(mode===1)target.run=source(value=>{events.push("replacement");return value;});
   if(mode===5)throw new Error("argument");
   return as3ObjectLiteral([["toString",as3SourceLambda(function(){events.push("coerce");return "value";})]]);
  };
  try {const invoke=r.as3PrepareObjectCall(receiver(),propertyName(),null);result.push(invoke([argument()]));}
  catch(error){result.push(error.name,error.errorID??0);}
  result.push(events.join("|"));
  assert.deepEqual(result,row.result,row.id);
 }
});

test("computed int/uint-key calls use Object names and snapshot functions before arguments",()=>{
 const {as3SourceLambda}=require(path.join(out,"hardened-runtime/AS3Function.js"));
 const events=[],first=as3SourceLambda(function(value){events.push("first");return value;});
 const replacement=as3SourceLambda(function(value){events.push("replacement");return value;});
 const target=as3ObjectLiteral([[-2147483648,first],[2,first],[4294967295,first]]);
 for(const key of [-2147483648,2,4294967295]) {
  const invoke=r.as3PrepareObjectCall(target,key);
  events.push("selected");
  target[String(key)]=replacement;
  assert.equal(invoke(["value"]),"value");
 }
 assert.deepEqual(events,["selected","first","selected","first","selected","first"]);
 for(const key of [2.5,-2147483649,4294967296,{}])
  assert.throws(()=>r.as3PrepareObjectCall(target,key),{name:"AS3ObjectDispatchUnavailable"});
});

test("Function slots preserve native identity, null normalization and rejected-store behavior",()=>{
 const {as3FunctionSlot}=require(path.join(out,"hardened-runtime/AS3Function.js"));
 const dir=path.join(process.env.HARDENED_FIXTURE_LAYA,"tests/nativeFlashOracle/function-slot");
 const retained=JSON.parse(fs.readFileSync(path.join(dir,"native-air.json")));
 for(const [file,hash] of Object.entries(retained.sourceFiles))
  assert.equal(crypto.createHash("sha256").update(fs.readFileSync(path.join(dir,file))).digest("hex"),hash);
 for(let mode=0;mode<9;mode++) {
  const events=[],result=[];let fn=()=>"retained";const original=fn;
  let value=[undefined,null,0,true,"value",[],{},()=>"callback"][mode];
  if(mode===8)value={valueOf(){events.push("value");return original;},toString(){events.push("text");return "function";}};
  try{fn=as3FunctionSlot(value);result.push(fn===value,fn===null);if(fn!==null)result.push(fn());}
  catch(error){result.push(error.name,error.errorID,fn===original);}
  result.push(events.join("|"));
  assert.deepEqual(result,retained.capture.state.observations.find(row=>row.id==='slot-'+mode).result);
 }
 for(const value of [1n,Symbol('host')])assert.throws(()=>as3FunctionSlot(value),{name:"AS3FunctionOperationUnavailable"});
});


test("associative Array reads preserve own data and reject host accessors and inherited members",()=>{
 const value=[];value.label="named";value["01"]="leading-zero";value.self=value;
 assert.equal(r.as3ObjectRead(value,"label"),"named");
 assert.equal(r.as3ObjectRead(value,"01"),"leading-zero");
 assert.equal(r.as3ObjectRead(value,"self"),value);
 assert.equal(r.as3ObjectRead(value,"absent"),undefined);
 assert.equal(r.as3ObjectRead(value,"length"),0);
 let reads=0;Object.defineProperty(value,"hostGetter",{get(){reads++;return 7;}});
 assert.throws(()=>r.as3ObjectRead(value,"hostGetter"),{name:"AS3ArrayOperationUnavailable"});
 assert.equal(reads,0);
 for(const key of ["push","toString","__proto__"])
  assert.throws(()=>r.as3ObjectRead(value,key),{name:"AS3ArrayOperationUnavailable"});
 class UnprovenArray extends Array {}
 assert.throws(()=>r.as3ObjectRead(new UnprovenArray(),"label"),{name:"AS3ObjectDispatchUnavailable"});
});
