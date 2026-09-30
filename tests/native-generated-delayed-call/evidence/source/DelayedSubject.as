package {import com.greensock.TweenMax;
 public class DelayedSubject {
  public var calls:int=0;
  public var evaluations:Array=[];
  private function delay(value:Number):Number {evaluations.push("delay");return value;}
  private function callback():Function {evaluations.push("callback");return this.deliver;}
  private function deliver():void {calls++;}
  public function start(value:Number):Object {return TweenMax.delayedCall(this.delay(value),this.callback());}
  public function cancel():void {TweenMax.killTweensOf(this.deliver);}
 }
}