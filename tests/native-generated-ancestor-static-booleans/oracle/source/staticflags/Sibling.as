package staticflags {public class Sibling extends Flags {
 public function Sibling(){super();}
 public static function siblingRead():Array{return [first,second,third];}
 public static function siblingWrite(value:Boolean):Array{first=value;return siblingRead();}
}}
