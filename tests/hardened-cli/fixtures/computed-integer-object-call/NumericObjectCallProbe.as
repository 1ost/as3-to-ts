package {
 public class NumericObjectCallProbe {
  public static function first(value:String):String {return "first:"+value;}
  public static function second(value:String):String {return "second:"+value;}
  public function snapshot():Object {
   var calls:Object={2:NumericObjectCallProbe.first,4294967295:NumericObjectCallProbe.second};
   var low:int=2,high:uint=4294967295;
   return [calls[low]("A"),calls[high]("B")];
  }
 }
}
