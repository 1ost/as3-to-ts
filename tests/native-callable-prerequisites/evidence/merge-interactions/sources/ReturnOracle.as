package {
 import flash.display.Sprite;
 import flash.external.ExternalInterface;
 import early.*;
 public class ReturnOracle extends Sprite {
  public function ReturnOracle(){
   var rows:Array=[],failure:String="";
   try {
    for each(var type:Class in [Subject,Child])for(var mode:int=0;mode<9;mode++){
     Journal.rows=[];
     var shared:Object={valueOf:function():*{Journal.rows.push("coerce");return "7.5";}};
     var fail:Object={valueOf:function():*{Journal.rows.push("coerce-fail");throw Journal.thrown;}};
     try {
      var value:Object;
      if(mode<4){value=new type(shared,mode);}
      else if(mode==4){value=new type();}
      else if(mode==5){value=new type(undefined,1);}
      else if(mode==6){value=new type(null,1);}
      else if(mode==7){value=new type("3.25",1,"extra");}
      else {value=new type(fail,1);}
      Journal.rows.push("result:"+value.stage+(value is Child?":"+value.ownStage:""));
     } catch(e:*) {Journal.rows.push("thrown:"+(e===Journal.thrown));if(e!==Journal.thrown){failure=String(e)+" "+e.getStackTrace();}}
     rows.push({child:type===Child,mode:mode,trace:Journal.rows});
    }
   }catch(error:*){failure=String(error);}
   ExternalInterface.addCallback("snapshot",function():String{return JSON.stringify({ready:true,failure:failure,rows:rows});});
  }
 }
}
