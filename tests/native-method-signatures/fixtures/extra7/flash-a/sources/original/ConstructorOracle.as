package {
 import flash.display.Sprite;import flash.external.ExternalInterface;import flash.utils.describeType;import probe.PlanSubject;
 public class ConstructorOracle extends Sprite { public function ConstructorOracle(){
 var rows:Array=[],s:PlanSubject=new PlanSubject();
 function norm(v:*):* {if(v===undefined)return 'undefined';if(v is Number&&isNaN(v))return 'NaN';if(v is Array){var a:Array=[];for each(var x:* in v)a.push(norm(x));return a;}return v;}
 function rec(id:String,fn:Function):void {try{rows.push({id:id,value:norm(fn())});}catch(e:*){rows.push({id:id,thrown:norm(e)});}}
 rec('number-throw-primitive',function():*{return s.fail(9);});
 rec('number-throw-identity',function():*{var marker:Object={};try{s.fail(marker);}catch(e:*){return e===marker;}return false;});
 rec('wildcard-defaults',function():*{return s.defaults();});
 rec('wildcard-supplied-undefined',function():*{return s.defaults(undefined,undefined,undefined,undefined,undefined);});
 rec('negative-zero-default',function():*{return s.negative();});
 rec('positive-zero-supplied',function():*{return s.negative(0,true);});
 rec('number-return-comment',function():*{return s.number('7');});
 var result:Object={rows:rows,reflection:[describeType(PlanSubject).toXMLString()],instances:[describeType(s).toXMLString()]};ExternalInterface.addCallback('snapshot',function():String{return encodeURIComponent(JSON.stringify(result));});
} } }
