package deep {import staticflags.Child;public class Grand extends Child {
 protected static var grand:Boolean=first&&true;
 public function Grand(){super();}
 public static function deepRead():Array{return [first,second,own,grand];}
 public static function deepWrite(value:Boolean):Array{first=value;own=!value;grand=value;return deepRead();}
 public function instanceRead():Array{return [first,second,own,grand];}
 public function instanceWrite(value:Boolean):Array{first=value;return instanceRead();}
}}
