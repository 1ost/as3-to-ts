package {import flash.display.Sprite;import flash.external.ExternalInterface;import flash.utils.describeType;import probe.ArrayFields;
 public class ConstructorOracle extends Sprite {public function ConstructorOracle(){
  var rows:Array=[];var first:ArrayFields=new ArrayFields();var second:ArrayFields=new ArrayFields();var item:Array=[];
  function rec(id:String,fn:Function):void{try{rows.push({id:id,value:fn()});}catch(e:Error){rows.push({id:id,error:{name:e.name,errorID:e.errorID}});}}
  rec('instance-default-null',function():*{return first.items===null;});
  rec('static-default-null',function():*{return ArrayFields.cache===null;});
  rec('instance-array-identity',function():*{first.items=item;return first.items===item;});
  rec('instances-storage-independent',function():*{return second.items===null;});
  rec('static-array-identity',function():*{ArrayFields.cache=item;return ArrayFields.cache===item;});
  rec('instance-undefined-null',function():*{var value:*=undefined;first.items=value;return first.items===null;});
  rec('static-undefined-null',function():*{var value:*=undefined;ArrayFields.cache=value;return ArrayFields.cache===null;});
  rec('instance-null',function():*{first.items=null;return first.items===null;});
  rec('instance-object-rejected',function():*{var value:*={};first.items=value;return false;});
  rec('static-number-rejected',function():*{var value:*=2;ArrayFields.cache=value;return false;});
  rec('arraylike-rejected',function():*{var value:*={length:0};first.items=value;return false;});
  rec('vector-rejected',function():*{var value:*=new Vector.<Number>();first.items=value;return false;});
  rec('wrong-conversion-no-valueOf',function():*{var count:int=0;var value:*={valueOf:function():*{count++;return item;}};try{first.items=value;}catch(e:Error){return [e.errorID,count,first.items===null];}return false;});
  rec('assignment-rhs-undefined',function():*{var value:*=undefined;var result:*=(first.items=value);return [result===undefined,first.items===null];});
  var result:Object={rows:rows,classXML:describeType(ArrayFields).toXMLString(),instanceXML:describeType(new ArrayFields()).toXMLString()};
  ExternalInterface.addCallback('snapshot',function():String{return encodeURIComponent(JSON.stringify(result));});
 }}
}
