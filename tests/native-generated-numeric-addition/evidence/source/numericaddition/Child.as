package numericaddition {
 public class Child extends Base {
  public function inherited(delta:*):Array { var result:*=(this.total+=delta);return [result,total]; }
 }
}
