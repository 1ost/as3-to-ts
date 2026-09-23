package {
 import flash.display.Sprite; import flash.external.ExternalInterface; import flash.utils.describeType; import probe.Number; import probe.Boolean;
 public class ClassConversionOracle extends Sprite {
 private var rows:Array=[]; private var reflection:Array=[]; private var instances:Array=[];
 private function row(id:String,f:Function):void {try {rows.push({id:id,value:f()});}catch(e:*){rows.push({id:id,error:e.errorID,name:e.name});}}
 private function inspect(name:String,c:*):void { var v:*=new c();
 row(name+'/static-null',function():* {return c.stored===null;});
 row(name+'/instance-null',function():* {return v.next===null;});
 row(name+'/self',function():* {return new c(v).next===v;});
 row(name+'/wrong',function():* {return new c({}).next;});
 reflection.push(describeType(c).toXMLString());instances.push(describeType(v).toXMLString()); }
 public function ClassConversionOracle(){inspect('Number',probe.Number);inspect('Boolean',probe.Boolean);
 var data:Object={rows:rows,reflection:reflection,instances:instances};
 ExternalInterface.addCallback('snapshot',function():String{return encodeURIComponent(JSON.stringify(data));}); }
 } }
