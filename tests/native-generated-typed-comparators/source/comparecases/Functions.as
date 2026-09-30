package comparecases {
 public class Functions {
  public function Functions(){}
  public function make():Function{return function(a:Item,b:Item):int{return a.rank-b.rank;};}
  public function capture(offset:*):Function{return function(a:Item,b:Item):int{return a.rank-b.rank+offset;};}
  public function constant(value:*):Function{return function():int{return value;};}
  public function fallthrough():Function{return function(a:Item):int{if(a)return a.rank;};}
  public function wildcard():Function{return function(value:*):int{return value;};}
  public function mixed():Function{return function(a:Item,b:*):int{return a.rank+b;};}
  public function reassign():Function{return function(a:Item,b:*):int{a=b;return a.rank;};}
  public function throwing():Function{return function(a:Item):int{if(a)throw a;return 3;};}
  public function sorted(values:Array):Array{return values.sort(make());}
 }
}
