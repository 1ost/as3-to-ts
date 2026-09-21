package {import flash.display.Sprite;import flash.external.ExternalInterface;import flash.utils.describeType;import probe.*;
 public class ConstructorOracle extends Sprite {public function ConstructorOracle(){
 var rows:Array=[];
 function rec(id:String,fn:Function):void {Journal.events=[];try{var v:*=fn();rows.push({id:id,value:v,events:Journal.events.concat()});}catch(e:Error){rows.push({id:id,error:{name:e.name,errorID:e.errorID},events:Journal.events.concat()});}}
 function hook(s:String,target:ReturnSubject=null,bad:Boolean=false):Object {return {valueOf:function():*{Journal.add(s+':valueOf');if(target)target.marker='coerced';if(bad)throw new Error('hook',7001);return 3;},toString:function():String{Journal.add(s+':toString');if(target)target.marker='coerced';if(bad)throw new Error('hook',7001);return '4';}};}
 rec('number-plain-hook',function():*{return new ReturnSubject().numberPlain(hook('n'));});
 rec('number-finally-hook',function():*{var x:ReturnSubject=new ReturnSubject();return x.numberFinally(hook('n',x));});
 rec('number-finally-throwing-hook',function():*{var x:ReturnSubject=new ReturnSubject();return x.numberFinally(hook('bad',x,true));});
 rec('number-catch-hook',function():*{return new ReturnSubject().numberCatch(hook('bad',null,true));});
 rec('number-catch-finally-hook',function():*{var x:ReturnSubject=new ReturnSubject();return x.numberCatchFinally(hook('bad',x,true));});
 rec('number-finally-return-overrides',function():*{return new ReturnSubject().numberFinallyReturn(hook('first'),hook('last'));});
 rec('number-finally-return-overrides-throw',function():*{return new ReturnSubject().numberFinallyReturn(hook('bad',null,true),hook('last'));});
 rec('number-finally-throw-overrides',function():*{return new ReturnSubject().numberFinallyThrow(hook('n'));});
 rec('number-finally-throw-overrides-conversion-throw',function():*{return new ReturnSubject().numberFinallyThrow(hook('bad',null,true));});
 rec('string-finally-hook',function():*{var x:ReturnSubject=new ReturnSubject();return x.stringFinally(hook('s',x));});
 rec('string-finally-throwing-hook',function():*{var x:ReturnSubject=new ReturnSubject();return x.stringFinally(hook('bad',x,true));});
 rec('string-catch-finally-hook',function():*{var x:ReturnSubject=new ReturnSubject();return x.stringCatchFinally(hook('bad',x,true));});
 rec('reference-finally-child',function():*{var x:ReturnSubject=new ReturnSubject();var y:ReturnChild=new ReturnChild();return x.referenceFinally(y)===y;});
 rec('reference-finally-undefined',function():*{return new ReturnSubject().referenceFinally(undefined)===null;});
 rec('reference-finally-wrong',function():*{return new ReturnSubject().referenceFinally({});});
 rec('reference-catch-finally-wrong',function():*{return new ReturnSubject().referenceCatchFinally({})===null;});
 rec('getter-finally-hook',function():*{var x:ReturnSubject=new ReturnSubject();x.value=hook('g',x);return x.numeric;});
 rec('getter-finally-throwing-hook',function():*{var x:ReturnSubject=new ReturnSubject();x.value=hook('bad',x,true);return x.numeric;});
 rec('getter-catch-finally-hook',function():*{var x:ReturnSubject=new ReturnSubject();x.value=hook('bad',x,true);return x.caughtNumeric;});
 rec('method-return-reentrant-method',function():*{var x:ReturnSubject=new ReturnSubject();var v:Object={valueOf:function():Number{Journal.add('outer:valueOf');x.marker='outer';var n:Number=x.numberFinally(hook('inner',x));Journal.add('outer:after:'+n);return 7;}};return x.numberFinally(v);});
 rec('getter-return-reentrant-getter',function():*{var x:ReturnSubject=new ReturnSubject();var v:Object={valueOf:function():Number{Journal.add('outer:valueOf');x.value=hook('inner',x);var n:Number=x.numeric;Journal.add('outer:after:'+n);return 7;}};x.value=v;return x.numeric;});
 rec('reentrant-conversion-throw-caught-by-outer',function():*{var x:ReturnSubject=new ReturnSubject();var v:Object={valueOf:function():Number{Journal.add('outer:valueOf');return x.numberFinally(hook('inner',x,true));}};return x.numberCatchFinally(v);});
 var result:Object={rows:rows,reflection:[describeType(ReturnSubject).toXMLString(),describeType(ReturnChild).toXMLString()]};
 ExternalInterface.addCallback('snapshot',function():String{return encodeURIComponent(JSON.stringify(result));});
 }}
}
