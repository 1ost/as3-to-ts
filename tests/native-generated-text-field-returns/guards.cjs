const assert=require('node:assert/strict');
module.exports=(api,input,config,hash)=>{
 const cases=[['unqualified','TextField','return value;',false,/generated native return type requires separate qualification/],
 ['bare','TextField','return;',true,/generated typed bare return/],
 ['fallthrough','TextField','if(value)return value;',true,/generated typed fallthrough completion/],
 ['other-native','Rectangle','return value;',true,/generated native return type requires separate qualification/]];
 for(const [id,type,body,qualified,error] of cases){
  const source='package cases {import flash.text.TextField;import flash.geom.Rectangle;public class Guard {public function Guard(){super();}public function echo(value:*):'+type+' {'+body+'}}}';
  const providers={...input.providers,'flash.geom.Rectangle':{module:input.providers['flash.text.TextField'].module.replace('utils/AS3CanonicalTextFieldReference','geom/Rectangle'),exportName:'Rectangle'}};
  const plan=api.createNativeGeneratedDeclarationPlan({...input,providers,sources:{'cases.Guard':{source,sourceSha256:hash(source)}}});
  assert.throws(()=>api.emitNativeSourceClassModule({...config,plan,emitterOptions:{...config.emitterOptions,
   definitionsByNamespace:{cases:['Guard']},nativeTextFieldReferenceModule:qualified?config.emitterOptions.nativeTextFieldReferenceModule:undefined,
   nativeReferenceCoercion:{...config.emitterOptions.nativeReferenceCoercion,plan}}}),error,id);
 }
 const module=config.emitterOptions.nativeTextFieldReferenceModule;
 for(const patch of [
  {nativeReferenceCoercion:undefined},
  {nativeTextFieldReferenceModule:module+'-wrong'},
  {importModules:{...config.emitterOptions.importModules,'flash.text.TextField':module+'-wrong'}}
 ])assert.throws(()=>api.emitNativeSourceClassModule({...config,emitterOptions:{...config.emitterOptions,...patch}}),patch.nativeReferenceCoercion===undefined&&Object.hasOwn(patch,'nativeReferenceCoercion')?/AS3_SOURCE_CLASS_MODULE_UNSUPPORTED: native Class and reference providers required/:/AS3_TEXTFIELD_REFERENCE_UNSUPPORTED/);
 return cases.length+3;
};
