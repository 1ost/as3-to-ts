const assert=require('assert/strict'),api=require('../../lib'),{sources,hash}=require('./compile.cjs');
const {createNativeSourceAncestryPlan}=require('../../lib/emit/native-source-ancestry');
const {nativeGeneratedDeclarationInputs}=require('../../lib/emit/native-generated-declarations');
module.exports=config=>{
 const members=createNativeSourceAncestryPlan({sources}).classes['model.Base'].members;
 assert.equal(members.find(v=>v.name==='worker'&&v.uri==='urn:op2:receiver-detail').fieldType,'compose.Worker');
 assert.equal(members.find(v=>v.name==='worker'&&v.uri==='urn:op2:receiver-other').fieldType,'int');
 assert.equal(members.find(v=>v.name==='make'&&v.uri==='urn:op2:receiver-detail').returnType,'compose.Worker');
 assert.equal(members.find(v=>v.name==='make'&&v.uri==='urn:op2:receiver-other').returnType,'int');
 assert.throws(()=>api.emitNativeSourceClassModule({...config,plan:{...config.plan}}),/AS3_.*UNSUPPORTED/);
 const source=sources['client.Child'].source.replace('use namespace detail;','use namespace detail;use namespace other;');
 const input=nativeGeneratedDeclarationInputs(config.plan,config.plan.scope);
 const plan=api.createNativeGeneratedDeclarationPlan({...input,sources:{...sources,'client.Child':{source,sourceSha256:hash(source)}}});
 assert.throws(()=>api.emitNativeSourceClassModule({...config,plan,emitterOptions:{...config.emitterOptions,nativeVectorTypes:{...config.emitterOptions.nativeVectorTypes,plan},nativeReferenceCoercion:{...config.emitterOptions.nativeReferenceCoercion,plan}}}),/ambiguous open namespace/);
 return ['field type retains URI and declaring unit','method return retains URI and declaring unit','copied plan rejected','ambiguous open namespaces rejected'];
};
