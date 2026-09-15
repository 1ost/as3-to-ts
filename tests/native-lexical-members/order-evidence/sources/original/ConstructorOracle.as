package {
 import flash.display.Sprite;
 import flash.external.ExternalInterface;
 import flash.utils.describeType;
 import probe.LexicalOrder;
 public class ConstructorOracle extends Sprite {
  private var rows:Array=[];
  private var events:Array=[];
  private function rec(id:String,fn:Function):void{events=[];try{rows.push({id:id,value:fn(),events:events.concat()});}catch(e:Error){rows.push({id:id,error:{name:e.name,errorID:e.errorID},events:events.concat()});}}
  public function ConstructorOracle(){
   var x:LexicalOrder=new LexicalOrder();
   rec("static-initializer-order",function():*{return LexicalOrder.initialized();});
   rec("receiver-key-arguments-once",function():*{return x.once();});
   rec("after-once",function():*{return x.state();});
   rec("argument-effects-before-arity",function():*{return x.arity();});
   rec("after-arity",function():*{return x.state();});
   rec("reentrant-write",function():*{var v:Object={valueOf:function():*{events.push("outer");x.assign(17);return 19;}};x.assign(v);return x.getValue();});
   rec("throwing-write",function():*{x.assign({valueOf:function():*{events.push("throw");throw new Error("capture");}});return x.getValue();});
   rec("after-throw",function():*{return x.getValue();});
   var result:Object={rows:rows,reflection:[describeType(LexicalOrder).toXMLString()],instances:[describeType(x).toXMLString()]};
   ExternalInterface.addCallback("snapshot",function():String{return encodeURIComponent(JSON.stringify(result));});
  }
 }
}
