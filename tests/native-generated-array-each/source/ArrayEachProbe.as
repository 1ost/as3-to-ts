package {import flash.events.EventDispatcher; public class ArrayEachProbe extends EventDispatcher {
 public var constructorState:Array;
 public function ArrayEachProbe(){super();var first:Array=[1],last:Array=[2],current:Array=first,selected:Array=[];for each(current in [first,last])selected.push(current===first);constructorState=[selected,current===last];}
 public var calls:int=0;
 private function values(input:Array):Array {calls++;return input;}
 public function snapshot():Object {
  var rows:Array=[],a:Array=[1],b:Array=[2],value:Array=[9],seen:Array=[];
  rows.push({id:"derived-constructor",value:constructorState});
  for each(value in this.values([a,b,null,undefined]))seen.push(value===a?"a":value===b?"b":value===null?"null":"other");
  rows.push({id:"identity-null-undefined",value:seen});rows.push({id:"last-value",value:value===null});rows.push({id:"collection-once",value:calls});
  value=a;for each(value in [])value.push(9);rows.push({id:"empty-retains",value:value===a});
  value=b;seen=[];var errorId:int=0,errorName:String="";
  try{for each(value in [a,7,b])seen.push(value===a);}catch(error:Error){errorId=error.errorID;errorName=error.name;}
  rows.push({id:"bad-value",value:[errorId,errorName,seen,value===a]});
  seen=[];var sparse:Array=[];sparse[2]=b;sparse[8]=a;
  for each(value in sparse){seen.push(value===b?"b":"a");value.push(3);}
  rows.push({id:"sparse-order",value:seen});rows.push({id:"mutation-identity",value:[a,b]});
  value=a;for each(value in [b,a])break;rows.push({id:"break-value",value:value===b});
  value=a;for each(value in null)value=null;rows.push({id:"null-collection",value:value===a});
  errorId=0;value=b;try{for each(value in [{length:1}])value=null;}catch(other:Error){errorId=other.errorID;}
  rows.push({id:"array-like-rejected",value:[errorId,value===b]});
  seen=[];for each(var inline:Array in [a,null,b])seen.push(inline===a?"a":inline===b?"b":"null");rows.push({id:"inline",value:seen});
  return {ready:true,failure:"",observations:rows};
 }
}}
