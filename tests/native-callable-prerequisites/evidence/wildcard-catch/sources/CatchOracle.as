package {
 import flash.display.Sprite;import flash.external.ExternalInterface;import catching.*;
 public class CatchOracle extends Sprite {
  public function CatchOracle(){
   var rows:Array=[],failure:String="",values:Array=[undefined,null,{label:"original"},"text",17,true];
   try {for(var i:int=0;i<values.length;i++)for(var mode:int=0;mode<2;mode++){
    Journal.rows=[];Journal.expected=values[i];
    try{var item:Subject=new Subject(values[i],mode);Journal.rows.push("survived:"+item.survived);}
    catch(error:*){Journal.rows.push("escaped:"+(error===values[i]));}
    rows.push({index:i,mode:mode,trace:Journal.rows});
   }}catch(fatal:*){failure=String(fatal);}
   ExternalInterface.addCallback("snapshot",function():String{return JSON.stringify({ready:true,failure:failure,rows:rows});});
  }
 }
}