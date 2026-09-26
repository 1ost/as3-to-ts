package {
 import com.greensock.TweenMax;
 public class BezierMigration {
  public function start(target:Object, points:Array, calls:Array):* {
   return TweenMax.to(target,.4,{alpha:1,bezier:points,scaleX:1,scaleY:1,overwrite:0,
    onStart:function():void{calls.push("start");},onUpdate:function():void{calls.push("update");},onComplete:function():void{calls.push("complete");}});
  }
  public function ordered(targetFactory:Function,durationFactory:Function,value:Function):* {
   return TweenMax.to(targetFactory(),durationFactory(),{alpha:value("alpha"),bezier:value("bezier"),scaleX:value("scaleX"),scaleY:value("scaleY"),overwrite:0});
  }
 }
}
