package valuecases {
 public class Holder {
  public var calls:int=0;
  public var last:Object;
  public var first:Object;
  public var second:Object;
  public var third:Object;
  public var lastInt:int=0;
  public function Holder(){}
  internal function take(input:Object):void{calls++;if(input===undefined)calls+=1000;last=input;}
  internal function triple(a:Object,b:Object,c:Object):void{calls++;first=a;second=b;third=c;}
  internal function number(input:int):void{calls++;if(input===4294967297)calls+=1000;lastInt=input;}
  internal function mixed(input:Object,count:int):void{calls++;last=input;lastInt=count;}
  public function own(input:Object):void{take(input);}
  public function ownClosure():Function{return take;}
 }
}
