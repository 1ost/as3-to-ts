package {
 import com.greensock.TweenMax;
 public class DelayedParamsSubject {
  public var calls:int = 0;
  public var evaluations:Array = [];
  public var received:Array = [];
  public static var items:Array = [];
  private function delay(value:Number):Number { evaluations.push("delay"); return value; }
  private function callback():Function { evaluations.push("callback"); return this.deliver; }
  private function params(value:Array):Array { evaluations.push("params"); return value; }
  private function deliver(first:* = null, second:* = null):void { calls++; received.push([first,second]); }
  public function start(value:Number, args:Array):Object {
   return TweenMax.delayedCall(this.delay(value),this.callback(),this.params(args));
  }
  public function omitted(value:Number):Object { return TweenMax.delayedCall(value,this.deliver); }
  public function cancel():void { TweenMax.killTweensOf(this.deliver); }
  private static function receiveItem(value:Object):void { items.push(value); }
  public static function startItem(value:Number, source:Array, index:int):Object {
   return TweenMax.delayedCall(value,receiveItem,[source[index]]);
  }
 }
}
