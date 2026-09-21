package {
 import flash.display.Sprite;
 import flash.external.ExternalInterface;
 import flash.utils.describeType;
 import probe.*;
 public class ConstructorOracle extends Sprite {
  public function ConstructorOracle() {
   var rows:Array=[];var subject:SignatureSubject=new SignatureSubject('original');
   var add:Function=subject.pick('addTween'),total:Function=subject.pick('setTotalTime'),dirty:Function=subject.pick('setDirtyCache'),event:Function=subject.pick('event'),empty:Function=subject.pick('empty');
   function rec(id:String,fn:Function):void {
    Journal.events=[];Journal.payload='no-body';
    try {var result:*=fn();rows.push({id:id,value:result===undefined?'undefined':result,payload:Journal.payload,events:Journal.events.concat()});}
    catch(e:Error){rows.push({id:id,error:{name:e.name,errorID:e.errorID},payload:Journal.payload,events:Journal.events.concat()});}
   }
   function arg(label:String,value:*):* {Journal.add('arg:'+label);return value;}
   function hook(label:String,bad:Boolean=false):Object {
    return {valueOf:function():*{Journal.add(label+':valueOf');if(bad)throw new Error('conversion',7101);return 7;},
     toString:function():String{Journal.add(label+':toString');if(bad)throw new Error('conversion',7102);return 'text';}};
   }
   rec('add-omitted-default',function():*{return add(Journal.object,'x',2,Journal.star);});
   rec('add-explicit-undefined-default',function():*{return add(Journal.object,'x',2,Journal.star,undefined);});
   rec('add-explicit-null-default',function():*{return add(Journal.object,'x',2,Journal.star,null);});
   rec('add-explicit-name',function():*{return add(Journal.object,'x',2,Journal.star,'label');});
   rec('add-null-object-and-string',function():*{return add(null,null,3,undefined);});
   rec('add-undefined-object-string-number',function():*{return add(undefined,undefined,undefined,Journal.star);});
   rec('add-scalar-object',function():*{return add(5,'x',null,false);});
   rec('add-too-few',function():*{return add(Journal.object,'x',2);});
   rec('add-too-many',function():*{return add(Journal.object,'x',2,Journal.star,null,9);});
   rec('add-ordered-hooks',function():*{return add(Journal.object,hook('property'),hook('start'),hook('star'),hook('name'));});
   rec('add-string-throw-stops-later-coercion',function():*{return add(Journal.object,hook('property',true),hook('start'),Journal.star,hook('name'));});
   rec('add-number-throw-stops-later-coercion',function():*{return add(Journal.object,hook('property'),hook('start',true),Journal.star,hook('name'));});
   rec('add-last-string-throw',function():*{return add(Journal.object,hook('property'),hook('start'),Journal.star,hook('name',true));});
   rec('add-arguments-before-coercion',function():*{return add(arg('target',Journal.object),arg('property',hook('property')),arg('start',hook('start')),arg('star',Journal.star),arg('name',hook('name')));});
   rec('add-arguments-before-short-arity',function():*{return add(arg('target',Journal.object),arg('property',hook('property')),arg('start',hook('start')));});
   rec('add-arguments-before-long-arity',function():*{return add(arg('target',Journal.object),arg('property',hook('property')),arg('start',hook('start')),arg('star',Journal.star),arg('name',hook('name')),arg('extra',hook('extra')));});
   rec('total-omitted-default',function():*{return total(3);});
   rec('total-explicit-undefined-default',function():*{return total(3,undefined);});
   rec('total-explicit-null-default',function():*{return total(3,null);});
   rec('total-boolean-object-no-hooks',function():*{return total(3,hook('boolean'));});
   rec('total-number-hook-before-body',function():*{return total(hook('time'),true);});
   rec('total-too-few',function():*{return total();});
   rec('total-too-many',function():*{return total(hook('time'),false,hook('extra'));});
   rec('dirty-omitted-default',function():*{return dirty();});
   rec('dirty-explicit-undefined',function():*{return dirty(undefined);});
   rec('dirty-explicit-null',function():*{return dirty(null);});
   rec('dirty-explicit-zero',function():*{return dirty(0);});
   rec('dirty-explicit-object',function():*{return dirty(hook('boolean'));});
   rec('dirty-too-many',function():*{return dirty(true,hook('extra'));});
   rec('event-genuine-reference',function():*{return event('start',new Peer());});
   rec('event-derived-reference',function():*{return event('start',new PeerChild());});
   rec('event-null-reference',function():*{return event('start',null);});
   rec('event-undefined-reference',function():*{return event('start',undefined);});
   rec('event-wrong-reference-after-string-hook',function():*{return event(hook('type'),{});});
   rec('event-string-failure-before-reference-check',function():*{return event(hook('type',true),{});});
   rec('event-too-few',function():*{return event(hook('type'));});
   rec('event-too-many',function():*{return event(hook('type'),new Peer(),9);});
   rec('empty-zero-args',function():*{return empty();});
   rec('empty-extra-arg',function():*{return empty(hook('extra'));});
   rec('closure-call-keeps-original-receiver',function():*{return total.call(new SignatureSubject('foreign'),8,true);});
   rec('closure-apply-defaults',function():*{return dirty.apply(new SignatureSubject('foreign'),[]);});
   rec('closure-formal-counts-and-identity',function():*{return [add.length,total.length,dirty.length,event.length,empty.length,add===subject.pick('addTween'),add===new SignatureSubject('other').pick('addTween')];});
   rec('number-coercion-reentrant-call',function():*{var value:Object={valueOf:function():Number{Journal.add('outer:valueOf');dirty(false);Journal.add('outer:after-inner');return 11;}};return total(value,true);});
   var result:Object={rows:rows,reflection:[describeType(SignatureSubject).toXMLString(),describeType(Peer).toXMLString(),describeType(PeerChild).toXMLString()]};
   ExternalInterface.addCallback('snapshot',function():String{return encodeURIComponent(JSON.stringify(result));});
  }
 }
}
