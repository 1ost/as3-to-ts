const assert=require('assert/strict'),fs=require('fs'),Module=require('module'),path=require('path'),api=require('../../lib');
const {sources,hash}=require('./compile.cjs');const {nativeGeneratedDeclarationInputs}=require('../../lib/emit/native-generated-declarations');
module.exports=config=>{
 const guards=[],input=nativeGeneratedDeclarationInputs(config.plan,config.plan.scope);
 const emit=(plan,options={})=>api.emitNativeSourceClassModule({...config,plan,emitterOptions:{...config.emitterOptions,nativeVectorTypes:{...config.emitterOptions.nativeVectorTypes,plan},nativeReferenceCoercion:{...config.emitterOptions.nativeReferenceCoercion,plan},...options}});
 for(const [before,after,pattern]of [
  ['use namespace detail;','',/static lexical namesake requires an opened/],
  ['use namespace detail;','use namespace detail;use namespace other;',/ambiguous open namespace member/],
  ['return Target.act(rhs(value));','var detail:int=1;return Target.act(rhs(value));',/runtime namespace qualifier shadows/],
  ['return Target.act(rhs(value));','Target.act=1;return 0;',/namespace method requires a read or call/],
  ['defaultCall():int{return Target.act();}','defaultCall(Target:Target):int{return Target.act();}',/method matching its receiver/],
 ]){
  const q='staticns.Reader',source=sources[q].source.replace(before,after);assert.notEqual(source,sources[q].source);
  const plan=api.createNativeGeneratedDeclarationPlan({...input,sources:{...sources,[q]:{source,sourceSha256:hash(source)}}});assert.throws(()=>emit(plan),pattern);guards.push(before);
 }
 assert.throws(()=>emit(config.plan,{nativeDynamicPropertyReadsModule:undefined}),/AS3_.*UNSUPPORTED/);guards.push('missing property provider');
 assert.throws(()=>api.emitNativeSourceClassModule({...config,sourceNamespaceProviderModule:undefined}),/AS3_.*UNSUPPORTED/);guards.push('missing namespace provider');
 assert.throws(()=>emit({...config.plan}),/AS3_.*UNSUPPORTED/);guards.push('copied plan');
 const file=require.resolve('../../lib/emit/native-generated-lexical'),source=fs.readFileSync(file,'utf8'),mutant=source.replace('if (!publicIdentity && lexicalName && receiver.kind', 'if (false && !publicIdentity && lexicalName && receiver.kind');assert.notEqual(mutant,source);
 const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(mutant,file);const live=require(file),saved=live.NativeGeneratedLexical;
 try{live.NativeGeneratedLexical=m.exports.NativeGeneratedLexical;assert.throws(()=>emit(config.plan),/lexical receiver requires exact source type/);guards.push('mutation: static source receiver admission removed');}finally{live.NativeGeneratedLexical=saved;}
 return guards;
};
