const assert=require('assert/strict'),api=require('../../lib'),crypto=require('crypto');
module.exports=c=>{
 const guards=[];assert.throws(()=>api.emitNativeSourceClassModule({...c.config,plan:{...c.plan}}),/UNSUPPORTED/);guards.push('copied-plan');
 const o=c.config.emitterOptions;
 assert.throws(()=>api.emitNativeSourceClassModule({...c.config,emitterOptions:{...o,nativeDynamicPropertyReadsModule:undefined}}),/interface calls require read provider/);guards.push('missing-read-provider');
 for(const [label,to,pattern]of [['constructor','new p[key](argument())',/not a constructor/],['write','p[key]=argument()',/indexed read cannot substitute/],['compound','p[key]+=argument()',/indexed read cannot substitute/],['delete','delete p[key]',/indexed read cannot substitute/]]){
  const original=c.input.sources['icall.Probe'],source=original.source.replace('p[key](argument())',to);assert.notEqual(source,original.source);
  const plan=api.createNativeGeneratedDeclarationPlan({...c.input,sources:{...c.input.sources,'icall.Probe':{source,sourceSha256:crypto.createHash('sha256').update(source).digest('hex')}}});
  assert.throws(()=>api.emitNativeSourceClassModule({...c.config,plan,emitterOptions:{...o,nativeVectorTypes:{...o.nativeVectorTypes,plan},nativeReferenceCoercion:{...o.nativeReferenceCoercion,plan}}}),pattern);guards.push(label);
 }
 return guards;
};
