const assert=require('assert/strict'),api=require('../../lib');
module.exports=c=>{
 const guards=[];assert.throws(()=>api.emitNativeSourceClassModule({...c.config,plan:{...c.plan}}),/UNSUPPORTED/);guards.push('copied-plan');
 const crypto=require('crypto');
 for(const replacement of ['OwnClassCastProbe()','OwnClassCastProbe(read(this),read(this))']){
  const original=c.input.sources['cases.OwnClassCastProbe'],source=original.source.replace('OwnClassCastProbe(read(this))',replacement);assert.notEqual(source,original.source);
  const input={...c.input,sources:{...c.input.sources,'cases.OwnClassCastProbe':{source,sourceSha256:crypto.createHash('sha256').update(source).digest('hex')}}};
  const plan=api.createNativeGeneratedDeclarationPlan(input),o=c.config.emitterOptions;
  assert.throws(()=>api.emitNativeSourceClassModule({...c.config,plan,emitterOptions:{...o,nativeVectorTypes:{...o.nativeVectorTypes,plan},nativeReferenceCoercion:{...o.nativeReferenceCoercion,plan}}}),/UNSUPPORTED/);guards.push(replacement);
 }return guards;
};
