package updatecases {
 public class Counter {
  public static var current:Counter;
  public static var lookups:int;
  public static function get inst():Counter {lookups=lookups+1;return current;}
  public var events:Array=[];
  public var failRead:Boolean;
  public var failWrite:Boolean;
  public var field:uint;
  private var stored:int;
  private var unsigned:uint;
  private var number:Number;
  public function reset(value:int):void {stored=value;events=[];failRead=false;failWrite=false;}
  public function raw():int {return stored;}
  public function get value():int {events.push("get");if(failRead)throw "read";return stored;}
  public function set value(next:int):void {events.push(["set",next]);if(failWrite)throw "write";stored=next;}
  public function get u():uint {return unsigned;}
  public function set u(next:uint):void {unsigned=next;}
  public function get n():Number {return number;}
  public function set n(next:Number):void {number=next;}
 }
}
