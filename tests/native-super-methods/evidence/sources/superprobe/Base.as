package superprobe {
 public class Base {
  public var identity:String="derived-receiver";
  public function Base() {}
  public function selected(flag:Boolean, optional:Boolean=false):String {Journal.rows.push("base:"+identity+":"+flag+":"+optional+":"+arguments.length); return "base";}
  public function inherited():Object {Journal.rows.push("inherited:"+identity); return this;}
  public function fail():void {Journal.rows.push("throw:"+identity); throw Journal.failure;}
  public function zero():String {return "base-zero";}
  protected function hidden(flag:Boolean=true):Boolean {Journal.rows.push("protected:"+identity+":"+flag);return flag;}
 }
}
