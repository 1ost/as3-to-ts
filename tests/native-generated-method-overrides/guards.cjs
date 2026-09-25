const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {NativeGeneratedClassTraits}=require('../../lib/emit/native-generated-traits');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
module.exports=(api,input)=>{
 let count=0;
 const cases=[
  ['parameter-type','public function parse(v:Object):void {}','override public function parse(v:String):void {}'],
  ['return-type','public function parse(v:Object):Object {return v;}','override public function parse(v:Object):String {return null;}'],
  ['optional','public function parse(v:Object=null):void {}','override public function parse(v:Object=null):void {}'],
  ['rest','public function parse(...values):void {}','override public function parse(...values):void {}'],
  ['reference-mismatch','public function parse(v:Base):void {}','override public function parse(v:Child):void {}'],
  ['accessor','public function get parse():int {return 1;}','override public function get parse():int {return 2;}'],
  ['final','public final function parse(v:Object):void {}','override public function parse(v:Object):void {}'],
  ['missing-modifier','public function parse(v:Object):void {}','public function parse(v:Object):void {}'],
 ];
 for(const [id,parent,child] of cases){
  const sources=Object.fromEntries(Object.entries({'check.Base':'package check {public class Base {'+parent+'}}',
   'check.Child':'package check {public class Child extends Base {'+child+'}}'}).map(([q,source])=>[q,{source,sourceSha256:hash(source)}]));
  assert.throws(()=>{const plan=api.createNativeGeneratedDeclarationPlan({...input,sources});
   new NativeGeneratedClassTraits(plan,input.scope,'check.Child',sources['check.Child'].source);},/AS3_[A-Z_]+UNSUPPORTED/,id);count++;
 }
 return count;
};
