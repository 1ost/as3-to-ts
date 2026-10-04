package {
 public class TraversalOracle {
  public function snapshot():Object {
   XML.ignoreComments=false;XML.ignoreProcessingInstructions=false;XML.prettyPrinting=false;
   var samples:Array=['<r><menuButton><label textKey="hi" url="old"/></menuButton><x aKey="one"><y bKey="two"/></x></r>','<r/>','<r>before<x labelKey="hello"/>after<!--comment--></r>'],rows:Array=[];
   for(var i:int=0;i<samples.length;i++){
    var root:XML=new XML(samples[i]),s:TraversalSubject=new TraversalSubject(root),saved:XMLList=s.all();
    rows.push({id:"rewrite-"+i,value:[s.rewrite()===root,root.toXMLString(),s.count(saved)]});
    rows.push({id:"write-"+i,value:[s.write("extra","value"),s.attrs().toXMLString()]});
    s.writeNested("nested");rows.push({id:"nested-"+i,value:root.toXMLString()});
    rows.push({id:"null-loop-"+i,value:s.count(null)});
    rows.push({id:"names-"+i,value:[s.name(new XML("text")),s.name(new XML('<r xmlns="urn:test"/>')),s.name(new XML('<p:r xmlns:p="urn:p"/>'))]});
   }
   try{new TraversalSubject(null).rewrite();}catch(e:Error){rows.push({id:"null-receiver",value:[e.name,e.errorID]});}
   return {ready:true,failure:"",observations:rows};
  }
 }
}
