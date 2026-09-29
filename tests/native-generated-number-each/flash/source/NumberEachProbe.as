package {
 import cn.kyiax.yare.util.MathUtil;
 public class NumberEachProbe {
  private var calls:int=0;
  private function values():Array {calls++;return [2,3,4];}
  public function snapshot():Object {
   var rows:Array=[],seen:Array=[];
   var value:Number=17;
   for each(value in ["3.75",null,undefined,true,false,"invalid",-2.5,Infinity,-Infinity]) seen.push(String(value));
   rows.push({id:"number-coercion",value:[seen,String(value)]});
   value=23;for each(value in []) seen.push("unexpected");
   rows.push({id:"empty-preserves",value:value});
   for each(value in null) seen.push("unexpected");
   rows.push({id:"null-preserves",value:value});
   for each(value in undefined) seen.push("unexpected");
   rows.push({id:"undefined-preserves",value:value});
   var total:Number=0;
   for each(value in values()) total+=value;
   rows.push({id:"receiver-once",value:[total,value,calls]});
   total=0;for each(value in [1,2,3,4]) {if(value==1)continue;total+=value;if(value==3)break;}
   rows.push({id:"break-continue",value:[total,value]});
   try {for each(value in [7,8]) {throw new Error("body");}}
   catch(e:Error) {rows.push({id:"throw-preserves",value:[value,e.message]});}
   var sparse:Array=[];sparse[2]="6.5";seen=[];
   for each(value in sparse) seen.push(value);
   rows.push({id:"sparse",value:seen});
   var vector:Vector.<Number>=new Vector.<Number>();vector.push(9.25);vector.push(-3);
   total=0;for each(value in vector) total+=value;
   rows.push({id:"vector",value:[total,value]});
   for each(value in [-0]) total=1/value;
   rows.push({id:"negative-zero",value:String(total)});
   rows.push({id:"sum-coercion",value:MathUtil.sum([1,"2.5",true,null,-4])});
   rows.push({id:"sum-empty",value:MathUtil.sum([])});
   rows.push({id:"sum-null",value:MathUtil.sum(null)});
   rows.push({id:"sum-nan",value:String(MathUtil.sum([1,undefined]))});
   rows.push({id:"average",value:MathUtil.avg([2,4,9])});
   return {ready:true,failure:"",observations:rows};
  }
 }
}
