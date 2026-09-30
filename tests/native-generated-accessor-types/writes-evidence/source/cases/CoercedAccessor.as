package cases {
 import cases.alpha;
 public class CoercedAccessor {
  public var stored:int;
  public var writes:int;
  public function CoercedAccessor(){super();}
  alpha function get numberValue():* { return "number:"+stored; }
  alpha function set numberValue(value:int):void {writes++;stored=value;}
  alpha function set setterFirst(value:*):void {staticStored=value;}
  alpha function get setterFirst():Boolean {return staticStored!==undefined;}
  public static var staticStored:*;
  alpha static function get staticValue():Boolean {return staticStored!==undefined;}
  alpha static function set staticValue(value:*):void {staticStored=value;}
 }
}
