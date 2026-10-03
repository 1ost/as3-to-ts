package staticflags {public class Child extends Flags {
 protected static var own:Boolean=first&&second;
 public function Child(){super();}
 public static function inherited():Array{return [first,second,third,own];}
 public static function mutate(value:Boolean):Array{first=value;return inherited();}
}}
