const nc=load('nativeClass'),klass=name=>nc.readNativeClass(load(name)[name]);
const Consumer=klass('Consumer'),Implementation=klass('Implementation'),Child=klass('Child'),Lookalike=klass('Lookalike'),Trace=klass('Trace');
var rows=[],c=new Consumer(),values=[new Implementation(),new Child(),new Lookalike(),null,undefined,"throw"],labels=["good","child","lookalike","null","undefined","throw"];
var numeric=api.as3CreateObjectLiteral([['valueOf',function(){Trace.events.push("coerce");return 3.9;}] ]);
for(var method of ["run","inherited","zero"]){for(var i=0;i<values.length;i++){
 Trace.events.length=0;try{var result=method==="zero"?c.zero(values[i]):c[method](values[i],numeric);rows.push({id:method+":"+labels[i],value:[["ok",result],Trace.events.slice()]});}
 catch(e){rows.push({id:method+":"+labels[i],value:[[e.name,e.errorID,e.errorID===0?e.message:""],Trace.events.slice()]});}
}}
for(i=0;i<values.length;i++){
 Trace.events.length=0;try{result=c.run(values[i],"throw");rows.push({id:"argument-throw:"+labels[i],value:[["ok",result],Trace.events.slice()]});}
 catch(e){rows.push({id:"argument-throw:"+labels[i],value:[[e.name,e.errorID,e.errorID===0?e.message:""],Trace.events.slice()]});}
}
for(var value of [values[0],null]) {var index=0;for(var input of [[numeric,numeric],[numeric,"throw"],["throw",numeric]]) {
 Trace.events.length=0;try{result=c.pair(value,input[0],input[1]);rows.push({id:"pair:"+(value===null?"null":"good")+":"+index,value:[["ok",result],Trace.events.slice()]});}
 catch(e){rows.push({id:"pair:"+(value===null?"null":"good")+":"+index,value:[[e.name,e.errorID,e.errorID===0?e.message:""],Trace.events.slice()]});}index++;
}}
Trace.events.length=0;try{result=c.field(numeric);rows.push({id:"field-default",value:[["ok",result],Trace.events.slice()]});}
catch(e){rows.push({id:"field-default",value:[[e.name,e.errorID,e.errorID===0?e.message:""],Trace.events.slice()]});}
for(method of ["field","fieldZero"]){for(i=0;i<values.length;i++){
 Trace.events.length=0;try{c.store(values[i]);result=method==="field"?c.field(numeric):c.fieldZero();rows.push({id:method+":"+labels[i],value:[["ok",result],Trace.events.slice()]});}
 catch(e){rows.push({id:method+":"+labels[i],value:[[e.name,e.errorID,e.errorID===0?e.message:""],Trace.events.slice()]});}
}}
c.store(null);Trace.events.length=0;try{result=c.field("throw");rows.push({id:"field-argument-throw",value:[["ok",result],Trace.events.slice()]});}
catch(e){rows.push({id:"field-argument-throw",value:[[e.name,e.errorID,e.errorID===0?e.message:""],Trace.events.slice()]});}
globalThis.result=rows;
