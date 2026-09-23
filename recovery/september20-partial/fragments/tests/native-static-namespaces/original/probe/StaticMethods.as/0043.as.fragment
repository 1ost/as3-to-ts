package probe {
 import probe.inside; import probe.alias;
 public class StaticMethods {
  public static var count:int=0;
  inside static function clear():void { count=0; }
  inside static function sum(a:Number,b:int=2):Number { count++; return a+b; }
  inside static function items(a:*,...rest):Array { count++;return [a,rest.length,rest]; }
  inside static function stringify(a:String,b:Array=null):Array { return [a,b]; }
  public static function take():Function { return StaticMethods.inside::sum; }
  public static function aliasTake():Function { return StaticMethods.alias::sum; }
 }
}
