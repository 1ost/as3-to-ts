const assert=require('node:assert/strict'),hash=s=>require('node:crypto').createHash('sha256').update(s).digest('hex');
const {NativeGeneratedEmission}=require('../../lib/emit/native-generated-emission');
module.exports=(api,input)=>{
 const members=[
  'public static var VALUE:String="literal";',
  'private static var VALUE:String="literal";',
  'protected static var VALUE:int=1;',
  'protected static var VALUE:String=String(7);',
  'private static const VALUE:String=String(7);',
  'protected static const VALUE:String="a"+"b";',
  'protected static const VALUE:int=1;',
  'private static const VALUE:Object=null;',
  'protected static var VALUE:String="a";public static const ALIAS:Array=[VALUE];',
  'private static const VALUE:String="a";public static const ALIAS:Array=[VALUE];',
  'protected static var VALUE:String="a";public static var after:String=VALUE;',
  'protected static var VALUE:String="a"; { trace("effect"); }',
 ];
 for(const member of members){const source='package guards {public class Subject {'+member+'public function Subject(){}}}';
  const plan=api.createNativeGeneratedDeclarationPlan({...input,sources:{'guards.Subject':{source,sourceSha256:hash(source)}}});
  assert.throws(()=>new NativeGeneratedEmission(source,{plan,module:'./domain'},'./registrar',
   {nativeClass:'./nativeClass',callableClass:'./callableClass'},'./lexical','./properties',true),/AS3_[A-Z_]+UNSUPPORTED/,member);
 }
 return members.length;
};
