package {
 import flash.display.Sprite;
 import flash.external.ExternalInterface;
 import flash.utils.describeType;
 import typeprobe.Subject;
 public class MetadataOracle extends Sprite {
  public function MetadataOracle(){
   var rows:Array=[],failure:String="",value:Subject=new Subject();
   try {
    var names:Array=["classType","functionType","primitives","getterType","effectType","commaType","missingDynamic","missingSealed","nullProperty","undefinedProperty","shadowClass","shadowUndefined","throwingType","readonlyWrite"];
    for each(var name:String in names){Subject.ticks=0;Subject.external="sentinel";try{rows.push([name,"ok",Subject[name](),Subject.ticks]);}catch(error:*){rows.push([name,"error",error is Error?error.errorID:error,Subject.ticks]);}}
    var one:Subject=new Subject(),two:Subject=new Subject();one.value=Subject;two.value=function():void {};
    var subjects:Array=[one,two];
    for(var j:int=0;j<subjects.length;j++){Subject.ticks=0;Subject.order=[];Subject.external=subjects[j];rows.push(["receiver",j,Subject.receiverType(),Subject.ticks,Subject.order]);}
    var values:Array=[undefined,null,true,false,1,-1,1.5,"text","",[],{},Subject,value,function():void {},new XML("<root><child/></root>"),new XMLList("<a/><b/>")];
    for(var i:int=0;i<values.length;i++){Subject.external=values[i];rows.push(["supplied",i,Subject.suppliedType()]);}
   }catch(error:*){failure=String(error);}
   var result:Object={ready:true,failure:failure,rows:rows,reflection:[describeType(Subject).toXMLString()],instances:[describeType(value).toXMLString()]};
   ExternalInterface.addCallback("snapshot",function():String{return encodeURIComponent(JSON.stringify(result));});
  }
 }
}
