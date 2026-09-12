"use strict";
const assert=require("node:assert/strict"),test=require("node:test"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),cp=require("node:child_process"),crypto=require("node:crypto");
const root=path.resolve(__dirname,"../.."),output=fs.mkdtempSync(path.join(os.tmpdir(),"as3-number-"));
fs.writeFileSync(path.join(output,"tsconfig.json"),JSON.stringify({compilerOptions:{target:"ES2022",module:"CommonJS",strict:true,skipLibCheck:true,rootDir:path.join(root,"src"),outDir:output},files:[path.join(root,"src/hardened-runtime/AS3Coerce.ts")]}));
cp.execFileSync(process.execPath,[path.join(root,"node_modules/typescript-4-9/bin/tsc"),"-p",path.join(output,"tsconfig.json")],{stdio:"inherit"});
const {as3Number,as3Int,as3Uint,as3String,as3NumericBinary}=require(path.join(output,"hardened-runtime/AS3Coerce.js"));
const registry=require(path.join(output,"hardened-runtime/internal/AS3TypeRegistry.js"));
const metadata={schema:"as3-runtime-type-authority@1",qnames:[],entries:[]};
registry.installAS3TypeAuthority({schema:metadata.schema,sha256:crypto.createHash("sha256").update(JSON.stringify(metadata)).digest("hex"),qnames:[],entries:[]});
test.after(()=>fs.rmSync(output,{recursive:true,force:true}));
const laya=process.env.HARDENED_FIXTURE_LAYA;
test("Number distinguishes omitted from explicit undefined",()=>{
 assert.equal(as3Number(),0); assert.ok(Number.isNaN(as3Number(undefined)));
 assert.equal(as3Int(undefined),0);assert.equal(as3Uint(undefined),0);
});
test("native numeric values, method order, errors and lexical conversions",{skip:!laya},()=>{
 const dir=path.join(laya,"tests/nativeFlashOracle/dynamic-number"),golden=JSON.parse(fs.readFileSync(path.join(dir,"native-air.json"),"utf8"));
 for(const [name,key] of [["DynamicNumberProbe.as","sourceSha256"],["scenario.json","scenarioSha256"]])
  assert.equal(crypto.createHash("sha256").update(fs.readFileSync(path.join(dir,name))).digest("hex"),golden[key]);
 const scenario=JSON.parse(fs.readFileSync(path.join(dir,"scenario.json"),"utf8"));
 for(const row of golden.capture.state.observations){
  const events=[],actual={result:"",order:"",failure:""};
  const values={undefined:undefined,null:null,true:true,false:false,empty:"",whitespace:" \t\n",hex:"0x10","signed-hex":"-0x10",binary:"0b10",octal:"0o10",decimal:"  -1.25e2  ",infinity:"Infinity",junk:"12px","array-empty":[],"array-single":[7],"array-multi":[7,8],object:{},
   valueOf:{valueOf(){events.push("valueOf");return 9;},toString(){events.push("toString");return "8";}},
   fallback:{valueOf(){events.push("valueOf");return {};},toString(){events.push("toString");return "8";}},
   "null-return":{valueOf(){events.push("valueOf");return null;},toString(){events.push("toString");return "8";}},
   "undefined-return":{valueOf(){events.push("valueOf");return undefined;},toString(){events.push("toString");return "8";}},
   noncallable:{valueOf:3,toString(){events.push("toString");return "8";}},
   failure:{valueOf(){events.push("valueOf");return {};},toString(){events.push("toString");return {};}},
   throw:{valueOf(){events.push("valueOf");throw new Error("conversion failed");}},function:()=>{},class:Function,"negative-zero":"-0",number:12.5};
  function side(name,value){events.push(name+"-eval");return {valueOf(){events.push(name+"-convert");return value;}};}
  try {
   if(row.id==="stage")actual.result=as3String(as3NumericBinary("-",123,17));
   else if(row.id==="pair")actual.result=as3String(as3NumericBinary("-",side("left",12),side("right",5)));
   else if(row.id==="ops")actual.result=["-","*","/","%"].map(op=>as3String(as3NumericBinary(op,"7",2))).join("/");
   else if(row.id==="negative-zero")actual.result=as3String(1/as3Number(values[row.id]));
   else actual.result=as3String(as3Number(values[row.id]));
  }catch(error){actual.failure=error.message;}
  actual.order=as3String(events);
  if(row.id.startsWith("lexical-")){
   const text=scenario.steps.find(step=>step.id===row.id).calls[0].args[0];
   actual.result=as3String(as3Number(text));actual.order=as3String(as3Int(text));actual.failure=as3String(as3Uint(text));
  }
  const {id,...expected}=row;assert.deepEqual(actual,expected,id);
 }
});
test("native numeric conversion rejects unresolved host identities",()=>{
 assert.throws(()=>as3Number(new (class Unknown {})()),{name:"AS3ObjectDispatchUnavailable"});
 assert.throws(()=>as3Number(Object.assign(()=>{},{valueOf:()=>2})),{name:"AS3ObjectDispatchUnavailable"});
 for(const value of [1n,Symbol()])assert.throws(()=>as3Number(value),{name:"AS3ObjectDispatchUnavailable"});
});
