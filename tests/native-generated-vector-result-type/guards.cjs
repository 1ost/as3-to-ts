const assert=require('assert/strict'),api=require('../../lib'),parse=require('../../lib/parse');
const {sources,hash}=require('./compile.cjs');
const {nativeGeneratedDeclarationInputs}=require('../../lib/emit/native-generated-declarations');
module.exports=config=>{
 assert.throws(()=>api.emitNativeSourceClassModule({...config,plan:{...config.plan}}),/AS3_.*UNSUPPORTED/);
 const q='sample.Reader',source=sources[q].source;
 const options={...config.emitterOptions,nativeGeneratedDeclarations:{plan:config.plan,module:'./__native_declarations',declarationIdentity:q}};
 options.nativeReferenceCoercion={...options.nativeReferenceCoercion,module:'./__native_declarations'};
 assert.throws(()=>api.Emitter.emit(parse(q+'.as',source+' '),source+' ',options),/exact current source bytes/);
 const changed=source.replace('public function exercise():Array {','public function exercise():Array { var Item:Class=Foreign;');assert.notEqual(changed,source);
 const input=nativeGeneratedDeclarationInputs(config.plan,config.plan.scope),plan=api.createNativeGeneratedDeclarationPlan({...input,sources:{...sources,[q]:{source:changed,sourceSha256:hash(changed)}}});
 assert.throws(()=>api.emitNativeSourceClassModule({...config,plan,emitterOptions:{...config.emitterOptions,nativeVectorTypes:{...config.emitterOptions.nativeVectorTypes,plan},nativeReferenceCoercion:{...config.emitterOptions.nativeReferenceCoercion,plan}}}),/shadowed class element construction/);
 return ['copied declaration plan rejected','changed source rejected','shadowed class element rejected'];
};
