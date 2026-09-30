package compoundcases {
 public class Counter {
  public static var current:Counter;
  public static var lookups:int;
  public static function get inst():Counter {lookups=lookups+1;return current;}
  public var amount:int;
  public var u:uint;
  public var n:Number;
  public var events:Array=[];
  public var failRead:Boolean;
  public var failWrite:Boolean;
  public function get value():int {events.push("get");if(failRead)throw "read";return amount;}
  public function set value(next:int):void {events.push(["set",next]);if(failWrite)throw "write";amount=next;}
  public function reset(next:int):void {amount=next;events=[];failRead=false;failWrite=false;}
 }
}
