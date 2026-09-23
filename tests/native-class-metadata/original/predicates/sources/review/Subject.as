package review {
 public class Subject {
  public function Subject(){}
  public static function functionCheck():Boolean {var ordinary:Function=function():void {};return ordinary is Class;}
  public static function classCheck():Boolean {return Subject is Class;}
  public static function isSubject(value:*):Boolean {return value is Subject;}
  public static function asSubject(value:*):* {return value as Subject;}
  public static function asClass(value:*):* {return value as Class;}
  public static function isInt(value:*):Boolean {return value is int;}
  public static function isUint(value:*):Boolean {return value is uint;}
 }
}
