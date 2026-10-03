package cases {
 public class VectorReturn {
  private var _calls:int;
  private function select(value:*):Vector.<int> {
   this._calls++;
   return value;
  }
  private static function staticSelect(value:*):Vector.<int> { return value; }
  public function exchange(value:*):* { return this.select(value); }
  public function closure():Function { return this.select; }
  public function staticExchange(value:*):* { return staticSelect(value); }
  public function calls():int { return this._calls; }
  private function getDigit(value:int):Vector.<int> {
   var result:Vector.<int> = new Vector.<int>();
   var i:int = 0;
   while(i < 4) {
    result.unshift(value % 10);
    value /= 10;
    if(value == 0) break;
    i++;
   }
   while(result.length < 4) result.push(-9);
   return result;
  }
  public function digits(value:int):* { return this.getDigit(value); }
 }
}
