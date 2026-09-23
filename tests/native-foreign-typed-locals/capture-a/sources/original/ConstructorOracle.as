package {import flash.display.Sprite;import flash.external.ExternalInterface;import flash.utils.describeType;
import refs.Entry;import refs.Peer;import elsewhere.Peer;import refs.Companion;import refs.Qualified;import refs.SamePackage;import refs.cycle.Left;import refs.cycle.Right;import refs.State;import refs.DeferredPeer;import refs.DeferredHolder;
public class ConstructorOracle extends Sprite {public function ConstructorOracle(){
var initializationRows=[];initializationRows.push({id:"entry",events:State.events.concat()});
var holder:DeferredHolder=new DeferredHolder();initializationRows.push({id:"holder",events:State.events.concat()});
var result:*=holder.empty();initializationRows.push({id:"default",isNull:result===null,events:State.events.concat()});
result=holder.accept(undefined);initializationRows.push({id:"undefined",isNull:result===null,events:State.events.concat()});
try{holder.accept({});}catch(e:*){initializationRows.push({id:"invalid",error:[e.name,e.errorID],events:State.events.concat()});}
var deferred:DeferredPeer=new DeferredPeer();initializationRows.push({id:"construction",events:State.events.concat()});
result=holder.accept(deferred);initializationRows.push({id:"genuine",same:result===deferred,events:State.events.concat()});
var x:Entry=new Entry(),q:Qualified=new Qualified(),same:SamePackage=new SamePackage(),peer:refs.Peer=new refs.Peer(),other:elsewhere.Peer=new elsewhere.Peer(),companion:Companion=new Companion(),left:Left=new Left(),right:Right=new Right();
var rows=[],events=[],token={token:true};
function encode(value:*):*{if(value===undefined)return {kind:"undefined"};if(value===null)return {kind:"null"};if(value===peer)return {kind:"peer"};if(value===other)return {kind:"other"};if(value===x)return {kind:"self"};if(value===companion)return {kind:"companion"};if(value===left)return {kind:"left"};if(value===right)return {kind:"right"};if(value is Array){var out=[];for(var i:int=0;i<value.length;i++)out.push(encode(value[i]));return out;}return value;}
function errorValue(e:*):*{return [e.name,e.errorID];}
var observer={error:errorValue};
function row(id:String,target:*,name:String,args:Array):void{events=[];try{rows.push({id:id,value:encode(target[name].apply(target,args)),events:events});}catch(e:*){rows.push({id:id,error:errorValue(e),sameThrow:e===token,events:events});}}
row("default",x,"empty",[]);
var inputs=[peer,null,undefined,other,{},3,"peer",refs.Peer],labels=["peer","null","undefined","other","plain","number","string","Class"];
for(var n:int=0;n<inputs.length;n++)row("init-"+labels[n],x,"initialize",[inputs[n]]);
row("store-peer",x,"store",[null,peer]);row("store-undefined",x,"store",[peer,undefined]);row("store-null",x,"store",[peer,null]);row("chain-undefined",x,"chain",[peer,undefined]);row("chain-peer",x,"chain",[null,peer]);
row("failed-write",x,"failure",[peer,other,observer]);row("failed-init",x,"failedInit",[other,observer]);
var bad:Object={};bad.valueOf=function():*{events.push("valueOf");throw token;};bad.toString=function():String{events.push("toString");throw token;};row("no-hooks",x,"failure",[peer,bad,observer]);
var box={next:function():*{events.push("rhs");return peer;}};row("rhs-once",x,"expression",[box]);box.next=function():*{events.push("rhs");return other;};row("rhs-invalid",x,"expression",[box]);box.next=function():*{events.push("rhs-throw");throw token;};row("rhs-throw",x,"expression",[box]);
row("self",x,"self",[x]);row("self-invalid",x,"self",[peer]);row("qualified-own",q,"own",[peer]);row("qualified-other",q,"other",[other]);row("qualified-own-invalid",q,"own",[other]);row("qualified-other-invalid",q,"other",[peer]);row("qualified-split",q,"split",[peer,other]);
row("same-package",same,"accept",[companion]);row("same-package-invalid",same,"accept",[peer]);row("left-default",left,"empty",[]);row("right-default",right,"empty",[]);row("left-right",left,"accept",[right]);row("right-left",right,"accept",[left]);row("left-invalid",left,"accept",[left]);
row("skipped-default",x,"skipped",[false]);row("entered-default",x,"skipped",[true]);row("repeated-preserves-value",x,"repeated",[peer]);row("before-declaration-default",x,"readBeforeDeclaration",[]);
var errorRows=[];function failure(v:*):*{try{x.initialize(v);}catch(e:*){return e;}return null;}function fields(e:*):*{return [e.name,e.message,e.errorID];}
var failureValue:*=failure(other);errorRows.push({id:"fields",value:fields(failureValue)});errorRows.push({id:"fresh",value:failure(other)!==failureValue});failureValue.name=17;failureValue.message=null;errorRows.push({id:"wildcard",value:fields(failureValue)});errorRows.push({id:"delete-fixed",value:[delete failureValue.name,delete failureValue.message,delete failureValue.errorID]});
try{failureValue.errorID=9;}catch(ro:*){errorRows.push({id:"readonly",value:fields(ro)});}errorRows.push({id:"id-retained",value:failureValue.errorID});failureValue.extra="slot";errorRows.push({id:"dynamic",value:[failureValue.extra,delete failureValue.extra,failureValue.extra===undefined]});
var seen:*=null;try{x.catchRethrow(other,{seen:function(e:*):*{seen=e;}});}catch(re:*){errorRows.push({id:"rethrow",same:seen===re,value:fields(re)});}
var old:*=TypeError.prototype.name;TypeError.prototype.name="Changed";var changed:*=failure(other);TypeError.prototype.name=old;errorRows.push({id:"snapshot",value:fields(changed)});
var classes=[Entry,refs.Peer,elsewhere.Peer,Companion,Qualified,SamePackage,Left,Right,State,DeferredPeer,DeferredHolder],objects=[x,peer,other,companion,q,same,left,right,new State(),deferred,holder],reflection=[],instances=[];
for(n=0;n<classes.length;n++){reflection.push(describeType(classes[n]).toXMLString());instances.push(describeType(objects[n]).toXMLString());}
var output={rows:rows,initializationRows:initializationRows,errorRows:errorRows,reflection:reflection,instances:instances};ExternalInterface.addCallback("snapshot",function():String{return encodeURIComponent(JSON.stringify(output));});
}}}
