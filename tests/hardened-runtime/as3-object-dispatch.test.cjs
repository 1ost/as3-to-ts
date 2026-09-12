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
const constructors=[DynamicClassProbe,ExternalDynamicClassProbe,ObjectErrorProbe,NativeBase,LocalChild,UnknownNative];
const predicates=[v=>brands.has(v)&&!(v instanceof ObjectErrorProbe),v=>externalBrands.has(v),v=>v instanceof ObjectErrorProbe,
 v=>nativeBrands.has(v),v=>childBrands.has(v),v=>unknownBrands.has(v)];
const metadata={schema:"as3-runtime-type-authority@1",qnames:rows.map(row=>row.qname),entries:rows};
i.installAS3TypeAuthority({schema:metadata.schema,sha256:crypto.createHash("sha256").update(JSON.stringify(metadata)).digest("hex"),qnames:metadata.qnames,entries:rows.map((row,n)=>({...row,constructor:constructors[n],predicate:predicates[n],constructionTarget:null,constructionProof:null}))});
test.after(()=>fs.rmSync(out,{recursive:true,force:true}));
const string=value=>r.as3ObjectFunctionLabel(value)??String(value);

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
