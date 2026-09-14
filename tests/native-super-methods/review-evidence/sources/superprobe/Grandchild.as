package superprobe {
 public class Grandchild extends Leaf {
  public function Grandchild(){super();}
  override public function selected(flag:Boolean=true):Boolean {Journal.rows.push("WRONG-grandchild");return false;}
 }
}
