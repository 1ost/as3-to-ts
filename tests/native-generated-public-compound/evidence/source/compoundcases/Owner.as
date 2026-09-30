package compoundcases {
 public class Owner {
  private var amount:int=91;
  private var target:Counter;
  public var events:Array=[];
  public function Owner(value:Counter){target=value;}
  public function add(value:Counter,rhs:*):* {return value.amount += rhs;}
  public function subtract(value:Counter,rhs:*):* {return value.amount -= rhs;}
  public function unsigned(value:Counter,rhs:*):* {return value.u += rhs;}
  public function number(value:Counter,rhs:*):* {return value.n -= rhs;}
  private function right(rhs:*):* {events.push("rhs");if(rhs==="throw")throw "rhs";return rhs;}
  public function accessorAdd(value:Counter,rhs:*):* {return value.value += right(rhs);}
  public function accessorSubtract(value:Counter,rhs:*):* {return value.value -= right(rhs);}
  private function redirect(value:Counter):int {events.push("redirect");Counter.current=value;target=value;return 5;}
  public function singleton(other:Counter):* {return Counter.inst.amount += redirect(other);}
  public function owned(other:Counter):* {return this.target.amount -= redirect(other);}
  public function redirectTo(value:Counter):void {target=value;Counter.current=value;}
  public function singletonValue(rhs:*):* {return Counter.inst.amount += rhs;}
  public function ownedValue(rhs:*):* {return this.target.amount -= rhs;}
  public function untouched():int {return amount;}
 }
}
