package superprobe {
 public class Leaf extends Middle {
  public function Leaf(){super();}
  override public function selected(flag:Boolean=true):Boolean {Journal.rows.push("WRONG-leaf");return false;}
  public function run():void {
   Journal.rows.push("result:"+super.selected(super.selected(false)));
   Journal.rows.push("omitted:"+super.selected());
   Journal.rows.push("undefined:"+super.selected(undefined));
   Journal.rows.push("inherited:"+super.inherited());
   Journal.rows.push("inherited-undefined:"+super.inherited(undefined));
  }
 }
}
