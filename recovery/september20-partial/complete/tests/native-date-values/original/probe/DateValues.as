package probe {public class DateValues {
 public static var stored:Date;
 private static var hidden:Date;
 public var value:Date;
 public function DateValues(input:Date=null){value=input;}
 public static function make(value:Number):Date{return new Date(value);}
 public static function entry(value:Date=null):*{return value;}
 public static function result(value:*):Date{return value;}
 public static function local(value:*):*{var date:Date;return date=value;}
 public static function localNull(value:*):Boolean{var date:Date=value;return date===null;}
 public static function parameterWrite(date:Date,value:*):*{return date=value;}
 public static function store(value:*):*{return stored=value;}
 public static function storeHidden(value:*):*{return hidden=value;}
 public static function readHidden():Date{return hidden;}
 public static function time(date:Date):Number{return date.getTime();}
}}
