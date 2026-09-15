package {
 import flash.display.Sprite;
 import probe.String;
 import flash.external.ExternalInterface;
 import flash.utils.describeType;
 public class ClassConversionOracle extends Sprite {
  private var rows:Array=[];
  private function row(id:*,f:Function):void {try {rows.push({id:id,value:f()});}catch(e:*){rows.push({id:id,error:e.errorID,name:e.name});}}
  public function ClassConversionOracle() {
   var c:*=probe.String;var value:*=new c();
   row('own-String-null',function():*{return value.next===null;});
   row('own-String-self',function():*{return new c(value).next===value;});
   row('own-String-plain',function():*{return new c({}).next;});
   var data:Object={rows:rows,classXML:describeType(c).toXMLString(),instanceXML:describeType(value).toXMLString()};
   ExternalInterface.addCallback('snapshot',function():*{return encodeURIComponent(JSON.stringify(data));});
  }
 }
}
