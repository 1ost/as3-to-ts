package entryreview {
 public class Lifecycle {
  public static var captured:*=LifecycleLog.capture(Lifecycle);
  public static var token:int=begin();
  public var n:int=record();
  public function Lifecycle() {LifecycleLog.rows.push("body");}
  public static function begin():int {
   LifecycleLog.rows.push("static");
   if(LifecycleLog.fail) {LifecycleLog.fail=false;throw LifecycleLog.failure;}
   return 7;
  }
  public static function record():int {LifecycleLog.rows.push("field");return 3;}
 }
}
