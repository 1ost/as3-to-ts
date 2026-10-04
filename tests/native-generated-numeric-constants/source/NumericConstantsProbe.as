package {
 import numericconstants.Base;
 import numericconstants.Child;
 public class NumericConstantsProbe {
  private function strings(values:Array):Array {
   var result:Array=[];
   for each(var value:* in values)result.push(String(value));
   return result;
  }
  public function snapshot():Object {
   var base:Base=new Base(),child:Child=new Child();
   return {ready:true,failure:"",observations:[
    {id:"base",value:strings(base.values())},
    {id:"child-base",value:strings(child.values())},
    {id:"child-own",value:strings(child.inherited())},
    {id:"fresh",value:strings(new Base().values())}
   ]};
  }
 }
}
