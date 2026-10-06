const assert=require('assert/strict'),api=require('../../lib'),crypto=require('crypto');
module.exports=c=>{
 const guards=[];assert.throws(()=>api.emitNativeSourceClassModule({...c.config,plan:{...c.plan}}),/UNSUPPORTED/);guards.push('copied-plan');
 for(const [label,from,to,pattern]of [['compound-index','v[key]=3.75','v[key]+=3.75',/indexed compound/],['unqualified-index-expression','v[key]=3.75','v[Number(key)]=3.75',/indexed expression type/]]){
  const original=c.input.sources['vindex.Probe'],source=original.source.replace(from,to);assert.notEqual(source,original.source);
  const plan=api.createNativeGeneratedDeclarationPlan({...c.input,sources:{'vindex.Probe':{source,sourceSha256:crypto.createHash('sha256').update(source).digest('hex')}}}),o=c.config.emitterOptions;
  assert.throws(()=>api.emitNativeSourceClassModule({...c.config,plan,emitterOptions:{...o,nativeVectorTypes:{...o.nativeVectorTypes,plan},nativeReferenceCoercion:{...o.nativeReferenceCoercion,plan}}}),pattern);guards.push(label);
 }
 return guards;
};
