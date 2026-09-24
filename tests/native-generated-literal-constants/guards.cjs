const assert=require('node:assert/strict'),hash=s=>require('node:crypto').createHash('sha256').update(s).digest('hex');
const {NativeGeneratedEmission}=require('../../lib/emit/native-generated-emission');
module.exports=(api,input)=>{
 const members=[
  'public static var VALUE:String="value";',
  'public static const VALUE:Object=null;',
  'public static const VALUE:String=String(1);',
  'public static const VALUE:String=other();public static function other():String{return "value";}',
  'private static const VALUE:String="value";',
  'public static const VALUE:String="value"; { trace("effect"); }',
 ];
 for(const member of members){const source='package guards {public class Subject {'+member+'public function Subject(){}}}';
  const plan=api.createNativeGeneratedDeclarationPlan({...input,sources:{'guards.Subject':{source,sourceSha256:hash(source)}}});
  assert.throws(()=>new NativeGeneratedEmission(source,{plan,module:'./domain'},'./registrar',
   {nativeClass:'./nativeClass',callableClass:'./callableClass'},'./lexical','./properties',true),/AS3_[A-Z_]+UNSUPPORTED/);
 }
 return members.length;
};
