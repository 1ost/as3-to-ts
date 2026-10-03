package staticflags {public class Flags {
 public static var log:Array=[];
 public static var early:Array=observe();
 protected static var yes:Boolean=true;
 protected static var no:Boolean=false;
 protected static var first:Boolean=count("first")>0;
 protected static var second:Boolean=choose("second",first);
 protected static var third:Boolean=count("third")===2;
 protected static var unused:Boolean;
 public static var after:Array=read();
 public function Flags(){super();}
 private static function observe():Array {var result:Array=read();yes=false;no=true;first=true;return result;}
 private static function count(name:String):int {log.push([name,first,second,third]);return log.length;}
 private static function choose(name:String,value:Boolean):Boolean {log.push([name,value]);return value;}
 public static function read():Array {return [yes,no,first,second,third,unused];}
 public static function change(value:Boolean):Array {first=value;second=!value;return read();}
}}
