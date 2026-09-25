package host {
 import flash.display.Sprite;
 public class ParentCallbacks {
  public function make():* { return new Sprite(); }
  public static function makeStatic():* { return new Sprite(); }
  public function callback():Function { return function():* { return new Sprite(); }; }
  public function invoke(fn:Function):* { return fn(); }
  public function captured(type:Class):* { return new type(); }
  public function dynamicConstruct(value:Object):* { return new value(); }
 }
}
