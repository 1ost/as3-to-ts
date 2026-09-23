package entryreview {
 public class FlowProbe {
  public static function transitiveCoerce():* {var a:*=Subject;var b:*=a;var c:*=b;var value:*=new Subject();return c(value);}
  public static function objectAllocate():* {var values:Object={type:Subject};return new (values.type as Class)();}
  public static function arrayAllocate():* {var values:Array=[Subject];return new (values[0] as Class)();}
  public static function callbackAllocate():* {var fn:*=allocate;return fn(Subject);}
  public static function objectCoerce():* {var values:Object={type:Subject};var value:*=new Subject();return values.type(value);}
  public static function arrayCoerce():* {var values:Array=[Subject];var value:*=new Subject();return values[0](value);}
  public static function allocate(type:Class):* {return new type();}
 }
}
