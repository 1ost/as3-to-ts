package {
 import flash.display.Sprite;import flash.external.ExternalInterface;import flash.utils.describeType;import probe.LocalReview;
 public class ConstructorOracle extends Sprite {
  public function ConstructorOracle(){
   var x:LocalReview=new LocalReview(),rows:Array=[],events:Array=[];
   function hook():Object{return {valueOf:function():*{events.push('valueOf');return 7;},toString:function():*{events.push('toString');return 's';}};}
   function row(id:String,name:String,args:Array):void{events=[];try{rows.push({id:id,value:x[name].apply(x,args),events:events.concat()});}catch(e:Error){rows.push({id:id,error:e.errorID,name:e.name,events:events.concat()});}}
   row('binary-string-left','binaryStringLeft',[hook()]);
   row('binary-object-left','binaryObjectLeft',[hook()]);
   row('binary-number-right','binaryNumberRight',[hook()]);
   row('compound-string-control','compoundString',[hook()]);
   row('binary-multiply','binaryMultiply',[hook()]);
   row('compound-multiply-control','compoundMultiply',[hook()]);
   row('cross-initializer','crossInitializer',[3.9]);
   row('catch-read','catchRead',[]);
   row('switch-default','switchDefault',[0]);
   row('switch-initialized','switchDefault',[1]);
   events=[];rows.push({id:'static-write',value:LocalReview.staticWrite(3.9),events:events.concat()});
   var output:Object={rows:rows,classXML:describeType(LocalReview).toXMLString(),instanceXML:describeType(x).toXMLString()};
   ExternalInterface.addCallback('snapshot',function():String{return encodeURIComponent(JSON.stringify(output));});
  }
 }
}
