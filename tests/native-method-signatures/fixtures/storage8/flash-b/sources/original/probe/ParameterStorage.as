package probe {
 public class ParameterStorage {
  public function numberWrite(a:Number,rhs:*):* {var raw:*=(a=rhs);return [raw===rhs,a];}
  public function booleanWrite(a:Boolean,rhs:*):* {var raw:*=(a=rhs);return [raw===rhs,a];}
  public function compound(a:Number,rhs:*):* {var raw:*=(a+=rhs);return [raw,a];}
  public function increment(a:Number):* {return [a++,a,++a,a];}
  public function retain(a:Number,rhs:*):* {try{a=rhs;}catch(e:*){}return a;}
 }
}
