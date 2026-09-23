package superprobe {
 public class Base {
  public var identity:String="fresh";
  public function Base(){}
  public function selected(flag:Boolean=true):Boolean {Journal.rows.push("base:"+identity+":"+flag+":"+arguments.length);return flag;}
  protected function inherited(flag:Boolean=true):Boolean {Journal.rows.push("inherited:"+identity+":"+flag+":"+arguments.length);return flag;}
 }
}
