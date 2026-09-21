package probe {
 public class PlainSubject {
  public var journal:*;
  public function PlainSubject(j:*) {journal=j;}
  public function renderTime(time:Number,suppress:Boolean=false,force:Boolean=false):void {journal.push([time,suppress,force]);}
  protected function easeOut(a:Number,b:Number,c:Number,d:Number):Number {return 1-(a=1-a/d)*a;}
  public function setEnabled(value:Boolean,ignore:Boolean=false):Boolean {journal.push(['enabled',ignore]);return value;}
  private function finish(value:*):void {journal.push('finish');if(value)return;journal.push('fallthrough');}
  public function numberReturn(value:*):Number {journal.push('number');return value;}
  public function pick(name:*):* {if(name=='ease')return easeOut;return finish;}
 }
}
