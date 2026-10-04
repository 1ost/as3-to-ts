const assert=require('node:assert/strict');
module.exports=(api,input,config,hash)=>{
 let guards=0;
 for(const name of ['nativeXMLModule','nativeGlobalModules','nativeReferenceCoercion']){assert.throws(()=>api.emitNativeSourceClassModule({...config,emitterOptions:{...config.emitterOptions,[name]:undefined}}),/AS3_[A-Z_]+UNSUPPORTED/);guards++;}
 for(const name of ['XML','XMLList']){assert.throws(()=>api.emitNativeSourceClassModule({...config,emitterOptions:{...config.emitterOptions,nativeGlobalModules:{...config.emitterOptions.nativeGlobalModules,[name]:'./wrong'}}}),/AS3_XML_UNSUPPORTED/);guards++;}
 const source=input.sources.TraversalSubject.source;
 for(const changed of [source.replace('config.descendants()','config.descendants("x")'),source.replace('node.attributes()','node.attributes("x")'),source.replace('node.@[name.substr(0,name.length-3)]=','node.@[name.substr(0,name.length-3)]+='),source.replace('config.menuButton.label.@url=""','delete config.menuButton.label.@url'),source.replace('name(node:XML)','name(node:XML,String:Function)')]){
  assert.notEqual(changed,source);const plan=api.createNativeGeneratedDeclarationPlan({...input,sources:{TraversalSubject:{source:changed,sourceSha256:hash(changed)}}});
  assert.throws(()=>api.emitNativeSourceClassModule({...config,plan,emitterOptions:{...config.emitterOptions,nativeReferenceCoercion:{...config.emitterOptions.nativeReferenceCoercion,plan},nativeVectorTypes:{...config.emitterOptions.nativeVectorTypes,plan}}}),/AS3_[A-Z_]+UNSUPPORTED/);guards++;
 }
 return guards;
};
