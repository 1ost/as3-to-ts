const assert=require('node:assert/strict'),crypto=require('node:crypto');
module.exports=function(api,input,config){
 let checks=0;
 function reject(qname,from,to){
  const previous=input.sources[qname].source;assert.ok(previous.includes(from));
  const source=previous.replace(from,to),sources={...input.sources,[qname]:{source,sourceSha256:crypto.createHash('sha256').update(source).digest('hex')}};
  assert.throws(()=>{
   const plan=api.createNativeGeneratedDeclarationPlan({...input,sources});
   api.emitNativeSourceClassModule({...config,plan,emitterOptions:{...config.emitterOptions,nativeReferenceCoercion:{...config.emitterOptions.nativeReferenceCoercion,plan}}});
  },/AS3_[A-Z_]+_UNSUPPORTED/);checks++;
 }
 reject('receivercases.Caller','invoke():int','invoke(Factory:Object):int');
 reject('receivercases.Caller','Factory.inst.init(argument())',"Factory['inst'].init(argument())");
 reject('receivercases.Caller','Factory.inst.init(argument())','Factory.inst.unknown.init(argument())');
 reject('receivercases.Factory','get inst():Target','get inst():Object');
 reject('receivercases.Factory','get inst():Target','get inst():*');
 reject('receivercases.Factory','public static function get inst','public function get inst');
 reject('receivercases.Factory','public static function get inst','private static function get inst');
 return checks;
};
