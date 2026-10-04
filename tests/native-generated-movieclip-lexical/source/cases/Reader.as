package cases {
 import flash.display.MovieClip;
 public class Reader extends Base {
  protected var downArrow:Object;
  public function Reader(value:MovieClip){super(value);downArrow={label:"own"};}
  public function read():* {return display.downArrow;}
  public function explicitRead():* {return this.display.downArrow;}
  public function localRead(value:MovieClip):* {return value.downArrow;}
  public function own():Object {return downArrow;}
 }
}
