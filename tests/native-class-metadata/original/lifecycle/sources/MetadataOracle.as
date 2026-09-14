package {
 import flash.display.Sprite;
 import flash.external.ExternalInterface;
 import flash.utils.describeType;
 import entryreview.*;
 public class MetadataOracle extends Sprite {
  public function MetadataOracle() {
   var rows:Array=[];var reflection:Array=[];var instances:Array=[];var lifecycle:Array=[];var operation:*;var failure:String="";
   try {
    for each(var name:String in ["bindNew","freshPrototype","aliasCoerce"]) {
     Subject.count=0;
     try {var value:*=Probe[name]();rows.push([name,"ok",value.n,value is Subject,Subject.count]);}
     catch(error:*) {rows.push([name,"error",error.errorID,Subject.count]);}
    }
    for each(name in ["transitiveCoerce","objectAllocate","arrayAllocate","callbackAllocate","objectCoerce","arrayCoerce"]) {
     Subject.count=0;
     try {value=FlowProbe[name]();rows.push([name,"ok",value.n,value is Subject,Subject.count]);}
     catch(error:*) {rows.push([name,"error",error.errorID,Subject.count]);}
    }
    operation=OperationProbe.run();
    LifecycleLog.rows=[];
    try {var ignored:Class=Lifecycle;}catch(initFailure:*) {LifecycleLog.rows.push("thrown:"+(initFailure===LifecycleLog.failure));}
    var first:Class=LifecycleLog.first;var next:Class=Lifecycle;
    LifecycleLog.rows.push("retry:"+(first!==next));
    var a:*=new next();var b:*=new first();
    LifecycleLog.rows.push("values:"+a.n+":"+b.n);
    LifecycleLog.rows.push("tokens:"+first.token+":"+next.token);
    LifecycleLog.rows.push("types:"+(a is first)+":"+(b is next));
    LifecycleLog.rows.push("coercions:"+(first(a)===a)+":"+(next(b)===b));
    lifecycle=LifecycleLog.rows.concat();
    for each(var type:Class in [Subject,Probe,FlowProbe,OperationProbe,LifecycleLog,next]) {reflection.push(describeType(type).toXMLString());instances.push(describeType(new type()).toXMLString());}
   } catch(fatal:*) {failure=String(fatal);}
   ExternalInterface.addCallback("snapshot",function():String{return encodeURIComponent(JSON.stringify({rows:rows,reflection:reflection,instances:instances,lifecycle:lifecycle,operation:operation,failure:failure}));});
  }
 }
}
