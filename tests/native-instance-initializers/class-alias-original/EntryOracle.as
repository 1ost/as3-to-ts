package {
import flash.display.Sprite;import flash.external.ExternalInterface;import entryreview.*;
public class EntryOracle extends Sprite {
 public function EntryOracle(){var rows:Array=[];
  for each(var name:String in ["bindNew","freshPrototype","aliasCoerce"]){Subject.count=0;try{var value:*=Probe[name]();rows.push([name,"ok",value.n,value is Subject,Subject.count]);}catch(error:*){rows.push([name,"error",error.errorID,Subject.count]);}}
  ExternalInterface.addCallback("snapshot",function():String{return encodeURIComponent(JSON.stringify(rows));});
 }
}
}
