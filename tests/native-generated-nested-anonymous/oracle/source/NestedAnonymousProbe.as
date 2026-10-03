package {
 import cases.NestedClosure;
 public class NestedAnonymousProbe {
  public function snapshot():Object {
   var rows:Array=[],first:NestedClosure=new NestedClosure(),second:NestedClosure=new NestedClosure();
   var foreign:Object={_calls:99};
   var outerA:Function=first.prepare(4294967295),outerB:Function=second.prepare(10);
   var a1:Function=outerA.call(foreign,2),a2:Function=outerA.apply(null,[5]),b1:Function=outerB.call(first,3);
   rows.push({id:"initial",value:[first.calls(),second.calls(),foreign._calls]});
   rows.push({id:"outer-overflow-foreign-receiver",value:a1.call(foreign,3)});
   rows.push({id:"sibling-shared-outer",value:a2.apply(second,[1])});
   rows.push({id:"intermediate-storage-fraction",value:a1(-1.5)});
   rows.push({id:"separate-owner-string-addition",value:b1("7")});
   rows.push({id:"undefined-storage",value:a1(undefined)});
   var deep:Function=first.chain(2147483647);
   deep=deep.call(foreign);deep=deep.call(second);deep=deep.apply(null,[]);deep=deep();
   rows.push({id:"five-level-overflow",value:deep.call(foreign)});
   rows.push({id:"five-level-repeat",value:deep.apply(second,[])});
   rows.push({id:"owners-retained",value:[first.calls(),second.calls(),foreign._calls]});
   return {ready:true,failure:"",observations:rows};
  }
 }
}
