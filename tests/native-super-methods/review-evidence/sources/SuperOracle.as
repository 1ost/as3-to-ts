package {
 import flash.display.Sprite;
 import flash.external.ExternalInterface;
 import superprobe.*;
 public class SuperOracle extends Sprite {
  public function SuperOracle(){
   var one:Grandchild=new Grandchild();one.identity="one";one.run();
   var two:Grandchild=new Grandchild();two.identity="two";
   var detached:Function=two.run;
   detached.call(one);
   ExternalInterface.addCallback("snapshot",function():String{return JSON.stringify(Journal.rows);});
  }
 }
}
