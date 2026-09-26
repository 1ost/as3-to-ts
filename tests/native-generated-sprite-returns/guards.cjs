const assert=require('node:assert/strict');
module.exports=(api,input,config,hash)=>{
 const cases=[['unqualified','Sprite','return value;',false,/generated native return type requires separate qualification/],
 ['bare','Sprite','return;',true,/generated typed bare return/],
 ['fallthrough','Sprite','if(value)return value;',true,/generated typed fallthrough completion/],
 ['other-native','Point','return value;',true,/generated native return type requires separate qualification/]];
 for(const [id,type,body,qualified,error] of cases){
  const source='package cases {import flash.display.Sprite;import flash.geom.Point;public class Guard {public function Guard(){super();}public function echo(value:*):'+type+' {'+body+'}}}';
  const providers={...input.providers,'flash.geom.Point':{module:input.providers['flash.display.Sprite'].module.replace('display/Sprite','geom/Point'),exportName:'Point'}};
  const plan=api.createNativeGeneratedDeclarationPlan({...input,providers,sources:{'cases.Guard':{source,sourceSha256:hash(source)}}});
  assert.throws(()=>api.emitNativeSourceClassModule({...config,plan,emitterOptions:{...config.emitterOptions,
   definitionsByNamespace:{cases:['Guard']},nativeDisplayObjectReferenceModule:qualified?config.emitterOptions.nativeDisplayObjectReferenceModule:undefined,
   nativeReferenceCoercion:{...config.emitterOptions.nativeReferenceCoercion,plan}}}),error,id);
 }
 return cases.length;
};
