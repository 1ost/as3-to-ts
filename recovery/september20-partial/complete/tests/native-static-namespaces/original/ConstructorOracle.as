package { import flash.display.Sprite; import flash.external.ExternalInterface; import probe.StaticMethods; import probe.inside;
 public class ConstructorOracle extends Sprite {public function ConstructorOracle(){
 var rows:Array=[];var method:Function=StaticMethods.take();var clear:Function=StaticMethods.inside::clear;var rest:Function=StaticMethods.inside::items;var strings:Function=StaticMethods.inside::stringify;
 function rec(id:String,f:Function):void {try{rows.push({id:id,value:f()});}catch(e:Error){rows.push({id:id,error:{name:e.name,errorID:e.errorID}});}}
rec("identity",function():*{return StaticMethods.take()===StaticMethods.aliasTake();});
rec("length",function():*{return method.length;});
rec("direct",function():*{return StaticMethods.inside::sum(3,4);});
rec("detached",function():*{return method(5);});
rec("borrowed",function():*{return method.call({count:99},6,3);});
rec("apply",function():*{return method.apply(null,[7,4]);});
rec("coerce",function():*{return method("5.5",3.9);});
rec("undefined-optional",function():*{return method(2,undefined);});
rec("missing",function():*{return method();});
rec("extra",function():*{return method(1,2,3);});
rec("before-clear",function():*{return StaticMethods.count;});
rec("clear-length",function():*{return clear.length;});
rec("clear-extra",function():*{return clear(1);});
rec("clear-extra-effect",function():*{return StaticMethods.count;});
rec("clear",function():*{clear();return StaticMethods.count;});
rec("rest-length",function():*{return rest.length;});
rec("rest",function():*{return rest("x",1,2);});
rec("rest-missing",function():*{return rest();});
rec("stringify",function():*{return strings(17);});
rec("string-null",function():*{return strings(undefined,undefined);});
rec("array-invalid",function():*{return strings("x",{});});
rec("prototype",function():*{return method.prototype===undefined;});
rec("construct",function():*{return new method(1);});
rec("qname-write",function():*{StaticMethods[new QName(inside,"sum")]=function():*{return 99;};return method===StaticMethods.take();});
rec("qname-delete",function():*{return delete StaticMethods[new QName(inside,"sum")];});
rec("final-identity",function():*{return method===StaticMethods.take();});
ExternalInterface.addCallback("snapshot",function():String{return encodeURIComponent(JSON.stringify({rows:rows}));});
}}}