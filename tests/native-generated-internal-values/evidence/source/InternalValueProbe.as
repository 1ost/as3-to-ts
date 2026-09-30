package {
 import flash.display.Sprite;
 import flash.utils.describeType;
 import valuecases.*;
 import othervalues.*;
 public class InternalValueProbe extends Sprite {
  private var rows:Array=[];
  private function add(id:String,value:*):void{rows.push({id:id,value:value});}
  public function InternalValueProbe(){
   var h:Holder=new Holder(),p:Peer=new Peer(),outside:Outsider=new Outsider();
   var object:Object={value:1};
   h.own(object);p.take(h,object);add("object-identity",[h.calls,h.last===object]);
   var fn:Function=h.ownClosure(),other:Function=p.closure(h),dynamicFn:Function=p.readName(h,"take");
   add("closure",[fn===other,fn===dynamicFn,fn.length,fn(object)===undefined,h.last===object,h.calls]);
   fn(null);add("null-object",[h.last===null,h.calls]);
   fn(undefined);add("undefined-object",[h.last===null,h.last===undefined,h.calls]);
   fn(3);add("number-object",[h.last===3,h.calls]);
   fn("text");add("string-object",[h.last==="text",h.calls]);
   fn(false);add("boolean-object",[h.last===false,h.calls]);
   var array:Array=[1];fn(array);add("array-object",[h.last===array,h.calls]);
   try{fn();add("missing-one","accepted");}catch(a:Error){add("missing-one",[a.name,a.errorID,h.calls]);}
   try{fn(object,object);add("extra-one","accepted");}catch(b:Error){add("extra-one",[b.name,b.errorID,h.calls]);}
   var triple:Function=p.readName(h,"triple");
   triple(object,array,null);add("triple",[triple.length,h.first===object,h.second===array,h.third===null,h.calls]);
   try{triple(object,array);add("missing-three","accepted");}catch(c:Error){add("missing-three",[c.name,c.errorID,h.calls]);}
   try{triple(object,array,null,object);add("extra-three","accepted");}catch(d:Error){add("extra-three",[d.name,d.errorID,h.calls]);}
   p.ordered(h);add("ordered",[p.effects,h.first,h.second,h.third,h.calls]);
   p.dynamicOrdered(h);add("dynamic-ordered",[p.effects,h.first,h.second,h.third,h.calls]);
   try{p.ordered(null);add("null-typed","accepted");}catch(e:Error){add("null-typed",[e.name,e.errorID,p.effects]);}
   try{p.dynamicOrdered(null);add("null-dynamic","accepted");}catch(f:Error){add("null-dynamic",[f.name,f.errorID,p.effects]);}
   var number:Function=p.readName(h,"number");number(4294967297);add("int-wrap",[h.lastInt,h.calls]);
   number(-3.75);add("int-truncate",[h.lastInt,h.calls]);
   number("12");add("int-string",[h.lastInt,h.calls]);
   number(NaN);add("int-nan",[h.lastInt,h.calls]);
   number(undefined);add("int-undefined",[h.lastInt,h.calls]);
   var mixed:Function=p.readName(h,"mixed");mixed(object,4294967298);add("mixed",[mixed.length,h.last===object,h.lastInt,h.calls]);
   var child:Child=new Child();p.take(child,object);child.own(array);add("override",[child.calls,child.last===array,p.closure(child)===child.ownClosure()]);
   var foreign:OtherChild=new OtherChild();p.take(foreign,object);foreign.ownOther(array);var foreignFn:Function=outside.readName(foreign,"take");foreignFn(object);
   add("separate-package",[foreign.calls,foreign.otherCalls,foreign.last===object,p.closure(foreign)===foreignFn]);
   try{outside.readName(h,"take");add("outside","accepted");}catch(g:Error){add("outside",[g.name,g.errorID]);}
   try{p.writeName(h,"take",null);add("method-write","accepted");}catch(i:Error){add("method-write",[i.name,i.errorID]);}
   add("delete",[p.removeName(h,"take"),p.closure(h)===fn]);
   add("reflection",[describeType(h).method.(@name=="take").length(),describeType(child).method.(@name=="take").length()]);
   add("fresh",[p.closure(new Holder())===fn,h.calls]);
  }
  public function snapshot():Object{return {ready:true,failure:"",observations:rows};}
 }
}
