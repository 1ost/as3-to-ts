package {
 import flash.display.Sprite;import flash.external.ExternalInterface;import flash.utils.describeType;import flash.utils.getQualifiedClassName;import probe.AritySubject;
 public class ConstructorOracle extends Sprite {
 public function ConstructorOracle(){
 var rows:Array=[],s:AritySubject=new AritySubject(),fn:Function=s.one,zero:Function=s.zero,events:Array=[];
 function failure():* {try{fn();}catch(e:*){return e;}return null;}
 function inspect(e:*):Object {return {name:e.name,id:e.errorID,message:e.message,messageType:typeof e.message,qualified:getQualifiedClassName(e),isArgument:e is ArgumentError,isError:e is Error,constructorIdentity:e.constructor===ArgumentError,prototypeContains:ArgumentError.prototype.isPrototypeOf(e),ownName:e.hasOwnProperty('name'),ownMessage:e.hasOwnProperty('message'),ownID:e.hasOwnProperty('errorID')};}
 var first:*=failure();rows.push({id:'too-few-fields',value:inspect(first)});
 try{zero(1);}catch(ex:*){rows.push({id:'too-many-fields',value:inspect(ex)});}
 rows.push({id:'separate-identity',value:first!==failure()});
 var oldName:*=ArgumentError.prototype.name;
 try{
 ArgumentError.prototype.name='mutated';var changed:*=failure();ArgumentError.prototype.name='later';rows.push({id:'live-name-snapshot',value:[changed.name,failure().name,first.name]});
 ArgumentError.prototype.name=undefined;rows.push({id:'undefined-name-snapshot',value:failure().name===undefined});
 var marker:Object={valueOf:function():*{events.push('valueOf');return 7;},toString:function():String{events.push('toString');return 'name';}};ArgumentError.prototype.name=marker;rows.push({id:'object-name-snapshot',value:failure().name===marker,events:events.concat()});
 ArgumentError.prototype.extra='before';var inherited:*=failure();ArgumentError.prototype.extra='after';rows.push({id:'live-dynamic-delegate',value:[inherited.extra,inherited.hasOwnProperty('extra')]});
 }finally{ArgumentError.prototype.name=oldName;delete ArgumentError.prototype.extra;}
 first.name=null;first.message=undefined;first.extra=23;rows.push({id:'mutable-own-fields',value:[first.name===null,first.message===undefined,first.extra]});
 try{first.errorID=9;}catch(ro:*){rows.push({id:'readonly-id',value:[ro.name,ro.errorID,first.errorID]});}
 var result:Object={rows:rows,reflection:[describeType(AritySubject).toXMLString(),describeType(ArgumentError).toXMLString()],instances:[describeType(s).toXMLString(),describeType(first).toXMLString()]};ExternalInterface.addCallback('snapshot',function():String{return encodeURIComponent(JSON.stringify(result));});
 }}
}
