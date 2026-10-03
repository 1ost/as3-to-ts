package cases {
 import flash.utils.setTimeout;
 import flash.utils.clearTimeout;
 public class TimerOwner {
  private var pending:uint;
  private var values:Array=[];
  public function schedule(label:String):void {
   cancel();
   pending=setTimeout(function():void {pending=0;values.push(label);},0);
  }
  public function cancel():void {if(pending)clearTimeout(pending);pending=0;}
  public function state():Array {return [pending!=0,values.concat()];}
 }
}
