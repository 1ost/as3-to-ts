package {
 import flash.display.Sprite;
 import flash.external.ExternalInterface;
 import flash.utils.describeType;
 import probe.LexicalUnit;
 public class ConstructorOracle extends Sprite {
  private var rows:Array=[];
  private var events:Array=[];
  private function rec(id:String,fn:Function):void {events=[];try{rows.push({id:id,value:fn(),events:events.concat()});}catch(e:Error){rows.push({id:id,error:{name:e.name,errorID:e.errorID},events:events.concat()});}}
  public function ConstructorOracle(){
   var x:LexicalUnit=new LexicalUnit(),y:LexicalUnit=new LexicalUnit();
   rec("defaults",function():*{return [x.read(),x.invoke(2),LexicalUnit.staticRead(),x.arrayRead(),x.publicValue];});
   rec("array-fresh",function():*{return x.arrayIdentity()!==y.arrayIdentity();});
   rec("field-write",function():*{return [x.write("7"),x.read()];});
   rec("protected-write",function():*{return x.invoke("8");});
   rec("implicit",function():*{return x.implicit();});
   rec("closure-stable",function():*{return [x.closure()===x.closure(),x.closure()!==y.closure(),x.closure()()];});
   rec("closure-receiver",function():*{var f:Function=x.closure();return [f.call(y),f.apply(null,[]),f.length];});
   rec("protected-closure",function():*{var f:Function=x.protectedClosure();return [f("11"),f.length];});
   rec("static-closure",function():*{var f:Function=LexicalUnit.callback();return [f("12"),LexicalUnit.staticRead(),f===LexicalUnit.callback(),f.length];});
   rec("parameter-shadow",function():*{return x.parameterShadow("parameter");});
   rec("local-shadow",function():*{return x.localShadow();});
   rec("catch-shadow",function():*{return x.catchShadow();});
   rec("catch-after",function():*{return x.catchAfter();});
   rec("dynamic-private",function():*{return x.dynamicRead("secret");});
   rec("dynamic-write",function():*{return [x.dynamicWrite("secret","13"),x.read()];});
   rec("dynamic-call",function():*{return x.dynamicCall("secretMethod");});
   rec("dynamic-public",function():*{return x.dynamicRead("publicValue");});
   rec("public-qname-private",function():*{return x.dynamicRead(new QName("","secret"));});
   rec("external-private",function():*{var a:*=x;return a.secret;});
   rec("private-arity-extra",function():*{var f:Function=x.closure();return f(1);});
   rec("protected-arity-missing",function():*{var f:Function=x.protectedClosure();return f();});
   rec("protected-arity-extra",function():*{var f:Function=x.protectedClosure();return f(1,2);});
   rec("static-arity-missing",function():*{var f:Function=LexicalUnit.callback();return f();});
   rec("coercion-order",function():*{return [x.write({valueOf:function():*{events.push("valueOf");return 14;}}),x.read()];});
   var result:Object={rows:rows,reflection:[describeType(LexicalUnit).toXMLString()],instances:[describeType(x).toXMLString()]};
   ExternalInterface.addCallback("snapshot",function():String{return encodeURIComponent(JSON.stringify(result));});
  }
 }
}
