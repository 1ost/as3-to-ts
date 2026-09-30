package retrycases {
 import flash.events.EventDispatcher;
 public class Retry extends EventDispatcher {
  internal var count:uint=7;
  internal static const LIMIT:uint=19;
  internal function bump():void {count++;}
  internal function get positive():Boolean {return count>0;}
  public static var initial:Array=begin();
  public static var tail:Array=finish();
  public function Retry() {super();}
  private static function begin():Array {
   var fn:Function=function():Object {return this;};
   Trace.functions.push(fn);
   Trace.globals.push(fn.call(null));
   Trace.classes.push(Retry);
   var result:Array=[];
   Trace.arrays.push(result);
   return result;
  }
  private static function finish():Array {
   if(Trace.fail)throw Trace.failure;
   return [];
  }
  public static function read():Array {return [initial,tail];}
 }
}
