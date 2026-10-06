const assert=require('assert/strict'),api=require('../../lib'),crypto=require('crypto');
module.exports=c=>{
 const guards=[];assert.throws(()=>api.emitNativeSourceClassModule({...c.config,plan:{...c.plan}}),/UNSUPPORTED/);guards.push('copied-plan');
 const o=c.config.emitterOptions;
 assert.throws(()=>api.emitNativeSourceClassModule({...c.config,emitterOptions:{...o,nativeGlobalModules:{...o.nativeGlobalModules,XMLList:'./forged'}}}),/exact XML/);guards.push('forged-provider');
 for(const [label,to,pattern]of [
 ['leading-zero','list[01]',/nonnegative integer literal/],['negative','list[-1]',/nonnegative integer literal/],['fraction','list[0.5]',/nonnegative integer literal/],['string','list["0"]',/nonnegative integer literal/],['upper-bound','list[4294967295]',/nonnegative integer literal/],['dynamic','list[Number(0)]',/nonnegative integer literal/],
 ['write','(list[0]=null)',/indexed mutation/],['compound','(list[0]+=1)',/indexed mutation/],['update','list[0]++',/indexed mutation/],['delete','delete list[0]',/indexed mutation/],['call','list[0]()',/indexed mutation/],['construct','new list[0]()',/indexed mutation/]]){
  const original=c.input.sources['xindex.LiteralProbe'],source=original.source.replace('list[0]',to);assert.notEqual(source,original.source);
  const plan=api.createNativeGeneratedDeclarationPlan({...c.input,sources:{'xindex.LiteralProbe':{source,sourceSha256:crypto.createHash('sha256').update(source).digest('hex')}}});
  assert.throws(()=>api.emitNativeSourceClassModule({...c.config,plan,emitterOptions:{...o,nativeVectorTypes:{...o.nativeVectorTypes,plan},nativeReferenceCoercion:{...o.nativeReferenceCoercion,plan}}}),pattern,label);guards.push(label);
 }
 return guards;
};
