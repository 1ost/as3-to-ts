package {
 public class ReceiverBucket {
  public var amount:int=7;
  public function read():int {return amount;}
  public function same():ReceiverBucket {return this;}
  public function toArrayCollection():Array {return [2,3,5];}
 }
}