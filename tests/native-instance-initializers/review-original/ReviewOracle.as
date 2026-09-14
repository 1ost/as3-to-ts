package {
import flash.display.Sprite;import flash.external.ExternalInterface;import adversary.*;
public class ReviewOracle extends Sprite {
 public function ReviewOracle(){
  var rows:Array=[];
  for each(var item:Array in [["LocalSelf",LocalSelf,[]],["ParameterSelf",ParameterSelf,[null]],["LocalError",LocalError,[1]],["LocalObject",LocalObject,[]],["ParameterObject",ParameterObject,[null]],["ParameterNumber",ParameterNumber,[null,7]],["ParameterError",ParameterError,[null,2]]]){
   var C:Class=item[1];
   try{var value:*=item[2].length===0?new C():item[2].length===1?new C(item[2][0]):new C(item[2][0],item[2][1]);rows.push([item[0],"ok",value.n]);}
   catch(error:*){rows.push([item[0],"error",error.errorID]);}
  }
  var subject:Subject=new Subject();subject.n=42;
  try{rows.push(["aliasCall","ok",Subject.replay(subject)]);}catch(aliasError:*){rows.push(["aliasCall","error",aliasError.errorID,subject.n]);}
  var leaked:Array=[];
  for(var i:int=0;i<2;i++){try{new FailureLeaf();}catch(failure:*){leaked.push(failure);rows.push(["leak",failure.ready,failure.base,failure.self===failure,failure is FailureLeaf,failure is Root]);}}
  rows.push(["fresh",leaked[0]!==leaked[1]]);
  ExternalInterface.addCallback("snapshot",function():String{return encodeURIComponent(JSON.stringify(rows));});
 }
}
}
