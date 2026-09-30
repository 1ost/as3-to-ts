const assert=require('node:assert/strict'),crypto=require('node:crypto'),api=require('../../lib');
module.exports=function(input,config){
 const q='probe.OwnReceiver',original=input.sources[q].source;
 const variants=[
  original.replace('private static var _inst:OwnReceiver','private static var _inst:Object'),
  original.replace('private static var _inst:OwnReceiver','private static var _inst:EventDispatcher'),
  original.replace('private static var _inst:OwnReceiver','public static var _inst:OwnReceiver'),
  original.replace('dispatch(value:Object)','dispatch(value:Object,OwnReceiver:Object)'),
  original.replace('OwnReceiver._inst.parseData(this.argument(value))','(OwnReceiver._inst as Object).parseData(this.argument(value))'),
  original.replace('internal function parseData','private function parseData')
 ];
 for(const source of variants){const plan=api.createNativeGeneratedDeclarationPlan({...input,sources:{[q]:{source,sourceSha256:crypto.createHash('sha256').update(source).digest('hex')}}});
  const emitterOptions={...config.emitterOptions,nativeReferenceCoercion:{...config.emitterOptions.nativeReferenceCoercion,plan},nativeVectorTypes:{...config.emitterOptions.nativeVectorTypes,plan}};
  assert.throws(()=>api.emitNativeSourceClassModule({...config,plan,emitterOptions}),/AS3_GENERATED_LEXICAL_UNSUPPORTED/);
 }
 return variants.length;
};
