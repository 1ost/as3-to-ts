package probe {
 import cases.*;
 import flash.utils.describeType;
 public class SourceAccessorProbe {
  public function snapshot():Object {
   var base:Base=new Base(),child:Child=new Child(),grand:Grand=new Grand(),token:Data=new Data(7),rows:Array=[];
   rows.push({id:"initial",value:[base.value===null,child.value===null,grand.value===null]});
   child.value=token;rows.push({id:"setter-override",value:[child.value===token,child.stored===token,child.writes]});
   grand.value=token;rows.push({id:"getter-override",value:[grand.value===token,grand.stored===token,grand.writes]});
   rows.push({id:"base-virtual",value:[grand.throughBase(null)===null,grand.value===null,grand.writes]});
   var inputs:Array=[token,null,undefined,new Other(),{},7,"text"];
   for(var i:int=0;i<inputs.length;i++){
    var error:String="none",before:int=child.writes;
    try{Object(child)["value"]=inputs[i];}catch(e:Error){error=e.name+":"+e.errorID;}
    rows.push({id:"dynamic-"+i,value:[error,child.value===token,child.value===null,child.writes-before]});
   }
   for each(var subject:Object in [base,child,grand]){
    var desc:XML=describeType(subject),a:XML=desc.accessor.(@name=="value")[0];
    rows.push({id:"reflection-"+String(desc.@name),value:[String(a.@type),String(a.@access),String(a.@declaredBy)]});
   }
   return {ready:true,failure:"",observations:rows};
  }
 }
}
