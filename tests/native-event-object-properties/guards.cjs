const assert=require('node:assert/strict');
module.exports=(api,input,config,hash)=>{
 let guards=0;
 for(const [name,qname,property,nativeBase] of [
  ['lookalike','other.Event','target',false],
  ['no-native-base','flash.events.Event','target',false],
  ['string-property','flash.events.Event','type',true],
 ]){
  const source='package check {import '+qname+';public class Reader {public function Reader(){super();} public function read(event:Event):* {return event.'+property+';}}}';
  const binding={...input.providers['flash.events.Event']};if(!nativeBase)delete binding.nativeBase;
  const plan=api.createNativeGeneratedDeclarationPlan({...input,sources:{'check.Reader':{source,sourceSha256:hash(source)}},providers:{[qname]:binding}});
  const generated=api.emitNativeSourceClassModule({...config,plan,emitterOptions:{...config.emitterOptions,
   definitionsByNamespace:{check:['Reader'],[qname.substring(0,qname.lastIndexOf('.'))]:['Event']},
   importModules:{...config.emitterOptions.importModules,[qname]:binding.module},
   nativeReferenceCoercion:{...config.emitterOptions.nativeReferenceCoercion,plan}}});
  assert.doesNotMatch(generated.moduleSource,/as3GetProperty\(event,/,name);guards++;
 }
 return guards;
};
