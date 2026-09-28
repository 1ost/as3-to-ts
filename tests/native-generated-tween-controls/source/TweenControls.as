package {import com.greensock.TweenMax;
public class TweenControls {
 private var ratio:Number=0;
 public var calls:int=0;
 public var writes:int=0;
 public function TweenControls() {super();}
 private function target():Object {calls++;return this;}
 public function get currentRatio():Number {return ratio;}
 public function set currentRatio(value:Number):void {writes++;ratio=value;}
 public function start(delay:Number=0):void {TweenMax.to(this,1,{"currentRatio":1,"delay":delay});}
 public function active():Boolean {return TweenMax.isTweening(this.target());}
 public function stop():void {TweenMax.killTweensOf(this.target());}
}}
