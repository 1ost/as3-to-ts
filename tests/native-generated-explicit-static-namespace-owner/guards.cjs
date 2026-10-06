const assert=require('assert/strict'),api=require('../../lib');
module.exports=config=>{const guards=[],saved=api.Emitter.emit;
 for(const identity of ['client.Child','client.Child#file:PrivateReader']){
  let reached=false;api.Emitter.emit=function(ast,source,options){if(options.nativeGeneratedDeclarations?.declarationIdentity===identity){reached=true;options={...options,importModules:{...options.importModules,'model.Base':undefined}};}return saved(ast,source,options);};
  try{assert.throws(()=>api.emitNativeSourceClassModule(config),/declaring static owner requires exact generated module: model.Base/);assert(reached);guards.push('missing owner import rejected: '+identity);}finally{api.Emitter.emit=saved;}
 }
 assert.throws(()=>api.emitNativeSourceClassModule({...config,plan:{...config.plan}}),/AS3_.*UNSUPPORTED/);guards.push('copied declaration plan rejected');return guards;
};
