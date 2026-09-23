package {
 import flash.display.Sprite;import flash.external.ExternalInterface;import flash.utils.describeType;import probe.ParameterStorage;
 public class ConstructorOracle extends Sprite {
 public function ConstructorOracle(){
 var rows:Array=[],events:Array=[],s:ParameterStorage=new ParameterStorage();
 function rec(id:String,fn:Function):void {events.length=0;try{var v:*=fn();rows.push({id:id,value:v,events:events.concat()});}catch(e:Error){rows.push({id:id,error:{name:e.name,errorID:e.errorID},events:events.concat()});}}
 function hook(bad:Boolean=false):Object {return {valueOf:function():*{events.push('valueOf');if(bad)throw new Error('hook',7301);return 7;},toString:function():String{events.push('toString');return '9';}};}
 rec('number-raw-rhs',function():*{return s.numberWrite(1,hook());});
 rec('boolean-raw-rhs',function():*{return s.booleanWrite(false,hook(true));});
 rec('number-null-rhs',function():*{return s.numberWrite(1,null);});
 rec('boolean-undefined-rhs',function():*{return s.booleanWrite(true,undefined);});
 rec('compound-string',function():*{return s.compound(2,'3');});
 rec('compound-object',function():*{return s.compound(2,hook());});
 rec('number-increments',function():*{return s.increment(5);});
 rec('number-failure-retains',function():*{return s.retain(5,hook(true));});
 var result:Object={rows:rows,reflection:[describeType(ParameterStorage).toXMLString()],instances:[describeType(s).toXMLString()]};ExternalInterface.addCallback('snapshot',function():String{return encodeURIComponent(JSON.stringify(result));});
 }}
}
