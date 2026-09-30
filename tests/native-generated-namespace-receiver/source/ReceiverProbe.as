package {
 import flash.events.EventDispatcher;
 public class ReceiverProbe extends EventDispatcher {
  private var calls:int=0;
  private var bucket:ReceiverBucket=new ReceiverBucket();
  public function ReceiverProbe(){super();}
  private function getBucket():ReceiverBucket {calls++;return bucket;}
  private function failBucket():ReceiverBucket {calls++;throw "source failure";}
  public function snapshot():Object {
   var rows:Array=[],value:int=0,items:Array=[];
   rows.push({id:"direct-result",value:this.getBucket().read()});
   rows.push({id:"direct-calls",value:calls});
   rows.push({id:"public-field",value:this.getBucket().amount});
   rows.push({id:"field-calls",value:calls});
   for each(value in this.getBucket().toArrayCollection()){items.push(value);}
   rows.push({id:"quest-shaped-enumeration",value:items});
   rows.push({id:"enumeration-calls",value:calls});
   rows.push({id:"chained-call",value:this.getBucket().same().read()});
   rows.push({id:"chained-calls",value:calls});
   try {this.failBucket().read();}catch(e:*){rows.push({id:"throw-order",value:[e,calls]});}
   rows.push({id:"receiver-retained",value:this.getBucket().read()});
   rows.push({id:"final-calls",value:calls});
   return {ready:true,failure:"",observations:rows};
  }
 }
}