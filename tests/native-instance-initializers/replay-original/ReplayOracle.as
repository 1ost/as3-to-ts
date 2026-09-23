package {
 import flash.display.Sprite; import flash.external.ExternalInterface; import replay.*;
 public class ReplayOracle extends Sprite {
  public function ReplayOracle(){
   var subject:Subject=new Subject(); subject.stage=42;
   Journal.attempt("completed",subject,Subject);
   Journal.rows.push("completed-value:"+subject.stage);
   for(var i:int=0;i<2;i++){
    try{new Failed();}catch(error:*){Journal.rows.push("failure:"+(error===Journal.failure));}
    Journal.attempt("failed",Journal.leaked,Failed);
    Journal.rows.push("failed-value:"+Journal.leaked.ready);
   }
   ExternalInterface.addCallback("snapshot",function():String{return encodeURIComponent(JSON.stringify(Journal.rows));});
  }
 }
}
