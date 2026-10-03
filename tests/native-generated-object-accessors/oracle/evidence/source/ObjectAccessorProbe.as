package {import cases.*;import flash.utils.describeType;public class ObjectAccessorProbe {
 public function snapshot():Object {
 var rows:Array=[],base:ReadBase=new ReadBase(),child:ReadChild=new ReadChild(),grand:ReadGrand=new ReadGrand(),writer:WriteChild=new WriteChild(),pair:PairChild=new PairChild(),dyn:*;
 rows.push({id:"initial",value:[base.value===null,child.value===null,grand.value===null,writer.value===null,pair.value===null]});
 var token:Object={label:"first"};child.value=token;rows.push({id:"new-setter",value:[child.value===token,child.throughBase()===token,child.stored===token,child.writes]});
 grand.value=token;rows.push({id:"inherited-new-setter",value:[grand.value===token,grand.throughBase()===token,grand.writes]});
 writer.value=token;rows.push({id:"new-getter",value:[writer.value===token,writer.stored===token,writer.writes]});
 var typed:WriteBase=writer;typed.throughBase(null);rows.push({id:"virtual-setter",value:[writer.value===null,writer.writes]});
 pair.value=token;rows.push({id:"pair-override",value:[pair.value===token,pair.writes]});
 var parent:PairBase=pair;rows.push({id:"pair-base-virtual",value:[parent.throughBase(token)===token,pair.writes]});
 var inputs:Array=[null,undefined,7,true,NaN,{},[],["a","b"],"text",function():void{}],item:*,result:*,stored:*;dyn=child;
 for(var i:int=0;i<inputs.length;i++){item=inputs[i];result=(dyn["value"]=item);stored=child.value;rows.push({id:"dynamic-"+i,value:[stored===null,stored===item,typeof stored,child.writes,result===item,result!==result]});}
 var calls:int=0;item={toString:function():String{calls++;throw new Error("must not convert",73);},valueOf:function():Object{calls++;return null;}};result=(dyn["value"]=item);rows.push({id:"no-conversion",value:[child.value===item,child.writes,calls,result===item]});
 dyn[new QName("","value")]=token;rows.push({id:"qname",value:[child.value===token,child.writes]});
 dyn=base;var error:String="none";try{dyn["value"]=token;}catch(e1:Error){error=e1.name+":"+e1.errorID;}rows.push({id:"base-remains-readonly",value:[error,base.value===null]});
 dyn=new WriteBase();error="none";try{var ignored:*=dyn["value"];}catch(e2:Error){error=e2.name+":"+e2.errorID;}rows.push({id:"base-remains-writeonly",value:[error]});
 for each(var subject:Object in [base,child,grand,new WriteBase(),writer,new PairBase(),pair]){var desc:XML=describeType(subject);for each(var member:XML in desc.accessor){if(member.@name=="value")rows.push({id:"reflection-"+desc.@name,value:[member.@type.toString(),member.@access.toString(),member.@declaredBy.toString()]});}}
 return {ready:true,failure:"",observations:rows};
 }}}
