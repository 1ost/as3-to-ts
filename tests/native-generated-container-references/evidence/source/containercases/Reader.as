package containercases {import flash.display.DisplayObjectContainer;
public class Reader {
 public var calls:int=0;
 public var saved:*=null;
 public function Reader(value:* = null) { saved=value as DisplayObjectContainer; }
 private function operand(value:*):* { calls++;return value; }
 public function test(value:*):Boolean { return this.operand(value) is DisplayObjectContainer; }
 public function cast(value:*):DisplayObjectContainer { return this.operand(value) as DisplayObjectContainer; }
 public function explicit(value:*):DisplayObjectContainer { return DisplayObjectContainer(this.operand(value)); }
 public function returned(value:*):DisplayObjectContainer { return this.operand(value); }
 public function coerce(value:*):DisplayObjectContainer { var slot:DisplayObjectContainer=value;return slot; }
}}
