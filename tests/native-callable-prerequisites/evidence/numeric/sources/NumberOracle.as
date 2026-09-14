package {
 import flash.display.Sprite; import flash.external.ExternalInterface; import flash.system.Capabilities; import numeric.*;
 public class NumberOracle extends Sprite {
  public function NumberOracle() {
   var C:Class=NumberSubject;
   Recorder.rows.push("omitted"); new C();
   Recorder.rows.push("one"); new C(2.5);
   Recorder.rows.push("undefined"); new C(undefined,undefined);
   Recorder.rows.push("null"); new C(null,null);
   Recorder.rows.push("invalid-string"); new C("not-a-number","1e-4000");
   Recorder.rows.push("extra"); new C(1,2,3);
   var shared:Object={valueOf:function():*{Recorder.rows.push("shared-coerce"); return "13.25";}};
   Recorder.rows.push("same-object"); new C(shared,shared);
   Recorder.rows.push("evaluation-order"); new C(Recorder.argument("first",shared),Recorder.argument("second",shared));
   Recorder.rows.push("nan-payloads"); new C(Recorder.fromBits("7ff8123456789abc"),Recorder.fromBits("fff823456789abcd"));
   var fallback:Object={valueOf:function():*{Recorder.rows.push("fallback-value");return null;},toString:function():String{Recorder.rows.push("fallback-string");return "17.5";}};
   Recorder.rows.push("fallback"); new C(fallback);
   var fail:Object={valueOf:function():*{Recorder.rows.push("coerce-throw");throw Recorder.failure;}};
   Recorder.rows.push("throw-first"); try {new C(fail,shared);}catch(e:*) {Recorder.rows.push("same-error:"+(e===Recorder.failure));}
   Recorder.rows.push("throw-second"); try {new C(shared,fail);}catch(e2:*) {Recorder.rows.push("same-error:"+(e2===Recorder.failure));}
   Recorder.rows.push("after-throw"); new C(3,4);
   C=Required;
   Recorder.rows.push("required-missing");try {new C();}catch(e3:Error){Recorder.rows.push("arity:"+e3.errorID);}
   Recorder.rows.push("required-extra");try {new C(shared,fail);}catch(e4:Error){Recorder.rows.push("arity:"+e4.errorID);}
   Recorder.rows.push("required-undefined"); new C(undefined);
   C=IntegerSubject; Recorder.rows.push("integers");new C("4294967297","-1.75");
   Recorder.rows.push("integer-fallback");new C(fallback,shared);
   C=Derived; Recorder.rows.push("derived-nan");new C(Recorder.fromBits("7ff8123456789abc"),Recorder.fromBits("fff823456789abcd"));
   Recorder.rows.push("derived-undefined");new C(undefined,undefined);
   C=Rebind;new C(1);
   ExternalInterface.addCallback("snapshot",function():String{return encodeURIComponent(JSON.stringify({runtime:Capabilities.version,rows:Recorder.rows}));});
  }
 }
}