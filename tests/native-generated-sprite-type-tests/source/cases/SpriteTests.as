package cases {import flash.display.Sprite;public class SpriteTests {
 public var calls:int=0;
 public function SpriteTests(){super();}
 public function cast(value:*):Sprite {return value as Sprite;}
 public function test(value:*):Boolean {return value is Sprite;}
 private function read(value:*):* {calls++;return value;}
 public function fromCall(value:*):Sprite {return this.read(value) as Sprite;}
}}
