const nc=load('nativeClass'),klass=name=>nc.readNativeClass(load(name)[name]);
const rows=[],c=new (consumerOnly?load('Consumer').Consumer:klass('Consumer'))(),Trace=klass('Trace');
const check=(id,value)=>{const root=c.rootAs(value),leaf=c.leafAs(value);return {id,value:[c.rootIs(value),c.leafIs(value),root===value,leaf===value,root===null,leaf===null,c.entries]};};
rows.push({id:'initial',value:Trace.events.concat()});rows.push(check('before-null',null));rows.push({id:'before-construction',value:Trace.events.concat()});
const Implementation=klass('Implementation'),base=new Implementation(),child=new (klass('Child'))();
rows.push({id:'construction',value:Trace.events.concat()});
const IRoot=load('declarationDomain')[declarationInterfaces.find(i=>i.qname==='contracts.IRoot').tokenExport];
const inputs=[base,child,new (klass('Lookalike'))(),null,undefined,7,NaN,true,'text',[],{},Implementation,IRoot];
const labels=['exact','inherited','lookalike','null','undefined','number','nan','boolean','string','array','object','class','interface'];
inputs.forEach((value,i)=>rows.push(check(labels[i],value)));
let calls=0;const object={valueOf(){calls++;return base;},toString(){calls++;return base;}};
rows.push(check('hooks',object));rows.push({id:'hook-calls',value:calls});
for(const op of ['Is','As']){try{c['root'+op]('throw');rows.push({id:'throw-'+op.toLowerCase(),value:'not-thrown'});}catch(e){if(!api.as3IsSourceErrorInstance(e))throw e;rows.push({id:'throw-'+op.toLowerCase(),value:[api.as3GetProperty(e,'message')==='throw',c.entries]});}}
const receivers=[base,child,new (klass('Lookalike'))(),null,undefined,'throw'],argumentsList=[4.9,undefined,'throw'];
for(const method of ['call','read','write'])for(let r=0;r<receivers.length;r++)for(let a=0;a<(method==='read'?1:argumentsList.length);a++){
 const id=method+':'+r+':'+a;c.entries=0;
 try{const result=method==='call'?c.call(receivers[r],argumentsList[a]):method==='read'?c.read(receivers[r]):c.write(receivers[r],argumentsList[a]);rows.push({id,value:['ok',typeof result,result===undefined?null:result,c.entries]});}
 catch(e){rows.push({id,value:[e.name,e.errorID,e.errorID===0?e.message:'',c.entries]});}
}
rows.push({id:'final-events' ,value:Trace.events.concat()});globalThis.result=rows;
