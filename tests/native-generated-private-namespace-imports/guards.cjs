const assert=require('assert/strict'),api=require('../../lib'),fs=require('fs'),Module=require('module'),path=require('path');
const {sources,hash}=require('./compile.cjs');const {nativeGeneratedDeclarationInputs}=require('../../lib/emit/native-generated-declarations');
module.exports=config=>{
 const guards=[],input=nativeGeneratedDeclarationInputs(config.plan,config.plan.scope),q='client.Factory';
 const emit=plan=>api.emitNativeSourceClassModule({...config,plan,emitterOptions:{...config.emitterOptions,nativeVectorTypes:{...config.emitterOptions.nativeVectorTypes,plan},nativeReferenceCoercion:{...config.emitterOptions.nativeReferenceCoercion,plan}}});
 const changed=sources[q].source.replace('return this.detail::read();','use namespace detail;return this.detail::read();');assert.notEqual(changed,sources[q].source);assert.throws(()=>emit(api.createNativeGeneratedDeclarationPlan({...input,sources:{...sources,[q]:{source:changed,sourceSha256:hash(changed)}}})),/AS3_.*UNSUPPORTED/);guards.push('function-local namespace still held');
 for(const [moduleName,exportName,before,after,pattern]of [
 ['native-namespaces','NativeNamespaces','while (unit.parent)','while (false && unit.parent)',/namespace inheritance requires a proven same-file ordinary base/],
 ['native-namespaces','NativeNamespaces','scope !== owner.findChild(nodeKind_1.default.CONTENT) && scope.findChildren','scope.findChildren',/function-local open namespaces/],
 ['native-callable-classes','NativeCallableClasses','member.kind === S.SemicolonClassElement','false && member.kind === S.SemicolonClassElement',/computed member identity/]
 ]){const file=require.resolve('../../lib/emit/'+moduleName),source=fs.readFileSync(file,'utf8'),mutated=source.replaceAll(before,after);assert.notEqual(mutated,source);const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(mutated,file);const live=require(file),saved=live[exportName];try{live[exportName]=m.exports[exportName];assert.throws(()=>emit(config.plan),pattern);guards.push('mutation: '+before);}finally{live[exportName]=saved;}}
 return guards;
};
