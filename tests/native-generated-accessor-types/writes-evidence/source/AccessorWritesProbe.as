package {
 import cases.AccessorWrites;import cases.DistinctAccessor;import cases.CoercedAccessor;import cases.DistinctGrandchild;import cases.alpha;
 public class AccessorWritesProbe {
  public function snapshot():Object {
   var a:DistinctAccessor=new DistinctAccessor(),n:CoercedAccessor=new CoercedAccessor(),g:DistinctGrandchild=new DistinctGrandchild(),rows:Array=[],result:*;
   result=AccessorWrites.publicWrite(a,undefined);rows.push({id:"typed-public-undefined",value:[result===undefined,a.publicValue,a.stored===undefined,a.writes]});
   result=AccessorWrites.publicWrite(a,null);rows.push({id:"typed-public-null",value:[result===null,a.publicValue,a.stored===null,a.writes]});
   result=AccessorWrites.namespaceWrite(a,false);rows.push({id:"typed-namespace-false",value:[result===false,a.alpha::implied,a.stored===false,a.writes]});
   var object:Object={marker:9};result=AccessorWrites.namespaceWrite(a,object);rows.push({id:"typed-namespace-object",value:[result===object,a.alpha::implied,a.stored===object,a.writes]});
   result=AccessorWrites.namespaceWrite(g,undefined);rows.push({id:"typed-inherited-undefined",value:[result===undefined,g.alpha::implied,g.stored===undefined,g.writes]});
   result=AccessorWrites.numericWrite(n,3.75);rows.push({id:"typed-number",value:[result,n.stored,n.writes,AccessorWrites.numericRead(n)]});
   result=AccessorWrites.numericWrite(n,4294967295);rows.push({id:"typed-wrap",value:[result,n.stored,n.writes,AccessorWrites.numericRead(n)]});
   result=AccessorWrites.staticWrite(undefined);rows.push({id:"typed-static-undefined",value:[result===undefined,CoercedAccessor.alpha::staticValue,CoercedAccessor.staticStored===undefined]});
   result=AccessorWrites.staticWrite(null);rows.push({id:"typed-static-null",value:[result===null,CoercedAccessor.alpha::staticValue,CoercedAccessor.staticStored===null]});
   result=AccessorWrites.reversedWrite(n,object);rows.push({id:"typed-reversed",value:[result===object,n.alpha::setterFirst,CoercedAccessor.staticStored===object]});
   return {ready:true,failure:"",observations:rows};
  }
 }
}
