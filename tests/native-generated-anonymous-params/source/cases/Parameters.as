package cases {
 public class Parameters {
  private function call(fn:Function,args:Array):Object {
   try { return {value:fn.apply(null,args)}; }
   catch(e:Error) { return {error:e.name,code:e.errorID}; }
  }
  public function snapshot():Object {
   var rows:Array=[];
   var text:Function=function(value:String):* {return [value,typeof value];};
   rows.push({id:"string-length",value:text.length});
   rows.push({id:"string",value:call(text,["hello"])});
   rows.push({id:"null",value:call(text,[null])});
   rows.push({id:"undefined",value:call(text,[undefined])});
   rows.push({id:"number",value:call(text,[42])});
   rows.push({id:"boolean",value:call(text,[false])});
   rows.push({id:"string-missing",value:call(text,[])});
   rows.push({id:"string-extra",value:call(text,["hello",2])});
   var rest:Function=function(...values):* {return values;};
   rows.push({id:"rest-length",value:rest.length});
   rows.push({id:"rest-empty",value:call(rest,[])});
   rows.push({id:"rest-many",value:call(rest,[1,"x",null])});
   var args:Array=[1,2];
   var first:Array=rest.apply(null,args);
   first.push(3);
   var second:Array=rest.apply(null,args);
   rows.push({id:"rest-fresh",value:[first,second,args,first===second,first===args]});
   var mixed:Function=function(value:String,...tail):* {return [value,tail];};
   rows.push({id:"mixed-length",value:mixed.length});
   rows.push({id:"mixed-missing",value:call(mixed,[])});
   rows.push({id:"mixed-empty",value:call(mixed,[17])});
   rows.push({id:"mixed-many",value:call(mixed,[undefined,2,3])});
   var wildcard:Function=function(value:*,...tail):* {return [value===undefined,tail];};
   rows.push({id:"wildcard-missing",value:call(wildcard,[])});
   rows.push({id:"wildcard-many",value:call(wildcard,[undefined,2])});
   var assign:Function=function(value:String,extra:*):* {value=extra;return [value,typeof value];};
   rows.push({id:"string-assignment",value:call(assign,["before",25])});
   return {ready:true,failure:"",observations:rows};
  }
 }
}
