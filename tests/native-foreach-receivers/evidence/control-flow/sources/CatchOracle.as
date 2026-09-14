package {
 import flash.display.Sprite;import flash.external.ExternalInterface;import catching.*;
 public class CatchOracle extends Sprite {
 public function CatchOracle(){var rows:Array=[],failure:String="";
 try{for(var mode:int=0;mode<14;mode++){Journal.rows=[];new Subject(mode);rows.push({mode:mode,trace:Journal.rows});}}catch(error:*){failure=String(error);}
 ExternalInterface.addCallback("snapshot",function():String{return JSON.stringify({ready:true,failure:failure,rows:rows});});
 }}
}
