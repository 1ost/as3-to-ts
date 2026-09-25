const assert=require('node:assert/strict');
module.exports=(api,input,config,hash)=>{
 const cases=[
  ['missing-required','v:int','',/super call source arity/],
  ['too-many','v:int=0','1,2',/super call source arity/],
  ['rest','...values','',/super rest method signature/],
  ['integer-default','v:int=2147483648','',/optional integer default/],
  ['expression-default','v:Object=new Object()','',/optional parameter requires qualified literal/],
  ['required-after-optional','a:int=1,b:int','',/required parameter after optional|super parameter after optional/],
 ];
 for(const [id,parameters,args,error] of cases){
  const raw={'supercheck.Base':'package supercheck {public class Base {public function Base(){super();} public function take('+parameters+'):void {}}}',
   'supercheck.Child':'package supercheck {public class Child extends Base {public function Child(){super();} public function probe():void {super.take('+args+');}}}'};
  const sources=Object.fromEntries(Object.entries(raw).map(([q,source])=>[q,{source,sourceSha256:hash(source)}]));
  assert.throws(()=>{
   const plan=api.createNativeGeneratedDeclarationPlan({...input,sources});
   api.emitNativeSourceClassModule({...config,plan,emitterOptions:{...config.emitterOptions,definitionsByNamespace:{supercheck:['Base','Child']},nativeReferenceCoercion:{...config.emitterOptions.nativeReferenceCoercion,plan}}});
  },error,id);
 }
 return cases.length;
};
