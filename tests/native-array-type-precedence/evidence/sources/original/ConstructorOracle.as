package {
 import flash.display.Sprite;
 import flash.external.ExternalInterface;
 import flash.utils.describeType;
 import probe.Array;
 import probe.Holder;
 public class ConstructorOracle extends Sprite {
  public function ConstructorOracle() {
   var rows:*=[];
   function rec(id:String,fn:Function):void{try{rows.push({id:id,value:fn()});}catch(e:Error){rows.push({id:id,error:{name:e.name,errorID:e.errorID}});}}
   var a:*=new probe.Array(),b:*=new probe.Array(),h:*=new Holder();
   rec('own-default',function():*{return a.items===null;});
   rec('own-self-identity',function():*{a.items=b;return a.items===b;});
   rec('own-static-identity',function():*{probe.Array.cache=b;return probe.Array.cache===b;});
   rec('own-builtin-array-reject',function():*{a.items=[];return false;});
   rec('imported-default',function():*{return h.items===null;});
   rec('imported-source-array-identity',function():*{h.items=b;return h.items===b;});
   rec('imported-builtin-array-reject',function():*{h.items=[];return false;});
   var result:Object={rows:rows,reflection:[describeType(probe.Array).toXMLString(),describeType(Holder).toXMLString()],instances:[describeType(a).toXMLString(),describeType(h).toXMLString()]}; ExternalInterface.addCallback('snapshot',function():String{return encodeURIComponent(JSON.stringify(result));});
  }
 }
}
