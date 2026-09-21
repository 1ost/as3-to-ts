package probe {
 public class Journal {
  public static var events:Array=[];
  public static var payload:*;
  public static var object:Object={};
  public static var star:Object={};
  public static function add(value:String):void { events.push(value); }
  public static function number(value:Number):String { return isNaN(value)?'NaN':String(value); }
 }
}
