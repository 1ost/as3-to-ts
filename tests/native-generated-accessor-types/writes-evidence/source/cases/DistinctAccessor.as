package cases {
 import cases.alpha;
 public class DistinctAccessor {
  public var stored:*;
  public var writes:int;
  public function DistinctAccessor() { super(); }
  alpha function get implied():Boolean { return stored !== undefined; }
  alpha function set implied(value:*):void { writes++; stored=value; }
  public function get publicValue():Boolean { return stored !== undefined; }
  public function set publicValue(value:*):void { writes++; stored=value; }
 }
}
