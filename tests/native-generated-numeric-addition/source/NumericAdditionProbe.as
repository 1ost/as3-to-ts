package {
 import numericaddition.Base;
 import numericaddition.Child;
 public class NumericAdditionProbe {
  private function strings(values:Array):Array { var result:Array=[];for each(var value:* in values)result.push(String(value));return result; }
  public function snapshot():Object {
   var a:Base=new Base(),b:Base=new Base(),c:Child=new Child(),rows:Array=[];
   a.reset(1.25,2147483647,4294967295);
   rows.push({id:"fraction",value:strings(a.addNumber(2.5))});
   rows.push({id:"int-overflow",value:strings(a.addInt(1))});
   rows.push({id:"uint-overflow",value:strings(a.addUint(1))});
   rows.push({id:"string",value:strings(a.addNumber("2"))});
   rows.push({id:"null",value:strings(a.addNumber(null))});
   rows.push({id:"undefined",value:strings(a.addNumber(undefined))});
   a.reset(0,0,0);rows.push({id:"int-fraction",value:strings(a.addInt(-1.75))});
   rows.push({id:"uint-fraction",value:strings(a.addUint(-1.75))});
   c.reset(8,0,0);rows.push({id:"inherited",value:strings(c.inherited(0.5))});
   a.reset(10,0,0);b.reset(100,0,0);a.target=a;
   rows.push({id:"routed",value:strings(a.routed(function():*{a.target=b;return 2;}))});
   rows.push({id:"routed-storage",value:strings([a.state()[0],b.state()[0]])});
   var effects:int=0;a.target=null;var code:int=0;
   try{a.routed(function():*{effects++;return 3;});}catch(error:Error){code=error.errorID;}
   rows.push({id:"null-receiver",value:[code,effects]});
   return {ready:true,failure:"",observations:rows};
  }
 }
}
