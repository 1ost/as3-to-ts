package probe {public class Callbacks {
 public static var prefix:String="default:";
 public static var handler:Function=defaultHandler;
 private static var hidden:Function=defaultHandler;
 public static var empty:Function;
 public function Callbacks(){}
 private static function defaultHandler(value:String):String{return prefix+value;}
 private static function alternate(value:String):String{return "other:"+value;}
 public static function invoke(value:String):String{return handler(value);}
 public static function invokeHidden(value:String):String{return hidden(value);}
 public static function replace(value:*):*{return handler=value;}
 public static function replaceHidden(value:*):*{return hidden=value;}
 public static function useAlternate():void{handler=alternate;}
 public static function same():Boolean{return handler===defaultHandler;}
 public static function reset():void{handler=defaultHandler;}
}}
