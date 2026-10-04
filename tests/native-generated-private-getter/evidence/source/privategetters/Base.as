package privategetters {
 public class Base {
  private var raw:Boolean=false;
  public var calls:int=0;
  private function get ready():Boolean { calls++; return raw; }
  public function setValue(value:Boolean):void { raw=value; }
  public function read(other:Base):Array { return [ready,this.ready,other.ready,calls,other.calls]; }
 }
}
