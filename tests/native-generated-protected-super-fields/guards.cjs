const assert=require('node:assert/strict');
module.exports=(api,input,config,hash)=>{
 const cases=[
 ['nested','protected var field:Number;','public function probe():* {var f:Function=function():* {return super.field;};return f();}',/anonymous callable receiver\/member lookup held/],
 ['static caller','protected var field:Number;','public static function probe():* {return super.field;}',/ordinary instance method/],
 ['static field','protected static var field:Number;','public function probe():* {return super.field;}',/AS3_.*UNSUPPORTED/],
 ['private','private var field:Number;','public function probe():* {return super.field;}',/AS3_.*UNSUPPORTED/],
 ['string','protected var field:String;','public function probe():* {return super.field;}',/inherited numeric variable/],
 ['constant','protected const field:int=7;','public function probe():* {return super.field;}',/inherited numeric variable/],
 ['compound','protected var field:Number;','public function probe():void {super.field+=1;}',/lexical addition requires qualified private String/],
 ['delete','protected var field:Number;','public function probe():Boolean {return delete super.field;}',/lexical update\/delete/],
 ];
 for(const [id,parent,child,error] of cases){
  const raw={'supercheck.Base':'package supercheck {public class Base {public function Base(){super();} '+parent+'}}',
   'supercheck.Child':'package supercheck {public class Child extends Base {public function Child(){super();} '+child+'}}'};
  const sources=Object.fromEntries(Object.entries(raw).map(([q,source])=>[q,{source,sourceSha256:hash(source)}]));
  assert.throws(()=>{const plan=api.createNativeGeneratedDeclarationPlan({...input,sources});
   api.emitNativeSourceClassModule({...config,plan,emitterOptions:{...config.emitterOptions,definitionsByNamespace:{supercheck:['Base','Child']},nativeReferenceCoercion:{...config.emitterOptions.nativeReferenceCoercion,plan}}});},error,id);
 }
 return cases.length;
};
