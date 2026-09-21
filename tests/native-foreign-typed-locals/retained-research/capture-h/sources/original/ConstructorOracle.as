package {import flash.display.Sprite;import flash.external.ExternalInterface;import flash.utils.describeType;
import init.State;import init.DeferredPeer;import init.DeferredHolder;import probe.ForeignLocals;import probe.QualifiedLocals;import probe.SamePackage;import probe.Companion;import foreign.Peer;import other.Peer;import foreign.Child;import cycle.A;import cycle.B;
public class ConstructorOracle extends Sprite {public function ConstructorOracle(){
var initializationRows=[];
initializationRows.push({id:"oracle-entry",events:State.events.concat()});
var deferred:DeferredHolder=new DeferredHolder();initializationRows.push({id:"holder-construction",events:State.events.concat()});
var result:*=deferred.empty();initializationRows.push({id:"foreign-default",isNull:result===null,events:State.events.concat()});
result=deferred.accept(undefined);initializationRows.push({id:"foreign-undefined",isNull:result===null,events:State.events.concat()});
try {deferred.accept({});}catch(failure:*) {initializationRows.push({id:"foreign-invalid",error:[failure.name,failure.errorID],events:State.events.concat()});}
var deferredPeer:DeferredPeer=new DeferredPeer();initializationRows.push({id:"foreign-construction",events:State.events.concat()});
result=deferred.accept(deferredPeer);initializationRows.push({id:"foreign-genuine",same:result===deferredPeer,events:State.events.concat()});
var x:ForeignLocals=new ForeignLocals(),q:QualifiedLocals=new QualifiedLocals(),same:SamePackage=new SamePackage(),peer:foreign.Peer=new foreign.Peer(),child:Child=new Child(),otherPeer:other.Peer=new other.Peer(),companion:Companion=new Companion(),a:A=new A(),b:B=new B();
var rows=[],events=[],token={token:true};
function encode(value:*):* {if(value===undefined)return {kind:"undefined"};if(value===null)return {kind:"null"};if(value===peer)return {kind:"peer"};if(value===child)return {kind:"child"};if(value===otherPeer)return {kind:"other-peer"};if(value===x)return {kind:"self"};if(value===companion)return {kind:"companion"};if(value===a)return {kind:"A"};if(value===b)return {kind:"B"};if(value is Array){var out=[];for(var i:int=0;i<value.length;i++)out.push(encode(value[i]));return out;}return value;}
function errorValue(e:*):* {return [e.name,e.errorID];}
var observer={error:errorValue};
function row(id:String,target:*,name:String,args:Array):void {events=[];try{rows.push({id:id,value:encode(target[name].apply(target,args)),events:events});}catch(e:*){rows.push({id:id,error:errorValue(e),sameThrow:e===token,events:events});}}
row("default",x,"empty",[]);
var values=[peer,child,null,undefined,otherPeer,{},3,"peer",foreign.Peer];var names=["peer","child","null","undefined","other-peer","plain","number","string","Class"];
for(var n:int=0;n<values.length;n++)row("init-"+names[n],x,"initialize",[values[n]]);
row("assign-peer",x,"assignment",[null,peer]);row("assign-undefined",x,"assignment",[peer,undefined]);row("chain-undefined",x,"chain",[peer,undefined]);row("assign-null",x,"assignment",[peer,null]);
row("failed-write",x,"failure",[peer,otherPeer,observer]);row("failed-init",x,"failedInit",[otherPeer,observer]);
var bad:Object={};bad.valueOf=function():* {events.push("valueOf");throw token;};bad.toString=function():String {events.push("toString");throw token;};row("incompatible-no-hooks",x,"failure",[peer,bad,observer]);
var box={next:function():* {events.push("rhs");return peer;}};row("rhs-once",x,"expression",[box]);box.next=function():* {events.push("rhs");return otherPeer;};row("bad-rhs-once",x,"expression",[box]);box.next=function():* {events.push("rhs-throw");throw token;};row("rhs-throw",x,"expression",[box]);
row("self-valid",x,"self",[x]);row("self-wrong",x,"self",[peer]);
row("qualified-valid",q,"qualified",[otherPeer]);row("qualified-wrong-import",q,"qualified",[peer]);row("import-valid",q,"imported",[peer]);row("import-wrong-qualified",q,"imported",[otherPeer]);
row("same-package",same,"accept",[companion]);row("same-package-wrong",same,"accept",[peer]);
row("cycle-A-default",a,"empty",[]);row("cycle-B-default",b,"empty",[]);row("cycle-A-B",a,"accept",[b]);row("cycle-B-A",b,"accept",[a]);row("cycle-A-wrong",a,"accept",[a]);
var errorRows=[];
function captureFailure(value:*):* {try{x.initialize(value);}catch(e:*){return e;}return null;}
function fields(e:*):* {return [e.name,e.message,e.errorID];}
var referenceError:*=captureFailure(otherPeer);errorRows.push({id:"foreign-instance-fields",value:fields(referenceError)});
errorRows.push({id:"plain-fields",value:fields(captureFailure({}))});errorRows.push({id:"number-fields",value:fields(captureFailure(3))});errorRows.push({id:"Class-fields",value:fields(captureFailure(foreign.Peer))});
var priorError:*=referenceError;errorRows.push({id:"fresh-failure-identity",value:captureFailure(otherPeer)!==priorError});
referenceError.name=17;referenceError.message=null;errorRows.push({id:"wildcard-fields",value:fields(referenceError)});
errorRows.push({id:"delete-fixed",value:[delete referenceError.name,delete referenceError.message,delete referenceError.errorID]});
try{referenceError.errorID=9;}catch(readonlyError:*){errorRows.push({id:"readonly-id-error",value:fields(readonlyError)});}
errorRows.push({id:"readonly-id-retained",value:referenceError.errorID});referenceError.extra="slot";errorRows.push({id:"dynamic-slot",value:[referenceError.extra,delete referenceError.extra,referenceError.extra===undefined]});
var seen:*=null;var watcher={seen:function(e:*):* {seen=e;}};try{x.catchRethrow(otherPeer,watcher);}catch(rethrown:*){errorRows.push({id:"rethrow-same-caught-object",value:seen===rethrown,fields:fields(rethrown)});}
var savedName:*=TypeError.prototype.name;TypeError.prototype.name="ChangedTypeError";var changedError:*=captureFailure(otherPeer);TypeError.prototype.name=savedName;errorRows.push({id:"prototype-name-snapshot",value:fields(changedError)});
events=[];var failureHook:Object={};failureHook.valueOf=function():*{events.push("valueOf");throw token;};failureHook.toString=function():*{events.push("toString");throw token;};var hookFailure:*=captureFailure(failureHook);errorRows.push({id:"failure-no-conversion-hooks",value:fields(hookFailure),events:events});
var preservedThrown:*=null;box.next=function():*{throw token;};try{x.expression(box);}catch(expressionThrown:*){preservedThrown=expressionThrown;}errorRows.push({id:"rhs-thrown-identity-not-replaced",value:preservedThrown===token});
var classes=[ForeignLocals,QualifiedLocals,SamePackage,Companion,foreign.Peer,Child,other.Peer,A,B,State,DeferredPeer,DeferredHolder],instances=[x,q,same,companion,peer,child,otherPeer,a,b,new State(),deferredPeer,deferred],reflection=[],instanceXML=[];
for(n=0;n<classes.length;n++){reflection.push(describeType(classes[n]).toXMLString());instanceXML.push(describeType(instances[n]).toXMLString());}
var output={rows:rows,errorRows:errorRows,initializationRows:initializationRows,reflection:reflection,instances:instanceXML};ExternalInterface.addCallback("snapshot",function():String{return encodeURIComponent(JSON.stringify(output));});
}}}
