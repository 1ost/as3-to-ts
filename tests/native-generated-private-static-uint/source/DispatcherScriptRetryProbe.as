package {
 import retrycases.Trace;
 import flash.events.EventDispatcher;
 import flash.events.Event;
 import flash.events.IEventDispatcher;
 import retrycases.Retry;
 import flash.utils.getQualifiedClassName;
 public class DispatcherScriptRetryProbe {
  private function inspectBinding(global:Object, expected:Class):Array {
   try {
    var value:*=global[new QName("retrycases","Retry")];
    return ["value",value===expected,value===null,value===undefined];
   } catch(e:*) {return ["error",e===Trace.failure,String(e)];}
  }
  public function snapshot():Object {
   var rows:Array=[];
   rows.push({id:"before",value:Trace.globals.length});
   try {Retry.read();rows.push({id:"first",value:"accepted"});}
   catch(e:*) {rows.push({id:"first",value:[e===Trace.failure,Trace.globals.length,Trace.arrays.length]});}
   var firstFunction:Function=Trace.functions[0];
   rows.push({id:"failed-closure",value:[firstFunction.call(null)===Trace.globals[0],getQualifiedClassName(firstFunction.call(null))]});
   var failedClass:Class=Trace.classes[0];
   var failedInstance:Object=new failedClass();
   rows.push({id:"failed-instance",value:[failedInstance is EventDispatcher,failedInstance is IEventDispatcher,failedInstance.hasEventListener("ready")]});
   Trace.globals[0].marker=19;
   try {Retry.read();rows.push({id:"second",value:"accepted"});}
   catch(e2:*) {rows.push({id:"second",value:[e2===Trace.failure,Trace.globals.length,Trace.arrays.length]});}
   rows.push({id:"retry-identities",value:[Trace.globals[0]===Trace.globals[1],Trace.classes[0]===Trace.classes[1],Trace.functions[0]===Trace.functions[1],Trace.arrays[0]===Trace.arrays[1]]});
   rows.push({id:"retry-global-state",value:[Trace.globals[0].marker,Trace.globals[1].marker]});
   Trace.fail=false;
   var state:Array=Retry.read();
   rows.push({id:"success",value:[Trace.globals.length,state[0]===Trace.arrays[2],state[0]!==state[1],state[0].length,state[1].length]});
   var selected:Class=Retry;
   rows.push({id:"success-identities",value:[Trace.globals[0]===Trace.globals[2],Trace.classes[0]===selected,Trace.classes[2]===selected,Trace.arrays[0]===state[0],firstFunction.call(null)===Trace.globals[2]]});
   var finalFunction:Function=Trace.functions[2];
   rows.push({id:"success-global-state",value:[finalFunction.call(null).marker,Trace.globals[0].marker]});
   var again:Array=Retry.read();
   rows.push({id:"success-once",value:[Trace.globals.length,again[0]===state[0],again[1]===state[1]]});
   rows.push({id:"failed-global-binding",value:inspectBinding(Trace.globals[0],Trace.classes[0])});
   rows.push({id:"successful-global-binding",value:inspectBinding(Trace.globals[2],selected)});
   rows.push({id:"after-binding-reads",value:Trace.globals.length});
   var instance:Object=new Retry();
   rows.push({id:"successful-instance",value:[instance is EventDispatcher,instance is IEventDispatcher,instance is Retry,failedInstance is Retry,instance.hasEventListener("ready"),failedInstance.hasEventListener("ready")]});
   rows.push({id:"parent-identity",value:[failedInstance is EventDispatcher,Trace.classes[0]===failedClass,EventDispatcher===EventDispatcher,Trace.globals.length]});
   var calls:Array=[];
   var listener:Function=function(event:Event):void {calls.push([event.target===failedInstance,event.currentTarget===failedInstance]);event.preventDefault();};
   failedInstance.addEventListener("ready",listener);
   rows.push({id:"listener-isolation",value:[failedInstance.hasEventListener("ready"),instance.hasEventListener("ready")]});
   rows.push({id:"failed-generation-dispatch",value:[failedInstance.dispatchEvent(new Event("ready",false,true)),calls]});
   failedInstance.removeEventListener("ready",listener);
   rows.push({id:"listener-removal",value:[failedInstance.hasEventListener("ready"),instance.dispatchEvent(new Event("ready")),calls.length]});
   rows.push({id:"uint-initialization",value:Trace.numbers});
   rows.push({id:"uint-final",value:Retry.values()});
   rows.push({id:"uint-instance",value:instance.advance()});
   return {ready:true,failure:"",observations:rows};
  }
 }
}
