package {
 import flash.display.Sprite; import flash.external.ExternalInterface; import flash.utils.describeType; import probe.Holder;
 public class ClassConversionOracle extends Sprite {
  private var rows:Array=[];
  private function row(id:String,f:Function):void {try {rows.push({id:id,value:f()});}catch(e:*){rows.push({id:id,error:e.errorID,name:e.name});}}
  public function ClassConversionOracle(){var c:*=probe.Holder;

   row('omitted-null',function():*{return new c().next===null;});
   row('null-null',function():*{return new c(null).next===null;});
   row('undefined-null',function():*{return new c(undefined).next===null;});
   row('numeric-string',function():*{return new c(12).next;});
   row('object-string-hook',function():*{var calls:int=0;var input:Object={toString:function():String{calls++;return 'hook-result';}};return [new c(input).next,calls];});

   var data:Object={rows:rows,classXML:describeType(c).toXMLString(),instanceXML:describeType(new c()).toXMLString()};
   ExternalInterface.addCallback('snapshot',function():String{return encodeURIComponent(JSON.stringify(data));});
  }
 }
}
