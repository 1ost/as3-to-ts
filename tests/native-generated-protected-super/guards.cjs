const assert=require('node:assert/strict');
module.exports=(api,input,config,hash)=>{
 const cases=[
  ['missing','protected function take(v:int):void {}','public function probe():void {super.take();}',/protected super source arity/],
  ['excess','protected function take(v:int=0):void {}','public function probe():void {super.take(1,2);}',/protected super source arity/],
  ['rest','protected function take(...values):void {}','public function probe():void {super.take();}',/protected super rest signature/],
  ['static-caller','protected function take():void {}','public static function probe():void {super.take();}',/protected super requires ordinary instance method/],
  ['method-value','protected function take():void {}','public function probe():Function {return super.take;}',/AS3_.*UNSUPPORTED/],
  ['private','private function take():void {}','public function probe():void {super.take();}',/super method visibility/],
 ];
 for(const [id,parent,child,error] of cases){
  const raw={'supercheck.Base':'package supercheck {public class Base {public function Base(){super();} '+parent+'}}',
   'supercheck.Child':'package supercheck {public class Child extends Base {public function Child(){super();} '+child+'}}'};
  const sources=Object.fromEntries(Object.entries(raw).map(([q,source])=>[q,{source,sourceSha256:hash(source)}]));
  assert.throws(()=>{
   const plan=api.createNativeGeneratedDeclarationPlan({...input,sources});
   api.emitNativeSourceClassModule({...config,plan,emitterOptions:{...config.emitterOptions,definitionsByNamespace:{supercheck:['Base','Child']},nativeReferenceCoercion:{...config.emitterOptions.nativeReferenceCoercion,plan}}});
  },error,id);
 }
 return cases.length;
};
