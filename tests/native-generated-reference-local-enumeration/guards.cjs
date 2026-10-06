const assert=require('assert/strict'),api=require('../../lib'),crypto=require('crypto');
module.exports=c=>{
 const guards=[];assert.throws(()=>api.emitNativeSourceClassModule({...c.config,plan:{...c.plan}}),/UNSUPPORTED/);guards.push('copied-plan');
 assert.throws(()=>api.emitNativeSourceClassModule({...c.config,emitterOptions:{...c.config.emitterOptions,nativeEnumeration:undefined}}),/AS3_ENUMERATION_UNSUPPORTED/);guards.push('missing-enumeration-provider');
 const original=c.input.sources['refenum.Probe'],source=original.source.replace('var current:Item','const current:Item');assert.notEqual(source,original.source);
 const plan=api.createNativeGeneratedDeclarationPlan({...c.input,sources:{...c.input.sources,'refenum.Probe':{source,sourceSha256:crypto.createHash('sha256').update(source).digest('hex')}}}),o=c.config.emitterOptions;
 assert.throws(()=>api.emitNativeSourceClassModule({...c.config,plan,emitterOptions:{...o,nativeVectorTypes:{...o.nativeVectorTypes,plan},nativeReferenceCoercion:{...o.nativeReferenceCoercion,plan}}}),/AS3_TYPED_LOCAL_UNSUPPORTED/);guards.push('const-reference-local');return guards;
};
