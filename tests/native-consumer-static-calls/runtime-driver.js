const nc=load('nativeClass'),Trace=nc.readNativeClass(load('Trace').Trace);
const consumer=new (load('Consumer').Consumer)(),rows=[];
rows.push({id:'lazy',value:Trace.events.slice()});
const numeric=api.as3CreateObjectLiteral([['valueOf',function(){Trace.events.push('coerce');return 3.9;}]]);
rows.push({id:'call',value:consumer.call(numeric)});
rows.push({id:'order',value:Trace.events.slice()});
Trace.events.length=0;
rows.push({id:'repeat',value:consumer.call(-2.9)});
rows.push({id:'repeat-order',value:Trace.events.slice()});
const payload=api.as3CreateObjectLiteral([]);
rows.push({id:'identity',value:consumer.echo(payload)===payload});
rows.push({id:'undefined',value:consumer.echo(undefined)===undefined});
rows.push({id:'null',value:consumer.echo(null)===null});
Trace.events.length=0;
try{consumer.reject(payload);}catch(error){rows.push({id:'throw',value:error===payload});}
rows.push({id:'throw-order',value:Trace.events.slice()});
rows.push({id:'shadow',value:consumer.shadow(api.as3CreateObjectLiteral([['call',function(value){return 'shadow:'+value;}]]),5)});
Trace.events.length=0;
try{consumer.retry(9);}catch(failure){rows.push({id:'initialization-failure',value:failure});}
rows.push({id:'failure-order',value:Trace.events.slice()});
Trace.fail=false;Trace.events.length=0;
rows.push({id:'retry',value:consumer.retry(9)});
rows.push({id:'retry-order',value:Trace.events.slice()});
globalThis.result=rows;
