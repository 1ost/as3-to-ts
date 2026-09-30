package valuecases {
 public class Peer {
  public var effects:String="";
  public function Peer(){}
  public function take(value:Holder,input:Object):void{value.take(input);}
  public function triple(value:Holder,a:Object,b:Object,c:Object):void{value.triple(a,b,c);}
  public function number(value:Holder,input:int):void{value.number(input);}
  public function mixed(value:Holder,input:Object,count:int):void{value.mixed(input,count);}
  public function closure(value:Holder):Function{return value.take;}
  public function readName(value:Object,name:String):*{return value[name];}
  public function effect(label:String):Object{effects+=label;return label;}
  public function ordered(value:Holder):void{value.triple(effect("a"),effect("b"),effect("c"));}
  public function dynamicOrdered(value:Object):void{value["triple"](effect("x"),effect("y"),effect("z"));}
  public function writeName(value:Object,name:String,replacement:*):*{return value[name]=replacement;}
  public function removeName(value:Object,name:String):Boolean{return delete value[name];}
 }
}
