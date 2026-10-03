package {import cases.TimerOwner;import flash.utils.setTimeout;
 public class TimerCallbackProbe {
  private var subject:TimerOwner=new TimerOwner();private var rows:Array=[];private var ready:Boolean=false;
  public function TimerCallbackProbe(){
   record("initial");subject.schedule("cancelled");record("queued");subject.cancel();record("cancelled");
   subject.schedule("replaced");subject.schedule("kept");record("rescheduled");setTimeout(afterFirst,50);
  }
  private function record(id:String):void{rows.push({id:id,value:subject.state()});}
  private function afterFirst():void{record("first-callback");subject.cancel();record("cancel-completed");subject.schedule("second");record("second-queued");setTimeout(afterSecond,50);}
  private function afterSecond():void{record("second-callback");ready=true;}
  public function snapshot():Object{return {ready:ready,failure:"",observations:rows};}
 }
}
