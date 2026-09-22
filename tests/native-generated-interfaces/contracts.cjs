const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const api=require('../../lib'),engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2');
const packet=path.join(engine,'tests/nativeFlashOracle/interface-contracts'),expected=require(path.join(packet,'verify.cjs'));
const hash=source=>crypto.createHash('sha256').update(source).digest('hex');
const source=text=>({source:text,sourceSha256:hash(text)});
const input=sources=>({scope:'interface-contracts',providerModule:'./AS3GeneratedClass',interfaceProviderModule:'./AS3Type',sources});
const results=[];
for(const row of expected){
 const directory=path.join(packet,'source',row.id),sources={};
 for(const file of fs.readdirSync(directory))sources[file.slice(0,-3)]=source(fs.readFileSync(path.join(directory,file),'utf8'));
 let plan,error;
 try{plan=api.createNativeGeneratedDeclarationPlan(input(sources));}catch(value){error=value;}
 assert.equal(!error,row.accepted,row.id);
 if(error)assert.match(error.message,/AS3_GENERATED_INTERFACE_CONTRACT_UNSUPPORTED/,row.id);
 else {
  assert(plan.interfaceContracts.implementations.length>0,row.id);
  assert(Object.isFrozen(plan.interfaceContracts)&&Object.isFrozen(plan.interfaceContracts.members)&&Object.isFrozen(plan.interfaceContracts.implementations));
  for(const member of plan.interfaceContracts.members)assert(Object.isFrozen(member)&&Object.isFrozen(member.parameters)&&member.parameters.every(Object.isFrozen));
  if(row.id==='inherited-public')assert.equal(plan.interfaceContracts.implementations[0].implementationOwner,'Parent');
 }
 results.push({id:row.id,accepted:!error,sourceHashes:Object.fromEntries(Object.entries(sources).map(([name,record])=>[name,record.sourceSha256])),contracts:plan&&plan.interfaceContracts,error:error&&error.message});
}
let guards=0;
function reject(sources){assert.throws(()=>api.createNativeGeneratedDeclarationPlan(input(Object.fromEntries(Object.entries(sources).map(([name,text])=>[name,source(text)])))),/AS3_GENERATED_INTERFACE_CONTRACT_UNSUPPORTED/);guards++;}
reject({I:'package {public interface I {function f(v:Missing):void;}}'});
reject({I:'package {public interface I {function f(v:Vector.<Missing>):void;}}'});
reject({I:'package {public interface I {function get x():int;function set x(v:String):void;}}'});
reject({I:'package {public interface I {function f():void;function f():void;}}'});
reject({I:'package {public interface I {function f():int;}}',J:'package {public interface J {function f():String;}}',K:'package {public interface K extends I,J {}}'});
reject({I:'package {public interface I {function f():int;}}',J:'package {public interface J {function get f():int;}}',K:'package {public interface K extends I,J {}}'});
reject({I:'package {public interface I {function f():int;}}',Base:'package {public class Base implements I {public function f():int{return 1;}}}',Child:'package {public class Child extends Base {override public function f():String{return "x";}}}'});
reject({I:'package {public interface I {function f(v:a.Value):void;}}','a.Value':'package a {public class Value {}}','b.Value':'package b {public class Value {}}',Subject:'package {public class Subject implements I {public function f(v:b.Value):void{}}}'});
const cache=path.resolve('.cache/native-generated-interface-contracts');fs.mkdirSync(cache,{recursive:true});const out=fs.mkdtempSync(path.join(cache,'run-'));
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({results,guards,scope:'AIR compiler acceptance comparison and source-contract validation; no emitted bodies or ADL runtime claim.'},null,2));
console.log('Interface contracts: 18 AIR compiler cases match (6 accepted, 12 rejected), '+guards+' projection guards. '+out);
