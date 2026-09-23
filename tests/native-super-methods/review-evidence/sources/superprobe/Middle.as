package superprobe {
 public class Middle extends Base {
  public function Middle(){super();}
  override public function selected(flag:Boolean=true):Boolean {Journal.rows.push("middle:"+identity+":"+flag+":"+arguments.length);return super.selected(flag);}
 }
}
