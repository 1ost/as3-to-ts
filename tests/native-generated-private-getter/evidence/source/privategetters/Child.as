package privategetters {
 public class Child extends Base {
  private var flag:Boolean=true;
  public var ownCalls:int=0;
  private function get ready():Boolean { ownCalls++; return !flag; }
  public function own(other:Child):Array { return [ready,this.ready,other.ready,ownCalls,other.ownCalls]; }
  public function change():void { flag=false; }
 }
}
