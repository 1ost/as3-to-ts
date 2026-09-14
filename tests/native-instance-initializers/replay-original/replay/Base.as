package replay {
 public class Base {
  public var base:int=Journal.mark("base-field");
  public function Base(value:int=0){Journal.rows.push("base-body:"+value);}
 }
}
