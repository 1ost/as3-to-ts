const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const api=require('../../lib'),{NativeGeneratedClassTraits}=require('../../lib/emit/native-generated-traits');
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2');
const packet=path.join(engine,'tests/nativeFlashOracle/generated-interface-vectors');
const cases=require(path.join(packet,'verify-signatures.cjs'));
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const record=source=>({source,sourceSha256:hash(source)});
const scope='vector-interface-contracts';
const input=sources=>({scope,providerModule:'./AS3GeneratedClass',interfaceProviderModule:'./AS3Type',sources});
function load(directory){
 const sources={};
 function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){
  const file=path.join(dir,item.name);
  if(item.isDirectory())walk(file);
  else if(item.name.endsWith('.as')&&item.name!=='InterfaceVectorsProbe.as')
   sources[path.relative(directory,file).replaceAll('\\','/').slice(0,-3).replaceAll('/','.')]=record(fs.readFileSync(file,'utf8'));
 }}
 walk(directory);assert.equal(Object.keys(sources).length,9);return sources;
}
const results=[];
for(const test of cases){
 const sources=load(path.join(packet,'signature-evidence',test.id,'source'));
 let plan,error;
 try{plan=api.createNativeGeneratedDeclarationPlan(input(sources));}catch(e){error=e;}
 assert.equal(!error,test.expectedStatus===0,test.id);
 if(error)assert.match(error.message,/AS3_GENERATED_INTERFACE_CONTRACT_UNSUPPORTED: incompatible interface signature:/);
 else{
  assert.equal(plan.interfaces.length,5);assert.equal(plan.bindings.length,4);
  const members=plan.interfaceContracts.members;
  const member=(owner,name)=>members.find(m=>m.owner===owner&&m.name===name);
  assert.equal(member('org.emvc.interfaces.IOrderManager','getUnfinishedQueue').returnType,'Vector.<org.emvc.interfaces.IOrder>');
  assert.equal(member('vectorcases.IVectorBoundary','read').returnType,'Vector.<org.emvc.interfaces.IOrder>');
  const exchange=member('vectorcases.IVectorBoundary','exchange');
  assert.equal(exchange.returnType,'Vector.<org.emvc.interfaces.IOrder>');
  assert.deepEqual(exchange.parameters,[{type:'Vector.<org.emvc.interfaces.IOrder>',optional:false,rest:false}]);
  assert.equal(plan.interfaceContracts.implementations.filter(i=>i.owner==='vectorcases.VectorBoundary').length,2);
  assert(Object.isFrozen(exchange)&&Object.isFrozen(exchange.parameters)&&Object.isFrozen(exchange.parameters[0]));
  // Planning a signature does not authorize generated Vector fields or bodies.
  assert.throws(()=>new NativeGeneratedClassTraits(plan,scope,'vectorcases.VectorBoundary',sources['vectorcases.VectorBoundary'].source),
   /AS3_GENERATED_TRAITS_UNSUPPORTED: vector storage requires separate initialization authority/);
 }
 results.push({id:test.id,accepted:!error,sourceHashes:Object.fromEntries(Object.entries(sources).map(([n,r])=>[n,r.sourceSha256])),
  contracts:plan&&plan.interfaceContracts,error:error&&error.message});
}
let guards=0;
function planText(sources){return api.createNativeGeneratedDeclarationPlan(input(Object.fromEntries(Object.entries(sources).map(([n,s])=>[n,record(s)]))));}
function reject(sources,reason){assert.throws(()=>planText(sources),reason);guards++;}
reject({I:'package {public interface I {function f():Vector.<Missing>;}}'},/unresolved interface signature type/);
reject({I:'package {public interface I {function f():Vector.<void>;}}'},/void vector interface element/);
reject({I:'package {public interface I {function f():Vector.<Vector.<int>>;}}',C:'package {public class C implements I {public function f():Vector.<Vector.<uint>> {return null;}}}'},/incompatible interface signature/);
reject({'a.Value':'package a {public class Value {}}','b.Value':'package b {public class Value {}}',
 I:'package {import a.Value;public interface I {function f(v:Vector.<Value>):void;}}',
 C:'package {import b.Value;public class C implements I {public function f(v:Vector.<Value>):void{}}}'},/incompatible interface signature/);
reject({I:'package {public interface I {function f():Vector.<int>;}}',J:'package {public interface J {function f():Vector.<uint>;}}',K:'package {public interface K extends I,J {}}'},/conflicting inherited interface signature/);
const nested=planText({I:'package {public interface I {function f():Vector.<Vector.<int>>;}}'});
assert.equal(nested.interfaceContracts.members[0].returnType,'Vector.<Vector.<int>>');guards++;
const cache=path.resolve('.cache/native-generated-vector-contracts');fs.mkdirSync(cache,{recursive:true});const out=fs.mkdtempSync(path.join(cache,'run-'));
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({results,guards,scope:'AIR compiler signature comparison only; generated Vector storage/callables remain held.'},null,2));
console.log('Vector interface contracts: 4 AIR compiler cases match, '+guards+' structural guards; generated storage remains held. '+out);
