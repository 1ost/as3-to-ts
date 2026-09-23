package probe {
 public class LexicalOrder {
  private var count:int=0;
  private var value:Number=0;
  private static var first:Number=3;
  private static var second:Number=LexicalOrder.initial();
  public function LexicalOrder(){super();}
  private static function initial():* {return first;}
  private function receiver():* {this.count=this.count+1;return this;}
  private function key():* {this.count=this.count+10;return "accept";}
  private function argument():* {this.count=this.count+100;return 8;}
  private function accept(value:*):* {this.value=value;return this.count;}
  public function once():* {this.count=0;return this.receiver()[this.key()](this.argument());}
  public function arity():* {this.count=0;return this.receiver()[this.key()](this.argument(),this.argument());}
  public function state():* {return [this.count,this.value];}
  public static function initialized():* {return [first,second];}
  public function assign(value:*):* {return this.value=value;}
  public function getValue():* {return this.value;}
 }
}
