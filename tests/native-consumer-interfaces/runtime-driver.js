const nc=load('nativeClass'),Consumer=load('Consumer').Consumer,Value=nc.readNativeClass(load('Value').Value),Child=nc.readNativeClass(load('Child').Child),Lookalike=nc.readNativeClass(load('Lookalike').Lookalike);
var rows=[],c=new Consumer(),good=new Value(),child=new Child(),bad=new Lookalike();
var values=[good,child,null,undefined,bad,api.as3CreateObjectLiteral([['value',function(){return 7;}]]),17];
var labels=["value","child","null","undefined","lookalike","structural","number"];
for(var method of ["required","optional","returned","child","local"]){
 for(var i=0;i<values.length;i++){
  try{var result=c[method](values[i]);rows.push({id:method+":"+labels[i],value:["ok",result===values[i],result===null]});}
  catch(e){rows.push({id:method+":"+labels[i],value:[e.name,e.errorID]});}
 }
}
for(method of ["required","optional","args"]){
 for(var input of [[],[good],[undefined],[good,child]]){
  try{result=c[method].apply(c,input);rows.push({id:method+":arity:"+input.length+":"+(input[0]===undefined),value:method==="args"?result:["ok",result===good,result===null]});}
  catch(e){rows.push({id:method+":arity:"+input.length+":"+(input[0]===undefined),value:[e.name,e.errorID]});}
 }
}
rows.push({id:"defaults",value:c.defaults()});
for(method of ["assigned","chained"]){
 for(i=0;i<values.length;i++)rows.push({id:method+":"+labels[i],value:c[method](good,values[i])});
}
var events=[],numeric=api.as3CreateObjectLiteral([['valueOf',function(){events.push("coerce");return 3.9;}]]);
for(method of ["mixed","reverse"]){
 for(var reference of [good,bad,undefined]){
  events.length=0;
  try{result=method==="mixed"?c.mixed(reference,numeric):c.reverse(numeric,reference);rows.push({id:method+":"+(reference===good?"good":reference===bad?"bad":"undefined"),value:[result,events.slice()]});}
  catch(e){rows.push({id:method+":bad",value:[[e.name,e.errorID],events.slice()]});}
 }
}
for(i=0;i<values.length;i++){
 events.length=0;
 try{result=c.returnedAfter(values[i],function(){events.push("body");});rows.push({id:"return-order:"+labels[i],value:[["ok",result===values[i],result===null],events.slice()]});}
 catch(e){rows.push({id:"return-order:"+labels[i],value:[[e.name,e.errorID],events.slice()]});}
}
globalThis.result=rows;
