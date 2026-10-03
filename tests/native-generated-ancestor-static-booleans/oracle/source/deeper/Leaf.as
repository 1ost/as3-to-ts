package deeper {import deep.Grand;public class Leaf extends Grand {
 public function Leaf(){super();}
 public static function leafRead():Array{return [first,second,own,grand];}
 public static function leafWrite(value:Boolean):Array{first=value;own=value;grand=!value;return leafRead();}
 public function leafInstanceRead():Array{return [first,second,own,grand];}
 public function leafInstanceWrite(value:Boolean):Array{first=value;return leafInstanceRead();}
}}
