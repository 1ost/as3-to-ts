package {import flash.display.Sprite;import flash.external.ExternalInterface;import probe.*;import com.greensock.core.PropTween;
public class ConstructorOracle extends Sprite {public function ConstructorOracle(){
var rows:Array=[];function rec(id:String,f:Function):void{Journal.events=[];try{rows.push({id:id,value:f(),events:Journal.events.concat()});}catch(e:Error){rows.push({id:id,error:{name:e.name,errorID:e.errorID},events:Journal.events.concat()});}}
function arg(label:String,v:*):*{Journal.add('arg:'+label);return v;}
function hook(label:String,kind:String):Object{return {toString:function():*{Journal.add(label+':toString');if(kind=='throw')throw new Error('hook',7001);if(kind=='object')return {};if(kind=='null')return null;if(kind=='undefined')return undefined;return label;},valueOf:function():*{Journal.add(label+':valueOf');return kind=='object'?{}:17;}};}
var C:Class=StringPair;var O:Class=OptionalString;var S:Class=SelfNode;var P:Class=PropTween;
rec('string-required-missing',function():*{new C();return 'body-return';});
rec('string-default',function():*{var x:*=new C(arg('a','x'));return [x.first,x.second];});
rec('string-null',function():*{var x:*=new C(arg('a',null),arg('b',null));return [x.first,x.second];});
rec('string-undefined',function():*{var x:*=new C(arg('a',undefined),arg('b',undefined));return [x.first,x.second];});
rec('string-scalars',function():*{var x:*=new C(arg('a',123),arg('b',true));return [x.first,x.second];});
rec('string-hooks-order',function():*{var x:*=new C(arg('a',hook('a','string')),arg('b',hook('b','string')));return [x.first,x.second];});
rec('string-hook-null',function():*{var x:*=new C(hook('a','null'));return [x.first,x.second];});
rec('string-hook-undefined',function():*{var x:*=new C(hook('a','undefined'));return [x.first,x.second];});
rec('string-hook-object',function():*{new C(arg('a',hook('a','object')),arg('b',hook('b','string')));return 'body-return';});
rec('string-hook-throw',function():*{new C(arg('a',hook('a','throw')),arg('b',hook('b','string')));return 'body-return';});
rec('string-too-many',function():*{new C(arg('a',hook('a','string')),arg('b',hook('b','string')),arg('extra',3));return 'body-return';});
rec('optional-missing',function():*{return (new O()).value;});rec('optional-undefined',function():*{return (new O(undefined)).value;});rec('optional-null',function():*{return (new O(null)).value;});
var node:SelfNode=new SelfNode();var child:SelfChild=new SelfChild();
rec('self-missing',function():*{return (new S()).next===null;});rec('self-undefined',function():*{return (new S(arg('v',undefined))).next===null;});rec('self-null',function():*{return (new S(arg('v',null))).next===null;});
rec('self-exact',function():*{return (new S(arg('v',node))).next===node;});rec('self-child',function():*{return (new S(arg('v',child))).next===child;});
rec('self-object',function():*{new S(arg('v',hook('bad','throw')));return 'body-return';});rec('self-number',function():*{new S(arg('v',1));return 'body-return';});rec('self-class',function():*{new S(arg('v',SelfNode));return 'body-return';});
rec('self-too-many',function():*{new S(arg('v',hook('bad','throw')),arg('extra',2));return 'body-return';});
rec('child-self',function():*{return (new SelfChild(node)).next===node;});
var old:PropTween=new PropTween({},'x',0,1,'x',false);
rec('actual-six',function():*{var x:*=new P({},'x',1,2,'n',false);return [x.property,x.name,x.priority,x.nextNode===null];});
rec('actual-eight-links',function():*{var x:*=new P({},arg('property',hook('p','string')),1,2,arg('name',hook('n','string')),false,arg('next',old),arg('priority',3));return [x.property,x.name,x.priority,x.nextNode===old,old.prevNode===x];});
rec('actual-undefined',function():*{var x:*=new P({},undefined,1,2,undefined,false,undefined);return [x.property,x.name,x.nextNode===null];});
rec('actual-null',function():*{var x:*=new P({},null,1,2,null,false,null);return [x.property,x.name,x.nextNode===null];});
rec('actual-wrong-self',function():*{new P({},arg('property',hook('p','string')),1,2,arg('name',hook('n','string')),false,arg('next',hook('bad','throw')));return 'body-return';});
rec('actual-self-Class',function():*{new P({},'x',1,2,'n',false,PropTween);return 'body-return';});
rec('actual-too-few',function():*{new P({},arg('property',hook('p','string')),1,2,arg('name',hook('n','string')));return 'body-return';});
rec('actual-too-many',function():*{new P({},arg('property',hook('p','string')),1,2,arg('name',hook('n','string')),false,null,0,arg('extra',9));return 'body-return';});
ExternalInterface.addCallback('snapshot',function():String{return encodeURIComponent(JSON.stringify({rows:rows}));});
}}}
