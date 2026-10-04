package numericsubtraction {
 public class Base {
  protected var total:Number=0;
  protected var count:int=0;
  protected var bits:uint=0;
  public var target:Base;
  public function reset(n:Number,i:int,u:uint):void { total=n;count=i;bits=u; }
  public function state():Array { return [total,count,bits]; }
  public function subtractNumber(delta:*):Array { var result:*=(total-=delta);return [result,total]; }
  public function subtractInt(delta:*):Array { var result:*=(count-=delta);return [result,count]; }
  public function subtractUint(delta:*):Array { var result:*=(bits-=delta);return [result,bits]; }
  public function routed(rhs:Function):Array { var result:*=(target.total-=rhs());return [result,target.total]; }
 }
}
