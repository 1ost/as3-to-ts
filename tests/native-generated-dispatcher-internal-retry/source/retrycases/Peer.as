package retrycases {
 public class Peer {
  public function method(value:*):Function {return value.bump;}
  public function read(value:*,type:Class):Array {return [value.count,value.positive,type.LIMIT];}
  public function change(value:*,next:uint):void {value.count=next;value.bump();}
 }
}
