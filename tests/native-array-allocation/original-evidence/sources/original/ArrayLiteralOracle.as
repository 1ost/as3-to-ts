package {
 import flash.display.Sprite;import flash.external.ExternalInterface;
 public class ArrayLiteralOracle extends Sprite {
  public function ArrayLiteralOracle(){
   var rows:Array=[];
   function shape(value:*):*{
    if(value is Array){var slots:Array=[];for(var i:int=0;i<value.length;i++)slots.push({own:value.hasOwnProperty(String(i)),value:shape(value[i])});return {kind:"Array",length:value.length,slots:slots};}
    return {kind:typeof value,value:value===undefined?"undefined":value};
   }
   for(var i:int=0;i<10;i++){try{rows.push({index:i,value:shape(new Subject(i).value)});}catch(error:*){rows.push({index:i,error:error.errorID,name:error.name,message:error.message,stack:error.getStackTrace()});}}
   ExternalInterface.addCallback("snapshot",function():String{return encodeURIComponent(JSON.stringify({rows:rows}));});
  }
 }
}