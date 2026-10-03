package {
 import cases.VoidNestedClosure;
 public class VoidNestedProbe {
  public function snapshot():Object {
   var rows:Array=[],subject:VoidNestedClosure=new VoidNestedClosure();
   var foreign:Object={_calls:77},target:Object={};
   subject.schedule(target);
   for(var i:int=0;i<5;i++) {target.next.call(foreign);rows.push({id:"void-step-"+i,value:[subject.calls(),target.next===null]});}
   rows.push({id:"void-final-owner",value:[target.value,foreign._calls]});
   var outer:Function=subject.typed(),inner:Function=outer.call(foreign);
   rows.push({id:"nested-typed-return",value:inner.call(foreign)});
   return {ready:true,failure:"",observations:rows};
  }
 }
}
