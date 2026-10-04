const assert=require('node:assert/strict');
module.exports=(api,input,config,hash)=>{
 let guards=0;
 const emit=sources=>{const plan=api.createNativeGeneratedDeclarationPlan({...input,sources});return api.emitNativeSourceClassModule({...config,plan,emitterOptions:{...config.emitterOptions,nativeVectorTypes:{...config.emitterOptions.nativeVectorTypes,plan},nativeReferenceCoercion:{...config.emitterOptions.nativeReferenceCoercion,plan}}});};
 for(const [before,after]of [
  ['var rows:Array=[];','var rows:Array=[];var Window:Function=function(v:*):*{return v;};'],
  ['Window(read()).addToStage(next())','Window().addToStage(next())'],
  ['Window(read()).addToStage(next())','Window(read(),read()).addToStage(next())']
 ]){const source=input.sources.CastProbe.source.replace(before,after);assert.notEqual(source,input.sources.CastProbe.source);assert.throws(()=>emit({...input.sources,CastProbe:{source,sourceSha256:hash(source)}}),/UNSUPPORTED/);guards++;}
 assert.throws(()=>api.emitNativeSourceClassModule({...config,plan:{...config.plan}}),/authenticated|identity|plan|registered/i);guards++;
 assert.throws(()=>api.emitNativeSourceClassModule({...config,emitterOptions:{...config.emitterOptions,nativeReferenceCoercion:undefined}}),/UNSUPPORTED/);guards++;
 assert.throws(()=>emit({...input.sources,'cases.Window':{...input.sources['cases.Window'],referenceOnly:true}}),/UNSUPPORTED/);guards++;
 for(const access of ['private','protected']){
  const source=input.sources['cases.Window'].source.replace('public function addToStage',access+' function addToStage');
  assert.notEqual(source,input.sources['cases.Window'].source);
  assert.throws(()=>emit({...input.sources,'cases.Window':{source,sourceSha256:hash(source)}}),/UNSUPPORTED/);guards++;
 }
 return guards;
};
