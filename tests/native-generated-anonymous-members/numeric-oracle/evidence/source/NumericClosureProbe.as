package {import cases.NumericClosure;public class NumericClosureProbe {
 public function snapshot():Object {var rows:Array=[],subject:NumericClosure=new NumericClosure(),inputs:Array=[4294967297,-1.5,undefined,"7"];
 for(var i:int=0;i<inputs.length;i++){var callback:Function=subject.make(inputs[i]);rows.push({id:"numeric-"+i,value:callback()});}
 return {ready:true,failure:"",observations:rows};}
}}
