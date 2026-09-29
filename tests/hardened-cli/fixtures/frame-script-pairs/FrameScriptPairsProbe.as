package {
 import flash.display.MovieClip;
 public class FrameScriptPairsProbe {
  public var result:Array=[];
  public function register(movie:MovieClip):void {
   var calls:Array=result;
   movie.addFrameScript(movie.totalFrames-1,function():void {
    calls.push(["last",movie.currentFrame]);
    movie.stop();
    movie.addFrameScript(movie.totalFrames-1,null);
   });
   movie.addFrameScript(movie.totalFrames-10,function():void {calls.push(["early",movie.currentFrame]);});
   movie.addFrameScript(0,function():void {calls.push(["replaced",movie.currentFrame]);});
   movie.addFrameScript(0,function():void {calls.push(["replacement",movie.currentFrame]);},2,null);
   movie.addFrameScript(-1,function():void {calls.push(["negative",movie.currentFrame]);},movie.totalFrames,function():void {calls.push(["past-end",movie.currentFrame]);});
  }
 }
}
