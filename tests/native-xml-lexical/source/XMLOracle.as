package {
 public class XMLOracle {
  public function snapshot():Object {
   var samples:Array=['<root tag="x"><state name="a">one</state><state name="b">two</state></root>','<root tag="y"><state name="c">three</state></root>','<root/>'],rows:Array=[];
   for(var i:int=0;i<samples.length;i++){
    var s:XMLSubject=new XMLSubject(new XML(samples[i]));
    rows.push({id:"sample-"+i,value:s.snapshot()});
    rows.push({id:"missing-"+i,value:s.missing()});
    rows.push({id:"shadow-"+i,value:s.shadow(new XML('<root><state>local</state></root>'))});
   }
   try{new XMLSubject(null).snapshot();}catch(e:Error){rows.push({id:"null",value:[e.name,e.errorID]});}
   return {ready:true,failure:"",observations:rows};
  }
 }
}
