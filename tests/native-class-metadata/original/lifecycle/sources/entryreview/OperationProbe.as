package entryreview {
 public class OperationProbe {
  public static var log:*=[];
  public static var target:Object;
  public static function key():String {log.push("key");return "x";}
  public static function receiver():Object {log.push("receiver");return target;}
  public static function run():* {
   log=[];target={x:1};
   var before:Boolean=key() in receiver();
   var removed:Boolean=delete receiver()[key()];
   var after:Boolean=key() in receiver();
   return [before,removed,after,target.hasOwnProperty("x"),log];
  }
 }
}
