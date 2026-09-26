const assert=require('node:assert/strict');
module.exports=(api,config,plans,hash)=>{
 let guards=0;
 const reject=next=>{assert.throws(()=>api.emitNativeSourceClassModule(next),/AS3_(?:TWEEN|SOURCE_CLASS_MODULE)_UNSUPPORTED/);guards++;};
 reject({...config,tweenSourcePlans:undefined});
 reject({...config,tweenSourcePlans:{Missing:plans.BezierMigration}});
 reject({...config,tweenSourcePlans:{BezierMigration:{...plans.BezierMigration,source:plans.BezierMigration.source+' '}}});
 reject({...config,emitterOptions:{...config.emitterOptions,nativeTweenSourcePlans:plans.BezierMigration}});
 const change=calls=>reject({...config,tweenSourcePlans:{BezierMigration:{...plans.BezierMigration,calls}}});
 const calls=plans.BezierMigration.calls;
 change([calls[0],calls[0],calls[1]]);
 for(const delta of [{start:-1},{end:1},{start:calls[0].start+1},{callSha256:'0'.repeat(64)},{initialization:['alpha','scaleX','bezier','scaleY']},{initialization:['scaleX','alpha','bezier','alpha']},{callSha256:undefined}])change([{...calls[0],...delta},calls[1]]);
 reject({...config,emitterOptions:{...config.emitterOptions,nativeTweenModule:undefined}});
 return guards;
};
