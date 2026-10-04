package retrycases {
 import flash.events.EventDispatcher;
 public class Retry extends EventDispatcher {
  public static var initial:Array=begin();
  private static var zero:uint=0;
  private static var one:uint=1;
  private static var high:uint=4294967295;
  private static var hex:uint=0xffffffff;
  private static var negative:uint=-1;
  private static var fraction:uint=1.75;
  private static var wrap:uint=4294967296;
  private static var exponent:uint=1e2;
  private static var minuszero:uint=-0;
  public static var tail:Array=finish();
  public function advance():Array {return [++zero,high--,values()];}
  public static function values():Array {return [zero,one,high,hex,negative,fraction,wrap,exponent,minuszero];}
  protected var _items:Array=[];
  private var _secret:String="fresh";
  protected var _count:uint=4294967295;
  public function Retry() {super();}
  public static function inspect(target:Retry):Array {
   var current:Retry=target;
   var before:Array=[current._items.length,current._secret,current._count];
   current._items.push("item");
   current._secret="changed";
   var overflow:Number=++current._count;
   return [before,current._items.length,current._secret,overflow,current._count,current.hidden()];
  }
  private function hidden():String {return _secret;}
  public static function invalid(target:Retry):uint {return target._count;}
  private static function begin():Array {
   Trace.numbers.push(values());
   Trace.numbers.push([++high,high,high--,high,--zero,zero,zero++,zero]);
   zero++;high++;
   Trace.numbers.push(values());
   var fn:Function=function():Object {return this;};
   Trace.functions.push(fn);
   Trace.globals.push(fn.call(null));
   Trace.classes.push(Retry);
   var result:Array=[];
   Trace.arrays.push(result);
   return result;
  }
  private static function finish():Array {
   Trace.numbers.push(values());
   if(Trace.fail)throw Trace.failure;
   return [];
  }
  public static function read():Array {return [initial,tail];}
 }
}
