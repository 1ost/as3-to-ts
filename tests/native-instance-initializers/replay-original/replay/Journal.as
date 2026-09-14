package replay {
 public class Journal {
  public static var rows:Array=[]; public static var leaked:*; public static var failure:Object={};
  public static function mark(value:String):int{rows.push(value);return 7;}
  public static function attempt(label:String,value:*,ctor:*):void {
   try{ctor.call(value);rows.push(label+":unexpected");}catch(error:*){rows.push(label+":"+error.errorID);}
  }
  public static function argument(value:*):int{
   rows.push("argument:start");attempt("argument-base-replay",value,Base);rows.push("argument:end");return 3;
  }
  public static function fail(value:*):int{leaked=value;rows.push("field-throw");throw failure;}
 }
}
