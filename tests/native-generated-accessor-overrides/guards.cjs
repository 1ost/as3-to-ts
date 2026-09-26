const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {NativeGeneratedClassTraits}=require('../../lib/emit/native-generated-traits');
module.exports=(api,input)=>{
 const get='public function get enabled():Boolean {return true;}',set='public function set enabled(value:Boolean):void {}';
 const cases=[
  ['missing override',get,'public function get enabled():Boolean {return false;}'],
  ['missing getter half',set,'override '+get],
  ['missing setter half',get,'override '+set],
  ['final getter','final '+get,'override '+get],
  ['final setter','final '+set,'override '+set],
  ['type mismatch',get,'override public function get enabled():String {return null;}'],
  ['field collision','public var enabled:Boolean;','override '+get],
  ['method collision','public function enabled():Boolean {return true;}','override '+get],
  ['unqualified int','public function get enabled():int {return 1;}','override public function get enabled():int {return 2;}'],
 ];
 for(const [id,parent,child] of cases){
  const sources=Object.fromEntries(Object.entries({'check.Base':'package check {public class Base {'+parent+'}}','check.Child':'package check {public class Child extends Base {'+child+'}}'}).map(([q,source])=>[q,{source,sourceSha256:crypto.createHash('sha256').update(source).digest('hex')}]));
  assert.throws(()=>{const plan=api.createNativeGeneratedDeclarationPlan({...input,sources});new NativeGeneratedClassTraits(plan,input.scope,'check.Child',sources['check.Child'].source);},/AS3_[A-Z_]+UNSUPPORTED/,id);
 }
 return cases.length;
};
