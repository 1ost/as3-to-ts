package numericconstants {
 public class Base {
  protected static const NORMAL:uint=0;
  protected static const READONLY:uint=64;
  protected static const INVISIBLE:uint=32768;
  protected static const FULL:uint=0xffffffff;
  private static const MASK:uint=7;
  private static const MAX_HEIGHT:Number=900000000;
  private static const FRACTION:Number=-1.25;
  private static const NEGATIVE_ZERO:Number=-0;
  private static const EXPONENT:Number=1.5e3;
  private static const WRAPPED:uint=4294967296;
  private static const NEGATIVE:uint=-1;
  private static const SIGNED:int=2147483648;
  public function Base() {}
  public function values():Array {
   return [NORMAL,READONLY,INVISIBLE,FULL,MASK,MAX_HEIGHT,FRACTION,
     1/NEGATIVE_ZERO,EXPONENT,WRAPPED,NEGATIVE,SIGNED];
  }
 }
}
