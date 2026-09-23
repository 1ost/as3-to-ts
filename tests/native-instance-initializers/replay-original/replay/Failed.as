package replay {
 public class Failed extends Base {
  public var ready:int=Journal.mark("failed-ready"); public var result:int=Journal.fail(this);
  public function Failed(){super();}
 }
}
