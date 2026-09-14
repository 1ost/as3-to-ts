package {
 import flash.display.Sprite;
 import flash.external.ExternalInterface;
 import early.*;
 public class ReturnOracle extends Sprite {
  public function ReturnOracle(){
   var rows:Array=[],failure:String="";
   try {
    for each(var type:Class in [Subject,Child])for(var mode:int=0;mode<=6;mode++){
     Journal.rows=[];
     try {var value:Object=new type(mode);Journal.rows.push("result:"+value.stage+(value is Child?":"+value.ownStage:""));}
     catch(e:*){Journal.rows.push("thrown:"+(e===Journal.thrown));if(e!==Journal.thrown){failure=String(e)+" "+e.getStackTrace();}}
     rows.push({child:type===Child,mode:mode,trace:Journal.rows});
    }
   }catch(error:*){failure=String(error);}
   ExternalInterface.addCallback("snapshot",function():String{return JSON.stringify({ready:true,failure:failure,rows:rows});});
  }
 }
}
