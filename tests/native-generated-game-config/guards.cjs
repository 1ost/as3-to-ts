const assert=require('node:assert/strict'),hash=s=>require('node:crypto').createHash('sha256').update(s).digest('hex');
const {NativeGeneratedEmission}=require('../../lib/emit/native-generated-emission');
module.exports=(api,input)=>{
 const members=[
  'public static var VALUE:int=1;',
  'public static const VALUE:Object=null;',
  'public static const VALUE:Array=make();public static function make():Array{return [];}',
  'public static const VALUE:Array=[make()];public static function make():int{return 1;}',
  'public static const VALUE:Array=[read];public static function get read():int{return 1;}',
  'public static var read:int;public static const VALUE:Array=[read];',
  'public static const A:Array=[];public static const VALUE:Array=[A];',
  'public static const VALUE:Array=[[1]];',
  'public static const VALUE:Array=[Subject.N];public static const N:int=1;',
  'public static const VALUE:Array=[missing];',
  'private static const VALUE:Array=[1];',
  'public static const VALUE:int=1; { trace("effect"); }',
  'public static const VALUE:int=1+2;',
  'public static const VALUE:Array=[{value:1}];',
 ];
 for(const member of members){const source='package guards {public class Subject {'+member+'public function Subject(){}}}';
  const plan=api.createNativeGeneratedDeclarationPlan({...input,sources:{'guards.Subject':{source,sourceSha256:hash(source)}}});
  assert.throws(()=>new NativeGeneratedEmission(source,{plan,module:'./domain'},'./registrar',
   {nativeClass:'./nativeClass',callableClass:'./callableClass'},'./lexical','./properties',true),/AS3_[A-Z_]+UNSUPPORTED/,member);
 }
 return members.length;
};
