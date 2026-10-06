const assert=require('assert/strict'),api=require('../../lib'),{sources,hash}=require('./compile.cjs');
const {nativeGeneratedDeclarationInputs}=require('../../lib/emit/native-generated-declarations');
module.exports=config=>{
 assert.throws(()=>api.emitNativeSourceClassModule({...config,plan:{...config.plan}}),/AS3_.*UNSUPPORTED/);
 const input=nativeGeneratedDeclarationInputs(config.plan,config.plan.scope);
 const emit=source=>{
  const plan=api.createNativeGeneratedDeclarationPlan({...input,sources:{...sources,'sample.Reader':{source,sourceSha256:hash(source)}}});
  return api.emitNativeSourceClassModule({...config,plan,emitterOptions:{...config.emitterOptions,nativeVectorTypes:{...config.emitterOptions.nativeVectorTypes,plan},nativeReferenceCoercion:{...config.emitterOptions.nativeReferenceCoercion,plan}}});
 };
 const original=sources['sample.Reader'].source;
 assert.throws(()=>emit(original.replace('use namespace detail;', 'use namespace detail; use namespace other;')),/ambiguous open namespace/);
 assert.throws(()=>emit(original.replace('use namespace detail;', '')),/implicit namespace member requires an explicit selector/);
 return ['copied declaration plan rejected','ambiguous file-local namespaces rejected','package directive does not replace missing file-local directive'];
};
