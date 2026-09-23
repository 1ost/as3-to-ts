package probe {
 public namespace internalA = "urn:op2:open-a";
 public namespace aliasA = internalA;
 public namespace internalB = "urn:op2:open-b";
 use namespace internalA;
 use namespace aliasA;
 public class OpenNamespace {
  internalA var count:int;
  internalA var unsigned:uint;
  internalB var count:int = 90;
  public var seen:int;
  public function OpenNamespace(value:Number=3) { this.initialize(value); this.seen=this.count; }
  internalA function initialize(value:Number):void { this.count=value; }
  internalA function increment(value:Number):Number { this.count+=value; return this.count; }
  public function read():Array { return [this.count,this.aliasA::count,this.internalB::count,this.seen]; }
  public function write(value:Number):Array { var result:Number=(this.count=value); (this.unsigned)=value; return [result,this.count,this.unsigned]; }
  public function add(value:Number):Number { return this.increment(value); }
  public function take():Function { return this.increment; }
  public function same():Boolean { return this.increment===this.aliasA::increment; }
 }
}
