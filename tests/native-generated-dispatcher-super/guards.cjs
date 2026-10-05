const assert=require('assert/strict'),api=require('../../lib'),fs=require('fs'),Module=require('module');
const {nativeGeneratedDeclarationInputs}=require('../../lib/emit/native-generated-declarations');const {sources,hash}=require('./compile.cjs');
module.exports=config=>{
 const input=nativeGeneratedDeclarationInputs(config.plan,config.plan.scope),guards=[];
 const emit=plan=>api.emitNativeSourceClassModule({...config,plan,emitterOptions:{...config.emitterOptions,nativeReferenceCoercion:{...config.emitterOptions.nativeReferenceCoercion,plan}}});
 const source=sources['cases.NamespaceBase'].source;
 const changed=text=>api.createNativeGeneratedDeclarationPlan({...input,sources:{...sources,'cases.NamespaceBase':{source:text,sourceSha256:hash(text)}}});
 for(const [name,replacement]of [['few arguments','super.addEventListener(type);'],['extra arguments','super.addEventListener(type,listener,capture,priority,weak,0);'],['other native method','super.willTrigger(type);'],['apply','super.addEventListener.apply(this,[]);']]){
  const next=source.replace('super.addEventListener(type,listener,capture,priority,weak);',replacement);assert.notEqual(next,source);assert.throws(()=>emit(changed(next)),/native dispatcher super method or arity requires authority/);guards.push(name);
 }
 for(const change of [{exportName:'Sprite'},{nativeBase:'Sprite'}]){assert.throws(()=>api.createNativeGeneratedDeclarationPlan({...input,providers:{'flash.events.EventDispatcher':{...input.providers['flash.events.EventDispatcher'],...change}}}),/exact supported/);guards.push('wrong native provider');}
 const file=require.resolve('../../lib/emit/native-callable-classes'),original=fs.readFileSync(file,'utf8'),start=original.indexOf("            if (!uri && !method && ancestor === 'flash.events.EventDispatcher'"),end=original.indexOf('            if (!method)',start);assert(start>=0&&end>start);
 const changedModule=new Module(file,module);changedModule.filename=file;changedModule.paths=module.paths;changedModule._compile(original.slice(0,start)+original.slice(end),file);
 const live=require(file),saved=live.NativeCallableClasses;try{live.NativeCallableClasses=changedModule.exports.NativeCallableClasses;assert.throws(()=>emit(config.plan),/super method is absent from complete source ancestry/);guards.push('mutation: native super lowering removed');}finally{live.NativeCallableClasses=saved;}
 return guards;
};
