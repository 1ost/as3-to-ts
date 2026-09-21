package {
 import flash.display.Sprite;import flash.external.ExternalInterface;import flash.utils.describeType;import probe.*;
 public class ConstructorOracle extends Sprite {
 public function ConstructorOracle() {
 var rows:Array=[],events:Array=[];var entry:EntrySubject=new EntrySubject(events,'owner');var ret:ReturnSubject=new ReturnSubject(events);var child:OverrideChild=new OverrideChild(events);
 var pub:Function=entry.pick('public'),pro:Function=entry.pick('protected'),priv:Function=entry.pick('private'),boo:Function=ret.pick('boolean'),finish:Function=ret.pick('void');
 function norm(v:*):* {if(v===undefined)return 'undefined';if(v is Number && isNaN(v))return 'NaN';if(v is Array){var a:Array=[];for each(var x:* in v)a.push(norm(x));return a;}return v;}
 function rec(id:String,fn:Function):void {events.length=0;try{rows.push({id:id,value:norm(fn()),events:events.concat()});}catch(e:Error){rows.push({id:id,error:{name:e.name,errorID:e.errorID},events:events.concat()});}}
 function hook(label:String,bad:Boolean=false):Object {return {valueOf:function():*{events.push(label+':valueOf');if(bad)throw new Error('hook',7201);return 7;},toString:function():String{events.push(label+':toString');return '8';}};}
 function arg(label:String,v:*):* {events.push('arg:'+label);return v;}
rec('public-omitted',function():* {return pub(2);});
rec('public-undefined',function():* {return pub(undefined,undefined,undefined);});
rec('public-null',function():* {return pub(null,null,null);});
rec('public-hook-order',function():* {return pub(arg('a',hook('a')),arg('b',hook('b')),arg('c',hook('c')));});
rec('public-too-few',function():* {return pub();});
rec('public-excess',function():* {return pub(arg('a',hook('a')),arg('b',true),arg('c',hook('c')),arg('extra',9));});
rec('public-throw',function():* {return pub(hook('a',true),hook('b'),hook('c'));});
rec('protected-default',function():* {return pro(3);});
rec('protected-undefined',function():* {return pro(undefined,undefined);});
rec('private-default',function():* {return priv(4);});
rec('private-null',function():* {return priv(null,null);});
rec('private-call-receiver',function():* {return priv.call(new EntrySubject(events,'foreign'),5,false);});
rec('formal-lengths',function():* {return [pub.length,pro.length,priv.length,boo.length,finish.length];});
rec('number-undefined',function():* {return ret.number(undefined);});
rec('number-null',function():* {return ret.number(null);});
rec('number-hook',function():* {return ret.number(hook('return'));});
rec('number-hook-finally',function():* {return ret.numberFinally(hook('return'));});
rec('number-hook-catch',function():* {return ret.numberCatch(hook('return',true));});
rec('number-throw-finally',function():* {return ret.numberFinally(hook('return',true));});
rec('finally-replacement',function():* {return ret.finalReplacement(hook('first'),hook('second'));});
rec('boolean-undefined',function():* {return boo(undefined);});
rec('boolean-null',function():* {return boo(null);});
rec('boolean-object-no-hooks',function():* {return boo(hook('bool',true));});
rec('boolean-finally-no-hooks',function():* {return ret.booleanFinally(hook('bool',true));});
rec('void-early',function():* {return finish(true);});
rec('void-fallthrough',function():* {return finish(false);});
rec('void-excess',function():* {return finish(true,2);});
rec('override-omitted',function():* {return child.renderTime(3);});
rec('override-undefined',function():* {return child.renderTime(undefined,undefined);});
rec('override-protected-default',function():* {return child.pick()();});
rec('override-protected-null',function():* {return child.pick()(null);});
rec('number-return-reentry',function():* {return ret.numberFinally({valueOf:function():*{events.push('return:enter');priv(9);events.push('return:leave');return 11;}});});
rec('number-entry-reentry',function():* {return pub({valueOf:function():*{events.push('entry:enter');priv(9);events.push('entry:leave');return 11;}});});
var result:Object={rows:rows,reflection:[describeType(EntrySubject).toXMLString(),describeType(ReturnSubject).toXMLString(),describeType(OverrideBase).toXMLString(),describeType(OverrideChild).toXMLString()],instances:[describeType(entry).toXMLString(),describeType(ret).toXMLString(),describeType(new OverrideBase(events)).toXMLString(),describeType(child).toXMLString()]};ExternalInterface.addCallback('snapshot',function():String{return encodeURIComponent(JSON.stringify(result));});
}}}
