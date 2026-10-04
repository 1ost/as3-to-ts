package numericaddition {
 public class Base {
  protected var total:Number=0;
  protected var count:int=0;
  protected var bits:uint=0;
  public var target:Base;
  public function reset(n:Number,i:int,u:uint):void { total=n;count=i;bits=u; }
  public function state():Array { return [total,count,bits]; }
  public function addNumber(delta:*):Array { var result:*=(total+=delta);return [result,total]; }
  public function addInt(delta:*):Array { var result:*=(count+=delta);return [result,count]; }
  public function addUint(delta:*):Array { var result:*=(bits+=delta);return [result,bits]; }
  public function routed(rhs:Function):Array { var result:*=(target.total+=rhs());return [result,target.total]; }
 }
}
