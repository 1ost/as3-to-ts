const rows=[];const a=new OpenNamespace(),b=new OpenNamespace(7);function rec(id,f){try{rows.push({id,value:f()});}catch(e){rows.push({id,error:{name:e.name,errorID:e.errorID}});}}
rec("constructor",function(){return a.read();});
rec("second",function(){return b.read();});
rec("negative",function(){return a.write(-1.75);});
rec("overflow",function(){return a.write(4294967297);});
rec("compound",function(){return a.add(2.8);});
rec("alias",function(){return a.same();});
rec("closure-identity",function(){return a.take()===a.take();});
rec("closure-different",function(){return a.take()!==b.take();});
const method=a.take();
rec("detached",function(){return method(2);});
rec("borrowed",function(){return method.call(b,4);});
rec("final-first",function(){return a.read();});
rec("final-second",function(){return b.read();});
globalThis.result={rows};
