const assert=require('node:assert/strict');
module.exports=(api,input,config,hash)=>{
 const source=input.sources['metrics.Reader'].source;let count=0;
 const check=(changed,options={})=>{
  const plan=api.createNativeGeneratedDeclarationPlan({...input,sources:{'metrics.Reader':{source:changed,sourceSha256:hash(changed)}}});
  assert.throws(()=>api.emitNativeSourceClassModule({...config,plan,emitterOptions:{...config.emitterOptions,nativeReferenceCoercion:{...config.emitterOptions.nativeReferenceCoercion,plan},...options}}),/AS3_[A-Z_]+UNSUPPORTED/);count++;
 };
 check(source,{nativeReferenceCoercion:undefined});
 for(const replacement of ['delete first.width','first.width++','first.width+=123','first.width()'])check(source.replace('first.width=123',replacement));
 return count;
};
