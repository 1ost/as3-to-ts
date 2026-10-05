const assert=require('assert/strict'),api=require('../../lib');
const {nativeGeneratedDeclarationInputs}=require('../../lib/emit/native-generated-declarations');const {sources,hash}=require('./compile.cjs');
module.exports=config=>{
 const input=nativeGeneratedDeclarationInputs(config.plan,config.plan.scope),guards=[];
 const emit=plan=>api.emitNativeSourceClassModule({...config,plan,emitterOptions:{...config.emitterOptions,nativeVectorTypes:{...config.emitterOptions.nativeVectorTypes,plan},nativeReferenceCoercion:{...config.emitterOptions.nativeReferenceCoercion,plan}}});
 const rejects=(name,fn,pattern=/AS3_.*UNSUPPORTED/)=>{assert.throws(fn,pattern);guards.push(name);};
 rejects('copied plan',()=>emit({...config.plan}));
 for(const change of [{classScriptSources:['boolconst.Trace']}])rejects('missing Class script authority',()=>emit(api.createNativeGeneratedDeclarationPlan({...input,...change})));
 for(const [name,after]of [['protected computed constant','protected static const yes:Boolean=Trace.value("yes",1);'],['instance computed constant','private const yes:Boolean=Trace.value("yes",1);'],['unqualified folded expression','private static const yes:Boolean=1<2;'],['unqualified builtin conversion','private static const yes:Boolean=Boolean(1);']]){
  const before='private static const yes:Boolean=Trace.value("yes",1);';assert.ok(sources['boolconst.Holder'].source.includes(before));const source=sources['boolconst.Holder'].source.replace(before,after);
  rejects(name,()=>emit(api.createNativeGeneratedDeclarationPlan({...input,sources:{...sources,'boolconst.Holder':{source,sourceSha256:hash(source)}}})));
 }
 const aliasSource=sources['boolconst.Holder'].source.replace('private static var enabled:Boolean=yes;','private static var enabled:Boolean=Trace.fail;');
 rejects('unqualified variable alias',()=>emit(api.createNativeGeneratedDeclarationPlan({...input,sources:{...sources,'boolconst.Holder':{source:aliasSource,sourceSha256:hash(aliasSource)}}})));
 const lexical=require('../../lib/emit/native-generated-lexical').NativeGeneratedLexical.prototype,original=lexical.deferredBooleanConstant;
 try{lexical.deferredBooleanConstant=()=>false;rejects('mutation: original Boolean constant admission',()=>emit(config.plan),/literal constant required/);}finally{lexical.deferredBooleanConstant=original;}
 return guards;
};
