package adversary {
 public class Subject {
 public var n:int=7; public function Subject(){} public static function replay(value:*):int { var ctor:*=Subject; ctor.call(value); return value.n; }
 }
}
