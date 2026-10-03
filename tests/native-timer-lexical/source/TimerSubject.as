package {
 import flash.utils.Timer;
 public class TimerSubject {
  private var timer:Timer;
  private var calls:int=0;
  public function TimerSubject(value:Timer) {timer=value;}
  private function start():void {calls+=1;}
  private function stop():void {calls+=10;}
  private function reset():void {calls+=100;}
  public function begin():void {timer.start();}
  public function end():void {this.timer.stop();}
  public function clear():void {timer.reset();}
  public function parameter(value:Timer):void {value.start();value.stop();value.reset();}
  public function local():void {var value:Timer=timer;value.start();value.stop();}
  public function intrinsic():void {timer.start.call({});timer.stop.apply({},[]);}
  public function closures():Array {return [timer.start,timer.stop,timer.reset];}
  public function own():int {start();stop();reset();return calls;}
 }
}
