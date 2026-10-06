const assert=require('assert/strict'),api=require('../../lib'),crypto=require('crypto');
module.exports=c=>{
 const guards=[];assert.throws(()=>api.emitNativeSourceClassModule({...c.config,plan:{...c.plan}}),/UNSUPPORTED/);guards.push('copied-plan');
 const o=c.config.emitterOptions;
 assert.throws(()=>api.emitNativeSourceClassModule({...c.config,emitterOptions:{...o,nativeDynamicPropertyReadsModule:undefined}}),/interface.*provider/);guards.push('missing-read-provider');
 for(const [label,to]of [['write','p[key]=7'],['compound','p[key]+=7'],['update','++p[key]'],['delete','delete p[key]'],['call','p[key]()']]){
  const original=c.input.sources['iread.Probe'],source=original.source.replace('return ["ok",p[key]]','return ["ok",'+to+']');assert.notEqual(source,original.source);
  const plan=api.createNativeGeneratedDeclarationPlan({...c.input,sources:{...c.input.sources,'iread.Probe':{source,sourceSha256:crypto.createHash('sha256').update(source).digest('hex')}}});
  assert.throws(()=>api.emitNativeSourceClassModule({...c.config,plan,emitterOptions:{...o,nativeVectorTypes:{...o.nativeVectorTypes,plan},nativeReferenceCoercion:{...o.nativeReferenceCoercion,plan}}}),/indexed read cannot substitute/);guards.push(label);
 }
 return guards;
};
