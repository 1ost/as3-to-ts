package cases {
 import cases.alpha;
 public class AccessorWrites {
  public static function publicWrite(target:DistinctAccessor,value:*):* {return target.publicValue=value;}
  public static function namespaceWrite(target:DistinctAccessor,value:*):* {return target.alpha::implied=value;}
  public static function numericWrite(target:CoercedAccessor,value:*):* {return target.alpha::numberValue=value;}
  public static function staticWrite(value:*):* {return CoercedAccessor.alpha::staticValue=value;}
  public static function reversedWrite(target:CoercedAccessor,value:*):* {return target.alpha::setterFirst=value;}
  public static function numericRead(target:CoercedAccessor):String {var result:String=target.alpha::numberValue;return result;}
 }
}
