const assert=require('node:assert/strict');
module.exports=(api,input,config,hash)=>{
 let guards=0;
 for(const name of ['nativeXMLModule','nativeGlobalModules','nativeReferenceCoercion']){assert.throws(()=>api.emitNativeSourceClassModule({...config,emitterOptions:{...config.emitterOptions,[name]:undefined}}),/AS3_[A-Z_]+UNSUPPORTED/);guards++;}
 assert.throws(()=>api.emitNativeSourceClassModule({...config,emitterOptions:{...config.emitterOptions,nativeGlobalModules:{...config.emitterOptions.nativeGlobalModules,XML:'./wrong'}}}),/AS3_XML_UNSUPPORTED/);guards++;
 const source=input.sources.XMLSubject.source;
 for(const changed of [source.replace('String(config.state)','String(config.state=42)'),source.replace('String(config.state)','String(delete config.state)'),source.replace('String(config.state)','String(config.state())'),source.replace('config.state) names.push','config.length) names.push')]){
  assert.notEqual(changed,source);const plan=api.createNativeGeneratedDeclarationPlan({...input,sources:{XMLSubject:{source:changed,sourceSha256:hash(changed)}}});
  assert.throws(()=>api.emitNativeSourceClassModule({...config,plan,emitterOptions:{...config.emitterOptions,nativeReferenceCoercion:{...config.emitterOptions.nativeReferenceCoercion,plan}}}),/AS3_[A-Z_]+UNSUPPORTED/);guards++;
 }
 return guards;
};
