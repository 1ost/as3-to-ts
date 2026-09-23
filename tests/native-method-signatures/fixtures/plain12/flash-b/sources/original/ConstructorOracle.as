package {
 import flash.display.Sprite;import flash.external.ExternalInterface;import flash.utils.describeType;import probe.PlainSubject;
 public class ConstructorOracle extends Sprite {
 public function ConstructorOracle(){
 var rows:Array=[],events:Array=[],s:PlainSubject=new PlainSubject(events),render:Function=s.renderTime,ease:Function=s.pick('ease');
 function norm(v:*):* {if(v===undefined)return 'undefined';if(v is Number&&isNaN(v))return 'NaN';if(v is Array){var a:Array=[];for each(var x:* in v)a.push(norm(x));return a;}return v;}
 function rec(id:String,fn:Function):void {events.length=0;try{var v:*=fn();rows.push({id:id,value:norm(v),events:norm(events.concat())});}catch(e:Error){rows.push({id:id,error:{name:e.name,errorID:e.errorID},events:norm(events.concat())});}}
 function hook():Object {return {valueOf:function():*{events.push('valueOf');return 7;}};}
 rec('render-defaults',function():*{return render(3);});
 rec('render-undefined',function():*{return render(undefined,undefined,undefined);});
 rec('render-null',function():*{return render(null,null,null);});
 rec('render-object',function():*{return render(hook(),hook(),hook());});
 rec('render-excess',function():*{return render(hook(),false,false,2);});
 rec('ease-reassigned-number',function():*{return ease(2,0,0,4);});
 rec('enabled-omitted',function():*{return s.setEnabled(true);});
 rec('enabled-object',function():*{return s.setEnabled(hook(),hook());});
 rec('private-void-early',function():*{return s.pick('finish')(true);});
 rec('private-void-fallthrough',function():*{return s.pick('finish')(false);});
 rec('number-return-hook',function():*{return s.numberReturn(hook());});
 rec('number-return-undefined',function():*{return s.numberReturn(undefined);});
 var result:Object={rows:rows,reflection:[describeType(PlainSubject).toXMLString()],instances:[describeType(s).toXMLString()]};ExternalInterface.addCallback('snapshot',function():String{return encodeURIComponent(JSON.stringify(result));});
 }}
}
