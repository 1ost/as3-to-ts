package subtractcases {
public class Counter {
 private var n:Number;
 private var i:int;
 private var u:uint;
 public var log:String="";
 public function Counter(value:Number) { super();n=value;i=value;u=value; }
 public function number(value:*):Array { var result:*=(this.n -= value);return [result,n]; }
 public function integer(value:*):Array { var result:*=(this.i -= value);return [result,i]; }
 public function unsigned(value:*):Array { var result:*=(u -= value);return [result,u]; }
 private function pick(value:Counter):Counter { log+="receiver;";return value; }
 private function rhs(value:Counter,fail:Boolean):* { log+="rhs;";if(fail)throw "rhs-failure";value.n=1000;return 3; }
 public function order(value:Counter,fail:Boolean=false):Array { var result:*=(value.n -= this.rhs(value,fail));return [result,value.n,log]; }
 public function state():Array { return [n,i,u,log]; }
 public function valueOf():Number { log+="convert;";n=900;return 2.5; }
 public function wrap():Array { this.n -= Math.floor(this.n);return [n]; }
}}
