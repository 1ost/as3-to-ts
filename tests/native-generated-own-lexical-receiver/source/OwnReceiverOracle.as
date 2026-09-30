package {import probe.OwnReceiver;
 public class OwnReceiverOracle {
  public function snapshot():Object {
   var rows:Array=[],a:OwnReceiver=new OwnReceiver(),b:OwnReceiver=new OwnReceiver();
   OwnReceiver.install(a);b.dispatch({amount:2});rows.push({id:"other-caller",value:a.total});rows.push({id:"selected-receiver",value:[a.total,b.total]});
   var first:Function=b.callback(),second:Function=a.callback();rows.push({id:"stable-closure",value:first===second});
   OwnReceiver.install(b);first({amount:3});rows.push({id:"retained-receiver",value:a.total});rows.push({id:"new-closure",value:b.callback()!==first});
   a.replacement=a;a.dispatch({amount:7});rows.push({id:"receiver-before-argument",value:b.total});rows.push({id:"state",value:[a.total,b.total]});
   a.replacement=null;OwnReceiver.install(null);var failure:int=0;try{a.dispatch({amount:1});}catch(error:Error){failure=error.errorID;}rows.push({id:"null-error",value:failure});
   rows.push({id:"argument-evaluation",value:[a.evaluations.concat(),b.evaluations.concat()]});return {ready:true,failure:"",observations:rows};
  }
 }
}