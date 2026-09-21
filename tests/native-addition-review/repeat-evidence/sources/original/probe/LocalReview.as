package probe {
 public class LocalReview {
  public function LocalReview(){super();}
  public function binaryStringLeft(value:*):* {var s:String="x";return s+value;}
  public function binaryObjectLeft(value:*):* {var o:Object=value;return o+2;}
  public function binaryNumberRight(value:*):* {var n:Number=2;return n+value;}
  public function compoundString(value:*):* {var s:String="x";var r:*=s+=value;return [r,s];}
  public function binaryMultiply(value:*):* {var n:Number=2;return n*value;}
  public function compoundMultiply(value:*):* {var n:Number=2;var r:*=n*=value;return [r,n];}
  public function crossInitializer(value:*):* {var i:int=(j=value),j:int;return [i,j];}
  public function catchRead():* {var n:int=7;var inside:*;try{throw "3.9";}catch(n:*){var m:int=n;inside=[m,n];}return [inside,n];}
  public function switchDefault(value:*):* {switch(value){case 1:var n:Number=4;break;case 2:var i:int=3;break;}return [n!==n,i];}
  public static function staticWrite(value:*):* {var n:int=1;var r:*=n=value;return [r,n];}
 }
}
