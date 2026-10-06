const assert=require('assert/strict'),api=require('../../lib');
module.exports=config=>{
 const guards=[],emit=()=>api.emitNativeSourceClassModule(config),saved=api.Emitter.emit;
 api.Emitter.emit=function(ast,source,options){if(options.nativeGeneratedDeclarations?.declarationIdentity==='client.Child')options={...options,importModules:{...options.importModules,'model.Base':undefined}};return saved(ast,source,options);};
 try{assert.throws(emit,/declaring static owner requires exact generated module: model.Base/);guards.push('missing declaring owner import rejected');}finally{api.Emitter.emit=saved;}
 assert.throws(()=>api.emitNativeSourceClassModule({...config,plan:{...config.plan}}),/AS3_.*UNSUPPORTED/);guards.push('copied declaration plan rejected');
 return guards;
};
