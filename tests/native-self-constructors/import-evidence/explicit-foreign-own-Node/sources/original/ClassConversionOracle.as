package {
 import flash.display.Sprite; import flash.external.ExternalInterface; import flash.utils.describeType; import probe.Node;
 public class ClassConversionOracle extends Sprite {
  private var rows:Array=[];
  private function row(id:String,f:Function):void {try {rows.push({id:id,value:f()});}catch(e:*){rows.push({id:id,error:e.errorID,name:e.name});}}
  public function ClassConversionOracle(){var c:*=probe.Node;

   var v:*=new c();
   row('default-null',function():*{return v.next===null;});
   row('valid-self',function():*{return new c(v).next===v;});
   row('wrong-plain',function():*{return new c({}).next;});

   var data:Object={rows:rows,classXML:describeType(c).toXMLString(),instanceXML:describeType(new c()).toXMLString()};
   ExternalInterface.addCallback('snapshot',function():String{return encodeURIComponent(JSON.stringify(data));});
  }
 }
}
