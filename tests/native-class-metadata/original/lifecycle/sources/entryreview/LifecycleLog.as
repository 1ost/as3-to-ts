package entryreview {
 public class LifecycleLog {
  public static var rows:*=[];
  public static var first:*;
  public static var fail:Boolean=true;
  public static var failure:Object={label:"failure"};
  public static function capture(value:*):* {first=value;rows.push("capture");return value;}
 }
}
