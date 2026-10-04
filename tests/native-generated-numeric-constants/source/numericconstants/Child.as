package numericconstants {
 public class Child extends Base {
  private static const MASK:uint=24;
  private static const MAX_HEIGHT:Number=123.5;
  public function Child() {super();}
  public function inherited():Array {return [NORMAL,READONLY,INVISIBLE,FULL,MASK,MAX_HEIGHT];}
 }
}
