const assert=require('assert/strict'),api=require('../../lib');
module.exports=c=>{const guards=[];
 assert.throws(()=>api.emitNativeSourceClassModule({...c.config,plan:{...c.plan}}),/UNSUPPORTED/);guards.push('copied-plan');
 const o=c.config.emitterOptions;
 assert.throws(()=>api.emitNativeSourceClassModule({...c.config,emitterOptions:{...o,nativeGlobalModules:{...o.nativeGlobalModules,XMLList:'./forged'}}}),/exact XML/);guards.push('forged-provider');
 return guards;
};
