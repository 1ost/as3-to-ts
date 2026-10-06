const assert=require('assert/strict'),api=require('../../lib'),{sources,hash}=require('./compile.cjs'),{nativeGeneratedDeclarationInputs}=require('../../lib/emit/native-generated-declarations');
module.exports=config=>{const guards=[],input=nativeGeneratedDeclarationInputs(config.plan,config.plan.scope),q='client.Child';
 const source=sources[q].source.replace('use namespace detail;','import scope.other;use namespace detail;use namespace other;');assert.notEqual(source,sources[q].source);
 const plan=api.createNativeGeneratedDeclarationPlan({...input,sources:{...sources,[q]:{source,sourceSha256:hash(source)}}});
 assert.throws(()=>api.emitNativeSourceClassModule({...config,plan,emitterOptions:{...config.emitterOptions,nativeVectorTypes:{...config.emitterOptions.nativeVectorTypes,plan},nativeReferenceCoercion:{...config.emitterOptions.nativeReferenceCoercion,plan}}}),/ambiguous open namespace member: factory/);guards.push('ambiguous opened field rejected');
 assert.throws(()=>api.emitNativeSourceClassModule({...config,plan:{...config.plan}}),/AS3_.*UNSUPPORTED/);guards.push('copied declaration plan rejected');return guards;};
