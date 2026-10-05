const assert=require('assert/strict'),fs=require('fs'),Module=require('module'),path=require('path'),api=require('../../lib');
const {sources,hash}=require('./compile.cjs');const {nativeGeneratedDeclarationInputs}=require('../../lib/emit/native-generated-declarations');
module.exports=config=>{
 const guards=[],input=nativeGeneratedDeclarationInputs(config.plan,config.plan.scope);
 const emit=(plan,options={})=>api.emitNativeSourceClassModule({...config,plan,emitterOptions:{...config.emitterOptions,nativeVectorTypes:{...config.emitterOptions.nativeVectorTypes,plan},nativeReferenceCoercion:{...config.emitterOptions.nativeReferenceCoercion,plan},...options}});
 for(const key of ['nativeDynamicPropertyReadsModule','nativeDynamicPropertyWritesModule'])for(const value of [undefined,'./wrong-provider']){
  assert.throws(()=>emit(config.plan,{[key]:value}),/AS3_.*UNSUPPORTED/);guards.push(key+':'+String(value));
 }
 for(const [owner,before,after]of [
  ['compoundcases.ICounter','function set value(next:int):void;',''],
  ['compoundcases.ICounter','function get value():int;',''],
  ['compoundcases.Owner','value.amount += rhs','value.amount *= rhs'],
  ['compoundcases.Owner','value.amount += rhs','++value.amount'],
 ]){
  const source=sources[owner].source.replace(before,after);assert.notEqual(source,sources[owner].source);
  const plan=api.createNativeGeneratedDeclarationPlan({...input,sources:{...sources,[owner]:{source,sourceSha256:hash(source)}}});
  assert.throws(()=>emit(plan),/AS3_.*UNSUPPORTED/);guards.push('held: '+before);
 }
 assert.throws(()=>emit({...config.plan}),/AS3_.*UNSUPPORTED/);guards.push('copied plan rejected');
 const stringSources={...sources};
 for(const owner of ['compoundcases.IAmount','compoundcases.Counter']){
  const source=sources[owner].source.replace('get amount():int','get amount():String').replace('set amount(value:int)','set amount(value:String)');
  assert.notEqual(source,sources[owner].source);stringSources[owner]={source,sourceSha256:hash(source)};
 }
 assert.throws(()=>emit(api.createNativeGeneratedDeclarationPlan({...input,sources:stringSources})),/interface accessor requires qualified read or assignment/);guards.push('nonnumeric interface compound held');
 const file=require.resolve('../../lib/emit/native-generated-lexical'),source=fs.readFileSync(file,'utf8'),mutant=source.replace('publicNumericUpdate: compound && numeric','publicNumericUpdate: false');assert.notEqual(mutant,source);
 const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(mutant,file);const live=require(file),saved=live.NativeGeneratedLexical;
 try{live.NativeGeneratedLexical=m.exports.NativeGeneratedLexical;assert.throws(()=>emit(config.plan),/interface accessor requires qualified read or assignment/);guards.push('mutation: numeric interface admission removed');}finally{live.NativeGeneratedLexical=saved;}
 const before="r.owner === owner.identity && (r.kind === 'declaration' || r.kind === 'private-declaration' || r.kind === 'interface')";
 const oldGetter=source.replace(before,"r.owner === owner.identity && (r.kind === 'declaration' || r.kind === 'private-declaration')");assert.notEqual(oldGetter,source);
 const second=new Module(file,module);second.filename=file;second.paths=m.paths;second._compile(oldGetter,file);
 try{live.NativeGeneratedLexical=second.exports.NativeGeneratedLexical;assert.throws(()=>emit(config.plan),/lexical receiver requires exact source type/);guards.push('mutation: static getter interface authority removed');}finally{live.NativeGeneratedLexical=saved;}
 return guards;
};
