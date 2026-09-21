const P=modules.get('AS3MethodBinding'),C=modules.get('nativeClass').readNativeClass(modules.get('RelationalReview').RelationalReview),x=P.as3ConstructValue(C,()=>[]);
var events=[],rows=[],token={marker:"source-token"};
function encode(value){if(value===undefined)return {type:"undefined"};if(value===null)return {type:"null"};if(typeof value==="number"){if(value!==value)return {type:"number",value:"NaN"};if(value===0)return {type:"number",value:1/value<0?"-0":"+0"};return {type:"number",value:value};}return {type:typeof value,value:value};}
function dynamic(){return P.as3CreateDynamicObject();}
function put(target,name,value){P.as3SetProperty(target,name,value);}
function hook(label,result,text){var o=dynamic();put(o,"valueOf",function(){events.push(label+":valueOf");return result;});put(o,"toString",function(){events.push(label+":toString");return text;});return o;}
function box(mode){var l=hook("left",null,"11"),r=hook("right",null,"2"),b=dynamic();
 if(mode==="throw-left")put(l,"valueOf",function(){events.push("left:throw");throw token;});
 if(mode==="throw-right")put(r,"valueOf",function(){events.push("right:throw");throw token;});
 if(mode==="live-right")put(l,"valueOf",function(){events.push("left:change-right");put(r,"valueOf",function(){events.push("right:new-valueOf");return "20";});return "11";});
 if(mode==="live-fallback")put(l,"valueOf",function(){events.push("left:change-fallback");put(l,"toString",function(){events.push("left:new-toString");return "1";});return null;});
 put(b,"left",function(){events.push("expr:left");return l;});
 put(b,"right",function(){events.push("expr:right");if(mode==="throw-rhs"){events.push("rhs:throw");throw token;}if(mode==="rhs-change-left")put(l,"valueOf",function(){events.push("left:rhs-new-valueOf");return "3";});return r;});
 return b;
}
function invoke(name,args){return P.as3CallProperty(x,name,()=>args);}
function row(id,name,args,inputs){events=[];try{var value=invoke(name,args);rows.push({id:id,value:value,valueType:typeof value,events:events.concat(),inputs:inputs});}catch(e){rows.push({id:id,thrownSame:e===token,events:events.concat(),inputs:inputs});}}
var pairs=[['strings-11-2','11','2'],['string-number','11',2],['number-string',11,'2'],['empty-number','',0],['nan-left',NaN,0],['nan-right',0,NaN],['undefined-left',undefined,0],['undefined-right',0,undefined],['null-number',null,0],['negative-positive-zero',-0.0,0.0],['positive-negative-zero',0.0,-0.0],['boolean-string',true,'1']];
var names=['lt','le','gt','ge'];
for(var i=0;i<pairs.length;i++){for(var j=0;j<names.length;j++){var p=pairs[i],name=names[j];row(p[0]+'-'+name,name,[p[1],p[2]],[encode(p[1]),encode(p[2])]);}}
for(j=0;j<names.length;j++){name=names[j];row('null-hooks-'+name,name,[hook('left',null,'11'),hook('right',null,'2')],[{type:'source-object',valueOf:'null',toString:'11'},{type:'source-object',valueOf:'null',toString:'2'}]);row('order-'+name,name+'Order',[box('normal')],[]);}
for(j=0;j<names.length;j++){name=names[j];row('string-left-hook-'+name,name,['11',hook('right',null,'2')],[encode('11'),{type:'source-object',valueOf:'null',toString:'2'}]);row('hook-left-string-'+name,name,[hook('left',null,'11'),'2'],[{type:'source-object',valueOf:'null',toString:'11'},encode('2')]);}
var modes=['throw-left','throw-right','throw-rhs','rhs-change-left','live-right','live-fallback'];var orderedNames=['gt','le'];
for(i=0;i<modes.length;i++){for(j=0;j<orderedNames.length;j++){name=orderedNames[j];row(modes[i]+'-'+name,name+'Order',[box(modes[i])],[]);}}
globalThis.result=rows;