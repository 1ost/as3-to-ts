package othervalues {
 import valuecases.Holder;
 public class OtherChild extends Holder {
  public var otherCalls:int=0;
  public function OtherChild(){super();}
  internal function take(input:Object):void{otherCalls++;last=input;}
  public function ownOther(input:Object):void{take(input);}
 }
}
