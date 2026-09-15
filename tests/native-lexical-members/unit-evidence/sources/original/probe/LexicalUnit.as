package probe {
 public class LexicalUnit {
  private var secret:Number = 1;
  protected var amount:Number = 2;
  protected var items:Array = [];
  private static var token:Number = 9;
  public var publicValue:* = "public";
  public function LexicalUnit() { super(); }
  private function secretMethod():* { return this.secret; }
  protected function amountMethod(value:*):* { return this.amount = value; }
  private static function event(value:*):* { return LexicalUnit.token = value; }
  public function read():* { return this.secret; }
  public function write(value:*):* { return this.secret = value; }
  public function invoke(value:*):* { return this.amountMethod(value); }
  public function closure():* { return this.secretMethod; }
  public function protectedClosure():* { return this.amountMethod; }
  public static function callback():* { return LexicalUnit.event; }
  public static function staticRead():* { return token; }
  public function implicit():* { return secretMethod(); }
  public function parameterShadow(secret:*):* { return secret; }
  public function localShadow():* { var secret:* = "local"; return secret; }
  public function catchShadow():* { try { throw "caught"; } catch (secret:*) { return secret; } }
  public function catchAfter():* { try { throw "caught"; } catch (secret:*) {} return secret; }
  public function dynamicRead(key:*):* { return this[key]; }
  public function dynamicWrite(key:*,value:*):* { return this[key] = value; }
  public function dynamicCall(key:*):* { return this[key](); }
  public function arrayIdentity():* { return this.items; }
  public function arrayRead():* { return this.items.length; }
 }
}
