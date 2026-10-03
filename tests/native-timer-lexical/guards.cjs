const assert=require('node:assert/strict');
module.exports=(api,input,config,hash)=>{
 let count=0; const source=input.sources.TimerSubject.source;
 const check=(changed=source,providers=input.providers,extra={})=>{
  const plan=api.createNativeGeneratedDeclarationPlan({...input,providers,sources:{TimerSubject:{source:changed,sourceSha256:hash(changed)}}});
  assert.throws(()=>api.emitNativeSourceClassModule({...config,plan,emitterOptions:{...config.emitterOptions,nativeReferenceCoercion:{...config.emitterOptions.nativeReferenceCoercion,plan},...extra}}),/AS3_[A-Z_]+UNSUPPORTED/);count++;
 };
 check(source,input.providers,{nativeTimerReferenceModule:undefined});
 check(source,input.providers,{nativeReferenceCoercion:undefined});
 check(source,{...input.providers,'flash.utils.Timer':{...input.providers['flash.utils.Timer'],exportName:'Wrong'}});
 check(source,input.providers,{importModules:{...config.emitterOptions.importModules,'flash.utils.Timer':'./wrong'}});
 for(const replacement of ['timer.start=this.start','delete timer.start','timer.start++','timer.unknown.start()'])check(source.replace('timer.start()',replacement));
 return count;
};
