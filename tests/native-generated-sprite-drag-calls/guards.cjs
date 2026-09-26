const assert=require('node:assert/strict');
module.exports=(api,input,config,hash)=>{
 const source=input.sources['dragcalls.Owner'].source;let count=0;
 const check=(changed,providers=input.providers,options={})=>{
  const plan=api.createNativeGeneratedDeclarationPlan({...input,providers,sources:{'dragcalls.Owner':{source:changed,sourceSha256:hash(changed)}}});
  assert.throws(()=>api.emitNativeSourceClassModule({...config,plan,emitterOptions:{...config.emitterOptions,nativeReferenceCoercion:{...config.emitterOptions.nativeReferenceCoercion,plan},...options}}),/AS3_[A-Z_]+UNSUPPORTED/);count++;
 };
 check(source,input.providers,{nativeReferenceCoercion:undefined});
 check(source,{...input.providers,'flash.display.Sprite':{...input.providers['flash.display.Sprite'],nativeBase:undefined}});
 for(const replacement of ['this.target.stopDrag=this.startDrag','delete this.target.stopDrag','this.target.stopDrag++','this.target.child.stopDrag()'])check(source.replace('this.target.stopDrag()',replacement));
 return count;
};
