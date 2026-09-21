package { import flash.display.Sprite; import flash.external.ExternalInterface; import probe.OpenNamespace;
public class ConstructorOracle extends Sprite {public function ConstructorOracle(){
var rows:Array=[]; var a:OpenNamespace=new OpenNamespace(); var b:OpenNamespace=new OpenNamespace(7);
function rec(id:String,f:Function):void {try{rows.push({id:id,value:f()});}catch(e:Error){rows.push({id:id,error:{name:e.name,errorID:e.errorID}});}}
rec("constructor",function():*{return a.read();});
rec("second",function():*{return b.read();});
rec("negative",function():*{return a.write(-1.75);});
rec("overflow",function():*{return a.write(4294967297);});
rec("compound",function():*{return a.add(2.8);});
rec("alias",function():*{return a.same();});
rec("closure-identity",function():*{return a.take()===a.take();});
rec("closure-different",function():*{return a.take()!==b.take();});
var method:Function=a.take();
rec("detached",function():*{return method(2);});
rec("borrowed",function():*{return method.call(b,4);});
rec("final-first",function():*{return a.read();});
rec("final-second",function():*{return b.read();});
ExternalInterface.addCallback("snapshot",function():String{return encodeURIComponent(JSON.stringify({rows:rows}));});
}}}
