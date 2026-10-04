package cases {
 import flash.display.MovieClip;
 public class Base {
  private var clip:MovieClip;
  private var reads:int=0;
  public function Base(value:MovieClip){clip=value;}
  public function get display():MovieClip {reads++;return clip;}
  public function get readCount():int {return reads;}
  public function replace(value:MovieClip):void {clip=value;}
 }
}
