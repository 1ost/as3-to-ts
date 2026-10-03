const assert=require('node:assert/strict');
module.exports=(api,input,config,hash)=>{
 const typeModule=config.emitterOptions.nativeTextFieldReferenceModule;
 const altered=[
  [{nativeTextFieldReferenceModule:undefined},/reference type operation requires class-evaluation authority/],
  [{nativeReferenceCoercion:undefined},/native Class and reference providers required/],
  [{nativeTextFieldReferenceModule:typeModule+'-wrong'},/AS3_TEXTFIELD_REFERENCE_UNSUPPORTED/],
  [{importModules:{...config.emitterOptions.importModules,'flash.text.TextField':typeModule+'-wrong'}},/AS3_TEXTFIELD_REFERENCE_UNSUPPORTED/]
 ];
 for(const [patch,error] of altered)assert.throws(()=>api.emitNativeSourceClassModule({...config,emitterOptions:{...config.emitterOptions,...patch}}),error);
 for(const operation of ['is','as']){
  const source='package cases {import flash.text.TextField;public class Guard {public function test(value:*,TextField:Class):* {return value '+operation+' TextField;}}}';
  const plan=api.createNativeGeneratedDeclarationPlan({...input,sources:{'cases.Guard':{source,sourceSha256:hash(source)}}});
  assert.throws(()=>api.emitNativeSourceClassModule({...config,plan,emitterOptions:{...config.emitterOptions,definitionsByNamespace:{cases:['Guard']},nativeReferenceCoercion:{...config.emitterOptions.nativeReferenceCoercion,plan}}}),/shadowed target requires separate Class authority/);
 }
 return 6;
};
