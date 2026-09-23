package {
 import flash.display.Sprite; import flash.external.ExternalInterface; import superprobe.*;
 public class SuperOracle extends Sprite {
  public function SuperOracle(){
   var value:Leaf=new Grandchild(); value.run();
   var detached:DetachedLeaf=new DetachedLeaf();
   var first:Function=detached.detached(); var second:Function=detached.detached();
   Journal.rows.push("detached:"+(first===second)+":"+first.call({}));
   try {first(1);} catch(error:Error){Journal.rows.push("detached-arity:"+error.errorID);}
   ExternalInterface.addCallback("snapshot",function():String{return encodeURIComponent(JSON.stringify(Journal.rows));});
  }
 }
}
