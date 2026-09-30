package {
 import flash.display.Sprite;
 import comparecases.*;
 public class TypedComparatorProbe extends Sprite {
  private var rows:Array=[];
  private function add(id:String,value:*):void{rows.push({id:id,value:value});}
  public function TypedComparatorProbe(){
   var factory:Functions=new Functions(),first:Item=new Item(7.75),second:Item=new Item(2);
   var fn:Function=factory.make();
   add("numeric",[fn(first,second),fn(second,first),fn.length]);
   add("fresh",[fn===factory.make(),fn===fn]);
   add("subtype",fn(new Child(9.5),second));
   add("overflow",fn(new Item(4294967297),new Item(0)));
   add("nan",fn(new Item(NaN),second));
   try{fn(first,second,"extra");add("extra","accepted");}catch(extra:Error){add("extra",[extra.name,extra.errorID]);}
   try{fn();add("missing-all","accepted");}catch(a:Error){add("missing-all",[a.name,a.errorID]);}
   try{fn(first);add("missing-second","accepted");}catch(b:Error){add("missing-second",[b.name,b.errorID]);}
   try{fn({},second);add("plain-object","accepted");}catch(c:Error){add("plain-object",[c.name,c.errorID]);}
   try{fn(new Other(),second);add("unrelated-class","accepted");}catch(d:Error){add("unrelated-class",[d.name,d.errorID]);}
   try{fn(null,second);add("null","accepted");}catch(e:Error){add("null",[e.name,e.errorID]);}
   try{fn(undefined,second);add("undefined","accepted");}catch(f:Error){add("undefined",[f.name,f.errorID]);}
   try{fn(null,{});add("coercion-before-body","accepted");}catch(g:Error){add("coercion-before-body",[g.name,g.errorID]);}
   add("call-apply",[fn.call({},first,second),fn.apply(null,[second,first])]);
   var closure:Function=factory.capture(3.5);add("capture",[closure(first,second),closure(second,first)]);
   var value:*="4294967298";add("return-string",factory.constant(value)());
   value=undefined;add("return-undefined",factory.constant(value)());
   value=null;add("return-null",factory.constant(value)());
   value=Infinity;add("return-infinity",factory.constant(value)());
   add("fallthrough",[factory.fallthrough()(null),factory.fallthrough()(first)]);
   try{add("zero-extra",factory.constant(5)("extra"));}catch(h:Error){add("zero-extra",[h.name,h.errorID]);}
   var wildcard:Function=factory.wildcard();add("wildcard",wildcard("4294967298"));
   try{add("wildcard-missing",wildcard());}catch(i:Error){add("wildcard-missing",[i.name,i.errorID]);}
   try{add("wildcard-extra",wildcard(4,5));}catch(j:Error){add("wildcard-extra",[j.name,j.errorID]);}
   add("mixed",factory.mixed()(first,3.5));
   add("reassign",factory.reassign()(null,new Child(8.5)));
   try{factory.reassign()(first,{});add("reassign-bad","accepted");}catch(k:Error){add("reassign-bad",[k.name,k.errorID]);}
   try{factory.throwing()(first);add("throw","returned");}catch(thrown:*){add("throw",thrown===first);}
   var items:Array=[new Item(3),new Item(1),new Child(2)];var sorted:Array=factory.sorted(items);
   add("sort",[sorted===items,items[0].rank,items[1].rank,items[2].rank]);
  }
  public function snapshot():Object{return {ready:true,failure:"",observations:rows};}
 }
}
