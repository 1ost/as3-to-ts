package probe {
 public class SignatureSubject {
  public var label:String;
  public function SignatureSubject(value:String) { label=value; }
  public function pick(name:String):Function {
   if(name=='addTween')return addTween;
   if(name=='setTotalTime')return setTotalTime;
   if(name=='setDirtyCache')return setDirtyCache;
   if(name=='event')return onTweenEvent;
   return empty;
  }
  protected function addTween(target:Object, property:String, start:Number, end:*, name:String=null):void {
   Journal.add('body:addTween:'+label);
   Journal.payload=[typeof target,target===null,target===Journal.object,property,Journal.number(start),typeof end,end===undefined,end===Journal.star,name];
  }
  protected function setTotalTime(time:Number, suppressEvents:Boolean=false):void {
   Journal.add('body:setTotalTime:'+label);
   Journal.payload=[Journal.number(time),suppressEvents];
  }
  protected function setDirtyCache(includeSelf:Boolean=true):void {
   Journal.add('body:setDirtyCache:'+label);Journal.payload=includeSelf;
  }
  private static function onTweenEvent(type:String, tween:Peer):Boolean {
   Journal.add('body:event');Journal.payload=[type,tween===null,tween is PeerChild];return true;
  }
  private function empty():void { Journal.add('body:empty:'+label);Journal.payload='empty'; }
 }
}
