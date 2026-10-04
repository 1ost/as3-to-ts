package {
 import flash.events.ErrorEvent;
 public class TraceOracle {
  public function snapshot():Object {
   var subject:TraceSubject=new TraceSubject(), rows:Array=[];
   subject.artwork(new ErrorEvent("error",false,false,"missing.png"));
   subject.scalar(null,null);
   subject.scalar(undefined,"text");
   subject.scalar(8,"last");
   rows.push({id:"coercion-order",value:subject.coercion()});
   try {subject.interrupted();} catch(e:Error) {rows.push({id:"interrupted",value:[e.name,e.message]});}
   return {ready:true,failure:"",observations:rows};
  }
 }
}
