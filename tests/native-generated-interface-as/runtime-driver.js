// Separate observer; complete AS3 subjects remain unchanged.
const nc=load("nativeClass"),klass=name=>nc.readNativeClass(load(name)[name]);
const rows=[],c=new (klass('Consumer'))();
const Trace=klass('Trace');
rows.push({id:'initial',value:Trace.events.concat()});
rows.push({id:'null',value:[c.root(null)===null,c.entries,Trace.events.concat()]});
rows.push({id:'undefined',value:[c.leaf(undefined)===null,c.entries,Trace.events.concat()]});
rows.push({id:'lookalike',value:[c.root(new (klass('Lookalike'))())===null,c.entries,Trace.events.concat()]});
const Implementation=klass('Implementation'),base=new Implementation();
rows.push({id:'first-construction',value:Trace.events.concat()});
const child=new (klass('Child'))();
rows.push({id:'child-construction',value:Trace.events.concat()});
rows.push({id:'exact',value:[c.root(base)===base,c.left(base)===base,c.right(base)===base,c.leaf(base)===base,c.entries]});
rows.push({id:'inherited',value:[c.root(child)===child,c.left(child)===child,c.right(child)===child,c.leaf(child)===child,c.entries]});
const IRoot=load('declarationDomain')[declarationInterfaces.find(i=>i.qname==='contracts.IRoot').tokenExport];
const inputs=[null,undefined,7,NaN,true,'text',[],{},Implementation,IRoot];
const labels=['null','undefined','number','nan','boolean','string','array','object','class','interface'];
for(let i=0;i<inputs.length;i++)rows.push({id:'reject-'+labels[i],value:[c.root(inputs[i])===null,c.leaf(inputs[i])===null,c.entries]});
let calls=0;const object={valueOf(){calls++;return base;},toString(){calls++;return base;}};
rows.push({id:'no-conversion-hooks',value:[c.root(object)===null,calls,c.entries]});
try{c.root('throw');rows.push({id:'throw',value:'not-thrown'});}catch(e){if(!api.as3IsSourceErrorInstance(e))throw e;rows.push({id:'throw',value:[api.as3GetProperty(e,'message')==='throw',c.entries]});}
rows.push({id:'single-evaluation',value:Trace.events.concat()});
globalThis.result=rows;
